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

from .models import User as UserModel, ApiKey, ApiUsage
from .pdf_compressor_service import PDFCompressorService
from .auth import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/pdf-compressor-api", tags=["PDF Compressor & Optimizer API"])

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
class PDFCompressionAnalysisResponse(BaseModel):
    filename: str
    file_size_bytes: int
    file_size_mb: float
    total_pages: int
    has_images: bool
    image_count: int
    estimated_savings: Dict[str, Dict[str, Any]]

class CompressionLevelsResponse(BaseModel):
    levels: Dict[str, Dict[str, Any]]

class CompressionJobStartRequest(BaseModel):
    compression_level: str = "moderate"  # "light", "moderate", "aggressive"

class CompressionJobStatusResponse(BaseModel):
    job_id: str
    status: str
    original_filename: str
    compression_level: str
    download_url: Optional[str] = None
    original_size: Optional[int] = None
    compressed_size: Optional[int] = None
    size_reduction_percentage: Optional[float] = None
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class CompressionJobStartResponse(BaseModel):
    job_id: str
    status: str
    message: str

class ApiUsageResponse(BaseModel):
    job_id: str
    status: str
    endpoint: str
    file_count: int
    original_size_mb: float
    compressed_size_mb: float
    size_reduction_percentage: float
    processing_time: Optional[float]
    created_at: str
    completed_at: Optional[str]

# Initialize service
compressor_service = PDFCompressorService()

@router.get("/compression-levels", response_model=CompressionLevelsResponse)
async def get_compression_levels(
    user_and_key = Depends(get_api_key_user)
):
    """Get available compression levels and their descriptions (API endpoint)"""
    return CompressionLevelsResponse(
        levels=compressor_service.get_compression_levels()
    )

