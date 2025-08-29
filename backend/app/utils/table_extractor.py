import os
import tempfile
import logging
from typing import List, Dict, Any, Optional, Callable
import uuid

logger = logging.getLogger(__name__)


class TableExtractor:
    """
    Table extraction using open-source tools as an alternative to Amazon Textract.
    
    Uses Camelot for native PDF table extraction and PaddleOCR as fallback for scanned PDFs.
    """
    
    def __init__(
        self,
        prefer_native: bool = True,
        ocr_fallback: bool = True,
        confidence_threshold: float = 0.5,
        merge_nearby: bool = False
    ):
        """
        Initialize table extractor.
        
        Args:
            prefer_native: Use native PDF table extraction first
            ocr_fallback: Use OCR if native extraction fails
            confidence_threshold: Minimum confidence for table detection
            merge_nearby: Merge tables that are close together
        """
        self.prefer_native = prefer_native
        self.ocr_fallback = ocr_fallback
        self.confidence_threshold = confidence_threshold
        self.merge_nearby = merge_nearby
        
        # Check if dependencies are available
        self._check_dependencies()
    
    def _check_dependencies(self):
        """Check if required dependencies are installed."""
        try:
            import camelot
            self.camelot_available = True
        except ImportError:
            self.camelot_available = False
            logger.warning("Camelot not available. Install with: pip install camelot-py[cv]")
        
        try:
            import paddleocr
            self.paddleocr_available = True
        except ImportError:
            self.paddleocr_available = False
            logger.warning("PaddleOCR not available. Install with: pip install paddleocr")
    
    def extract_tables(
        self, 
        pdf_path: str,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Extract tables from PDF using open-source tools.
        
        Args:
            pdf_path: Path to PDF file
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict containing extracted tables and metadata
        """
        if progress_callback:
            progress_callback(0, "Starting table extraction")
        
        tables = []
        extraction_methods_used = []
        errors = []
        
        # Step 1: Try native extraction with Camelot
        if self.prefer_native and self.camelot_available:
            try:
                if progress_callback:
                    progress_callback(20, "Attempting native table extraction with Camelot")
                
                native_tables = self._extract_with_camelot(pdf_path)
                if native_tables:
                    tables.extend(native_tables)
                    extraction_methods_used.append("camelot_native")
                    
                    if progress_callback:
                        progress_callback(60, f"Found {len(native_tables)} tables with native extraction")
                
            except Exception as e:
                error_msg = f"Camelot extraction failed: {str(e)}"
                errors.append(error_msg)
                logger.warning(error_msg)
        
        # Step 2: OCR fallback if native extraction didn't find enough tables
        if (self.ocr_fallback and self.paddleocr_available and 
            len(tables) == 0):  # Only use OCR if no tables found
            try:
                if progress_callback:
                    progress_callback(70, "Using OCR fallback with PaddleOCR")
                
                ocr_tables = self._extract_with_paddleocr(pdf_path)
                if ocr_tables:
                    tables.extend(ocr_tables)
                    extraction_methods_used.append("paddleocr_ocr")
                    
                    if progress_callback:
                        progress_callback(90, f"Found {len(ocr_tables)} tables with OCR")
                
            except Exception as e:
                error_msg = f"PaddleOCR extraction failed: {str(e)}"
                errors.append(error_msg)
                logger.warning(error_msg)
        
        # Step 3: Post-process tables
        if progress_callback:
            progress_callback(95, "Post-processing extracted tables")
        
        processed_tables = self._post_process_tables(tables)
        
        if progress_callback:
            progress_callback(100, f"Extraction complete: {len(processed_tables)} tables found")
        
        # Prepare result
        result = {
            'tables': processed_tables,
            'total_tables': len(processed_tables),
            'summary': {
                'extraction_methods_used': extraction_methods_used,
                'total_raw_tables': len(tables),
                'total_processed_tables': len(processed_tables),
                'errors': errors,
                'settings': {
                    'prefer_native': self.prefer_native,
                    'ocr_fallback': self.ocr_fallback,
                    'confidence_threshold': self.confidence_threshold,
                    'merge_nearby': self.merge_nearby
                }
            }
        }
        
        return result
    
    def _extract_with_camelot(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract tables using Camelot (native PDF parsing)."""
        import camelot
        
        tables = []
        
        try:
            # Try lattice method first (good for tables with lines)
            camelot_tables = camelot.read_pdf(
                pdf_path, 
                flavor='lattice',
                pages='all'
            )
            
            for i, table in enumerate(camelot_tables):
                if table.accuracy >= self.confidence_threshold * 100:  # Camelot uses 0-100 scale
                    table_data = {
                        'table_id': f"camelot_lattice_{i+1}",
                        'method': 'camelot_lattice',
                        'confidence': table.accuracy / 100.0,  # Convert to 0-1 scale
                        'page': table.page,
                        'rows': len(table.df),
                        'columns': len(table.df.columns),
                        'bbox': [float(x) for x in table._bbox] if hasattr(table, '_bbox') else [0, 0, 0, 0],
                        'data': table.df.values.tolist()
                    }
                    tables.append(table_data)
            
            # If lattice didn't find enough tables, try stream method
            if len(tables) == 0:
                camelot_tables = camelot.read_pdf(
                    pdf_path, 
                    flavor='stream',
                    pages='all'
                )
                
                for i, table in enumerate(camelot_tables):
                    if table.accuracy >= self.confidence_threshold * 100:
                        table_data = {
                            'table_id': f"camelot_stream_{i+1}",
                            'method': 'camelot_stream',
                            'confidence': table.accuracy / 100.0,
                            'page': table.page,
                            'rows': len(table.df),
                            'columns': len(table.df.columns),
                            'bbox': [float(x) for x in table._bbox] if hasattr(table, '_bbox') else [0, 0, 0, 0],
                            'data': table.df.values.tolist()
                        }
                        tables.append(table_data)
        
        except Exception as e:
            logger.error(f"Camelot extraction error: {str(e)}")
            raise
        
        return tables
    
    def _extract_with_paddleocr(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract tables using PaddleOCR (for scanned PDFs)."""
        try:
            from paddleocr import PaddleOCR
            import cv2
            import numpy as np
            from pdf2image import convert_from_path
        except ImportError as e:
            raise ImportError(f"Required dependencies not available: {str(e)}")
        
        tables = []
        
        try:
            # Initialize PaddleOCR with table structure recognition
            ocr = PaddleOCR(use_angle_cls=True, lang='en')
            
            # Convert PDF to images
            pages = convert_from_path(pdf_path, dpi=200)
            
            for page_num, page_image in enumerate(pages):
                # Convert PIL image to numpy array
                img_array = np.array(page_image)
                
                # Use PaddleOCR to detect text and structure
                result = ocr.ocr(img_array)
                
                if result and result[0]:
                    # Extract structured text and attempt to identify table-like structures
                    table_data = self._detect_table_structure_from_ocr(result[0], page_num + 1)
                    if table_data:
                        tables.extend(table_data)
        
        except Exception as e:
            logger.error(f"PaddleOCR extraction error: {str(e)}")
            raise
        
        return tables
    
    def _detect_table_structure_from_ocr(self, ocr_result: List, page_num: int) -> List[Dict[str, Any]]:
        """
        Detect table-like structures from OCR results.
        
        This is a simplified heuristic approach to identify tabular data.
        """
        tables = []
        
        try:
            # Group text by Y-coordinate (rows)
            rows = {}
            for line in ocr_result:
                if len(line) >= 2:
                    bbox, (text, confidence) = line
                    if confidence >= self.confidence_threshold:
                        y_center = (bbox[0][1] + bbox[2][1]) / 2
                        y_key = round(y_center / 10) * 10  # Group by 10-pixel intervals
                        
                        if y_key not in rows:
                            rows[y_key] = []
                        rows[y_key].append({
                            'text': text,
                            'bbox': bbox,
                            'confidence': confidence,
                            'x_center': (bbox[0][0] + bbox[2][0]) / 2
                        })
            
            # Sort rows by Y coordinate and cells by X coordinate
            sorted_rows = []
            for y in sorted(rows.keys()):
                row = sorted(rows[y], key=lambda x: x['x_center'])
                sorted_rows.append(row)
            
            # Detect table-like structures (rows with similar column counts)
            if len(sorted_rows) >= 2:  # At least 2 rows for a table
                # Find the most common column count
                column_counts = [len(row) for row in sorted_rows]
                most_common_cols = max(set(column_counts), key=column_counts.count)
                
                # Extract rows that match the most common column count
                table_rows = [row for row in sorted_rows if len(row) == most_common_cols]
                
                if len(table_rows) >= 2 and most_common_cols >= 2:  # Valid table
                    # Convert to table format
                    table_data = []
                    for row in table_rows:
                        table_data.append([cell['text'] for cell in row])
                    
                    # Calculate bounding box
                    all_cells = [cell for row in table_rows for cell in row]
                    min_x = min(cell['bbox'][0][0] for cell in all_cells)
                    min_y = min(cell['bbox'][0][1] for cell in all_cells)
                    max_x = max(cell['bbox'][2][0] for cell in all_cells)
                    max_y = max(cell['bbox'][2][1] for cell in all_cells)
                    
                    # Calculate average confidence
                    avg_confidence = sum(cell['confidence'] for cell in all_cells) / len(all_cells)
                    
                    table = {
                        'table_id': f"paddleocr_structure_{page_num}",
                        'method': 'paddleocr_structure',
                        'confidence': avg_confidence,
                        'page': page_num,
                        'rows': len(table_data),
                        'columns': most_common_cols,
                        'bbox': [min_x, min_y, max_x, max_y],
                        'data': table_data
                    }
                    tables.append(table)
        
        except Exception as e:
            logger.warning(f"Error detecting table structure from OCR: {str(e)}")
        
        return tables
    
    def _post_process_tables(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Post-process extracted tables."""
        processed_tables = []
        
        for table in tables:
            # Clean up table data
            cleaned_data = []
            for row in table.get('data', []):
                cleaned_row = []
                for cell in row:
                    # Clean cell text
                    if isinstance(cell, str):
                        cleaned_cell = cell.strip()
                    else:
                        cleaned_cell = str(cell).strip() if cell is not None else ""
                    cleaned_row.append(cleaned_cell)
                
                # Only add non-empty rows
                if any(cell for cell in cleaned_row):
                    cleaned_data.append(cleaned_row)
            
            if cleaned_data:  # Only include tables with data
                processed_table = table.copy()
                processed_table['data'] = cleaned_data
                processed_table['rows'] = len(cleaned_data)
                processed_table['columns'] = len(cleaned_data[0]) if cleaned_data else 0
                processed_tables.append(processed_table)
        
        # Merge nearby tables if requested
        if self.merge_nearby and len(processed_tables) > 1:
            processed_tables = self._merge_nearby_tables(processed_tables)
        
        return processed_tables
    
    def _merge_nearby_tables(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge tables that are close together on the same page."""
        # Simple implementation: merge tables on the same page with similar column counts
        merged_tables = []
        
        # Group tables by page
        pages = {}
        for table in tables:
            page = table.get('page', 1)
            if page not in pages:
                pages[page] = []
            pages[page].append(table)
        
        for page_num, page_tables in pages.items():
            if len(page_tables) == 1:
                merged_tables.extend(page_tables)
            else:
                # Try to merge tables with same column count
                column_groups = {}
                for table in page_tables:
                    cols = table.get('columns', 0)
                    if cols not in column_groups:
                        column_groups[cols] = []
                    column_groups[cols].append(table)
                
                for cols, group_tables in column_groups.items():
                    if len(group_tables) == 1:
                        merged_tables.extend(group_tables)
                    else:
                        # Merge tables in the group
                        merged_table = self._merge_table_group(group_tables)
                        merged_tables.append(merged_table)
        
        return merged_tables
    
    def _merge_table_group(self, tables: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge a group of tables into one."""
        if not tables:
            return {}
        
        # Use the first table as base
        merged = tables[0].copy()
        merged['table_id'] = f"merged_{merged['table_id']}"
        merged['method'] = f"merged_{merged['method']}"
        
        # Combine data from all tables
        all_data = []
        for table in tables:
            all_data.extend(table.get('data', []))
        
        merged['data'] = all_data
        merged['rows'] = len(all_data)
        
        # Calculate average confidence
        confidences = [table.get('confidence', 0) for table in tables]
        merged['confidence'] = sum(confidences) / len(confidences) if confidences else 0
        
        # Expand bounding box
        bboxes = [table.get('bbox', [0, 0, 0, 0]) for table in tables]
        if bboxes:
            min_x = min(bbox[0] for bbox in bboxes)
            min_y = min(bbox[1] for bbox in bboxes)
            max_x = max(bbox[2] for bbox in bboxes)
            max_y = max(bbox[3] for bbox in bboxes)
            merged['bbox'] = [min_x, min_y, max_x, max_y]
        
        return merged