from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import uuid
import os
import tempfile
from datetime import datetime
from io import BytesIO

from .models import PDFCompressorJob, User as UserModel, ApiKey
from .pdf_compressor_service import PDFCompressorService
from .auth import get_current_user, get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/pdf-compressor", tags=["PDF Compressor & Optimizer"])

# Pydantic models for requests/responses
class PDFAnalysisResponse(BaseModel):
    filename: str
    file_size_bytes: int
    file_size_mb: float
    total_pages: int
    has_images: bool
    image_count: int
    estimated_savings: Dict[str, Dict[str, Any]]

class CompressionRequest(BaseModel):
    compression_level: str  # "light", "moderate", "aggressive"

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    original_filename: str
    compression_level: str
    output_filename: Optional[str] = None
    original_size: Optional[int] = None
    compressed_size: Optional[int] = None
    size_reduction_percentage: Optional[float] = None
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class JobStartResponse(BaseModel):
    job_id: str
    status: str
    message: str

class CompressionLevelsResponse(BaseModel):
    levels: Dict[str, Dict[str, Any]]

# Initialize service
compressor_service = PDFCompressorService()

@router.get("/compression-levels", response_model=CompressionLevelsResponse)
async def get_compression_levels():
    """
    Get available compression levels and their descriptions
    """
    return CompressionLevelsResponse(
        levels=compressor_service.get_compression_levels()
    )

@router.post("/analyze", response_model=PDFAnalysisResponse)
async def analyze_pdf_for_compression(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Analyze PDF and return file information with estimated compression savings
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        pdf_bytes = await file.read()
        analysis_result = await compressor_service.analyze_pdf(pdf_bytes, file.filename)

        return PDFAnalysisResponse(**analysis_result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze PDF: {str(e)}")

@router.post("/compress", response_model=JobStartResponse)
async def start_pdf_compression(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    compression_level: str = Form(...),  # "light", "moderate", "aggressive"
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Start PDF compression job
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    if compression_level not in ["light", "moderate", "aggressive"]:
        raise HTTPException(status_code=400, detail="Invalid compression level")

    try:
        # Read PDF
        pdf_bytes = await file.read()

        # Create job
        job_id = str(uuid.uuid4())
        output_filename = file.filename.replace(".pdf", f"_compressed_{compression_level}.pdf")

        job = PDFCompressorJob(
            job_id=job_id,
            user_id=current_user.id,
            original_filename=file.filename,
            output_filename=output_filename,
            compression_level=compression_level,
            status="PENDING",
            original_size=len(pdf_bytes)
        )

        db.add(job)
        db.commit()

        # Start background processing
        background_tasks.add_task(
            process_pdf_compression,
            job_id,
            pdf_bytes,
            compression_level,
            file.filename
        )

        return JobStartResponse(
            job_id=job_id,
            status="PENDING",
            message=f"PDF compression started with {compression_level} level"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start compression: {str(e)}")

@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get compression job status
    """
    job = db.query(PDFCompressorJob).filter(
        PDFCompressorJob.job_id == job_id,
        PDFCompressorJob.user_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        original_filename=job.original_filename,
        compression_level=job.compression_level,
        output_filename=job.output_filename,
        original_size=job.original_size,
        compressed_size=job.compressed_size,
        size_reduction_percentage=job.size_reduction_percentage,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None
    )

@router.get("/download/{job_id}")
async def download_compressed_pdf(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Download the compressed PDF
    """
    job = db.query(PDFCompressorJob).filter(
        PDFCompressorJob.job_id == job_id,
        PDFCompressorJob.user_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job is not completed yet")

    # Read the compressed file
    output_path = f"/tmp/compressor_job_{job_id}.pdf"

    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Compressed file not found")

    def generate_file():
        with open(output_path, "rb") as file:
            yield from file

    return StreamingResponse(
        generate_file(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={job.output_filename}"}
    )

@router.get("/jobs")
async def list_jobs(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    limit: int = 10,
    offset: int = 0
):
    """
    List user's compression jobs
    """
    jobs = db.query(PDFCompressorJob).filter(
        PDFCompressorJob.user_id == current_user.id
    ).order_by(PDFCompressorJob.created_at.desc()).offset(offset).limit(limit).all()

    return [
        {
            "job_id": job.job_id,
            "status": job.status,
            "original_filename": job.original_filename,
            "compression_level": job.compression_level,
            "output_filename": job.output_filename,
            "original_size": job.original_size,
            "compressed_size": job.compressed_size,
            "size_reduction_percentage": job.size_reduction_percentage,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        }
        for job in jobs
    ]

# Background task for processing
async def process_pdf_compression(job_id: str, pdf_bytes: bytes, compression_level: str, filename: str):
    """
    Background task to process PDF compression
    """
    from .main import get_db_session

    db = next(get_db_session())

    try:
        job = db.query(PDFCompressorJob).filter(PDFCompressorJob.job_id == job_id).first()
        if not job:
            return

        # Update status to processing
        job.status = "PROCESSING"
        db.commit()

        # Compress PDF
        compression_result = await compressor_service.compress_pdf(
            pdf_bytes,
            filename,
            compression_level=compression_level,
            remove_metadata=True,
            optimize_fonts=True
        )

        # Save to temporary location
        output_path = f"/tmp/compressor_job_{job_id}.pdf"
        with open(output_path, "wb") as f:
            f.write(compression_result["compressed_bytes"])

        # Update job status with compression stats
        job.status = "COMPLETED"
        job.compressed_size = compression_result["compressed_size"]
        job.size_reduction_percentage = compression_result["size_reduction_percentage"]
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        # Update job with error
        job = db.query(PDFCompressorJob).filter(PDFCompressorJob.job_id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()
