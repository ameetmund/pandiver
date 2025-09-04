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

from .models import PDFSplitterJob, User as UserModel, ApiKey
from .pdf_splitter_service import PDFSplitterService
from .auth import get_current_user, get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/pdf-splitter", tags=["PDF Splitter"])

# Pydantic models for requests/responses
class PDFAnalysisResponse(BaseModel):
    total_pages: int
    filename: str
    pages: List[Dict[str, Any]]

class PageExtractionRequest(BaseModel):
    page_numbers: List[int]

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    original_filename: str
    selected_pages: List[int]
    output_filename: Optional[str] = None
    total_pages: int
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class JobStartResponse(BaseModel):
    job_id: str
    status: str
    message: str

# Initialize service
splitter_service = PDFSplitterService()

@router.post("/analyze", response_model=PDFAnalysisResponse)
async def analyze_pdf_for_splitting(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Analyze PDF and return page information with thumbnails
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        pdf_bytes = await file.read()
        analysis_result = await splitter_service.analyze_pdf(pdf_bytes, file.filename)
        
        return PDFAnalysisResponse(**analysis_result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze PDF: {str(e)}")

@router.post("/extract", response_model=JobStartResponse)
async def start_page_extraction(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    page_numbers: str = Form(...),  # JSON string of page numbers
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Start page extraction job
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if not page_numbers:
        raise HTTPException(status_code=400, detail="Page numbers are required")
    
    try:
        # Parse page numbers
        selected_pages = json.loads(page_numbers)
        if not isinstance(selected_pages, list) or not selected_pages:
            raise HTTPException(status_code=400, detail="Invalid page numbers format")
        
        # Read PDF and validate
        pdf_bytes = await file.read()
        metadata = await splitter_service.get_pdf_metadata(pdf_bytes)
        
        if not splitter_service.validate_page_numbers(selected_pages, metadata["page_count"]):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid page numbers. PDF has {metadata['page_count']} pages"
            )
        
        # Create job
        job_id = str(uuid.uuid4())
        output_filename = splitter_service.generate_output_filename(file.filename, selected_pages)
        
        job = PDFSplitterJob(
            job_id=job_id,
            user_id=current_user.id,
            original_filename=file.filename,
            selected_pages=json.dumps(selected_pages),
            output_filename=output_filename,
            total_pages=metadata["page_count"],
            status="PENDING",
            file_size_bytes=len(pdf_bytes)
        )
        
        db.add(job)
        db.commit()
        
        # Start background processing
        background_tasks.add_task(
            process_page_extraction, 
            job_id, 
            pdf_bytes, 
            selected_pages, 
            file.filename
        )
        
        return JobStartResponse(
            job_id=job_id,
            status="PENDING",
            message="Page extraction started successfully"
        )
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid page numbers JSON format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start extraction: {str(e)}")

@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get job status
    """
    job = db.query(PDFSplitterJob).filter(
        PDFSplitterJob.job_id == job_id,
        PDFSplitterJob.user_id == current_user.id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        original_filename=job.original_filename,
        selected_pages=json.loads(job.selected_pages),
        output_filename=job.output_filename,
        total_pages=job.total_pages,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None
    )

@router.get("/download/{job_id}")
async def download_extracted_pdf(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Download the extracted PDF
    """
    job = db.query(PDFSplitterJob).filter(
        PDFSplitterJob.job_id == job_id,
        PDFSplitterJob.user_id == current_user.id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job is not completed yet")
    
    # Read the processed file
    output_path = f"/tmp/splitter_job_{job_id}.pdf"
    
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Processed file not found")
    
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
    List user's splitter jobs
    """
    jobs = db.query(PDFSplitterJob).filter(
        PDFSplitterJob.user_id == current_user.id
    ).order_by(PDFSplitterJob.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        {
            "job_id": job.job_id,
            "status": job.status,
            "original_filename": job.original_filename,
            "selected_pages": json.loads(job.selected_pages),
            "output_filename": job.output_filename,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        }
        for job in jobs
    ]

# Background task for processing
async def process_page_extraction(job_id: str, pdf_bytes: bytes, page_numbers: List[int], filename: str):
    """
    Background task to process page extraction
    """
    from .main import get_db_session
    
    db = next(get_db_session())
    
    try:
        job = db.query(PDFSplitterJob).filter(PDFSplitterJob.job_id == job_id).first()
        if not job:
            return
        
        # Update status to processing
        job.status = "PROCESSING"
        db.commit()
        
        # Extract pages
        extracted_pdf_bytes = await splitter_service.extract_pages(pdf_bytes, page_numbers, filename)
        
        # Save to temporary location
        output_path = f"/tmp/splitter_job_{job_id}.pdf"
        with open(output_path, "wb") as f:
            f.write(extracted_pdf_bytes)
        
        # Update job status
        job.status = "COMPLETED"
        job.completed_at = datetime.utcnow()
        db.commit()
        
    except Exception as e:
        # Update job with error
        job = db.query(PDFSplitterJob).filter(PDFSplitterJob.job_id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()