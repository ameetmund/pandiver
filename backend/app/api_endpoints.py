from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import tempfile
import uuid
import os
import secrets
import hashlib
from datetime import datetime, timedelta
import json
import asyncio
import time
import pandas as pd
import io

from .models import User as UserModel, ApiKey, ApiUsage
from .auth import get_current_user, get_db
from .azure_di_endpoints import start_intelligent_data_analysis, get_intelligent_data_job_status

router = APIRouter(prefix="/api/v1", tags=["Intelligent Data Parser API"])
security = HTTPBearer()

# Pydantic models for API requests/responses
class ApiKeyCreate(BaseModel):
    key_name: str

class ApiKeyResponse(BaseModel):
    id: int
    key_name: str
    api_key: str
    created_at: datetime
    last_used_at: Optional[datetime]
    is_active: bool

class ApiUsageResponse(BaseModel):
    id: int
    endpoint: str
    job_id: str
    status: str
    file_count: int
    processing_time: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]

class JobStartResponse(BaseModel):
    job_id: str
    status: str
    message: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[str]
    error: Optional[str]

class JobResultResponse(BaseModel):
    job_id: str
    status: str
    tables_count: int
    key_values_count: int
    download_urls: Dict[str, Dict[str, str]]  # Format -> {individual/merged -> url}

# API Key Authentication
async def get_api_key_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Authenticate user via API key"""
    api_key = credentials.credentials
    
    # Try to find API key in plain text format first (for compatibility with main.py endpoints)
    db_api_key = db.query(ApiKey).filter(
        ApiKey.api_key == api_key,
        ApiKey.is_active == True
    ).first()
    
    # If not found in plain text, try hashed format
    if not db_api_key:
        hashed_key = hashlib.sha256(api_key.encode()).hexdigest()
        db_api_key = db.query(ApiKey).filter(
            ApiKey.api_key == hashed_key,
            ApiKey.is_active == True
        ).first()
    
    if not db_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last used timestamp
    db_api_key.last_used_at = datetime.utcnow()
    db.commit()
    
    return db_api_key.user, db_api_key

# API Key Management Endpoints (protected by JWT)
@router.post("/auth/api-keys", response_model=ApiKeyResponse)
async def create_api_key(
    api_key_data: ApiKeyCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API key for the authenticated user"""
    # Generate a secure API key
    raw_key = secrets.token_urlsafe(32)
    hashed_key = hashlib.sha256(raw_key.encode()).hexdigest()
    
    db_api_key = ApiKey(
        user_id=current_user.id,
        key_name=api_key_data.key_name,
        api_key=hashed_key
    )
    
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    
    # Return the raw key only once (it won't be stored in plain text)
    return ApiKeyResponse(
        id=db_api_key.id,
        key_name=db_api_key.key_name,
        api_key=raw_key,  # Only time we return the raw key
        created_at=db_api_key.created_at,
        last_used_at=db_api_key.last_used_at,
        is_active=db_api_key.is_active
    )

