"""
API endpoints for manual bank statement parsing workflow
Implements the 6-step user-controlled extraction process
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import tempfile
import os
import uuid
from .manual_bank_parser import ManualBankStatementParser, PatternRule
import json

router = APIRouter()
parser = ManualBankStatementParser()


# Pydantic models for request/response
class HeaderSelection(BaseModel):
    headers: List[str]
    positions: List[List[float]]  # List of [x0, x1] pairs
    y_position: float
    page_number: int


class SampleRowSelection(BaseModel):
    data: List[str]
    y_position: float
    page_number: int


class PatternCreationRequest(BaseModel):
    header_selection: HeaderSelection
    sample_rows: List[SampleRowSelection]
    selected_column_indices: Optional[List[int]] = None  # Which columns user wants to extract


class SavePatternRequest(BaseModel):
    pattern_name: str
    bank_name: Optional[str] = ""


# Debug endpoint: Extract words in rectangle for debugging
@router.post("/debug/extract-words-in-rectangle")
async def debug_extract_words_in_rectangle(
    file: UploadFile = File(...),
    page: int = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(...),
    height: float = Form(...),
    is_header: str = Form("false")
):
    """Debug endpoint to examine word positions within a rectangle"""
    try:
        import pdfplumber
        import io
        
        # Read PDF content
        pdf_content = await file.read()
        
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            if page >= len(pdf.pages):
                raise HTTPException(status_code=400, detail="Page number out of range")
            
            pdf_page = pdf.pages[page]
            
            # Extract words with positions
            words = pdf_page.extract_words()
            
            # Define rectangle bounds
            rect_bounds = {
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'is_header': is_header
            }
            
            # Filter words within rectangle
            rect_words = []
            x_min = x
            y_min = y
            x_max = x + width
            y_max = y + height
            
            for word in words:
                word_x_center = (word['x0'] + word['x1']) / 2
                word_y_center = (word['top'] + word['bottom']) / 2
                
                # Check if word center is within rectangle
                if (x_min <= word_x_center <= x_max and 
                    y_min <= word_y_center <= y_max):
                    rect_words.append(word)
            
            return {
                'success': True,
                'words': rect_words,
                'total_words': len(rect_words),
                'rectangle': rect_bounds
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Debug extraction failed: {str(e)}")


# Step 1: Detect transaction-like pages
@router.post("/detect-transaction-pages")
async def detect_transaction_pages(file: UploadFile = File(...)):
    """
    Step 1: Scan PDF and find pages that contain possible transaction tables.
    Returns candidate pages with the best suggestion as starting point.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Save uploaded file temporarily
        temp_filename = f"detect_{uuid.uuid4()}.pdf"
        temp_filepath = os.path.join(tempfile.gettempdir(), temp_filename)
        
        with open(temp_filepath, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        # Detect transaction pages
        result = parser.detect_transaction_pages(temp_filepath)
        
        # Clean up temp file
        os.unlink(temp_filepath)
        
        return {
            "filename": file.filename,
            "detection_result": result,
            "message": result.get('message', 'Transaction page detection complete'),
            "suggested_page": result.get('suggested_start_page', 0) if result['success'] else None
        }
        
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_filepath' in locals() and os.path.exists(temp_filepath):
            os.unlink(temp_filepath)
        
        raise HTTPException(status_code=500, detail=f"Error detecting transaction pages: {str(e)}")


# Step 2: Get page content for user selection
@router.post("/get-page-content")
async def get_page_content(
    file: UploadFile = File(...),
    page_number: int = Form(...)
):
    """
    Get detailed content of a specific page for user selection.
    Returns words with positions for manual header/row selection.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        import pdfplumber
        import io
        
        # Read PDF content
        pdf_content = await file.read()
        
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            if page_number >= len(pdf.pages):
                raise HTTPException(status_code=400, detail="Page number out of range")
            
            page = pdf.pages[page_number]
            
            # Extract words with positions
            words = page.extract_words()
            
            # Group words into potential rows for easier selection
            detector = parser.detector
            rows = detector._group_words_into_rows(words)
            
            # Format rows for frontend consumption
            formatted_rows = []
            for i, row in enumerate(rows):
                if len(row) >= 4 and len(row) <= 8:  # Only show rows that could be transaction tables
                    formatted_rows.append({
                        'row_index': i,
                        'words': row,
                        'text': ' '.join([w['text'] for w in row]),
                        'y_position': row[0]['top'] if row else 0,
                        'column_count': len(row),
                        'bounding_box': {
                            'x0': min([w['x0'] for w in row]) if row else 0,
                            'x1': max([w['x1'] for w in row]) if row else 0,
                            'y0': min([w['top'] for w in row]) if row else 0,
                            'y1': max([w['bottom'] for w in row]) if row else 0,
                        }
                    })
            
            return {
                "page_number": page_number,
                "page_dimensions": {
                    "width": page.width,
                    "height": page.height
                },
                "total_words": len(words),
                "potential_table_rows": formatted_rows,
                "raw_words": words  # For advanced selection if needed
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting page content: {str(e)}")


# Step 3: Create pattern from user selection
@router.post("/create-pattern-from-selection")
async def create_pattern_from_selection(
    file: UploadFile = File(...),
    pattern_request: str = Form(...)  # JSON string of PatternCreationRequest
):
    """
    Step 2: Generate pattern rule from user's manual selection of headers and sample rows.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Parse the JSON request
        request_data = json.loads(pattern_request)
        pattern_creation = PatternCreationRequest(**request_data)
        
        # Save uploaded file temporarily
        temp_filename = f"pattern_{uuid.uuid4()}.pdf"
        temp_filepath = os.path.join(tempfile.gettempdir(), temp_filename)
        
        with open(temp_filepath, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        # Create pattern from user selection
        pattern = parser.create_pattern_from_selection(
            pdf_path=temp_filepath,
            page_number=pattern_creation.header_selection.page_number,
            header_selection={
                'headers': pattern_creation.header_selection.headers,
                'positions': [tuple(pos) for pos in pattern_creation.header_selection.positions],
                'y_position': pattern_creation.header_selection.y_position
            },
            sample_rows_selection=[
                {
                    'data': row.data,
                    'y_position': row.y_position,
                    'page_number': row.page_number
                }
                for row in pattern_creation.sample_rows
            ]
        )
        
        # Override selected fields if user specified them
        if pattern_creation.selected_column_indices is not None:
            pattern.selected_fields = pattern_creation.selected_column_indices
        
        # Clean up temp file
        os.unlink(temp_filepath)
        
        return {
            "success": True,
            "pattern": {
                "column_count": pattern.column_count,
                "column_names": pattern.column_names,
                "selected_fields": pattern.selected_fields,
                "selected_headers": [pattern.column_names[i] for i in pattern.selected_fields],
                "row_gap_tolerance": pattern.row_gap_tolerance,
                "first_column_pattern": pattern.first_column_pattern,
                "layout_mode": pattern.layout_mode,
                "multiline_merge": pattern.multiline_merge,
                "column_boundaries": pattern.column_boundaries,
                "header_y_position": pattern.header_y_position,
                "font_size_range": pattern.font_size_range
            },
            "message": f"Pattern created successfully with {len(pattern.selected_fields)} selected columns"
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in pattern request")
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_filepath' in locals() and os.path.exists(temp_filepath):
            os.unlink(temp_filepath)
        
        raise HTTPException(status_code=500, detail=f"Error creating pattern: {str(e)}")


# Step 4: Apply pattern to extract data
@router.post("/extract-with-pattern")
async def extract_with_pattern(
    file: UploadFile = File(...),
    pattern_data: str = Form(...),  # JSON string of pattern
    start_page: int = Form(0)
):
    """
    Step 3: Apply the user-defined pattern to scan and extract from all pages.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Parse pattern data
        pattern_dict = json.loads(pattern_data)
        
        # Reconstruct PatternRule object
        pattern = PatternRule(
            column_count=pattern_dict['column_count'],
            column_names=pattern_dict['column_names'],
            selected_fields=pattern_dict['selected_fields'],
            row_gap_tolerance=pattern_dict['row_gap_tolerance'],
            font_size_range=tuple(pattern_dict.get('font_size_range', [8.0, 14.0])),
            first_column_pattern=pattern_dict['first_column_pattern'],
            multiline_merge=pattern_dict.get('multiline_merge', True),
            header_y_position=pattern_dict.get('header_y_position', 0.0),
            layout_mode=pattern_dict.get('layout_mode', 'manual_selection'),
            column_boundaries=pattern_dict.get('column_boundaries', [])
        )
        
        # Save uploaded file temporarily
        temp_filename = f"extract_{uuid.uuid4()}.pdf"
        temp_filepath = os.path.join(tempfile.gettempdir(), temp_filename)
        
        with open(temp_filepath, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        # Apply pattern to extract data
        result = parser.apply_pattern_to_pdf(temp_filepath, pattern, start_page)
        
        # Clean up temp file
        os.unlink(temp_filepath)
        
        # Format extracted data for table display
        if result['success'] and result['transactions']:
            # Convert to table format expected by frontend
            table_rows = []
            for transaction in result['transactions']:
                table_rows.append(transaction['data'])
            
            return {
                "success": True,
                "total_transactions": result['total_transactions'],
                "headers": result['headers'],
                "transactions": table_rows,  # Array of arrays for table display
                "pages_processed": result['pages_processed'],
                "errors": result['errors'],
                "message": f"Successfully extracted {result['total_transactions']} transactions from {len(result['pages_processed'])} pages"
            }
        else:
            return {
                "success": False,
                "total_transactions": 0,
                "headers": result['headers'],
                "transactions": [],
                "pages_processed": result['pages_processed'],
                "errors": result['errors'],
                "message": "No transactions found with the current pattern. Please adjust your selection."
            }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in pattern data")
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_filepath' in locals() and os.path.exists(temp_filepath):
            os.unlink(temp_filepath)
        
        raise HTTPException(status_code=500, detail=f"Error extracting with pattern: {str(e)}")


# Step 5: Save pattern for future use
@router.post("/save-pattern")
async def save_pattern(
    pattern_data: str = Form(...),  # JSON string of pattern
    save_request: str = Form(...)   # JSON string of SavePatternRequest
):
    """
    Step 5: Save the pattern with a user-defined name for future use.
    """
    try:
        # Parse requests
        pattern_dict = json.loads(pattern_data)
        save_data = json.loads(save_request)
        save_request_obj = SavePatternRequest(**save_data)
        
        # Reconstruct PatternRule object
        pattern = PatternRule(
            column_count=pattern_dict['column_count'],
            column_names=pattern_dict['column_names'],
            selected_fields=pattern_dict['selected_fields'],
            row_gap_tolerance=pattern_dict['row_gap_tolerance'],
            font_size_range=tuple(pattern_dict.get('font_size_range', [8.0, 14.0])),
            first_column_pattern=pattern_dict['first_column_pattern'],
            multiline_merge=pattern_dict.get('multiline_merge', True),
            header_y_position=pattern_dict.get('header_y_position', 0.0),
            layout_mode=pattern_dict.get('layout_mode', 'manual_selection'),
            column_boundaries=pattern_dict.get('column_boundaries', [])
        )
        
        # Save pattern
        success = parser.save_pattern(
            pattern, 
            save_request_obj.pattern_name, 
            save_request_obj.bank_name
        )
        
        if success:
            return {
                "success": True,
                "pattern_name": save_request_obj.pattern_name,
                "bank_name": save_request_obj.bank_name,
                "message": f"Pattern '{save_request_obj.pattern_name}' saved successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save pattern")
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in request")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving pattern: {str(e)}")


# New endpoint for intelligent column detection
@router.post("/detect-columns-in-rectangle")
async def detect_columns_in_rectangle(
    file: UploadFile = File(...),
    page: int = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(...),
    height: float = Form(...),
    is_header: bool = Form(False)
):
    """
    Intelligent column detection within a user-selected rectangle.
    Uses word positioning and clustering to automatically detect column boundaries.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        import pdfplumber
        import io
        from .intelligent_column_detector import IntelligentColumnDetector
        
        # Read PDF content
        pdf_content = await file.read()
        
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            if page >= len(pdf.pages):
                raise HTTPException(status_code=400, detail="Page number out of range")
            
            pdf_page = pdf.pages[page]
            
            # Extract words with positions
            words = pdf_page.extract_words()
            
            # Define rectangle bounds
            rect_bounds = {
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'is_header': is_header
            }
            
            # Initialize intelligent column detector
            detector = IntelligentColumnDetector()
            
            # Detect columns within rectangle
            detection_result = detector.detect_columns_in_rectangle(
                words=words,
                rect_bounds=rect_bounds,
                is_header=is_header
            )
            
            # Extract text from detected columns using only words from the rectangle
            if detection_result.success:
                # For header detection, only use words from the selected rectangle
                if is_header:
                    # Extract only the words that were actually used in detection
                    rect_words = []
                    for word in words:
                        word_y_center = (word['top'] + word['bottom']) / 2
                        word_x_center = (word['x0'] + word['x1']) / 2
                        
                        if (x <= word_x_center <= x + width and 
                            y <= word_y_center <= y + height):
                            rect_words.append(word)
                    
                    column_texts = detector.extract_text_from_columns(rect_words, detection_result.columns)
                else:
                    column_texts = detector.extract_text_from_columns(words, detection_result.columns)
            else:
                column_texts = []
            
            # Format response
            response_data = {
                "success": detection_result.success,
                "total_columns": detection_result.total_columns,
                "confidence_score": detection_result.confidence_score,
                "method_used": detection_result.method_used,
                "errors": detection_result.errors,
                "columns": [
                    {
                        "column_index": col.column_index,
                        "x_start": col.x_start,
                        "x_end": col.x_end,
                        "width": col.x_end - col.x_start,
                        "confidence": col.confidence,
                        "header_keyword": col.header_keyword,
                        "text": column_texts[i] if i < len(column_texts) else "",
                        "word_count": len(col.words_in_column)
                    }
                    for i, col in enumerate(detection_result.columns)
                ],
                "rectangle_bounds": rect_bounds,
                "page_number": page,
                "is_header_row": is_header
            }
            
            if detection_result.success:
                response_data["message"] = f"Successfully detected {detection_result.total_columns} columns with {detection_result.confidence_score:.1%} confidence"
            else:
                response_data["message"] = "Failed to detect columns. " + "; ".join(detection_result.errors)
            
            return response_data
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting columns: {str(e)}")


# Get saved patterns
@router.get("/saved-patterns")
async def get_saved_patterns():
    """
    Get list of all saved patterns.
    """
    try:
        from pathlib import Path
        import json
        
        patterns_dir = Path("saved_patterns")
        if not patterns_dir.exists():
            return {"patterns": [], "message": "No patterns saved yet"}
        
        patterns = []
        for pattern_file in patterns_dir.glob("*.json"):
            try:
                with open(pattern_file, 'r') as f:
                    data = json.load(f)
                    patterns.append({
                        "name": data['name'],
                        "bank_name": data.get('bank_name', ''),
                        "created_at": data.get('created_at', ''),
                        "column_count": data['pattern']['column_count'],
                        "headers": data['pattern']['column_names']
                    })
            except Exception as e:
                continue  # Skip invalid pattern files
        
        return {
            "patterns": patterns,
            "total_patterns": len(patterns),
            "message": f"Found {len(patterns)} saved patterns"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving patterns: {str(e)}")


# Load and apply saved pattern
@router.post("/apply-saved-pattern")
async def apply_saved_pattern(
    file: UploadFile = File(...),
    pattern_name: str = Form(...),
    start_page: int = Form(0)
):
    """
    Load a saved pattern and apply it to extract data.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Load saved pattern
        pattern = parser.load_pattern(pattern_name)
        if not pattern:
            raise HTTPException(status_code=404, detail=f"Pattern '{pattern_name}' not found")
        
        # Save uploaded file temporarily
        temp_filename = f"saved_pattern_{uuid.uuid4()}.pdf"
        temp_filepath = os.path.join(tempfile.gettempdir(), temp_filename)
        
        with open(temp_filepath, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        # Apply pattern
        result = parser.apply_pattern_to_pdf(temp_filepath, pattern, start_page)
        
        # Clean up temp file
        os.unlink(temp_filepath)
        
        # Format result
        if result['success'] and result['transactions']:
            table_rows = []
            for transaction in result['transactions']:
                table_rows.append(transaction['data'])
            
            return {
                "success": True,
                "pattern_name": pattern_name,
                "total_transactions": result['total_transactions'],
                "headers": result['headers'],
                "transactions": table_rows,
                "pages_processed": result['pages_processed'],
                "errors": result['errors'],
                "message": f"Applied saved pattern '{pattern_name}': {result['total_transactions']} transactions extracted"
            }
        else:
            return {
                "success": False,
                "pattern_name": pattern_name,
                "total_transactions": 0,
                "headers": result['headers'],
                "transactions": [],
                "pages_processed": result['pages_processed'],
                "errors": result['errors'],
                "message": f"Pattern '{pattern_name}' applied but no data found. PDF may have different format."
            }
        
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_filepath' in locals() and os.path.exists(temp_filepath):
            os.unlink(temp_filepath)
        
        raise HTTPException(status_code=500, detail=f"Error applying saved pattern: {str(e)}")