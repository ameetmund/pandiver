from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Form, status
from fastapi.responses import StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import uuid
import os
import tempfile
from datetime import datetime
from io import BytesIO
import zipfile

from .models import User as UserModel
from .pdf_converter_service import PDFConverterService
from .auth import get_current_user, get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/pdf-converter", tags=["PDF ↔ Office Converter (UI)"])

# Initialize service
converter_service = PDFConverterService()


class SupportedFormatsResponse(BaseModel):
    from_pdf: Dict[str, Dict[str, str]]
    to_pdf: Dict[str, Dict[str, str]]
    is_configured: bool


class FileAnalysisResponse(BaseModel):
    filename: str
    file_size_bytes: int
    file_size_mb: float
    file_extension: str
    is_pdf: bool
    detected_format: Optional[str]


class ConversionJobResponse(BaseModel):
    job_id: str
    status: str
    message: str


class ConversionJobStatusResponse(BaseModel):
    job_id: str
    status: str
    original_filename: str
    conversion_type: str  # "from_pdf" or "to_pdf"
    target_formats: Optional[List[str]] = None
    source_format: Optional[str] = None
    total_conversions: Optional[int] = None
    successful_conversions: Optional[int] = None
    failed_conversions: Optional[int] = None
    download_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


@router.get("/supported-formats", response_model=SupportedFormatsResponse)
async def get_supported_formats(
    current_user: UserModel = Depends(get_current_user)
):
    """Get list of supported conversion formats"""
    return SupportedFormatsResponse(**converter_service.get_supported_formats())


