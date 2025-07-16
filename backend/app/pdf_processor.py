import pdfplumber
from typing import List, Dict, Any, Tuple
import io
import numpy as np
from PIL import Image

# OCR and image processing imports
try:
    from pdf2image import convert_from_bytes
    from doctr.io import DocumentFile
    from doctr.models import ocr_predictor
    PDF2IMAGE_AVAILABLE = True
    DOCTR_AVAILABLE = True
except ImportError as e:
    PDF2IMAGE_AVAILABLE = False
    DOCTR_AVAILABLE = False
    print(f"Warning: OCR dependencies not available: {e}")

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

def extract_words_digital(page) -> List[Dict[str, Any]]:
    """
    Extract words from digital PDF page using pdfplumber.
    
    Args:
        page: pdfplumber Page object
        
    Returns:
        List of word dictionaries with format:
        [{"text": "word", "x0": 10, "y0": 20, "x1": 30, "y1": 40, "page": 1}, ...]
    """
    try:
        words = page.extract_words(
            x_tolerance=1, 
            y_tolerance=1,
            keep_blank_chars=False,
            use_text_flow=False
        )
        
        # Format to match specification
        word_boxes = []
        for word in words:
            word_boxes.append({
                "text": word.get("text", ""),
                "x0": float(word.get("x0", 0)),
                "y0": float(word.get("y0", 0)), 
                "x1": float(word.get("x1", 0)),
                "y1": float(word.get("y1", 0)),
                "page": getattr(page, 'page_number', 1)
            })
            
        return word_boxes
        
    except Exception as e:
        raise Exception(f"Error extracting words from digital PDF: {str(e)}")

def extract_words_scanned(image: Image.Image, page_num: int) -> List[Dict[str, Any]]:
    """
    Extract words from scanned PDF page using OCR (docTR).
    
    Args:
        image: PIL Image of the PDF page
        page_num: Page number
        
    Returns:
        List of word dictionaries with format:
        [{"text": "word", "x0": 10, "y0": 20, "x1": 30, "y1": 40, "page": 1}, ...]
    """
    if not DOCTR_AVAILABLE:
        raise Exception("docTR not available for OCR processing")
    
    try:
        # Initialize OCR model
        model = ocr_predictor(pretrained=True)
        
        # Convert PIL image to numpy array
        img_array = np.array(image)
        
        # Create DocumentFile from image
        doc = DocumentFile.from_images([img_array])
        
        # Run OCR
        result = model(doc)
        
        # Extract words with bounding boxes
        word_boxes = []
        page_data = result.pages[0]
        
        for block in page_data.blocks:
            for line in block.lines:
                for word in line.words:
                    # Get bounding box coordinates (normalized 0-1)
                    geometry = word.geometry
                    
                    # Convert to absolute coordinates
                    x0 = geometry[0][0] * image.width
                    y0 = geometry[0][1] * image.height
                    x1 = geometry[1][0] * image.width  
                    y1 = geometry[1][1] * image.height
                    
                    word_boxes.append({
                        "text": word.value,
                        "x0": float(x0),
                        "y0": float(y0),
                        "x1": float(x1), 
                        "y1": float(y1),
                        "page": page_num,
                        "confidence": float(word.confidence)
                    })
        
        return word_boxes
        
    except Exception as e:
        raise Exception(f"Error extracting words from scanned PDF: {str(e)}")

def convert_pdf_to_images(pdf_bytes: bytes, dpi: int = 200) -> List[Image.Image]:
    """
    Convert PDF pages to images for OCR processing.
    
    Args:
        pdf_bytes: PDF file content as bytes
        dpi: Resolution for image conversion (default 200 DPI)
        
    Returns:
        List of PIL Images, one per page
    """
    if not PDF2IMAGE_AVAILABLE:
        raise Exception("pdf2image not available for PDF to image conversion")
    
    try:
        images = convert_from_bytes(
            pdf_bytes,
            dpi=dpi,
            fmt='RGB',
            thread_count=1  # Single thread for memory efficiency
        )
        return images
        
    except Exception as e:
        raise Exception(f"Error converting PDF to images: {str(e)}")

def extract_all_words(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract all words from PDF file, handling both digital and scanned pages.
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        List of all word dictionaries from all pages
    """
    try:
        all_words = []
        
        # Read PDF file
        with open(file_path, 'rb') as f:
            pdf_bytes = f.read()
        
        # Analyze pages first
        page_analysis = analyze_pdf_pages(pdf_bytes)
        
        # Convert scanned pages to images if needed
        scanned_pages = [p for p in page_analysis if not p["is_digital"]]
        images = []
        if scanned_pages:
            images = convert_pdf_to_images(pdf_bytes)
        
        # Process each page
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                page_info = page_analysis[page_num - 1]
                
                if page_info["is_digital"]:
                    # Extract words from digital page
                    words = extract_words_digital(page)
                else:
                    # Extract words from scanned page using OCR
                    if images and page_num <= len(images):
                        image = images[page_num - 1]
                        words = extract_words_scanned(image, page_num)
                    else:
                        words = []  # Skip if image conversion failed
                
                all_words.extend(words)
        
        return all_words
        
    except Exception as e:
        raise Exception(f"Error extracting all words: {str(e)}") 