import pdfplumber
from typing import List, Dict, Any, Tuple
import io

def is_digital(page) -> bool:
    """
    Detect if a PDF page is digital (has selectable text) or scanned.
    
    Args:
        page: pdfplumber Page object
        
    Returns:
        bool: True if page has extractable text (digital), False if scanned
    """
    try:
        text = page.extract_text()
        return bool(text and text.strip())
    except Exception:
        return False

def analyze_pdf_pages(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Analyze all pages in a PDF to determine digital vs scanned status.
    
    Args:
        pdf_bytes: PDF file content as bytes
        
    Returns:
        List of page analysis results with format:
        [{"page_num": 1, "is_digital": True, "text_length": 1234}, ...]
    """
    page_analysis = []
    
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                is_digital_page = is_digital(page)
                text_length = 0
                
                if is_digital_page:
                    text = page.extract_text() or ""
                    text_length = len(text.strip())
                
                page_analysis.append({
                    "page_num": page_num,
                    "is_digital": is_digital_page,
                    "text_length": text_length,
                    "width": page.width,
                    "height": page.height
                })
                
    except Exception as e:
        raise Exception(f"Error analyzing PDF pages: {str(e)}")
    
    return page_analysis

def get_pdf_info(file_path: str) -> Dict[str, Any]:
    """
    Get basic information about a PDF file including page types.
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        Dict with PDF information including page analysis
    """
    try:
        with open(file_path, 'rb') as f:
            pdf_bytes = f.read()
        
        page_analysis = analyze_pdf_pages(pdf_bytes)
        
        total_pages = len(page_analysis)
        digital_pages = sum(1 for p in page_analysis if p["is_digital"])
        scanned_pages = total_pages - digital_pages
        
        return {
            "total_pages": total_pages,
            "digital_pages": digital_pages,
            "scanned_pages": scanned_pages,
            "pages": page_analysis,
            "file_size": len(pdf_bytes),
            "is_mixed": digital_pages > 0 and scanned_pages > 0
        }
        
    except Exception as e:
        raise Exception(f"Error getting PDF info: {str(e)}") 