@router.post("/analyze", response_model=FileAnalysisResponse)
async def analyze_file(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Analyze uploaded file and return metadata
    """
    try:
        file_bytes = await file.read()
        analysis_result = await converter_service.analyze_file(file_bytes, file.filename)
        return FileAnalysisResponse(**analysis_result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze file: {str(e)}")


@router.post("/convert-from-pdf", response_model=ConversionJobResponse)
async def convert_from_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_formats: str = Form(...),  # Comma-separated list: "docx,xlsx,jpeg"
    current_user: UserModel = Depends(get_current_user)
):
    """
    Convert PDF to one or more target formats (UI endpoint)
    Supports multiple output formats in a single request
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        # Parse target formats
        formats_list = [fmt.strip().lower() for fmt in target_formats.split(',')]

        if not formats_list:
            raise HTTPException(status_code=400, detail="At least one target format is required")

        # Read PDF
        pdf_bytes = await file.read()

        # Create job ID
        job_id = str(uuid.uuid4())

        # Start background processing
        background_tasks.add_task(
            process_from_pdf_conversion,
            job_id,
            pdf_bytes,
            file.filename,
            formats_list,
            current_user.id
        )

        return ConversionJobResponse(
            job_id=job_id,
            status="PROCESSING",
            message=f"PDF conversion started. Converting to: {', '.join(formats_list)}"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start conversion: {str(e)}")


@router.post("/convert-to-pdf", response_model=ConversionJobResponse)
async def convert_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Convert various formats to PDF (UI endpoint)
    """
    # Detect source format from filename
    file_extension = os.path.splitext(file.filename)[1].lower().lstrip('.')

    if file_extension not in converter_service.TO_PDF_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {file_extension}. "
                   f"Supported formats: {', '.join(converter_service.TO_PDF_FORMATS.keys())}"
        )

    try:
        # Read file
        file_bytes = await file.read()

        # Create job ID
        job_id = str(uuid.uuid4())

        # Start background processing
        background_tasks.add_task(
            process_to_pdf_conversion,
            job_id,
            file_bytes,
            file.filename,
            file_extension,
            current_user.id
        )

        return ConversionJobResponse(
            job_id=job_id,
            status="PROCESSING",
            message=f"Converting {file_extension.upper()} to PDF"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start conversion: {str(e)}")


@router.get("/jobs/{job_id}/status", response_model=ConversionJobStatusResponse)
async def get_conversion_job_status(
    job_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get conversion job status (UI endpoint)
    """
    # Get job metadata from temp file
    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"

    if not os.path.exists(metadata_file):
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        with open(metadata_file, "r") as f:
            metadata = json.load(f)

        # Verify job belongs to this user
        if metadata.get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Generate download URL if completed
        download_url = None
        if metadata.get("status") == "COMPLETED":
            download_url = f"/api/v1/pdf-converter/download/{job_id}"

        return ConversionJobStatusResponse(
            job_id=job_id,
            status=metadata.get("status", "UNKNOWN"),
            original_filename=metadata.get("original_filename", "unknown"),
            conversion_type=metadata.get("conversion_type", "unknown"),
            target_formats=metadata.get("target_formats"),
            source_format=metadata.get("source_format"),
            total_conversions=metadata.get("total_conversions"),
            successful_conversions=metadata.get("successful_conversions"),
            failed_conversions=metadata.get("failed_conversions"),
            download_url=download_url,
            error_message=metadata.get("error_message"),
            created_at=metadata.get("created_at", datetime.utcnow().isoformat()),
            completed_at=metadata.get("completed_at")
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid job metadata")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")


@router.get("/download/{job_id}")
async def download_conversion_result(
    job_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Download conversion result (UI endpoint)
    Returns a single file or a ZIP file with multiple conversions
    """
    # Get job metadata
    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"

    if not os.path.exists(metadata_file):
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        with open(metadata_file, "r") as f:
            metadata = json.load(f)

        # Verify job belongs to this user
        if metadata.get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        if metadata.get("status") != "COMPLETED":
            raise HTTPException(
                status_code=400,
                detail=f"Job is not completed. Current status: {metadata.get('status')}"
            )

        conversion_type = metadata.get("conversion_type")

        if conversion_type == "from_pdf":
            # Multiple files - return as ZIP
            conversions = metadata.get("conversions", [])
            successful_conversions = [c for c in conversions if c.get("success")]

            if not successful_conversions:
                raise HTTPException(status_code=404, detail="No successful conversions found")

            if len(successful_conversions) == 1:
                # Single file - return directly
                output_path = f"/tmp/converter_job_{job_id}_{successful_conversions[0]['format']}"

                if not os.path.exists(output_path):
                    raise HTTPException(status_code=404, detail="Converted file not found")

                def generate_file():
                    with open(output_path, "rb") as file:
                        yield from file

                # Determine media type based on format
                format_ext = successful_conversions[0]['format']
                media_types = {
                    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "doc": "application/msword",
                    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "rtf": "application/rtf",
                    "jpeg": "image/jpeg",
                    "png": "image/png"
                }

                return StreamingResponse(
                    generate_file(),
                    media_type=media_types.get(format_ext, "application/octet-stream"),
                    headers={
                        "Content-Disposition": f"attachment; filename={successful_conversions[0]['output_filename']}"
                    }
                )
            else:
                # Multiple files - create ZIP
                zip_buffer = BytesIO()

                with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                    for conversion in successful_conversions:
                        output_path = f"/tmp/converter_job_{job_id}_{conversion['format']}"
                        if os.path.exists(output_path):
                            with open(output_path, 'rb') as f:
                                zip_file.writestr(conversion['output_filename'], f.read())

                zip_buffer.seek(0)

                base_filename = os.path.splitext(metadata.get("original_filename", "converted"))[0]
                zip_filename = f"{base_filename}_converted.zip"

                return StreamingResponse(
                    zip_buffer,
                    media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
                )

        elif conversion_type == "to_pdf":
            # Single PDF file
            output_path = f"/tmp/converter_job_{job_id}.pdf"

            if not os.path.exists(output_path):
                raise HTTPException(status_code=404, detail="Converted PDF not found")

            def generate_file():
                with open(output_path, "rb") as file:
                    yield from file

            output_filename = metadata.get("output_filename", "converted.pdf")

            return StreamingResponse(
                generate_file(),
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={output_filename}"}
            )

        else:
            raise HTTPException(status_code=400, detail="Unknown conversion type")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")


# Background task functions

async def process_from_pdf_conversion(
    job_id: str,
    pdf_bytes: bytes,
    filename: str,
    target_formats: List[str],
    user_id: int
):
    """Background task to process PDF to other formats conversion"""
    metadata = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "PROCESSING",
        "original_filename": filename,
        "conversion_type": "from_pdf",
        "target_formats": target_formats,
        "created_at": datetime.utcnow().isoformat()
    }

    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"

    try:
        # Save initial metadata
        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Perform conversion
        result = await converter_service.convert_from_pdf(pdf_bytes, filename, target_formats)

        # Save each converted file
        for conversion in result["conversions"]:
            if conversion["success"] and conversion["output_bytes"]:
                output_path = f"/tmp/converter_job_{job_id}_{conversion['format']}"
                with open(output_path, "wb") as f:
                    f.write(conversion["output_bytes"])

        # Update metadata
        metadata["status"] = "COMPLETED"
        metadata["total_conversions"] = result["total_conversions"]
        metadata["successful_conversions"] = result["successful_conversions"]
        metadata["failed_conversions"] = result["failed_conversions"]
        metadata["conversions"] = [
            {
                "format": c["format"],
                "format_name": c["format_name"],
                "output_filename": c["output_filename"],
                "success": c["success"],
                "error": c["error"]
            }
            for c in result["conversions"]
        ]
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        print(f"DEBUG: Conversion job {job_id} completed. {result['successful_conversions']}/{result['total_conversions']} successful")

    except Exception as e:
        print(f"ERROR: Conversion job {job_id} failed: {str(e)}")
        metadata["status"] = "FAILED"
        metadata["error_message"] = str(e)
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)


async def process_to_pdf_conversion(
    job_id: str,
    file_bytes: bytes,
    filename: str,
    source_format: str,
    user_id: int
):
    """Background task to process other formats to PDF conversion"""
    metadata = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "PROCESSING",
        "original_filename": filename,
        "conversion_type": "to_pdf",
        "source_format": source_format,
        "created_at": datetime.utcnow().isoformat()
    }

    metadata_file = f"/tmp/converter_job_{job_id}_metadata.json"

    try:
        # Save initial metadata
        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        # Perform conversion
        result = await converter_service.convert_to_pdf(file_bytes, filename, source_format)

        # Save PDF file
        output_path = f"/tmp/converter_job_{job_id}.pdf"
        with open(output_path, "wb") as f:
            f.write(result["pdf_bytes"])

        # Update metadata
        metadata["status"] = "COMPLETED"
        metadata["output_filename"] = result["output_filename"]
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)

        print(f"DEBUG: Conversion job {job_id} completed. {source_format} -> PDF")

    except Exception as e:
        print(f"ERROR: Conversion job {job_id} failed: {str(e)}")
        metadata["status"] = "FAILED"
        metadata["error_message"] = str(e)
        metadata["completed_at"] = datetime.utcnow().isoformat()

        with open(metadata_file, "w") as f:
            json.dump(metadata, f)
