import os
import json
import uuid
import tempfile
import fnmatch
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Body
from celery import current_task
from celery.schedules import crontab

from ..auth import get_current_user
from ..models import User as UserModel
from ..celery_app import celery_app
from .models import WatchFolderConfig, WatchFolderStatus, ProcessedFile, ExtractionMethod
from .tasks import process_single_file_api

router = APIRouter()

# In-memory storage for watch folders (use database in production)
watch_folders = {}
processed_files_log = {}


class CloudStorageAdapter:
    """Base adapter for cloud storage services"""
    
    def __init__(self, credentials: Dict[str, str]):
        self.credentials = credentials
    
    def list_files(self, folder_path: str, file_patterns: List[str] = None) -> List[Dict[str, Any]]:
        """List files in the folder matching patterns"""
        raise NotImplementedError
    
    def download_file(self, file_path: str, local_path: str) -> str:
        """Download file to local path"""
        raise NotImplementedError
    
    def delete_file(self, file_path: str) -> bool:
        """Delete file from cloud storage"""
        raise NotImplementedError


class S3Adapter(CloudStorageAdapter):
    """AWS S3 storage adapter"""
    
    def __init__(self, credentials: Dict[str, str]):
        super().__init__(credentials)
        try:
            import boto3
            self.client = boto3.client(
                's3',
                aws_access_key_id=credentials.get('aws_access_key_id'),
                aws_secret_access_key=credentials.get('aws_secret_access_key'),
                region_name=credentials.get('region', 'us-east-1')
            )
            self.bucket_name = credentials.get('bucket_name')
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="boto3 is required for S3 integration. Install with: pip install boto3"
            )
    
    def list_files(self, folder_path: str, file_patterns: List[str] = None) -> List[Dict[str, Any]]:
        """List files in S3 bucket folder"""
        try:
            # Remove leading slash if present
            prefix = folder_path.lstrip('/')
            if not prefix.endswith('/') and prefix:
                prefix += '/'
            
            response = self.client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            files = []
            for obj in response.get('Contents', []):
                file_path = obj['Key']
                file_name = os.path.basename(file_path)
                
                # Skip directories
                if file_path.endswith('/'):
                    continue
                
                # Apply file patterns
                if file_patterns:
                    matches = any(fnmatch.fnmatch(file_name.lower(), pattern.lower()) 
                                for pattern in file_patterns)
                    if not matches:
                        continue
                
                files.append({
                    'file_path': file_path,
                    'file_name': file_name,
                    'size': obj['Size'],
                    'modified_at': obj['LastModified'].isoformat(),
                    'etag': obj['ETag'].strip('"')
                })
            
            return files
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error listing S3 files: {str(e)}"
            )
    
    def download_file(self, file_path: str, local_path: str) -> str:
        """Download file from S3"""
        try:
            self.client.download_file(self.bucket_name, file_path, local_path)
            return local_path
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error downloading S3 file: {str(e)}"
            )
    
    def delete_file(self, file_path: str) -> bool:
        """Delete file from S3"""
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=file_path)
            return True
        except Exception as e:
            print(f"Error deleting S3 file {file_path}: {str(e)}")
            return False


class GoogleDriveAdapter(CloudStorageAdapter):
    """Google Drive storage adapter"""
    
    def __init__(self, credentials: Dict[str, str]):
        super().__init__(credentials)
        raise HTTPException(
            status_code=501,
            detail="Google Drive integration not yet implemented. Coming soon!"
        )


class DropboxAdapter(CloudStorageAdapter):
    """Dropbox storage adapter"""
    
    def __init__(self, credentials: Dict[str, str]):
        super().__init__(credentials)
        raise HTTPException(
            status_code=501,
            detail="Dropbox integration not yet implemented. Coming soon!"
        )


def get_storage_adapter(folder_type: str, credentials: Dict[str, str]) -> CloudStorageAdapter:
    """Factory function to create storage adapters"""
    if folder_type.lower() == 's3':
        return S3Adapter(credentials)
    elif folder_type.lower() == 'drive':
        return GoogleDriveAdapter(credentials)
    elif folder_type.lower() == 'dropbox':
        return DropboxAdapter(credentials)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported folder type: {folder_type}. Supported: s3, drive, dropbox"
        )


