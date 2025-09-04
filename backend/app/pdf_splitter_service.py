import os
import uuid
import tempfile
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from io import BytesIO
import fitz  # PyMuPDF for PDF manipulation
from fastapi import HTTPException
import base64
from sqlalchemy.orm import Session

class PDFSplitterService:
    """Service for PDF page splitting and extraction"""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
    
    async def analyze_pdf(self, pdf_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Analyze PDF and return page information
        
        Returns:
        {
            "total_pages": int,
            "filename": str,
            "pages": [
                {
                    "page_number": int,
                    "thumbnail": str,  # base64 encoded thumbnail
                    "text_preview": str  # First 100 characters of text
                }
            ]
        }
        """
        try:
            doc = fitz.open("pdf", pdf_bytes)
            pages_info = []
            
            for page_num in range(doc.page_count):
                page = doc[page_num]
                
                # Generate thumbnail (150x200 pixels)
                mat = fitz.Matrix(150/page.rect.width, 200/page.rect.height)
                pix = page.get_pixmap(matrix=mat)
                thumbnail_bytes = pix.tobytes("png")
                thumbnail_b64 = base64.b64encode(thumbnail_bytes).decode()
                
                # Extract text preview (first 100 characters)
                text = page.get_text()
                text_preview = (text[:97] + "...") if len(text) > 100 else text
                
                pages_info.append({
                    "page_number": page_num + 1,
                    "thumbnail": f"data:image/png;base64,{thumbnail_b64}",
                    "text_preview": text_preview.strip()
                })
            
            doc.close()
            
            return {
                "total_pages": len(pages_info),
                "filename": filename,
                "pages": pages_info
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to analyze PDF: {str(e)}")
    
    async def extract_pages(self, pdf_bytes: bytes, page_numbers: List[int], filename: str) -> bytes:
        """
        Extract specific pages from PDF
        
        Args:
            pdf_bytes: Original PDF bytes
            page_numbers: List of page numbers to extract (1-indexed)
            filename: Original filename
            
        Returns:
            bytes: New PDF containing only selected pages
        """
        try:
            # Convert to 0-indexed
            zero_indexed_pages = [p - 1 for p in page_numbers]
            
            # Open source document
            source_doc = fitz.open("pdf", pdf_bytes)
            
            # Create new document
            new_doc = fitz.open()
            
            # Copy selected pages
            for page_num in sorted(zero_indexed_pages):
                if 0 <= page_num < source_doc.page_count:
                    new_doc.insert_pdf(source_doc, from_page=page_num, to_page=page_num)
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Page {page_num + 1} does not exist in the document"
                    )
            
            # Save to bytes
            output_bytes = new_doc.tobytes()
            
            # Clean up
            source_doc.close()
            new_doc.close()
            
            return output_bytes
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to extract pages: {str(e)}")
    
    def generate_output_filename(self, original_filename: str, page_numbers: List[int]) -> str:
        """Generate output filename for extracted pages"""
        base_name = os.path.splitext(original_filename)[0]
        
        if len(page_numbers) == 1:
            return f"{base_name}_page_{page_numbers[0]}.pdf"
        elif len(page_numbers) <= 5:
            pages_str = "_".join(map(str, sorted(page_numbers)))
            return f"{base_name}_pages_{pages_str}.pdf"
        else:
            return f"{base_name}_{len(page_numbers)}_pages_extracted.pdf"
    
    def validate_page_numbers(self, page_numbers: List[int], total_pages: int) -> bool:
        """Validate that all page numbers are within valid range"""
        if not page_numbers:
            return False
        
        for page_num in page_numbers:
            if not isinstance(page_num, int) or page_num < 1 or page_num > total_pages:
                return False
        
        return True
    
    async def get_pdf_metadata(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Get basic PDF metadata"""
        try:
            doc = fitz.open("pdf", pdf_bytes)
            metadata = doc.metadata
            
            info = {
                "page_count": doc.page_count,
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "subject": metadata.get("subject", ""),
                "creator": metadata.get("creator", ""),
                "producer": metadata.get("producer", ""),
                "creation_date": metadata.get("creationDate", ""),
                "modification_date": metadata.get("modDate", "")
            }
            
            doc.close()
            return info
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to get PDF metadata: {str(e)}")