@router.post("/analyze", response_model=PDFCompressionAnalysisResponse)
async def analyze_pdf_for_compression(
    file: UploadFile = File(...),
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Analyze PDF and return compression estimates (API endpoint)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        user, api_key = user_and_key

        # Create usage tracking record
        usage_record = ApiUsage(
            api_key_id=api_key.id,
            user_id=user.id,
            endpoint="/api/v1/pdf-compressor-api/analyze",
            job_id=str(uuid.uuid4()),
            status="IN_PROGRESS",
            file_count=1
        )
        db.add(usage_record)
        db.commit()

        start_time = datetime.utcnow()
        pdf_bytes = await file.read()
        print(f"DEBUG: PDF Compressor API - analyzing PDF {file.filename}, size: {len(pdf_bytes)} bytes")
        analysis_result = await compressor_service.analyze_pdf(pdf_bytes, file.filename)
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Update usage record
        usage_record.status = "SUCCEEDED"
        usage_record.processing_time = processing_time
        usage_record.completed_at = datetime.utcnow()
        db.commit()

        return PDFCompressionAnalysisResponse(**analysis_result)

    except Exception as e:
        if 'usage_record' in locals():
            usage_record.status = "FAILED"
            usage_record.error_message = str(e)
            usage_record.completed_at = datetime.utcnow()
            db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to analyze PDF: {str(e)}")

@router.post("/compress", response_model=CompressionJobStartResponse)
async def start_pdf_compression(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    compression_level: str = Form("moderate"),
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Start PDF compression job with batch support (API endpoint)
    Supports Azure Blob Storage for staging/production
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    if compression_level not in ["light", "moderate", "aggressive"]:
        raise HTTPException(status_code=400, detail="Invalid compression level. Must be one of: light, moderate, aggressive")

    try:
        user, api_key = user_and_key

        # Read PDF
        pdf_bytes = await file.read()
        original_size = len(pdf_bytes)

        # Create job ID
        job_id = str(uuid.uuid4())

        # Create API usage record
        usage_record = ApiUsage(
            api_key_id=api_key.id,
            user_id=user.id,
            endpoint="/api/v1/pdf-compressor-api/compress",
            job_id=job_id,
            status="IN_PROGRESS",
            file_count=1
        )
        db.add(usage_record)
        db.commit()

        # Start background processing
        background_tasks.add_task(
            process_pdf_compression_api,
            job_id,
            pdf_bytes,
            file.filename,
            compression_level,
            user.id,
            api_key.id
        )

        return CompressionJobStartResponse(
            job_id=job_id,
            status="IN_PROGRESS",
            message=f"PDF compression started with {compression_level} compression level"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start compression: {str(e)}")

@router.get("/jobs/{job_id}/status", response_model=CompressionJobStatusResponse)
async def get_compression_job_status(
    job_id: str,
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Get compression job status (API endpoint)
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
    metadata_file = f"/tmp/compressor_job_{job_id}_metadata.json"
    metadata = {}
    if os.path.exists(metadata_file):
        with open(metadata_file, "r") as f:
            metadata = json.load(f)

    # Generate download URL if completed
    download_url = None
    if usage_record.status == "SUCCEEDED":
        # Check if using Azure Blob Storage
        blob_src_url = os.getenv('AZURE_BLOB_SRC_URL')
        if blob_src_url and 'blob_filename' in metadata:
            # Azure Blob Storage URL
            download_url = f"/api/v1/pdf-compressor-api/download/{job_id}"
        else:
            # Local storage URL
            download_url = f"/api/v1/pdf-compressor-api/download/{job_id}"

    return CompressionJobStatusResponse(
        job_id=job_id,
        status=usage_record.status,
        original_filename=metadata.get("original_filename", "unknown.pdf"),
        compression_level=metadata.get("compression_level", "moderate"),
        download_url=download_url,
        original_size=metadata.get("original_size"),
        compressed_size=metadata.get("compressed_size"),
        size_reduction_percentage=metadata.get("size_reduction_percentage"),
        error_message=usage_record.error_message,
        created_at=usage_record.created_at.isoformat(),
        completed_at=usage_record.completed_at.isoformat() if usage_record.completed_at else None
    )

@router.get("/download/{job_id}")
async def download_compressed_pdf(
    job_id: str,
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Download compressed PDF (API endpoint)
    Supports both local storage and Azure Blob Storage
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
        raise HTTPException(status_code=400, detail=f"Job is not completed. Current status: {usage_record.status}")

    # Get job metadata
    metadata_file = f"/tmp/compressor_job_{job_id}_metadata.json"
    if not os.path.exists(metadata_file):
        raise HTTPException(status_code=404, detail="Job metadata not found")

    with open(metadata_file, "r") as f:
        metadata = json.load(f)

    output_filename = metadata.get("output_filename", "compressed.pdf")

    # Check if using Azure Blob Storage
    blob_out_url = os.getenv('AZURE_BLOB_OUT_URL')
    out_sas_token = os.getenv('AZURE_BLOB_OUT_SAS_TOKEN')

    if blob_out_url and out_sas_token and 'blob_filename' in metadata:
        # Download from Azure Blob Storage
        blob_filename = metadata['blob_filename']
        blob_url = f"{blob_out_url}/{blob_filename}?{out_sas_token}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(blob_url) as response:
                    if response.status != 200:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to download from blob storage: {response.status}"
                        )

                    pdf_bytes = await response.read()

                    return StreamingResponse(
                        BytesIO(pdf_bytes),
                        media_type="application/pdf",
                        headers={"Content-Disposition": f"attachment; filename={output_filename}"}
                    )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to download from blob storage: {str(e)}")
    else:
        # Download from local storage
        output_path = f"/tmp/compressor_job_{job_id}.pdf"

        if not os.path.exists(output_path):
            raise HTTPException(status_code=404, detail="Compressed file not found")

        def generate_file():
            with open(output_path, "rb") as file:
                yield from file

        return StreamingResponse(
            generate_file(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={output_filename}"}
        )

@router.get("/jobs")
async def list_compression_jobs(
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 10,
    offset: int = 0
):
    """
    List user's compression jobs (API endpoint)
    """
    user, api_key = user_and_key

    jobs = db.query(ApiUsage).filter(
        ApiUsage.user_id == user.id,
        ApiUsage.endpoint.like("%/pdf-compressor-api/compress%")
    ).order_by(ApiUsage.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for job in jobs:
        # Get metadata if available
        metadata_file = f"/tmp/compressor_job_{job.job_id}_metadata.json"
        metadata = {}
        if os.path.exists(metadata_file):
            with open(metadata_file, "r") as f:
                metadata = json.load(f)

        result.append({
            "job_id": job.job_id,
            "status": job.status,
            "original_filename": metadata.get("original_filename", "unknown.pdf"),
            "compression_level": metadata.get("compression_level", "moderate"),
            "original_size": metadata.get("original_size"),
            "compressed_size": metadata.get("compressed_size"),
            "size_reduction_percentage": metadata.get("size_reduction_percentage"),
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        })

    return result

@router.get("/usage", response_model=List[ApiUsageResponse])
async def get_api_usage(
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 10
):
    """
    Get API usage statistics for compression (API endpoint)
    """
    user, api_key = user_and_key

    usage_records = db.query(ApiUsage).filter(
        ApiUsage.user_id == user.id,
        ApiUsage.endpoint.like("%/pdf-compressor-api/%")
    ).order_by(ApiUsage.created_at.desc()).limit(limit).all()

    result = []
    for record in usage_records:
        # Get metadata
        metadata_file = f"/tmp/compressor_job_{record.job_id}_metadata.json"
        metadata = {}
        if os.path.exists(metadata_file):
            with open(metadata_file, "r") as f:
                metadata = json.load(f)

        result.append(ApiUsageResponse(
            job_id=record.job_id,
            status=record.status,
            endpoint=record.endpoint,
            file_count=record.file_count or 1,
            original_size_mb=round((metadata.get("original_size", 0) / (1024 * 1024)), 2),
            compressed_size_mb=round((metadata.get("compressed_size", 0) / (1024 * 1024)), 2),
            size_reduction_percentage=metadata.get("size_reduction_percentage", 0),
            processing_time=record.processing_time,
            created_at=record.created_at.isoformat(),
            completed_at=record.completed_at.isoformat() if record.completed_at else None
        ))

    return result

# Background task for processing
async def process_pdf_compression_api(
    job_id: str,
    pdf_bytes: bytes,
    filename: str,
    compression_level: str,
    user_id: int,
    api_key_id: int
):
    """
    Background task to process PDF compression (API)
    Uploads to Azure Blob Storage if configured
    """
    from .main import get_db_session

    db = next(get_db_session())

    try:
        # Get usage record
        usage_record = db.query(ApiUsage).filter(ApiUsage.job_id == job_id).first()
        if not usage_record:
            return

        # Update status to processing
        usage_record.status = "PROCESSING"
        db.commit()

        start_time = datetime.utcnow()

        # Compress PDF
        compression_result = await compressor_service.compress_pdf(
            pdf_bytes,
            filename,
            compression_level=compression_level,
            remove_metadata=True,
            optimize_fonts=True
        )

        compressed_bytes = compression_result["compressed_bytes"]
        original_size = compression_result["original_size"]
        compressed_size = compression_result["compressed_size"]
        size_reduction_percentage = compression_result["size_reduction_percentage"]

        output_filename = filename.replace(".pdf", f"_compressed_{compression_level}.pdf")

        # Check if Azure Blob Storage is configured
        blob_out_url = os.getenv('AZURE_BLOB_OUT_URL')
        out_sas_token = os.getenv('AZURE_BLOB_OUT_SAS_TOKEN')

        blob_filename = None

        if blob_out_url and out_sas_token:
            # Upload to Azure Blob Storage
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                job_uuid = str(uuid.uuid4())[:8]
                blob_filename = f"compressed/{timestamp}_{job_uuid}_{output_filename}"
                blob_url = f"{blob_out_url}/{blob_filename}?{out_sas_token}"

                async with aiohttp.ClientSession() as session:
                    headers = {
                        'x-ms-blob-type': 'BlockBlob',
                        'Content-Type': 'application/pdf'
                    }

                    async with session.put(blob_url, data=compressed_bytes, headers=headers) as response:
                        if response.status not in [200, 201]:
                            error_text = await response.text()
                            raise Exception(f"Failed to upload to blob storage: {error_text}")

                print(f"DEBUG: Compressed PDF uploaded to blob storage: {blob_filename}")
            except Exception as blob_error:
                print(f"Warning: Failed to upload to Azure Blob Storage: {str(blob_error)}")
                print("Falling back to local storage")
                blob_filename = None

        # Also save to local storage (fallback or primary for local Docker)
        output_path = f"/tmp/compressor_job_{job_id}.pdf"
        with open(output_path, "wb") as f:
            f.write(compressed_bytes)

        # Save metadata
        metadata = {
            "original_filename": filename,
            "output_filename": output_filename,
            "compression_level": compression_level,
            "original_size": original_size,
            "compressed_size": compressed_size,
            "size_reduction_percentage": size_reduction_percentage,
            "blob_filename": blob_filename
        }

        metadata_file = f"/tmp/compressor_job_{job_id}_metadata.json"
        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Update usage record
        usage_record.status = "SUCCEEDED"
        usage_record.processing_time = processing_time
        usage_record.completed_at = datetime.utcnow()
        db.commit()

        print(f"DEBUG: Compression job {job_id} completed successfully. Reduction: {size_reduction_percentage}%")

    except Exception as e:
        print(f"ERROR: Compression job {job_id} failed: {str(e)}")
        # Update job with error
        usage_record = db.query(ApiUsage).filter(ApiUsage.job_id == job_id).first()
        if usage_record:
            usage_record.status = "FAILED"
            usage_record.error_message = str(e)
            usage_record.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()