@router.get("/auth/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API keys for the authenticated user"""
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    
    return [
        ApiKeyResponse(
            id=key.id,
            key_name=key.key_name,
            api_key="***hidden***",  # Never return the actual key after creation
            created_at=key.created_at,
            last_used_at=key.last_used_at,
            is_active=key.is_active
        )
        for key in api_keys
    ]

@router.delete("/auth/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an API key"""
    api_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    db.delete(api_key)
    db.commit()
    
    return {"message": "API key deleted successfully"}

# Usage History Endpoint (protected by JWT)
@router.get("/auth/api-usage", response_model=List[ApiUsageResponse])
async def get_api_usage(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get API usage history for the authenticated user"""
    usage_records = db.query(ApiUsage).filter(
        ApiUsage.user_id == current_user.id
    ).order_by(
        ApiUsage.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [
        ApiUsageResponse(
            id=record.id,
            endpoint=record.endpoint,
            job_id=record.job_id,
            status=record.status,
            file_count=record.file_count,
            processing_time=record.processing_time,
            created_at=record.created_at,
            completed_at=record.completed_at,
            error_message=record.error_message
        )
        for record in usage_records
    ]

# Main API Endpoints (protected by API key)
@router.post("/intelligent-data/analyze", response_model=JobStartResponse)
async def start_intelligent_data_analysis(
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = None,
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """Start intelligent data analysis for uploaded files"""
    user, api_key = user_and_key
    
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files uploaded"
        )
    
    job_id = str(uuid.uuid4())
    
    # Create usage record
    usage_record = ApiUsage(
        api_key_id=api_key.id,
        user_id=user.id,
        endpoint="/api/v1/intelligent-data/analyze",
        job_id=job_id,
        status="IN_PROGRESS",
        file_count=len(files)
    )
    db.add(usage_record)
    db.commit()
    
    try:
        # Process files directly using the working azure_di_endpoints logic
        for file in files:
            await file.seek(0)
            file_content = await file.read()
            
            # Use the working Azure DI function directly
            from .azure_document_intelligence import start_layout_analysis
            operation_id = start_layout_analysis(file_content, file.filename)
            
            # Store the operation ID for this job
            with open(os.path.join(tempfile.gettempdir(), f"job_{job_id}_operation.txt"), "w") as f:
                f.write(operation_id)
                
        # Update status to indicate Azure processing has started
        usage_record.status = "IN_PROGRESS"
        db.commit()
        
        return JobStartResponse(
            job_id=job_id,
            status="IN_PROGRESS",
            message=f"Started processing {len(files)} file(s)"
        )
        
    except Exception as e:
        usage_record.status = "FAILED"
        usage_record.error_message = str(e)
        usage_record.completed_at = datetime.utcnow()
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start processing: {str(e)}"
        )

@router.get("/intelligent-data/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status_api(
    job_id: str,
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """Get the status of a processing job"""
    user, api_key = user_and_key
    
    # Verify job belongs to this user
    usage_record = db.query(ApiUsage).filter(
        ApiUsage.job_id == job_id,
        ApiUsage.user_id == user.id
    ).first()
    
    if not usage_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Check the actual Azure status if still in progress
    if usage_record.status == "IN_PROGRESS":
        try:
            # Read the operation ID from temp file
            operation_file = os.path.join(tempfile.gettempdir(), f"job_{job_id}_operation.txt")
            if os.path.exists(operation_file):
                with open(operation_file, "r") as f:
                    operation_id = f.read().strip()
                
                # Check Azure status using the working function
                from .azure_document_intelligence import get_analysis_status
                status_info = get_analysis_status(operation_id)
                print(f"[DEBUG] Azure status for {operation_id}: {status_info}")
                
                if status_info['status'] == 'SUCCEEDED':
                    # Process results and update database
                    from .azure_document_intelligence import extract_tables_from_azure_result, extract_key_value_pairs_from_azure_result
                    
                    tables = extract_tables_from_azure_result(operation_id)
                    forms_data = extract_key_value_pairs_from_azure_result(operation_id)
                    
                    # Store results
                    results_data = {
                        "tables": tables or [],
                        "key_values": forms_data or [],
                        "processed_files": 1,
                        "total_files": usage_record.file_count
                    }
                    
                    results_file = os.path.join(tempfile.gettempdir(), f"results_{job_id}.json")
                    with open(results_file, "w") as f:
                        json.dump(results_data, f)
                    
                    # Update database
                    usage_record.status = "SUCCEEDED"
                    usage_record.completed_at = datetime.utcnow()
                    db.commit()
                    
                    # Clean up operation file
                    os.unlink(operation_file)
                    
                    return JobStatusResponse(
                        job_id=job_id,
                        status="SUCCEEDED",
                        progress="Processing completed",
                        error=None
                    )
                elif status_info['status'] == 'FAILED':
                    usage_record.status = "FAILED"
                    usage_record.error_message = status_info.get('error', 'Azure processing failed')
                    usage_record.completed_at = datetime.utcnow()
                    db.commit()
        except Exception as e:
            print(f"Error checking Azure status: {str(e)}")
    
    return JobStatusResponse(
        job_id=job_id,
        status=usage_record.status,
        progress=f"Processing {usage_record.file_count} files..." if usage_record.status == "IN_PROGRESS" else "Completed",
        error=usage_record.error_message
    )

@router.get("/intelligent-data/jobs/{job_id}/results", response_model=JobResultResponse)
async def get_job_results_api(
    job_id: str,
    format: str = Query("csv", regex="^(csv|xlsx|json|txt)$"),
    mode: str = Query("individual", regex="^(individual|merged)$"),
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """Get the results of a completed job with download URLs"""
    user, api_key = user_and_key
    
    # Verify job belongs to this user and is completed
    usage_record = db.query(ApiUsage).filter(
        ApiUsage.job_id == job_id,
        ApiUsage.user_id == user.id
    ).first()
    
    if not usage_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    if usage_record.status == "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="Job is still processing"
        )
    
    if usage_record.status == "FAILED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job failed: {usage_record.error_message}"
        )
    
    # Generate download URLs (these would be temporary signed URLs in production)
    base_url = "http://localhost:8000/api/v1/intelligent-data"
    download_urls = {
        "tables": {
            "individual": f"{base_url}/download/{job_id}/tables/{format}?mode=individual",
            "merged": f"{base_url}/download/{job_id}/tables/{format}?mode=merged"
        },
        "key_values": {
            "all": f"{base_url}/download/{job_id}/key-values/{format}"
        }
    }
    
    # Load actual results from storage
    tables_count = 0
    key_values_count = 0
    
    try:
        results_file = os.path.join(tempfile.gettempdir(), f"results_{job_id}.json")
        if os.path.exists(results_file):
            with open(results_file, "r") as f:
                results_data = json.load(f)
                tables_count = len(results_data.get("tables", []))
                key_values_count = len(results_data.get("key_values", []))
    except Exception as e:
        print(f"Error loading results for job {job_id}: {str(e)}")
    
    return JobResultResponse(
        job_id=job_id,
        status=usage_record.status,
        tables_count=tables_count,
        key_values_count=key_values_count,
        download_urls=download_urls
    )

@router.get("/intelligent-data/download/{job_id}/tables/{format}")
async def download_tables(
    job_id: str,
    format: str,
    mode: str = Query("individual"),
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """Download processed tables"""
    user, api_key = user_and_key
    
    # Verify job belongs to this user
    usage_record = db.query(ApiUsage).filter(
        ApiUsage.job_id == job_id,
        ApiUsage.user_id == user.id
    ).first()
    
    if not usage_record or usage_record.status != "SUCCEEDED":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not completed"
        )
    
    try:
        # Load results from storage
        results_file = os.path.join(tempfile.gettempdir(), f"results_{job_id}.json")
        if not os.path.exists(results_file):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Results file not found"
            )
        
        with open(results_file, "r") as f:
            results_data = json.load(f)
        
        tables_data = results_data.get("tables", [])
        if not tables_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No tables found in results"
            )
        
        # Generate file based on format and mode
        filename = f"tables_{job_id}_{mode}.{format}"
        file_content = generate_tables_file(tables_data, format, mode)
        
        # Create temporary file for download
        temp_download_file = os.path.join(tempfile.gettempdir(), filename)
        
        if format in ["csv", "txt"]:
            with open(temp_download_file, "w", encoding="utf-8") as f:
                f.write(file_content)
            media_type = "text/csv" if format == "csv" else "text/plain"
        elif format == "xlsx":
            with open(temp_download_file, "wb") as f:
                f.write(file_content)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif format == "json":
            with open(temp_download_file, "w", encoding="utf-8") as f:
                f.write(file_content)
            media_type = "application/json"
        
        return FileResponse(
            temp_download_file,
            media_type=media_type,
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating download file: {str(e)}"
        )

@router.get("/intelligent-data/download/{job_id}/key-values/{format}")
async def download_key_values(
    job_id: str,
    format: str,
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """Download processed key-value pairs"""
    user, api_key = user_and_key
    
    # Verify job belongs to this user
    usage_record = db.query(ApiUsage).filter(
        ApiUsage.job_id == job_id,
        ApiUsage.user_id == user.id
    ).first()
    
    if not usage_record or usage_record.status != "SUCCEEDED":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not completed"
        )
    
    try:
        # Load results from storage
        results_file = os.path.join(tempfile.gettempdir(), f"results_{job_id}.json")
        if not os.path.exists(results_file):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Results file not found"
            )
        
        with open(results_file, "r") as f:
            results_data = json.load(f)
        
        key_values_data = results_data.get("key_values", [])
        if not key_values_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No key-value pairs found in results"
            )
        
        # Generate file based on format
        filename = f"key_values_{job_id}.{format}"
        file_content = generate_key_values_file(key_values_data, format)
        
        # Create temporary file for download
        temp_download_file = os.path.join(tempfile.gettempdir(), filename)
        
        if format in ["csv", "txt"]:
            with open(temp_download_file, "w", encoding="utf-8") as f:
                f.write(file_content)
            media_type = "text/csv" if format == "csv" else "text/plain"
        elif format == "xlsx":
            with open(temp_download_file, "wb") as f:
                f.write(file_content)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif format == "json":
            with open(temp_download_file, "w", encoding="utf-8") as f:
                f.write(file_content)
            media_type = "application/json"
        
        return FileResponse(
            temp_download_file,
            media_type=media_type,
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating download file: {str(e)}"
        )

# Note: Background processing removed - now using direct Azure polling like the working dashboard

# File generation functions for downloads

def generate_tables_file(tables_data: List[Dict], format: str, mode: str):
    """Generate file content for tables download"""
    try:
        if format == "json":
            if mode == "individual":
                return json.dumps({"tables": tables_data}, indent=2)
            else:  # merged
                # Merge all tables into one
                merged_table = {"columns": [], "rows": []}
                for table in tables_data:
                    if "columns" in table:
                        merged_table["columns"].extend(table["columns"])
                    if "rows" in table:
                        merged_table["rows"].extend(table["rows"])
                return json.dumps({"merged_table": merged_table}, indent=2)
        
        elif format == "csv":
            csv_content = ""
            if mode == "individual":
                for i, table in enumerate(tables_data):
                    if i > 0:
                        csv_content += "\n\n"
                    csv_content += f"# Table {i+1}\n"
                    
                    # Convert table to DataFrame
                    if "columns" in table and "rows" in table:
                        df = pd.DataFrame(table["rows"], columns=table["columns"])
                    elif "rows" in table and len(table["rows"]) > 0:
                        df = pd.DataFrame(table["rows"])
                    else:
                        continue
                    
                    csv_content += df.to_csv(index=False)
            else:  # merged
                all_rows = []
                all_columns = set()
                for table in tables_data:
                    if "rows" in table:
                        all_rows.extend(table["rows"])
                    if "columns" in table:
                        all_columns.update(table["columns"])
                
                if all_rows:
                    df = pd.DataFrame(all_rows, columns=list(all_columns) if all_columns else None)
                    csv_content = df.to_csv(index=False)
            
            return csv_content
        
        elif format == "xlsx":
            output = io.BytesIO()
            if mode == "individual":
                with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                    for i, table in enumerate(tables_data):
                        if "columns" in table and "rows" in table:
                            df = pd.DataFrame(table["rows"], columns=table["columns"])
                        elif "rows" in table and len(table["rows"]) > 0:
                            df = pd.DataFrame(table["rows"])
                        else:
                            continue
                        df.to_excel(writer, sheet_name=f'Table_{i+1}', index=False)
            else:  # merged
                all_rows = []
                all_columns = set()
                for table in tables_data:
                    if "rows" in table:
                        all_rows.extend(table["rows"])
                    if "columns" in table:
                        all_columns.update(table["columns"])
                
                if all_rows:
                    df = pd.DataFrame(all_rows, columns=list(all_columns) if all_columns else None)
                    df.to_excel(output, sheet_name='Merged_Tables', index=False)
            
            return output.getvalue()
        
        elif format == "txt":
            txt_content = ""
            if mode == "individual":
                for i, table in enumerate(tables_data):
                    if i > 0:
                        txt_content += "\n" + "="*50 + "\n"
                    txt_content += f"TABLE {i+1}\n"
                    txt_content += "="*20 + "\n"
                    
                    if "columns" in table and "rows" in table:
                        # Add headers
                        txt_content += " | ".join(table["columns"]) + "\n"
                        txt_content += "-" * len(" | ".join(table["columns"])) + "\n"
                        
                        # Add rows
                        for row in table["rows"]:
                            txt_content += " | ".join(str(cell) for cell in row) + "\n"
            else:  # merged
                all_rows = []
                all_columns = []
                for table in tables_data:
                    if "rows" in table:
                        all_rows.extend(table["rows"])
                    if "columns" in table and not all_columns:
                        all_columns = table["columns"]
                
                if all_columns:
                    txt_content += " | ".join(all_columns) + "\n"
                    txt_content += "-" * len(" | ".join(all_columns)) + "\n"
                
                for row in all_rows:
                    txt_content += " | ".join(str(cell) for cell in row) + "\n"
            
            return txt_content
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating {format} file: {str(e)}"
        )

def generate_key_values_file(key_values_data: List[Dict], format: str):
    """Generate file content for key-value pairs download"""
    try:
        if format == "json":
            return json.dumps({"key_values": key_values_data}, indent=2)
        
        elif format == "csv":
            # Convert key-value pairs to DataFrame
            rows = []
            for kv in key_values_data:
                if isinstance(kv, dict):
                    for key, value in kv.items():
                        rows.append({"Key": key, "Value": value})
                else:
                    rows.append({"Key": "Unknown", "Value": str(kv)})
            
            if rows:
                df = pd.DataFrame(rows)
                return df.to_csv(index=False)
            return "Key,Value\n"
        
        elif format == "xlsx":
            output = io.BytesIO()
            rows = []
            for kv in key_values_data:
                if isinstance(kv, dict):
                    for key, value in kv.items():
                        rows.append({"Key": key, "Value": value})
                else:
                    rows.append({"Key": "Unknown", "Value": str(kv)})
            
            if rows:
                df = pd.DataFrame(rows)
                df.to_excel(output, sheet_name='Key_Values', index=False)
            else:
                # Create empty DataFrame with headers
                df = pd.DataFrame(columns=["Key", "Value"])
                df.to_excel(output, sheet_name='Key_Values', index=False)
            
            return output.getvalue()
        
        elif format == "txt":
            txt_content = "KEY-VALUE PAIRS\n"
            txt_content += "="*20 + "\n\n"
            
            for kv in key_values_data:
                if isinstance(kv, dict):
                    for key, value in kv.items():
                        txt_content += f"{key}: {value}\n"
                else:
                    txt_content += f"Unknown: {str(kv)}\n"
                txt_content += "\n"
            
            return txt_content
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating {format} file: {str(e)}"
        )