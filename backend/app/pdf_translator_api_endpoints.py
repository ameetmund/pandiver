from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Form
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

from .models import PDFTranslationJob, User as UserModel, ApiKey, ApiUsage
from .pdf_translation_service import PDFTranslationService
from .azure_doc_translation_service import AzureDocumentTranslationService
from .auth import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/pdf-translator-api", tags=["PDF Translator API"])

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

    if not db_api_key:
        # If not found in plain text, try hashed format (for consistency with PDF splitter API)
        import hashlib
        hashed_api_key = hashlib.sha256(api_key.encode()).hexdigest()

        db_api_key = db.query(ApiKey).filter(
            ApiKey.api_key == hashed_api_key,
            ApiKey.is_active == True
        ).first()

    if not db_api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )

    # Get the user associated with this API key
    user = db.query(UserModel).filter(UserModel.id == db_api_key.user_id).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found for API key"
        )

    return {"user": user, "api_key": db_api_key}

# Pydantic models for requests/responses
class PDFTranslationAnalysisResponse(BaseModel):
    total_pages: int
    filename: str
    detected_language: str
    language_confidence: float
    character_count: int
    sample_text: str
    translatable: bool

class SupportedLanguagesResponse(BaseModel):
    languages: Dict[str, Any]
    auto_detect_supported: bool

class TranslationStartRequest(BaseModel):
    source_language: str = "auto"
    target_language: str
    translation_method: str = "text"

class TranslationJobStatusResponse(BaseModel):
    job_id: str
    status: str
    original_filename: str
    translated_filename: Optional[str] = None
    source_language: str
    target_language: str
    detected_language: Optional[str] = None
    translation_method: str
    total_pages: int
    characters_translated: int
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class TranslationJobStartResponse(BaseModel):
    job_id: str
    status: str
    message: str

class ApiUsageResponse(BaseModel):
    job_id: str
    status: str
    endpoint: str
    file_count: int
    characters_translated: int
    processing_time: Optional[float]
    created_at: str
    completed_at: Optional[str]

class ErrorResponse(BaseModel):
    error: str
    detail: str
    job_id: Optional[str] = None

# Initialize services
translation_service = PDFTranslationService()
doc_translation_service = AzureDocumentTranslationService()

@router.get("/languages", response_model=SupportedLanguagesResponse)
async def get_supported_languages(auth_info: Dict = Depends(get_api_key_user)):
    """
    Get supported languages for translation (API endpoint)
    """
    try:
        result = await doc_translation_service.get_supported_languages()
        return SupportedLanguagesResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get supported languages: {str(e)}")