@router.post("/watch-folders")
async def create_watch_folder(
    config: WatchFolderConfig,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Create a new watch folder configuration.
    
    **Parameters:**
    - `folder_type`: Type of storage ('s3', 'drive', 'dropbox')
    - `folder_path`: Path to the folder to watch
    - `credentials`: Storage service credentials
    - `poll_interval_hours`: How often to check for new files (default: 24)
    - `extraction_method`: Method to use for processing files
    - `webhook_url`: Optional webhook URL for notifications
    - `auto_delete_processed`: Whether to delete files after processing
    - `file_patterns`: File patterns to match (e.g., ["*.pdf"])
    
    **S3 Credentials Format:**
    ```json
    {
        "aws_access_key_id": "YOUR_ACCESS_KEY",
        "aws_secret_access_key": "YOUR_SECRET_KEY", 
        "bucket_name": "your-bucket-name",
        "region": "us-east-1"
    }
    ```
    
    **Returns:**
    - Watch folder configuration details
    
    **Example curl:**
    ```bash
    curl -X POST "http://localhost:8000/api/v1/watch-folders" \
         -H "Authorization: Bearer YOUR_JWT_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{
           "folder_type": "s3",
           "folder_path": "bank-statements/incoming/",
           "credentials": {
             "aws_access_key_id": "AKIA...",
             "aws_secret_access_key": "...",
             "bucket_name": "my-documents",
             "region": "us-east-1"
           },
           "poll_interval_hours": 6,
           "extraction_method": "smart",
           "webhook_url": "https://yourdomain.com/webhooks/pandiver",
           "auto_delete_processed": false,
           "file_patterns": ["*.pdf"]
         }'
    ```
    """
    # Test storage connection
    try:
        adapter = get_storage_adapter(config.folder_type, config.credentials)
        # Test by listing files (will raise exception if credentials are invalid)
        adapter.list_files(config.folder_path, config.file_patterns)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to {config.folder_type}: {str(e)}"
        )
    
    # Create watch folder configuration
    folder_id = str(uuid.uuid4())
    watch_folder = {
        'folder_id': folder_id,
        'user_id': current_user.id,
        'folder_type': config.folder_type,
        'folder_path': config.folder_path,
        'credentials': config.credentials,
        'poll_interval_hours': config.poll_interval_hours,
        'extraction_method': config.extraction_method.value,
        'webhook_url': config.webhook_url,
        'auto_delete_processed': config.auto_delete_processed,
        'file_patterns': config.file_patterns or ["*.pdf"],
        'active': True,
        'created_at': datetime.utcnow(),
        'last_scan': None,
        'files_processed_today': 0,
        'total_files_processed': 0,
        'next_scan': datetime.utcnow() + timedelta(hours=config.poll_interval_hours)
    }
    
    watch_folders[folder_id] = watch_folder
    
    # Schedule the watch folder task
    schedule_watch_folder_scan.apply_async(
        args=[folder_id], 
        eta=watch_folder['next_scan']
    )
    
    return {
        "folder_id": folder_id,
        "folder_type": config.folder_type,
        "folder_path": config.folder_path,
        "poll_interval_hours": config.poll_interval_hours,
        "extraction_method": config.extraction_method,
        "webhook_url": config.webhook_url,
        "auto_delete_processed": config.auto_delete_processed,
        "file_patterns": config.file_patterns,
        "active": True,
        "created_at": watch_folder['created_at'].isoformat(),
        "next_scan": watch_folder['next_scan'].isoformat(),
        "message": "Watch folder created successfully and scheduled for scanning"
    }


@router.get("/watch-folders")
async def list_watch_folders(
    current_user: UserModel = Depends(get_current_user)
):
    """
    List all watch folders for the current user.
    
    **Returns:**
    - List of user's watch folder configurations
    """
    user_folders = []
    
    for folder_id, folder in watch_folders.items():
        if folder['user_id'] == current_user.id:
            # Don't include sensitive credentials in the list
            folder_info = folder.copy()
            folder_info['credentials'] = {k: "***" for k in folder['credentials'].keys()}
            user_folders.append(folder_info)
    
    return {"watch_folders": user_folders, "total": len(user_folders)}


@router.get("/watch-folders/{folder_id}")
async def get_watch_folder(
    folder_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get details of a specific watch folder.
    """
    folder = watch_folders.get(folder_id)
    
    if not folder or folder['user_id'] != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Watch folder not found"
        )
    
    # Include credentials for the owner
    return folder


