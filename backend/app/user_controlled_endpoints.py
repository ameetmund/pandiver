"""
API endpoints for user-controlled column detection and extraction
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import tempfile
import os
import json
import pdfplumber
import io
from .user_controlled_column_detector import UserControlledColumnDetector, ColumnDefinition, ExtractedRow

router = APIRouter()
detector = UserControlledColumnDetector()


# Pydantic models
class RectangleSelection(BaseModel):
    x: float
    y: float
    width: float
    height: float
    page_number: int


class ColumnBoundaryUpdate(BaseModel):
    column_index: int
    x_min: Optional[float] = None
    x_max: Optional[float] = None
    name: Optional[str] = None


class ColumnManipulation(BaseModel):
    action: str  # "add", "delete", "update"
    column_index: Optional[int] = None
    x_position: Optional[float] = None
    name: Optional[str] = None
    updates: Optional[List[ColumnBoundaryUpdate]] = None


@router.post("/extract-headers-from-selection")
async def extract_headers_from_selection(
    file: UploadFile = File(...),
    rectangle: str = Form(...)  # JSON string of rectangle coordinates
):
    """
    Step 1: Extract header fields from user-selected rectangle
    Returns editable column definitions
    """
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Parse rectangle coordinates
        rect_data = json.loads(rectangle)
        
        # Read PDF content
        pdf_content = await file.read()
        
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            page_num = rect_data.get('page_number', 0)
            
            if page_num >= len(pdf.pages):
                raise HTTPException(status_code=400, detail="Page number out of range")
            
            pdf_page = pdf.pages[page_num]
            words = pdf_page.extract_words()
            
            # Extract header fields from selection
            columns = detector.extract_header_fields_from_selection(words, rect_data)
            
            return {
                'success': True,
                'total_columns': len(columns),
                'columns': [
                    {
                        'index': col.index,
                        'name': col.name,
                        'x_min': col.x_min,
                        'x_max': col.x_max,
                        'width': col.x_max - col.x_min,
                        'user_adjusted': col.user_adjusted
                    }
                    for col in columns
                ],
                'rectangle': rect_data,
                'message': f'Extracted {len(columns)} columns from selected header area'
            }
            
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid rectangle coordinates format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Header extraction failed: {str(e)}")


@router.post("/adjust-column-boundaries")
async def adjust_column_boundaries(
    manipulation: ColumnManipulation = Body(...)
):
    """
    Step 2: Allow user to manually adjust column boundaries
    Supports add, delete, and update operations
    """
    
    try:
        # This would typically work with stored column definitions
        # For now, we'll return the manipulation request for frontend handling
        
        return {
            'success': True,
            'action': manipulation.action,
            'message': f'Column boundary {manipulation.action} operation received',
            'manipulation': manipulation.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Column adjustment failed: {str(e)}")


@router.post("/extract-data-with-columns")
async def extract_data_with_columns(
    file: UploadFile = File(...),
    columns_data: str = Form(...),  # JSON string of column definitions
    header_y: float = Form(...),  # Y position of header row
    start_page: int = Form(0)  # Page to start extraction from
):
    """
    Step 3: Extract all data using user-defined column boundaries
    """
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Parse column definitions
        columns_json = json.loads(columns_data)
        
        # Create column definitions
        columns = []
        for col_data in columns_json:
            columns.append(ColumnDefinition(
                name=col_data['name'],
                x_min=col_data['x_min'],
                x_max=col_data['x_max'],
                index=col_data['index'],
                user_adjusted=col_data.get('user_adjusted', False)
            ))
        
        # Read PDF content and extract all words
        pdf_content = await file.read()
        all_words = []
        
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_words = page.extract_words()
                for word in page_words:
                    word['page_number'] = page_num
                    all_words.append(word)
        
        # Extract data rows
        extracted_rows = detector.extract_data_rows(
            all_words, columns, header_y, start_page
        )
        
        # Convert to output format
        output_rows = []
        for row in extracted_rows:
            if not row.is_continuation:  # Only include main rows, not continuation rows
                output_rows.append(row.data)
        
        # Generate summary
        summary = detector.get_extraction_summary(columns, extracted_rows)
        
        return {
            'success': True,
            'total_rows': len(output_rows),
            'total_transactions': len(output_rows),
            'headers': [col.name for col in columns],
            'data': output_rows,
            'summary': summary,
            'pages_processed': summary['pages_processed'],
            'continuation_rows_merged': summary['continuation_rows'],
            'message': f'Extracted {len(output_rows)} rows using X-coordinate alignment'
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid columns data format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data extraction failed: {str(e)}")


@router.post("/preview-column-alignment")
async def preview_column_alignment(
    file: UploadFile = File(...),
    columns_data: str = Form(...),
    page_number: int = Form(0),
    max_rows: int = Form(10),
    header_y: float = Form(None)
):
    """
    Preview how data aligns with column boundaries (for debugging/validation)
    """
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Parse column definitions
        columns_json = json.loads(columns_data)
        columns = []
        for col_data in columns_json:
            columns.append(ColumnDefinition(
                name=col_data['name'],
                x_min=col_data['x_min'],
                x_max=col_data['x_max'],
                index=col_data['index']
            ))
        
        # Read PDF content
        pdf_content = await file.read()
        
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            if page_number >= len(pdf.pages):
                raise HTTPException(status_code=400, detail="Page number out of range")
            
            page = pdf.pages[page_number]
            words = page.extract_words()
            
            # Group words by Y position to simulate rows, filtering out header area
            y_groups = {}
            header_buffer = 10  # Small buffer below header
            
            for word in words:
                y_pos = word['top']
                
                # Skip words at or above header level (if header_y is provided)
                if header_y is not None and y_pos <= (header_y + header_buffer):
                    continue
                
                matched_y = None
                
                for existing_y in y_groups.keys():
                    if abs(y_pos - existing_y) <= detector.y_tolerance:
                        matched_y = existing_y
                        break
                
                if matched_y is not None:
                    y_groups[matched_y].append(word)
                else:
                    y_groups[y_pos] = [word]
            
            # Preview alignment for first few rows
            preview_rows = []
            for y_pos in sorted(y_groups.keys())[:max_rows]:
                row_words = y_groups[y_pos]
                row_data = {col.name: [] for col in columns}
                
                for word in row_words:
                    word_x_center = (word['x0'] + word['x1']) / 2
                    assigned = False
                    
                    for col in columns:
                        # Use tolerance for boundary matching
                        col_tolerance = 5
                        if (col.x_min - col_tolerance) <= word_x_center <= (col.x_max + col_tolerance):
                            row_data[col.name].append({
                                'text': word['text'],
                                'x': word_x_center,
                                'confidence': 'good' if col.x_min + 5 <= word_x_center <= col.x_max - 5 else 'edge'
                            })
                            assigned = True
                            break
                    
                    if not assigned:
                        # Assign to closest column as fallback
                        closest_col = min(columns, key=lambda c: min(
                            abs(word_x_center - c.x_min), 
                            abs(word_x_center - c.x_max)
                        ))
                        row_data[closest_col.name].append({
                            'text': word['text'],
                            'x': word_x_center,
                            'confidence': 'fallback'
                        })
                
                preview_rows.append({
                    'y_position': y_pos,
                    'column_data': row_data
                })
            
            return {
                'success': True,
                'columns': [
                    {
                        'name': col.name,
                        'x_min': col.x_min,
                        'x_max': col.x_max,
                        'width': col.x_max - col.x_min
                    }
                    for col in columns
                ],
                'preview_rows': preview_rows,
                'page_number': page_number,
                'total_preview_rows': len(preview_rows)
            }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid columns data format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.post("/export-extracted-data")
async def export_extracted_data(
    export_data: Dict[str, Any] = Body(...)
):
    """
    Export extracted data to various formats (Excel, CSV, JSON)
    """
    
    try:
        data_rows = export_data.get('data', [])
        headers = export_data.get('headers', [])
        export_format = export_data.get('format', 'json').lower()
        
        if export_format == 'json':
            return {
                'success': True,
                'format': 'json',
                'data': {
                    'headers': headers,
                    'rows': data_rows,
                    'total_rows': len(data_rows)
                }
            }
        
        elif export_format == 'csv':
            # Generate CSV content
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data_rows)
            
            return {
                'success': True,
                'format': 'csv',
                'content': output.getvalue(),
                'filename': 'extracted_data.csv'
            }
        
        elif export_format == 'excel':
            # Generate Excel content
            import pandas as pd
            import io
            
            df = pd.DataFrame(data_rows)
            
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Bank Statement', index=False)
            
            return {
                'success': True,
                'format': 'excel',
                'content': output.getvalue().hex(),  # Return as hex string
                'filename': 'extracted_data.xlsx'
            }
        
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")