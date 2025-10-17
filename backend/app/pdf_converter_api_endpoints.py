from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Form, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import uuid
import os
import tempfile
from datetime import datetime
from io import BytesIO
import hashlib
import aiohttp
import zipfile

from .models import User as UserModel, ApiKey, ApiUsage
from .pdf_converter_service import PDFConverterService
from .auth import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/pdf-converter-api", tags=["PDF ↔ Office Converter API"])

# Security scheme
security = HTTPBearer()

# API Key Authentication
async def get_api_key_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Authenticate user via API key"""
    api_key = credentials.credentials

    # Try to find API key in plain text format first
    db_api_key = db.query(ApiKey).filter(
        ApiKey.api_key == api_key,
        ApiKey.is_active == True
    ).first()

    # If not found in plain text, try hashed format
    if not db_api_key:
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        db_api_key = db.query(ApiKey).filter(
            ApiKey.api_key == api_key_hash,
            ApiKey.is_active == True
        ).first()

    if not db_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

    # Get user
    user = db.query(UserModel).filter(UserModel.id == db_api_key.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Update last_used_at timestamp
    db_api_key.last_used_at = datetime.utcnow()
    db.commit()

    return user, db_api_key


# Pydantic models for requests/responses
class SupportedFormatsResponse(BaseModel):
    from_pdf: Dict[str, Dict[str, str]]
    to_pdf: Dict[str, Dict[str, str]]
    is_configured: bool


class BatchConversionJobStartResponse(BaseModel):
    job_id: str
    status: str
    message: str
    file_count: int


class ConversionJobStatusResponse(BaseModel):
    job_id: str
    status: str
    conversion_type: str
    file_count: int
    total_conversions: Optional[int] = None
    successful_conversions: Optional[int] = None
    failed_conversions: Optional[int] = None
    download_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class ApiUsageResponse(BaseModel):
    job_id: str
    status: str
    endpoint: str
    file_count: int
    conversion_type: str
    processing_time: Optional[float]
    created_at: str
    completed_at: Optional[str]


# Initialize service
converter_service = PDFConverterService()


@router.get("/supported-formats", response_model=SupportedFormatsResponse)
async def get_supported_formats(
    user_and_key=Depends(get_api_key_user)
):
    """Get list of supported conversion formats (API endpoint)"""
    return SupportedFormatsResponse(**converter_service.get_supported_formats())


@router.post("/convert-from-pdf", response_model=BatchConversionJobStartResponse)
async def batch_convert_from_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    target_formats: str = Form(...),  # Comma-separated list: "docx,xlsx,jpeg"
    user_and_key=Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Batch convert multiple PDFs to one or more target formats (API endpoint)
    Supports multiple files and multiple output formats
    """
    user, api_key = user_and_key

    # Validate all files are PDFs
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} is not a PDF. All files must be PDFs."
            )

    try:
        # Parse target formats
        formats_list = [fmt.strip().lower() for fmt in target_formats.split(',')]

        if not formats_list:
            raise HTTPException(status_code=400, detail="At least one target format is required")

        # Create job ID
        job_id = str(uuid.uuid4())

        # Create API usage record
        usage_record = ApiUsage(
            api_key_id=api_key.id,
            user_id=user.id,
            endpoint="/api/v1/pdf-converter-api/convert-from-pdf",
            job_id=job_id,
            status="IN_PROGRESS",
            file_count=len(files)
        )
        db.add(usage_record)
        db.commit()

        # Read all files
        file_data = []
        for file in files:
            file_bytes = await file.read()
            file_data.append({
                "filename": file.filename,
                "bytes": file_bytes
            })

        # Start background processing
        background_tasks.add_task(
            process_batch_from_pdf_conversion_api,
            job_id,
            file_data,
            formats_list,
            user.id,
            api_key.id
        )

        return BatchConversionJobStartResponse(
            job_id=job_id,
            status="IN_PROGRESS",
            message=f"Batch PDF conversion started. Processing {len(files)} file(s) to {', '.join(formats_list)}",
            file_count=len(files)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start batch conversion: {str(e)}")


@router.post("/convert-to-pdf", response_model=BatchConversionJobStartResponse)
async def batch_convert_to_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    user_and_key=Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Batch convert multiple files to PDF (API endpoint)
    Supports multiple files of various formats
    """
    user, api_key = user_and_key

    try:
        # Create job ID
        job_id = str(uuid.uuid4())

        # Create API usage record
        usage_record = ApiUsage(
            api_key_id=api_key.id,
            user_id=user.id,
            endpoint="/api/v1/pdf-converter-api/convert-to-pdf",
            job_id=job_id,
            status="IN_PROGRESS",
            file_count=len(files)
        )
        db.add(usage_record)
        db.commit()

        # Read all files and detect formats
        file_data = []
        for file in files:
            file_extension = os.path.splitext(file.filename)[1].lower().lstrip('.')

            if file_extension not in converter_service.TO_PDF_FORMATS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format for {file.filename}: {file_extension}. "
                           f"Supported formats: {', '.join(converter_service.TO_PDF_FORMATS.keys())}"
                )

            file_bytes = await file.read()
            file_data.append({
                "filename": file.filename,
                "bytes": file_bytes,
                "format": file_extension
            })

        # Start background processing
        background_tasks.add_task(
            process_batch_to_pdf_conversion_api,
            job_id,
            file_data,
            user.id,
            api_key.id
        )

        return BatchConversionJobStartResponse(
            job_id=job_id,
            status="IN_PROGRESS",
            message=f"Batch PDF conversion started. Processing {len(files)} file(s) to PDF",
            file_count=len(files)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start batch conversion: {str(e)}")


@router.get("/jobs/{job_id}/status", response_model=ConversionJobStatusResponse)
async def get_conversion_job_status(
    job_id: str,
    user_and_key=Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Get conversion job status (API endpoint)
    """
    user, api_key = user_and_key

    # Find the usage record for this job
    usage_record = db.query(ApiUsage).filter(
        ApiUsage.job_id == job_id,
        ApiUsage.user_id == user.id
    ).first()

    if not usage_record:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get job metadata from temp file
    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"
    metadata = {}
    if os.path.exists(metadata_file):
        with open(metadata_file, "r") as f:
            metadata = json.load(f)

    # Generate download URL if completed
    download_url = None
    if usage_record.status == "SUCCEEDED":
        download_url = f"/api/v1/pdf-converter-api/download/{job_id}"

    return ConversionJobStatusResponse(
        job_id=job_id,
        status=usage_record.status,
        conversion_type=metadata.get("conversion_type", "unknown"),
        file_count=usage_record.file_count or 1,
        total_conversions=metadata.get("total_conversions"),
        successful_conversions=metadata.get("successful_conversions"),
        failed_conversions=metadata.get("failed_conversions"),
        download_url=download_url,
        error_message=usage_record.error_message,
        created_at=usage_record.created_at.isoformat(),
        completed_at=usage_record.completed_at.isoformat() if usage_record.completed_at else None
    )


@router.get("/download/{job_id}")
async def download_conversion_result(
    job_id: str,
    user_and_key=Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Download conversion result (API endpoint)
    Returns a ZIP file with all converted files
    """
    user, api_key = user_and_key

    # Verify job belongs to this user
    usage_record = db.query(ApiUsage).filter(
        ApiUsage.job_id == job_id,
        ApiUsage.user_id == user.id
    ).first()

    if not usage_record:
        raise HTTPException(status_code=404, detail="Job not found")

    if usage_record.status != "SUCCEEDED":
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed. Current status: {usage_record.status}"
        )

    # Get job metadata
    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"
    if not os.path.exists(metadata_file):
        raise HTTPException(status_code=404, detail="Job metadata not found")

    try:
        with open(metadata_file, "r") as f:
            metadata = json.load(f)

        conversion_type = metadata.get("conversion_type")

        # Create ZIP file with all conversions
        zip_buffer = BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            if conversion_type == "from_pdf":
                # Add all successful conversions from all files
                for file_result in metadata.get("file_results", []):
                    for conversion in file_result.get("conversions", []):
                        if conversion.get("success"):
                            file_id = file_result.get("file_id")
                            output_path = f"/tmp/converter_job_{job_id}_{file_id}_{conversion['format']}"
                            if os.path.exists(output_path):
                                with open(output_path, 'rb') as f:
                                    zip_file.writestr(conversion['output_filename'], f.read())

            elif conversion_type == "to_pdf":
                # Add all successfully converted PDFs
                for file_result in metadata.get("file_results", []):
                    if file_result.get("success"):
                        file_id = file_result.get("file_id")
                        output_path = f"/tmp/converter_job_{job_id}_{file_id}.pdf"
                        if os.path.exists(output_path):
                            with open(output_path, 'rb') as f:
                                zip_file.writestr(file_result['output_filename'], f.read())

        zip_buffer.seek(0)

        zip_filename = f"converted_{job_id}.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")


@router.get("/jobs")
async def list_conversion_jobs(
    user_and_key=Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 10,
    offset: int = 0
):
    """
    List user's conversion jobs (API endpoint)
    """
    user, api_key = user_and_key

    jobs = db.query(ApiUsage).filter(
        ApiUsage.user_id == user.id,
        ApiUsage.endpoint.like("%/pdf-converter-api/%")
    ).order_by(ApiUsage.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for job in jobs:
        # Get metadata if available
        metadata_file = f"/tmp/converter_job_{job.job_id}_metadata.json"
        metadata = {}
        if os.path.exists(metadata_file):
            with open(metadata_file, "r") as f:
                metadata = json.load(f)

        result.append({
            "job_id": job.job_id,
            "status": job.status,
            "conversion_type": metadata.get("conversion_type", "unknown"),
            "file_count": job.file_count or 1,
            "total_conversions": metadata.get("total_conversions"),
            "successful_conversions": metadata.get("successful_conversions"),
            "failed_conversions": metadata.get("failed_conversions"),
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        })

    return result


@router.get("/usage", response_model=List[ApiUsageResponse])
async def get_api_usage(
    user_and_key=Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 10
):
    """
    Get API usage statistics for PDF conversion (API endpoint)
    """
    user, api_key = user_and_key

    usage_records = db.query(ApiUsage).filter(
        ApiUsage.user_id == user.id,
        ApiUsage.endpoint.like("%/pdf-converter-api/%")
    ).order_by(ApiUsage.created_at.desc()).limit(limit).all()

    result = []
    for record in usage_records:
        # Get metadata
        metadata_file = f"/tmp/converter_job_{record.job_id}_metadata.json"
        metadata = {}
        if os.path.exists(metadata_file):
            with open(metadata_file, "r") as f:
                metadata = json.load(f)

        result.append(ApiUsageResponse(
            job_id=record.job_id,
            status=record.status,
            endpoint=record.endpoint,
            file_count=record.file_count or 1,
            conversion_type=metadata.get("conversion_type", "unknown"),
            processing_time=record.processing_time,
            created_at=record.created_at.isoformat(),
            completed_at=record.completed_at.isoformat() if record.completed_at else None
        ))

    return result


# Background task functions

async def process_batch_from_pdf_conversion_api(
    job_id: str,
    file_data: List[Dict[str, Any]],
    target_formats: List[str],
    user_id: int,
    api_key_id: int
):
    """Background task to process batch PDF to other formats conversion (API)"""
    from .main import get_db_session

    db = next(get_db_session())

    metadata = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "PROCESSING",
        "conversion_type": "from_pdf",
        "target_formats": target_formats,
        "file_count": len(file_data),
        "created_at": datetime.utcnow().isoformat()
    }

    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"

    try:
        # Save initial metadata
        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Get usage record
        usage_record = db.query(ApiUsage).filter(ApiUsage.job_id == job_id).first()
        if usage_record:
            usage_record.status = "PROCESSING"
            db.commit()

        start_time = datetime.utcnow()

        # Process each file
        file_results = []
        total_conversions = 0
        successful_conversions = 0
        failed_conversions = 0

        for idx, file_info in enumerate(file_data):
            file_id = f"file_{idx}"
            try:
                result = await converter_service.convert_from_pdf(
                    file_info["bytes"],
                    file_info["filename"],
                    target_formats
                )

                # Save converted files
                for conversion in result["conversions"]:
                    if conversion["success"] and conversion["output_bytes"]:
                        output_path = f"/tmp/converter_job_{job_id}_{file_id}_{conversion['format']}"
                        with open(output_path, "wb") as f:
                            f.write(conversion["output_bytes"])

                file_results.append({
                    "file_id": file_id,
                    "original_filename": file_info["filename"],
                    "conversions": [
                        {
                            "format": c["format"],
                            "format_name": c["format_name"],
                            "output_filename": c["output_filename"],
                            "success": c["success"],
                            "error": c["error"]
                        }
                        for c in result["conversions"]
                    ]
                })

                total_conversions += result["total_conversions"]
                successful_conversions += result["successful_conversions"]
                failed_conversions += result["failed_conversions"]

            except Exception as file_error:
                print(f"ERROR: Failed to process file {file_info['filename']}: {str(file_error)}")
                file_results.append({
                    "file_id": file_id,
                    "original_filename": file_info["filename"],
                    "error": str(file_error)
                })
                failed_conversions += len(target_formats)

        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Update metadata
        metadata["status"] = "COMPLETED"
        metadata["file_results"] = file_results
        metadata["total_conversions"] = total_conversions
        metadata["successful_conversions"] = successful_conversions
        metadata["failed_conversions"] = failed_conversions
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Update usage record
        if usage_record:
            usage_record.status = "SUCCEEDED"
            usage_record.processing_time = processing_time
            usage_record.completed_at = datetime.utcnow()
            db.commit()

        print(f"DEBUG: Batch conversion job {job_id} completed. {successful_conversions}/{total_conversions} successful")

    except Exception as e:
        print(f"ERROR: Batch conversion job {job_id} failed: {str(e)}")

        metadata["status"] = "FAILED"
        metadata["error_message"] = str(e)
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Update usage record
        usage_record = db.query(ApiUsage).filter(ApiUsage.job_id == job_id).first()
        if usage_record:
            usage_record.status = "FAILED"
            usage_record.error_message = str(e)
            usage_record.completed_at = datetime.utcnow()
            db.commit()

    finally:
        db.close()


async def process_batch_to_pdf_conversion_api(
    job_id: str,
    file_data: List[Dict[str, Any]],
    user_id: int,
    api_key_id: int
):
    """Background task to process batch other formats to PDF conversion (API)"""
    from .main import get_db_session

    db = next(get_db_session())

    metadata = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "PROCESSING",
        "conversion_type": "to_pdf",
        "file_count": len(file_data),
        "created_at": datetime.utcnow().isoformat()
    }

    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"

    try:
        # Save initial metadata
        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Get usage record
        usage_record = db.query(ApiUsage).filter(ApiUsage.job_id == job_id).first()
        if usage_record:
            usage_record.status = "PROCESSING"
            db.commit()

        start_time = datetime.utcnow()

        # Process each file
        file_results = []
        successful = 0
        failed = 0

        for idx, file_info in enumerate(file_data):
            file_id = f"file_{idx}"
            try:
                result = await converter_service.convert_to_pdf(
                    file_info["bytes"],
                    file_info["filename"],
                    file_info["format"]
                )

                # Save PDF file
                output_path = f"/tmp/converter_job_{job_id}_{file_id}.pdf"
                with open(output_path, "wb") as f:
                    f.write(result["pdf_bytes"])

                file_results.append({
                    "file_id": file_id,
                    "original_filename": file_info["filename"],
                    "output_filename": result["output_filename"],
                    "success": True,
                    "error": None
                })

                successful += 1

            except Exception as file_error:
                print(f"ERROR: Failed to convert file {file_info['filename']}: {str(file_error)}")
                file_results.append({
                    "file_id": file_id,
                    "original_filename": file_info["filename"],
                    "success": False,
                    "error": str(file_error)
                })
                failed += 1

        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Update metadata
        metadata["status"] = "COMPLETED"
        metadata["file_results"] = file_results
        metadata["total_conversions"] = len(file_data)
        metadata["successful_conversions"] = successful
        metadata["failed_conversions"] = failed
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Update usage record
        if usage_record:
            usage_record.status = "SUCCEEDED"
            usage_record.processing_time = processing_time
            usage_record.completed_at = datetime.utcnow()
            db.commit()

        print(f"DEBUG: Batch conversion job {job_id} completed. {successful}/{len(file_data)} successful")

    except Exception as e:
        print(f"ERROR: Batch conversion job {job_id} failed: {str(e)}")

        metadata["status"] = "FAILED"
        metadata["error_message"] = str(e)
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Update usage record
        usage_record = db.query(ApiUsage).filter(ApiUsage.job_id == job_id).first()
        if usage_record:
            usage_record.status = "FAILED"
            usage_record.error_message = str(e)
            usage_record.completed_at = datetime.utcnow()
            db.commit()

    finally:
        db.close()