@router.put("/watch-folders/{folder_id}")
async def update_watch_folder(
    folder_id: str,
    active: Optional[bool] = Body(None),
    poll_interval_hours: Optional[int] = Body(None),
    extraction_method: Optional[ExtractionMethod] = Body(None),
    webhook_url: Optional[str] = Body(None),
    auto_delete_processed: Optional[bool] = Body(None),
    file_patterns: Optional[List[str]] = Body(None),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Update watch folder configuration.
    """
    folder = watch_folders.get(folder_id)
    
    if not folder or folder['user_id'] != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Watch folder not found"
        )
    
    # Update fields
    if active is not None:
        folder['active'] = active
    if poll_interval_hours is not None:
        folder['poll_interval_hours'] = poll_interval_hours
        # Reschedule next scan
        folder['next_scan'] = datetime.utcnow() + timedelta(hours=poll_interval_hours)
    if extraction_method is not None:
        folder['extraction_method'] = extraction_method.value
    if webhook_url is not None:
        folder['webhook_url'] = webhook_url
    if auto_delete_processed is not None:
        folder['auto_delete_processed'] = auto_delete_processed
    if file_patterns is not None:
        folder['file_patterns'] = file_patterns
    
    folder['updated_at'] = datetime.utcnow()
    
    return {
        "folder_id": folder_id,
        "message": "Watch folder updated successfully",
        "updated_at": folder['updated_at'].isoformat()
    }


@router.delete("/watch-folders/{folder_id}")
async def delete_watch_folder(
    folder_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Delete a watch folder configuration.
    """
    folder = watch_folders.get(folder_id)
    
    if not folder or folder['user_id'] != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Watch folder not found"
        )
    
    del watch_folders[folder_id]
    
    # Also clean up processed files log
    if folder_id in processed_files_log:
        del processed_files_log[folder_id]
    
    return {
        "folder_id": folder_id,
        "message": "Watch folder deleted successfully"
    }


