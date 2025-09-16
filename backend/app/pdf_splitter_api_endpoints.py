from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Form, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Any, Optional
import json
import uuid
import os
import tempfile
from datetime import datetime
from io import BytesIO
import hashlib

from .models import PDFSplitterJob, User as UserModel, ApiKey, ApiUsage
from .pdf_splitter_service import PDFSplitterService
from .auth import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/pdf-splitter-api", tags=["PDF Splitter API"])

# Security scheme
security = HTTPBearer()

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
class PDFSplitterAnalysisResponse(BaseModel):
    total_pages: int
    filename: str
    file_size_bytes: int
    splittable: bool

class SplitterJobStartRequest(BaseModel):
    selected_pages: List[int]
    output_filename: Optional[str] = None

class SplitterJobStatusResponse(BaseModel):
    job_id: str
    status: str
    original_filename: str
    output_filename: Optional[str] = None
    selected_pages: List[int]
    total_pages: int
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class SplitterJobStartResponse(BaseModel):
    job_id: str
    status: str
    message: str

class ApiUsageResponse(BaseModel):
    job_id: str
    status: str
    endpoint: str
    file_count: int
    pages_extracted: int
    processing_time: Optional[float]
    created_at: str
    completed_at: Optional[str]

class ErrorResponse(BaseModel):
    error: str
    detail: str
    job_id: Optional[str] = None

# Initialize service
splitter_service = PDFSplitterService()

@router.post("/analyze", response_model=PDFSplitterAnalysisResponse)
async def analyze_pdf_for_splitting(
    file: UploadFile = File(...),
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Analyze PDF for page splitting (API endpoint)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        user, api_key = user_and_key
        
        # Create usage tracking record
        usage_record = ApiUsage(
            api_key_id=api_key.id,
            user_id=user.id,
            endpoint="/analyze",
            job_id=str(uuid.uuid4()),
            status="IN_PROGRESS",
            file_count=1
        )
        db.add(usage_record)
        db.commit()
        
        start_time = datetime.utcnow()
        pdf_bytes = await file.read()
        print(f"DEBUG: PDF Splitter API - analyzing PDF {file.filename}, size: {len(pdf_bytes)} bytes")
        analysis_result = await splitter_service.analyze_pdf(pdf_bytes, file.filename)
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Update usage record
        usage_record.status = "SUCCEEDED"
        usage_record.processing_time = processing_time
        usage_record.completed_at = datetime.utcnow()
        db.commit()
        
        # Transform result to match expected format
        return PDFSplitterAnalysisResponse(
            total_pages=analysis_result["total_pages"],
            filename=analysis_result["filename"],
            file_size_bytes=len(pdf_bytes),
            splittable=analysis_result["total_pages"] > 0
        )
        
    except Exception as e:
        print(f"ERROR: PDF Splitter API analyze failed: {str(e)}")
        import traceback
        print(f"ERROR: Full traceback: {traceback.format_exc()}")
        
        # Update usage record with error if it exists
        try:
            if 'usage_record' in locals():
                usage_record.status = "FAILED"
                usage_record.error_message = str(e)
                usage_record.completed_at = datetime.utcnow()
                db.commit()
        except Exception as db_error:
            print(f"ERROR: Failed to update usage record: {str(db_error)}")
        
        raise HTTPException(status_code=500, detail=f"Failed to analyze PDF: {str(e)}")

@router.post("/split", response_model=SplitterJobStartResponse)
async def start_pdf_splitting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    selected_pages: str = Form(...),  # JSON string of page numbers
    output_filename: Optional[str] = Form(None),
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Start PDF splitting job (API endpoint)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        # Parse selected pages
        try:
            pages_list = json.loads(selected_pages)
            if not isinstance(pages_list, list) or not pages_list:
                raise ValueError("Selected pages must be a non-empty list")
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=400, detail="Invalid selected_pages format")
        
        # Read and validate PDF
        pdf_bytes = await file.read()
        metadata = await splitter_service.get_pdf_metadata(pdf_bytes)
        
        # Check if pages exist (simplified validation)
        if metadata["page_count"] < 1:
            raise HTTPException(
                status_code=400, 
                detail="PDF cannot be split"
            )
        
        # Generate output filename if not provided
        if not output_filename:
            base_name = os.path.splitext(file.filename)[0]
            output_filename = f"{base_name}_split.pdf"
        
        user, api_key = user_and_key
        
        # Create job
        job_id = str(uuid.uuid4())
        
        job = PDFSplitterJob(
            job_id=job_id,
            user_id=user.id,
            api_key_id=api_key.id,
            original_filename=file.filename,
            selected_pages=json.dumps(pages_list),
            output_filename=output_filename,
            total_pages=metadata["page_count"],
            status="PENDING",
            file_size_bytes=len(pdf_bytes)
        )
        
        db.add(job)
        db.commit()
        
        # Create usage tracking record
        usage_record = ApiUsage(
            api_key_id=api_key.id,
            user_id=user.id,
            endpoint="/split",
            job_id=job_id,
            status="IN_PROGRESS",
            file_count=1
        )
        db.add(usage_record)
        db.commit()
        
        # Start background processing
        background_tasks.add_task(
            process_pdf_splitting_api, 
            job_id, 
            pdf_bytes, 
            pages_list,
            output_filename,
            usage_record.id
        )
        
        return SplitterJobStartResponse(
            job_id=job_id,
            status="PENDING",
            message="PDF splitting started successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start splitting: {str(e)}")