@router.post("/analyze", response_model=PDFTranslationAnalysisResponse)
async def analyze_pdf_for_translation(
    file: UploadFile = File(...),
    auth_info: Dict = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Analyze PDF and detect language for translation (API endpoint)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        # Create usage tracking record
        usage_record = ApiUsage(
            api_key_id=auth_info["api_key"].id,
            user_id=auth_info["user"].id,
            endpoint="/analyze",
            job_id=str(uuid.uuid4()),
            status="IN_PROGRESS",
            file_count=1
        )
        db.add(usage_record)
        db.commit()
        
        start_time = datetime.utcnow()
        pdf_bytes = await file.read()
        analysis_result = await translation_service.analyze_pdf_for_translation(pdf_bytes, file.filename)
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Update usage record
        usage_record.status = "SUCCEEDED"
        usage_record.processing_time = processing_time
        usage_record.completed_at = datetime.utcnow()
        db.commit()
        
        return PDFTranslationAnalysisResponse(**analysis_result)
        
    except Exception as e:
        # Update usage record with error
        usage_record.status = "FAILED"
        usage_record.error_message = str(e)
        usage_record.completed_at = datetime.utcnow()
        db.commit()
        
        raise HTTPException(status_code=500, detail=f"Failed to analyze PDF: {str(e)}")

@router.post("/translate", response_model=TranslationJobStartResponse)
async def start_pdf_translation(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_language: str = Form("auto"),
    target_language: str = Form(...),
    translation_method: str = Form("text"),
    auth_info: Dict = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Start PDF translation job (API endpoint)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if not target_language:
        raise HTTPException(status_code=400, detail="Target language is required")
    
    try:
        # Basic validation
        if not target_language or target_language.strip() == "":
            raise HTTPException(status_code=400, detail="Target language is required")
        
        if not source_language:
            source_language = "auto"
        
        # Read PDF and validate
        pdf_bytes = await file.read()
        analysis = await translation_service.analyze_pdf_for_translation(pdf_bytes, file.filename)
        
        if not analysis["translatable"]:
            raise HTTPException(
                status_code=400, 
                detail="PDF does not contain translatable text"
            )
        
        # Generate output filename
        translated_filename = doc_translation_service.generate_translated_filename(
            file.filename, source_language, target_language
        )
        
        # Create job
        job_id = str(uuid.uuid4())
        
        job = PDFTranslationJob(
            job_id=job_id,
            user_id=auth_info["user"].id,
            api_key_id=auth_info["api_key"].id,
            original_filename=file.filename,
            translated_filename=translated_filename,
            source_language=source_language,
            target_language=target_language,
            detected_language=analysis["detected_language"],
            translation_method=translation_method,
            total_pages=analysis["total_pages"],
            status="PENDING",
            file_size_bytes=len(pdf_bytes),
            characters_translated=0
        )
        
        db.add(job)
        db.commit()
        
        # Create usage tracking record
        usage_record = ApiUsage(
            api_key_id=auth_info["api_key"].id,
            user_id=auth_info["user"].id,
            endpoint="/translate",
            job_id=job_id,
            status="IN_PROGRESS",
            file_count=1
        )
        db.add(usage_record)
        db.commit()
        
        # Start background processing
        background_tasks.add_task(
            process_pdf_document_translation_api, 
            job_id, 
            pdf_bytes, 
            source_language,
            target_language,
            file.filename,
            analysis["character_count"],
            usage_record.id
        )
        
        return TranslationJobStartResponse(
            job_id=job_id,
            status="PENDING",
            message="PDF translation started successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start translation: {str(e)}")

@router.get("/jobs/{job_id}/status", response_model=TranslationJobStatusResponse)
async def get_translation_job_status(
    job_id: str,
    auth_info: Dict = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Get translation job status (API endpoint)
    """
    job = db.query(PDFTranslationJob).filter(
        PDFTranslationJob.job_id == job_id,
        PDFTranslationJob.user_id == auth_info["user"].id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return TranslationJobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        original_filename=job.original_filename,
        translated_filename=job.translated_filename,
        source_language=job.source_language,
        target_language=job.target_language,
        detected_language=job.detected_language,
        translation_method=job.translation_method,
        total_pages=job.total_pages,
        characters_translated=job.characters_translated,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None
    )

@router.get("/download/{job_id}")
async def download_translated_pdf(
    job_id: str,
    auth_info: Dict = Depends(get_api_key_user),
    db: Session = Depends(get_db)
):
    """
    Download the translated PDF (API endpoint)
    """
    job = db.query(PDFTranslationJob).filter(
        PDFTranslationJob.job_id == job_id,
        PDFTranslationJob.user_id == auth_info["user"].id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Translation is not completed yet")
    
    try:
        # First try to get URL from new document translation approach
        url_path = f"/tmp/translation_job_{job_id}_url.txt"
        if os.path.exists(url_path):
            # New approach: download from Azure Blob Storage
            with open(url_path, "r") as f:
                document_url = f.read().strip()
            
            if document_url:
                # Download from blob storage
                pdf_bytes = await doc_translation_service.download_translated_pdf(document_url)
                
                return StreamingResponse(
                    BytesIO(pdf_bytes),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={job.translated_filename}"}
                )
        
        # Fallback to legacy approach
        output_path = f"/tmp/translation_job_{job_id}.pdf"
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=404, detail="Translated file not found")
        
        def generate_file():
            with open(output_path, "rb") as file:
                yield from file
        
        return StreamingResponse(
            generate_file(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={job.translated_filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download translated PDF: {str(e)}")

@router.get("/jobs", response_model=List[TranslationJobStatusResponse])
async def list_translation_jobs(
    auth_info: Dict = Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 10,
    offset: int = 0
):
    """
    List user's translation jobs (API endpoint)
    """
    jobs = db.query(PDFTranslationJob).filter(
        PDFTranslationJob.user_id == auth_info["user"].id
    ).order_by(PDFTranslationJob.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        TranslationJobStatusResponse(
            job_id=job.job_id,
            status=job.status,
            original_filename=job.original_filename,
            translated_filename=job.translated_filename,
            source_language=job.source_language,
            target_language=job.target_language,
            detected_language=job.detected_language,
            translation_method=job.translation_method,
            total_pages=job.total_pages,
            characters_translated=job.characters_translated,
            error_message=job.error_message,
            created_at=job.created_at.isoformat(),
            completed_at=job.completed_at.isoformat() if job.completed_at else None
        )
        for job in jobs
    ]

@router.get("/usage", response_model=List[ApiUsageResponse])
async def get_api_usage(
    auth_info: Dict = Depends(get_api_key_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """
    Get API usage statistics (API endpoint)
    """
    usage_records = db.query(ApiUsage).filter(
        ApiUsage.user_id == auth_info["user"].id,
        ApiUsage.api_key_id == auth_info["api_key"].id
    ).order_by(ApiUsage.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        ApiUsageResponse(
            job_id=record.job_id,
            status=record.status,
            endpoint=record.endpoint,
            file_count=record.file_count,
            characters_translated=0,  # ApiUsage model doesn't have this field, use default
            processing_time=record.processing_time,
            created_at=record.created_at.isoformat(),
            completed_at=record.completed_at.isoformat() if record.completed_at else None
        )
        for record in usage_records
    ]

@router.get("/estimate")
async def get_translation_estimate(
    file: UploadFile = File(...),
    auth_info: Dict = Depends(get_api_key_user)
):
    """
    Get translation time and cost estimate (API endpoint)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        pdf_bytes = await file.read()
        estimate = await translation_service.get_translation_estimate(pdf_bytes)
        return estimate
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get estimate: {str(e)}")

# Background task for document translation (API version)
async def process_pdf_document_translation_api(
    job_id: str, 
    pdf_bytes: bytes, 
    source_language: str,
    target_language: str,
    filename: str,
    character_count: int,
    usage_record_id: int
):
    """
    Background task to process PDF translation using Azure Document Translation for API
    """
    from .main import get_db_session
    import asyncio
    
    db = next(get_db_session())
    
    try:
        job = db.query(PDFTranslationJob).filter(PDFTranslationJob.job_id == job_id).first()
        usage_record = db.query(ApiUsage).filter(ApiUsage.id == usage_record_id).first()
        
        if not job or not usage_record:
            return
        
        start_time = datetime.utcnow()
        
        # Update status to processing
        job.status = "PROCESSING"
        usage_record.status = "IN_PROGRESS"
        db.commit()
        
        # Step 1: Upload PDF to Azure Blob Storage
        source_url, unique_filename = await doc_translation_service.upload_pdf_to_blob(pdf_bytes, filename)
        
        # Step 2: Start Azure Document Translation job
        azure_job_id, output_folder = await doc_translation_service.start_document_translation(
            source_url, target_language, source_language, job_id
        )
        
        # Step 3: Poll for completion (with timeout)
        max_wait_time = 600  # 10 minutes max
        check_interval = 10  # Check every 10 seconds
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            await asyncio.sleep(check_interval)
            elapsed_time += check_interval
            
            status_info = await doc_translation_service.get_translation_status(azure_job_id)
            
            if status_info["status"] == "Succeeded":
                # Step 4: Get translated document URL and save location info
                document_url = await doc_translation_service.get_translated_document_url(
                    azure_job_id, unique_filename, output_folder
                )
                
                if document_url:
                    # Save the document URL for download
                    output_path = f"/tmp/translation_job_{job_id}_url.txt"
                    with open(output_path, "w") as f:
                        f.write(document_url)
                    
                    processing_time = (datetime.utcnow() - start_time).total_seconds()
                    
                    # Update job status
                    job.status = "COMPLETED"
                    job.characters_translated = character_count
                    job.completed_at = datetime.utcnow()
                    
                    # Update usage record
                    usage_record.status = "SUCCEEDED"
                    usage_record.processing_time = processing_time
                    usage_record.completed_at = datetime.utcnow()
                    
                    db.commit()
                    return
                else:
                    raise Exception("Failed to get translated document URL")
                    
            elif status_info["status"] in ["Failed", "Cancelled", "ValidationFailed"]:
                error_detail = status_info.get("error", {})
                if isinstance(error_detail, dict):
                    error_msg = error_detail.get("message", "Translation failed")
                else:
                    error_msg = str(error_detail)
                raise Exception(f"Azure translation failed: {error_msg}")
        
        # If we get here, translation timed out
        raise Exception(f"Translation timed out after {max_wait_time} seconds")
        
    except Exception as e:
        # Update job with error
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
        
        # Update usage record with error
        if usage_record:
            usage_record.status = "FAILED"
            usage_record.error_message = str(e)
            usage_record.completed_at = datetime.utcnow()
        
        db.commit()
    finally:
        db.close()