@router.post("/watch-folders/{folder_id}/scan")
async def trigger_manual_scan(
    folder_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Trigger a manual scan of the watch folder.
    
    **Returns:**
    - Scan results
    """
    folder = watch_folders.get(folder_id)
    
    if not folder or folder['user_id'] != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Watch folder not found"
        )
    
    if not folder['active']:
        raise HTTPException(
            status_code=400,
            detail="Watch folder is not active"
        )
    
    # Trigger scan task
    task = scan_watch_folder_now.delay(folder_id)
    
    return {
        "folder_id": folder_id,
        "scan_job_id": task.id,
        "message": "Manual scan triggered successfully",
        "status": "scanning"
    }


@router.get("/watch-folders/{folder_id}/files")
async def list_processed_files(
    folder_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: UserModel = Depends(get_current_user)
):
    """
    List files processed by this watch folder.
    """
    folder = watch_folders.get(folder_id)
    
    if not folder or folder['user_id'] != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Watch folder not found"
        )
    
    folder_files = processed_files_log.get(folder_id, [])
    
    # Sort by processed_at (most recent first)
    folder_files.sort(key=lambda f: f.get('processed_at', ''), reverse=True)
    
    # Apply pagination
    paginated_files = folder_files[offset:offset + limit]
    
    return {
        "files": paginated_files,
        "total": len(folder_files),
        "limit": limit,
        "offset": offset
    }


@celery_app.task(bind=True)
def scan_watch_folder_now(self, folder_id: str):
    """Immediately scan a watch folder for new files"""
    return scan_watch_folder_task(folder_id, manual_scan=True)


@celery_app.task(bind=True)
def schedule_watch_folder_scan(self, folder_id: str):
    """Scheduled scan task for watch folders"""
    result = scan_watch_folder_task(folder_id, manual_scan=False)
    
    # Schedule next scan
    folder = watch_folders.get(folder_id)
    if folder and folder['active']:
        next_scan = datetime.utcnow() + timedelta(hours=folder['poll_interval_hours'])
        folder['next_scan'] = next_scan
        
        # Schedule the next scan
        schedule_watch_folder_scan.apply_async(
            args=[folder_id],
            eta=next_scan
        )
    
    return result


def scan_watch_folder_task(folder_id: str, manual_scan: bool = False) -> Dict[str, Any]:
    """Core logic for scanning a watch folder"""
    folder = watch_folders.get(folder_id)
    
    if not folder:
        return {"error": "Watch folder not found", "folder_id": folder_id}
    
    if not folder['active']:
        return {"message": "Watch folder is not active", "folder_id": folder_id}
    
    try:
        # Get storage adapter
        adapter = get_storage_adapter(folder['folder_type'], folder['credentials'])
        
        # List files in the folder
        files = adapter.list_files(folder['folder_path'], folder['file_patterns'])
        
        # Get list of already processed files
        processed_list = processed_files_log.get(folder_id, [])
        processed_paths = {f['file_path'] for f in processed_list}
        
        # Filter out already processed files
        new_files = [f for f in files if f['file_path'] not in processed_paths]
        
        # Process new files
        processed_count = 0
        processing_jobs = []
        
        for file_info in new_files:
            try:
                # Download file to temp location
                temp_filename = f"watch_{folder_id}_{uuid.uuid4()}.pdf"
                temp_filepath = os.path.join(tempfile.gettempdir(), temp_filename)
                
                adapter.download_file(file_info['file_path'], temp_filepath)
                
                # Queue processing job
                task = process_single_file_api.delay(
                    temp_filepath,
                    folder['extraction_method'],
                    folder.get('webhook_url'),
                    ["processing.completed", "processing.failed"],
                    {
                        'watch_folder_id': folder_id,
                        'source_file_path': file_info['file_path'],
                        'source_file_size': file_info['size'],
                        'auto_scan': not manual_scan
                    }
                )
                
                processing_jobs.append({
                    'file_path': file_info['file_path'],
                    'job_id': task.id
                })
                
                # Log the file as being processed
                processed_file = {
                    'file_path': file_info['file_path'],
                    'file_name': file_info['file_name'],
                    'job_id': task.id,
                    'processed_at': datetime.utcnow().isoformat(),
                    'status': 'processing',
                    'file_size': file_info['size']
                }
                
                if folder_id not in processed_files_log:
                    processed_files_log[folder_id] = []
                processed_files_log[folder_id].append(processed_file)
                
                # Delete from cloud storage if configured
                if folder['auto_delete_processed']:
                    adapter.delete_file(file_info['file_path'])
                
                processed_count += 1
                
            except Exception as e:
                print(f"Error processing file {file_info['file_path']}: {str(e)}")
                continue
        
        # Update folder statistics
        folder['last_scan'] = datetime.utcnow()
        folder['files_processed_today'] = processed_count
        folder['total_files_processed'] = folder.get('total_files_processed', 0) + processed_count
        
        return {
            "folder_id": folder_id,
            "scan_type": "manual" if manual_scan else "scheduled",
            "total_files_found": len(files),
            "new_files_found": len(new_files),
            "files_queued_for_processing": processed_count,
            "processing_jobs": processing_jobs,
            "last_scan": folder['last_scan'].isoformat(),
            "message": f"Scan completed successfully. {processed_count} new files queued for processing."
        }
        
    except Exception as e:
        error_msg = f"Error scanning watch folder {folder_id}: {str(e)}"
        print(error_msg)
        
        return {
            "folder_id": folder_id,
            "error": error_msg,
            "scan_type": "manual" if manual_scan else "scheduled"
        }