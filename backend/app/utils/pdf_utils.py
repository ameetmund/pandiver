"""
PDF processing utilities for document analysis
"""
import os
import tempfile
from pathlib import Path
from typing import List, Tuple, Dict, Any
import logging

try:
    import pdfplumber
    import pdf2image
    from PIL import Image
    import fitz  # PyMuPDF
except ImportError as e:
    logging.warning(f"PDF processing dependencies not available: {e}")

logger = logging.getLogger(__name__)


def is_native_pdf(pdf_path: str) -> bool:
    """
    Detect if PDF contains native text or is primarily scanned images.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        True if PDF has extractable text, False if scanned
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_chars = 0
            total_pages = len(pdf.pages)
            
            # Sample up to 5 pages to determine document type
            sample_pages = min(5, total_pages)
            
            for i in range(sample_pages):
                page = pdf.pages[i]
                text = page.extract_text()
                if text:
                    total_chars += len(text.strip())
            
            # If we have substantial text across sampled pages, it's native
            avg_chars_per_page = total_chars / sample_pages if sample_pages > 0 else 0
            
            # Threshold: if average page has less than 50 characters, likely scanned
            is_native = avg_chars_per_page > 50
            
            logger.info(f"PDF analysis: {avg_chars_per_page:.1f} chars/page, "
                       f"classified as {'native' if is_native else 'scanned'}")
            
            return is_native
            
    except Exception as e:
        logger.error(f"Error analyzing PDF type: {e}")
        return False


def render_pdf_to_images(pdf_path: str, dpi: int = 300, 
                        output_dir: str = None) -> List[str]:
    """
    Convert PDF pages to images for OCR processing.
    
    Args:
        pdf_path: Path to PDF file
        dpi: Resolution for image conversion
        output_dir: Directory to save images (temp dir if None)
        
    Returns:
        List of image file paths
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp()
    
    os.makedirs(output_dir, exist_ok=True)
    image_paths = []
    
    try:
        # Try pdf2image first (better quality)
        pages = pdf2image.convert_from_path(
            pdf_path, 
            dpi=dpi,
            fmt='PNG',
            thread_count=1  # CPU-only processing
        )
        
        for i, page in enumerate(pages):
            image_path = os.path.join(output_dir, f"page_{i+1:03d}.png")
            page.save(image_path, 'PNG')
            image_paths.append(image_path)
            
        logger.info(f"Converted {len(pages)} pages to images using pdf2image")
        
    except Exception as e:
        logger.warning(f"pdf2image failed: {e}, trying PyMuPDF...")
        
        try:
            # Fallback to PyMuPDF
            doc = fitz.open(pdf_path)
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                
                # Render page to image
                mat = fitz.Matrix(dpi/72, dpi/72)  # Convert DPI to scale
                pix = page.get_pixmap(matrix=mat)
                
                image_path = os.path.join(output_dir, f"page_{page_num+1:03d}.png")
                pix.save(image_path)
                image_paths.append(image_path)
            
            doc.close()
            logger.info(f"Converted {len(image_paths)} pages to images using PyMuPDF")
            
        except Exception as e2:
            logger.error(f"Both pdf2image and PyMuPDF failed: {e2}")
            raise RuntimeError(f"Failed to convert PDF to images: {e2}")
    
    return image_paths


def setup_extraction_workspace(job_id: str, base_dir: str = None) -> Dict[str, str]:
    """
    Create directory structure for extraction job.
    
    Args:
        job_id: Unique job identifier
        base_dir: Base directory for workspaces
        
    Returns:
        Dictionary with directory paths
    """
    if base_dir is None:
        base_dir = tempfile.gettempdir()
    
    workspace = {
        'root': os.path.join(base_dir, f"extraction_{job_id}"),
        'pages': os.path.join(base_dir, f"extraction_{job_id}", "pages"),
        'tables': os.path.join(base_dir, f"extraction_{job_id}", "tables"),
        'key_values': os.path.join(base_dir, f"extraction_{job_id}", "key_values"),
        'results': os.path.join(base_dir, f"extraction_{job_id}", "results")
    }
    
    # Create all directories
    for dir_path in workspace.values():
        os.makedirs(dir_path, exist_ok=True)
    
    logger.info(f"Created extraction workspace: {workspace['root']}")
    return workspace


def cleanup_workspace(workspace_root: str) -> None:
    """
    Clean up temporary extraction workspace.
    
    Args:
        workspace_root: Root directory to clean up
    """
    try:
        import shutil
        if os.path.exists(workspace_root):
            shutil.rmtree(workspace_root)
            logger.info(f"Cleaned up workspace: {workspace_root}")
    except Exception as e:
        logger.warning(f"Failed to cleanup workspace {workspace_root}: {e}")


def get_pdf_metadata(pdf_path: str) -> Dict[str, Any]:
    """
    Extract metadata from PDF file.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Dictionary with PDF metadata
    """
    metadata = {
        'pages': 0,
        'size_bytes': 0,
        'title': None,
        'author': None,
        'creator': None,
        'encrypted': False,
        'has_text': False
    }
    
    try:
        metadata['size_bytes'] = os.path.getsize(pdf_path)
        
        with pdfplumber.open(pdf_path) as pdf:
            metadata['pages'] = len(pdf.pages)
            
            if pdf.metadata:
                metadata.update({
                    'title': pdf.metadata.get('Title'),
                    'author': pdf.metadata.get('Author'),
                    'creator': pdf.metadata.get('Creator')
                })
            
            # Check if PDF has extractable text
            sample_text = ""
            for i in range(min(3, len(pdf.pages))):
                page_text = pdf.pages[i].extract_text()
                if page_text:
                    sample_text += page_text
                    
            metadata['has_text'] = len(sample_text.strip()) > 100
            
    except Exception as e:
        logger.error(f"Error extracting PDF metadata: {e}")
        
    return metadata


def validate_pdf_file(file_path: str) -> Tuple[bool, str]:
    """
    Validate if file is a proper PDF and can be processed.
    
    Args:
        file_path: Path to file to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        if not os.path.exists(file_path):
            return False, "File does not exist"
            
        if not file_path.lower().endswith('.pdf'):
            return False, "File is not a PDF"
            
        # Try to open with pdfplumber
        with pdfplumber.open(file_path) as pdf:
            if len(pdf.pages) == 0:
                return False, "PDF has no pages"
                
            if len(pdf.pages) > 500:
                return False, "PDF has too many pages (max 500)"
        
        # Check file size (max 100MB)
        size_mb = os.path.getsize(file_path) / (1024 * 1024)
        if size_mb > 100:
            return False, f"File too large: {size_mb:.1f}MB (max 100MB)"
            
        return True, "Valid PDF"
        
    except Exception as e:
        return False, f"Invalid PDF: {str(e)}"