@router.get("/jobs/{job_id}/status", response_model=SplitterJobStatusResponse)
async def get_splitting_job_status(
    job_id: str,
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Get splitting job status (API endpoint)
    """
    user, api_key = user_and_key
    
    job = db.query(PDFSplitterJob).filter(
        PDFSplitterJob.job_id == job_id,
        PDFSplitterJob.user_id == user.id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return SplitterJobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        original_filename=job.original_filename,
        output_filename=job.output_filename,
        selected_pages=json.loads(job.selected_pages),
        total_pages=job.total_pages,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None
    )

@router.get("/download/{job_id}")
async def download_split_pdf(
    job_id: str,
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Download the split PDF (API endpoint)
    """
    user, api_key = user_and_key
    
    job = db.query(PDFSplitterJob).filter(
        PDFSplitterJob.job_id == job_id,
        PDFSplitterJob.user_id == user.id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Splitting is not completed yet")
    
    try:
        output_path = f"/tmp/splitter_job_{job_id}.pdf"
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=404, detail="Split file not found")
        
        def generate_file():
            with open(output_path, "rb") as file:
                yield from file
        
        return StreamingResponse(
            generate_file(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={job.output_filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download split PDF: {str(e)}")

@router.get("/jobs", response_model=List[SplitterJobStatusResponse])
async def list_splitting_jobs(
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 10,
    offset: int = 0
):
    """
    List user's splitting jobs (API endpoint)
    """
    user, api_key = user_and_key
    
    jobs = db.query(PDFSplitterJob).filter(
        PDFSplitterJob.user_id == user.id
    ).order_by(PDFSplitterJob.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        SplitterJobStatusResponse(
            job_id=job.job_id,
            status=job.status,
            original_filename=job.original_filename,
            output_filename=job.output_filename,
            selected_pages=json.loads(job.selected_pages),
            total_pages=job.total_pages,
            error_message=job.error_message,
            created_at=job.created_at.isoformat(),
            completed_at=job.completed_at.isoformat() if job.completed_at else None
        )
        for job in jobs
    ]

@router.get("/usage", response_model=List[ApiUsageResponse])
async def get_api_usage(
    user_and_key = Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """
    Get API usage statistics (API endpoint)
    """
    user, api_key = user_and_key
    
    usage_records = db.query(ApiUsage).filter(
        ApiUsage.user_id == user.id
    ).order_by(ApiUsage.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        ApiUsageResponse(
            job_id=record.job_id,
            status=record.status,
            endpoint=record.endpoint,
            file_count=record.file_count,
            pages_extracted=0,  # ApiUsage model doesn't have this field, use default
            processing_time=record.processing_time,
            created_at=record.created_at.isoformat(),
            completed_at=record.completed_at.isoformat() if record.completed_at else None
        )
        for record in usage_records
    ]

# Background task for PDF splitting
async def process_pdf_splitting_api(
    job_id: str, 
    pdf_bytes: bytes, 
    selected_pages: List[int],
    output_filename: str,
    usage_record_id: int
):
    """
    Background task to process PDF splitting for API
    """
    from .main import get_db_session
    
    db = next(get_db_session())
    
    try:
        job = db.query(PDFSplitterJob).filter(PDFSplitterJob.job_id == job_id).first()
        usage_record = db.query(ApiUsage).filter(ApiUsage.id == usage_record_id).first()
        
        if not job or not usage_record:
            return
        
        start_time = datetime.utcnow()
        
        # Update status to processing
        job.status = "PROCESSING"
        usage_record.status = "IN_PROGRESS"
        db.commit()
        
        # Perform splitting
        split_pdf_bytes = await splitter_service.extract_pages(
            pdf_bytes, selected_pages, output_filename
        )
        
        # Save split PDF to temporary location
        output_path = f"/tmp/splitter_job_{job_id}.pdf"
        with open(output_path, "wb") as f:
            f.write(split_pdf_bytes)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Update job and usage record status
        job.status = "COMPLETED"
        job.completed_at = datetime.utcnow()
        
        usage_record.status = "SUCCEEDED"
        usage_record.processing_time = processing_time
        usage_record.completed_at = datetime.utcnow()
        
        db.commit()
        
    except Exception as e:
        # Update job and usage record with error
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
        
        if usage_record:
            usage_record.status = "FAILED"
            usage_record.error_message = str(e)
            usage_record.completed_at = datetime.utcnow()
        
        db.commit()
    finally:
        db.close()