import pdfplumber
from typing import List, Dict, Any, Tuple
import io
import numpy as np
from PIL import Image

# OCR and image processing imports - temporarily disabled to avoid WeasyPrint issues
try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
    print("✅ pdf2image loaded successfully")
except ImportError as e:
    PDF2IMAGE_AVAILABLE = False
    print(f"Warning: pdf2image not available: {e}")

# Temporarily disable doctr to avoid WeasyPrint dependency issues
try:
    # from doctr.io import DocumentFile
    # from doctr.models import ocr_predictor
    DOCTR_AVAILABLE = False  # Temporarily disabled
    print("ℹ️ doctr temporarily disabled to avoid WeasyPrint dependency issues")
except ImportError as e:
    DOCTR_AVAILABLE = False
    print(f"Warning: doctr not available: {e}")

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

def cluster_words_into_rows(words: List[Dict[str, Any]], tolerance: float = 2.0) -> List[List[Dict[str, Any]]]:
    """
    Cluster word boxes into rows where mid-Y differs ≤ tolerance points.
    
    Args:
        words: List of word dictionaries with x0, y0, x1, y1 coordinates
        tolerance: Maximum Y difference to consider words in same row (default 2.0)
        
    Returns:
        List of rows, where each row is a list of words sorted by x-coordinate
    """
    if not words:
        return []
    
    try:
        # Calculate mid-Y for each word
        words_with_midy = []
        for word in words:
            mid_y = (word.get('y0', 0) + word.get('y1', 0)) / 2
            words_with_midy.append({
                **word,
                'mid_y': mid_y
            })
        
        # Sort by mid-Y to group similar Y values together
        words_with_midy.sort(key=lambda w: w['mid_y'])
        
        # Group words into rows
        rows = []
        current_row = []
        current_row_y = None
        
        for word in words_with_midy:
            word_y = word['mid_y']
            
            if current_row_y is None or abs(word_y - current_row_y) <= tolerance:
                # Add to current row
                current_row.append(word)
                # Update row Y to average of all words in row
                if current_row_y is None:
                    current_row_y = word_y
                else:
                    current_row_y = sum(w['mid_y'] for w in current_row) / len(current_row)
            else:
                # Start new row
                if current_row:
                    # Sort current row by x-coordinate before adding
                    current_row.sort(key=lambda w: w.get('x0', 0))
                    rows.append(current_row)
                
                current_row = [word]
                current_row_y = word_y
        
        # Add the last row
        if current_row:
            current_row.sort(key=lambda w: w.get('x0', 0))
            rows.append(current_row)
        
        # Sort rows by Y coordinate (top to bottom)
        rows.sort(key=lambda row: row[0]['mid_y'] if row else 0)
        
        return rows
        
    except Exception as e:
        raise Exception(f"Error clustering words into rows: {str(e)}")

def get_page_rows(words: List[Dict[str, Any]], page_num: int, tolerance: float = 2.0) -> List[List[Dict[str, Any]]]:
    """
    Get rows for a specific page.
    
    Args:
        words: List of all word dictionaries
        page_num: Page number to filter for
        tolerance: Y tolerance for row clustering
        
    Returns:
        List of rows for the specified page
    """
    try:
        # Filter words for the specific page
        page_words = [w for w in words if w.get('page', 1) == page_num]
        
        # Cluster into rows
        return cluster_words_into_rows(page_words, tolerance)
        
    except Exception as e:
        raise Exception(f"Error getting rows for page {page_num}: {str(e)}")

def get_all_page_rows(words: List[Dict[str, Any]], tolerance: float = 2.0) -> Dict[int, List[List[Dict[str, Any]]]]:
    """
    Get rows organized by page number.
    
    Args:
        words: List of all word dictionaries
        tolerance: Y tolerance for row clustering
        
    Returns:
        Dictionary mapping page numbers to their rows
    """
    try:
        # Get all unique page numbers
        page_numbers = sorted(set(w.get('page', 1) for w in words))
        
        # Get rows for each page
        all_rows = {}
        for page_num in page_numbers:
            all_rows[page_num] = get_page_rows(words, page_num, tolerance)
        
        return all_rows
        
    except Exception as e:
        raise Exception(f"Error getting all page rows: {str(e)}")

def analyze_row_structure(rows: List[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Analyze the structure of rows for debugging and optimization.
    
    Args:
        rows: List of word rows
        
    Returns:
        Dictionary with row analysis statistics
    """
    try:
        if not rows:
            return {
                "total_rows": 0,
                "total_words": 0,
                "avg_words_per_row": 0,
                "min_words_per_row": 0,
                "max_words_per_row": 0
            }
        
        words_per_row = [len(row) for row in rows]
        total_words = sum(words_per_row)
        
        analysis = {
            "total_rows": len(rows),
            "total_words": total_words,
            "avg_words_per_row": total_words / len(rows) if rows else 0,
            "min_words_per_row": min(words_per_row),
            "max_words_per_row": max(words_per_row),
            "words_per_row_distribution": words_per_row[:20],  # First 20 rows
            "sample_rows": []
        }
        
        # Add sample rows (first 5 rows with text preview)
        for i, row in enumerate(rows[:5]):
            row_text = " ".join(word.get('text', '') for word in row)
            analysis["sample_rows"].append({
                "row_index": i,
                "word_count": len(row),
                "text_preview": row_text[:100],  # First 100 chars
                "y_range": {
                    "min_y": min(w.get('y0', 0) for w in row) if row else 0,
                    "max_y": max(w.get('y1', 0) for w in row) if row else 0
                }
            })
        
        return analysis
        
    except Exception as e:
        raise Exception(f"Error analyzing row structure: {str(e)}") 