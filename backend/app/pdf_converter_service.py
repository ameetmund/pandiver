import os
import uuid
import tempfile
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Literal
from io import BytesIO
from fastapi import HTTPException
import base64
import logging

# Adobe PDF Services SDK imports
try:
    from adobe.pdfservices.operation.auth.service_principal_credentials import ServicePrincipalCredentials
    from adobe.pdfservices.operation.pdf_services import PDFServices
    from adobe.pdfservices.operation.pdf_services_media_type import PDFServicesMediaType
    from adobe.pdfservices.operation.io.cloud_asset import CloudAsset
    from adobe.pdfservices.operation.io.stream_asset import StreamAsset

    # Export PDF operations
    from adobe.pdfservices.operation.pdfjobs.jobs.export_pdf_job import ExportPDFJob
    from adobe.pdfservices.operation.pdfjobs.params.export_pdf.export_pdf_params import ExportPDFParams
    from adobe.pdfservices.operation.pdfjobs.params.export_pdf.export_pdf_target_format import ExportPDFTargetFormat
    from adobe.pdfservices.operation.pdfjobs.params.export_pdf.export_ocr_locale import ExportOCRLocale

    # Create PDF operations
    from adobe.pdfservices.operation.pdfjobs.jobs.create_pdf_job import CreatePDFJob
    from adobe.pdfservices.operation.pdfjobs.params.create_pdf.CreatePDFParams import CreatePDFParams

    from adobe.pdfservices.operation.pdfjobs.result.export_pdf_result import ExportPDFResult
    from adobe.pdfservices.operation.pdfjobs.result.create_pdf_result import CreatePDFResult

    ADOBE_SDK_AVAILABLE = True
except ImportError:
    ADOBE_SDK_AVAILABLE = False
    logging.warning("Adobe PDF Services SDK not installed. PDF conversion features will be disabled.")

logger = logging.getLogger(__name__)


