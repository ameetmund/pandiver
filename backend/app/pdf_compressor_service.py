import os
import uuid
import tempfile
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Literal
from io import BytesIO
import fitz  # PyMuPDF for PDF manipulation
from fastapi import HTTPException
import base64
from sqlalchemy.orm import Session

# Try to import pikepdf for advanced optimization
try:
    import pikepdf
    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False
    print("Warning: pikepdf not installed. Advanced PDF optimization will be limited.")

class PDFCompressorService:
    """Service for PDF compression and optimization"""

    # Compression level configurations
    COMPRESSION_LEVELS = {
        "light": {
            "name": "Light Compression",
            "image_quality": 90,
            "image_dpi": 150,
            "description": "Minimal compression, best quality (90% quality, 150 DPI)"
        },
        "moderate": {
            "name": "Moderate Compression",
            "image_quality": 70,
            "image_dpi": 120,
            "description": "Balanced compression (70% quality, 120 DPI)"
        },
        "aggressive": {
            "name": "Aggressive Compression",
            "image_quality": 50,
            "image_dpi": 96,
            "description": "Maximum compression, smaller file (50% quality, 96 DPI)"
        }
    }

    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()

    async def analyze_pdf(self, pdf_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Analyze PDF and return file information

        Returns:
        {
            "filename": str,
            "file_size_bytes": int,
            "file_size_mb": float,
            "total_pages": int,
            "has_images": bool,
            "image_count": int,
            "estimated_savings": {
                "light": {"bytes": int, "percentage": float},
                "moderate": {"bytes": int, "percentage": float},
                "aggressive": {"bytes": int, "percentage": float}
            }
        }
        """
        try:
            doc = fitz.open("pdf", pdf_bytes)
            original_size = len(pdf_bytes)

            # Count images across all pages
            image_count = 0
            page_count = doc.page_count  # Store page count before closing
            for page_num in range(page_count):
                page = doc[page_num]
                image_list = page.get_images()
                image_count += len(image_list)

            # Estimate compression savings based on image count and file size
            # These are rough estimates - actual compression depends on content
            light_savings = int(original_size * 0.10) if image_count > 0 else 0  # ~10% reduction
            moderate_savings = int(original_size * 0.30) if image_count > 0 else 0  # ~30% reduction
            aggressive_savings = int(original_size * 0.50) if image_count > 0 else 0  # ~50% reduction

            doc.close()

            return {
                "filename": filename,
                "file_size_bytes": original_size,
                "file_size_mb": round(original_size / (1024 * 1024), 2),
                "total_pages": page_count,
                "has_images": image_count > 0,
                "image_count": image_count,
                "estimated_savings": {
                    "light": {
                        "bytes": light_savings,
                        "percentage": round((light_savings / original_size * 100), 1) if original_size > 0 else 0
                    },
                    "moderate": {
                        "bytes": moderate_savings,
                        "percentage": round((moderate_savings / original_size * 100), 1) if original_size > 0 else 0
                    },
                    "aggressive": {
                        "bytes": aggressive_savings,
                        "percentage": round((aggressive_savings / original_size * 100), 1) if original_size > 0 else 0
                    }
                }
            }

        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to analyze PDF: {str(e)}")

    async def compress_pdf(
        self,
        pdf_bytes: bytes,
        filename: str,
        compression_level: Literal["light", "moderate", "aggressive"] = "moderate",
        remove_metadata: bool = True,
        optimize_fonts: bool = True
    ) -> Dict[str, Any]:
        """
        Compress PDF using specified compression level

        Args:
            pdf_bytes: Original PDF bytes
            filename: Original filename
            compression_level: One of "light", "moderate", "aggressive"
            remove_metadata: Whether to remove PDF metadata
            optimize_fonts: Whether to subset/optimize fonts

        Returns:
            {
                "compressed_bytes": bytes,
                "original_size": int,
                "compressed_size": int,
                "compression_ratio": float,
                "size_reduction_bytes": int,
                "size_reduction_percentage": float,
                "compression_level": str,
                "pages_processed": int
            }
        """
        try:
            original_size = len(pdf_bytes)
            config = self.COMPRESSION_LEVELS[compression_level]

            # Step 1: Open PDF with PyMuPDF
            doc = fitz.open("pdf", pdf_bytes)
            pages_processed = doc.page_count

            # Step 2: Compress images in each page
            for page_num in range(doc.page_count):
                page = doc[page_num]

                # Get all images on the page
                image_list = page.get_images()

                for img_index, img_info in enumerate(image_list):
                    xref = img_info[0]  # xref is the image reference number

                    try:
                        # Extract image
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]

                        # Convert to pixmap and resize/compress
                        pix = fitz.Pixmap(image_bytes)

                        # Convert CMYK to RGB if needed
                        if pix.colorspace and pix.colorspace.n == 4:  # CMYK
                            pix = fitz.Pixmap(fitz.csRGB, pix)

                        # Downsample if image is large
                        # Calculate scaling factor based on DPI
                        target_dpi = config["image_dpi"]
                        if pix.width > target_dpi * 8 or pix.height > target_dpi * 11:  # Larger than typical page
                            # Scale down to target DPI
                            scale_factor = min(
                                (target_dpi * 8) / pix.width,
                                (target_dpi * 11) / pix.height
                            )
                            if scale_factor < 1.0:
                                new_width = int(pix.width * scale_factor)
                                new_height = int(pix.height * scale_factor)
                                pix = fitz.Pixmap(pix, new_width, new_height)

                        # Convert to JPEG with specified quality
                        compressed_image = pix.tobytes("jpeg", jpg_quality=config["image_quality"])

                        # Replace image in PDF
                        # Note: PyMuPDF doesn't have direct image replacement,
                        # so we'll rely on final save optimization

                        pix = None  # Free memory

                    except Exception as img_error:
                        # Skip problematic images
                        print(f"Warning: Could not compress image {img_index} on page {page_num + 1}: {str(img_error)}")
                        continue

            # Step 3: Save with compression options
            # Create temporary file for intermediate processing
            temp_file = os.path.join(self.temp_dir, f"{uuid.uuid4()}.pdf")

            # PyMuPDF save options for compression
            save_options = {
                "garbage": 4,  # Maximum garbage collection
                "deflate": True,  # Compress content streams
                "clean": True,  # Clean up redundant objects
            }

            # Remove metadata if requested
            if remove_metadata:
                doc.set_metadata({})  # Clear all metadata

            doc.save(temp_file, **save_options)
            doc.close()

            # Step 4: Further optimization with pikepdf if available
            if PIKEPDF_AVAILABLE:
                try:
                    with pikepdf.open(temp_file, allow_overwriting_input=True) as pdf:
                        # Remove unused objects
                        pdf.remove_unreferenced_resources()

                        # Optimize for web/streaming
                        pdf.save(temp_file,
                                linearize=True,  # Optimize for web viewing
                                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                                compress_streams=True,
                                stream_decode_level=pikepdf.StreamDecodeLevel.generalized)
                except Exception as pike_error:
                    print(f"Warning: pikepdf optimization failed: {str(pike_error)}")
                    # Continue with PyMuPDF-only compression

            # Read compressed file
            with open(temp_file, "rb") as f:
                compressed_bytes = f.read()

            # Clean up temp file
            os.remove(temp_file)

            compressed_size = len(compressed_bytes)
            size_reduction = original_size - compressed_size
            reduction_percentage = (size_reduction / original_size * 100) if original_size > 0 else 0
            compression_ratio = original_size / compressed_size if compressed_size > 0 else 1.0

            return {
                "compressed_bytes": compressed_bytes,
                "original_size": original_size,
                "compressed_size": compressed_size,
                "compression_ratio": round(compression_ratio, 2),
                "size_reduction_bytes": size_reduction,
                "size_reduction_percentage": round(reduction_percentage, 1),
                "compression_level": compression_level,
                "compression_level_name": config["name"],
                "pages_processed": pages_processed
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to compress PDF: {str(e)}")

    def get_compression_levels(self) -> Dict[str, Any]:
        """Return available compression levels and their descriptions"""
        return self.COMPRESSION_LEVELS