class PDFConverterService:
    """Service for PDF conversion using Adobe PDF Services API"""

    # Supported conversion formats
    # Note: Adobe PDF Services SDK only supports DOC, DOCX, XLSX, PPTX, RTF exports
    # JPEG and PNG are NOT supported by Adobe's ExportPDFTargetFormat
    FROM_PDF_FORMATS = {
        "docx": {"name": "Microsoft Word (DOCX)", "extension": ".docx", "adobe_format": "DOCX"},
        "xlsx": {"name": "Microsoft Excel (XLSX)", "extension": ".xlsx", "adobe_format": "XLSX"},
        "pptx": {"name": "Microsoft PowerPoint (PPTX)", "extension": ".pptx", "adobe_format": "PPTX"},
    }

    TO_PDF_FORMATS = {
        "html": {"name": "HTML", "extension": ".html", "media_type": PDFServicesMediaType.HTML if ADOBE_SDK_AVAILABLE else None},
        "docx": {"name": "Microsoft Word (DOCX)", "extension": ".docx", "media_type": PDFServicesMediaType.DOCX if ADOBE_SDK_AVAILABLE else None},
        "doc": {"name": "Microsoft Word (DOC)", "extension": ".doc", "media_type": PDFServicesMediaType.DOC if ADOBE_SDK_AVAILABLE else None},
        "xlsx": {"name": "Microsoft Excel (XLSX)", "extension": ".xlsx", "media_type": PDFServicesMediaType.XLSX if ADOBE_SDK_AVAILABLE else None},
        "xls": {"name": "Microsoft Excel (XLS)", "extension": ".xls", "media_type": PDFServicesMediaType.XLS if ADOBE_SDK_AVAILABLE else None},
        "pptx": {"name": "Microsoft PowerPoint (PPTX)", "extension": ".pptx", "media_type": PDFServicesMediaType.PPTX if ADOBE_SDK_AVAILABLE else None},
        "ppt": {"name": "Microsoft PowerPoint (PPT)", "extension": ".ppt", "media_type": PDFServicesMediaType.PPT if ADOBE_SDK_AVAILABLE else None},
        "txt": {"name": "Text File", "extension": ".txt", "media_type": PDFServicesMediaType.TXT if ADOBE_SDK_AVAILABLE else None},
        "jpeg": {"name": "JPEG Image", "extension": ".jpeg", "media_type": PDFServicesMediaType.JPEG if ADOBE_SDK_AVAILABLE else None},
        "jpg": {"name": "JPEG Image", "extension": ".jpg", "media_type": PDFServicesMediaType.JPEG if ADOBE_SDK_AVAILABLE else None},
        "png": {"name": "PNG Image", "extension": ".png", "media_type": PDFServicesMediaType.PNG if ADOBE_SDK_AVAILABLE else None},
    }

    def __init__(self):
        """Initialize PDF Converter Service with Adobe credentials"""
        self.temp_dir = tempfile.mkdtemp()

        # Get Adobe credentials from environment
        self.client_id = os.getenv('ADOBE_PDF_SERVICES_CLIENT_ID')
        self.client_secret = os.getenv('ADOBE_PDF_SERVICES_CLIENT_SECRET')

        if not self.client_id or not self.client_secret:
            logger.warning("Adobe PDF Services credentials not configured. Conversion features will be disabled.")
            self.is_configured = False
        else:
            self.is_configured = True

        if not ADOBE_SDK_AVAILABLE:
            logger.warning("Adobe PDF Services SDK not available")
            self.is_configured = False

    def _get_pdf_services(self) -> 'PDFServices':
        """Create and return PDFServices instance with credentials"""
        if not self.is_configured or not ADOBE_SDK_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="Adobe PDF Services not configured or SDK not available"
            )

        try:
            credentials = ServicePrincipalCredentials(
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            return PDFServices(credentials=credentials)
        except Exception as e:
            logger.error(f"Failed to initialize PDF Services: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Adobe PDF Services: {str(e)}"
            )

    async def convert_from_pdf(
        self,
        pdf_bytes: bytes,
        filename: str,
        target_formats: List[str]
    ) -> Dict[str, Any]:
        """
        Convert PDF to one or more target formats

        Args:
            pdf_bytes: PDF file bytes
            filename: Original filename
            target_formats: List of target formats (e.g., ['docx', 'xlsx', 'jpeg'])

        Returns:
            {
                "conversions": [
                    {
                        "format": "docx",
                        "format_name": "Microsoft Word (DOCX)",
                        "output_bytes": bytes,
                        "output_filename": "document.docx",
                        "success": True,
                        "error": None
                    },
                    ...
                ],
                "original_filename": str,
                "total_conversions": int,
                "successful_conversions": int,
                "failed_conversions": int
            }
        """
        if not self.is_configured:
            raise HTTPException(
                status_code=503,
                detail="Adobe PDF Services not configured. Please contact administrator."
            )

        # Validate target formats
        invalid_formats = [fmt for fmt in target_formats if fmt not in self.FROM_PDF_FORMATS]
        if invalid_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid target formats: {', '.join(invalid_formats)}. "
                       f"Supported formats: {', '.join(self.FROM_PDF_FORMATS.keys())}"
            )

        conversions = []
        successful = 0
        failed = 0

        base_filename = os.path.splitext(filename)[0]

        for target_format in target_formats:
            try:
                logger.info(f"Converting {filename} to {target_format}")

                # Get PDF Services instance
                pdf_services = self._get_pdf_services()

                # Create input asset from bytes
                input_asset = pdf_services.upload(
                    input_stream=BytesIO(pdf_bytes),
                    mime_type=PDFServicesMediaType.PDF
                )

                # Get Adobe format enum
                adobe_format_str = self.FROM_PDF_FORMATS[target_format]["adobe_format"]
                adobe_format = getattr(ExportPDFTargetFormat, adobe_format_str)

                # Create export parameters
                export_pdf_params = ExportPDFParams(target_format=adobe_format)

                # Create export job
                export_pdf_job = ExportPDFJob(
                    input_asset=input_asset,
                    export_pdf_params=export_pdf_params
                )

                # Submit job and get result
                location = pdf_services.submit(export_pdf_job)
                pdf_services_response = pdf_services.get_job_result(location, ExportPDFResult)

                # Get result asset
                result_asset: CloudAsset = pdf_services_response.get_result().get_asset()
                stream_asset: StreamAsset = pdf_services.get_content(result_asset)

                # Read output bytes
                output_bytes = stream_asset.get_input_stream()

                # Generate output filename
                output_filename = f"{base_filename}.{target_format}"

                conversions.append({
                    "format": target_format,
                    "format_name": self.FROM_PDF_FORMATS[target_format]["name"],
                    "output_bytes": output_bytes,
                    "output_filename": output_filename,
                    "success": True,
                    "error": None
                })

                successful += 1
                logger.info(f"Successfully converted {filename} to {target_format}")

            except Exception as e:
                logger.error(f"Failed to convert {filename} to {target_format}: {str(e)}")
                conversions.append({
                    "format": target_format,
                    "format_name": self.FROM_PDF_FORMATS[target_format]["name"],
                    "output_bytes": None,
                    "output_filename": None,
                    "success": False,
                    "error": str(e)
                })
                failed += 1

        return {
            "conversions": conversions,
            "original_filename": filename,
            "total_conversions": len(target_formats),
            "successful_conversions": successful,
            "failed_conversions": failed
        }

    async def convert_to_pdf(
        self,
        file_bytes: bytes,
        filename: str,
        source_format: str
    ) -> Dict[str, Any]:
        """
        Convert various formats to PDF

        Args:
            file_bytes: Input file bytes
            filename: Original filename
            source_format: Source format (e.g., 'docx', 'html', 'jpeg')

        Returns:
            {
                "pdf_bytes": bytes,
                "output_filename": str,
                "original_filename": str,
                "source_format": str,
                "success": True
            }
        """
        if not self.is_configured:
            raise HTTPException(
                status_code=503,
                detail="Adobe PDF Services not configured. Please contact administrator."
            )

        # Validate source format
        if source_format not in self.TO_PDF_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid source format: {source_format}. "
                       f"Supported formats: {', '.join(self.TO_PDF_FORMATS.keys())}"
            )

        try:
            logger.info(f"Converting {filename} ({source_format}) to PDF")

            # Get PDF Services instance
            pdf_services = self._get_pdf_services()

            # Get media type for source format
            media_type = self.TO_PDF_FORMATS[source_format]["media_type"]

            # Create input asset from bytes
            input_asset = pdf_services.upload(
                input_stream=BytesIO(file_bytes),
                mime_type=media_type
            )

            # Create PDF job with default parameters
            create_pdf_job = CreatePDFJob(input_asset=input_asset)

            # Submit job and get result
            location = pdf_services.submit(create_pdf_job)
            pdf_services_response = pdf_services.get_job_result(location, CreatePDFResult)

            # Get result asset
            result_asset: CloudAsset = pdf_services_response.get_result().get_asset()
            stream_asset: StreamAsset = pdf_services.get_content(result_asset)

            # Read PDF bytes
            pdf_bytes = stream_asset.get_input_stream()

            # Generate output filename
            base_filename = os.path.splitext(filename)[0]
            output_filename = f"{base_filename}.pdf"

            logger.info(f"Successfully converted {filename} to PDF")

            return {
                "pdf_bytes": pdf_bytes,
                "output_filename": output_filename,
                "original_filename": filename,
                "source_format": source_format,
                "success": True
            }

        except Exception as e:
            logger.error(f"Failed to convert {filename} to PDF: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to convert {source_format.upper()} to PDF: {str(e)}"
            )

    def get_supported_formats(self) -> Dict[str, Any]:
        """Return supported conversion formats"""
        return {
            "from_pdf": {
                fmt: {
                    "name": info["name"],
                    "extension": info["extension"]
                }
                for fmt, info in self.FROM_PDF_FORMATS.items()
            },
            "to_pdf": {
                fmt: {
                    "name": info["name"],
                    "extension": info["extension"]
                }
                for fmt, info in self.TO_PDF_FORMATS.items()
            },
            "is_configured": self.is_configured
        }

    async def analyze_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Analyze uploaded file and return metadata

        Returns:
            {
                "filename": str,
                "file_size_bytes": int,
                "file_size_mb": float,
                "file_extension": str,
                "is_pdf": bool,
                "detected_format": str or None
            }
        """
        file_size = len(file_bytes)
        file_extension = os.path.splitext(filename)[1].lower().lstrip('.')
        is_pdf = file_extension == 'pdf'

        # Detect format
        detected_format = None
        if is_pdf:
            detected_format = "pdf"
        elif file_extension in self.TO_PDF_FORMATS:
            detected_format = file_extension

        return {
            "filename": filename,
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "file_extension": file_extension,
            "is_pdf": is_pdf,
            "detected_format": detected_format
        }
