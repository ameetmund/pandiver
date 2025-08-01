"""
User-Controlled Column Detection System
Implements manual header selection with X-coordinate alignment for data extraction
"""

import re
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass


@dataclass
class ColumnDefinition:
    """Represents a user-defined column with adjustable boundaries"""
    name: str
    x_min: float
    x_max: float
    index: int
    user_adjusted: bool = False  # Track if user manually adjusted boundaries


@dataclass
class ExtractedRow:
    """Represents an extracted data row"""
    data: Dict[str, str]  # column_name -> value
    y_position: float
    page_number: int
    is_continuation: bool = False  # True if this is a multi-line description continuation


class UserControlledColumnDetector:
    """
    Column detection system that gives users full control over header selection
    and column boundary definition via manual rectangle selection
    """
    
    def __init__(self):
        self.y_tolerance = 3.0  # Tolerance for grouping words on same baseline
        self.gap_threshold = 20.0  # Minimum gap to consider separate columns
    
    def _detect_column_data_type(self, column_name: str, sample_values: List[str]) -> str:
        """
        Intelligently detect the expected data type for a column based on its name and sample values
        """
        column_name_lower = column_name.lower().strip()
        
        # Date column detection
        if any(keyword in column_name_lower for keyword in 
               ['date', 'dt', 'trans', 'posting', 'value', 'effective']):
            return 'date'
        
        # Amount/Balance column detection
        if any(keyword in column_name_lower for keyword in 
               ['amount', 'debit', 'credit', 'balance', 'withdrawal', 'deposit', 
                'dr', 'cr', 'bal', '$', '₹', '£', '€', 'usd', 'inr', 'gbp', 'eur']):
            return 'amount'
        
        # Reference/Check number column detection
        if any(keyword in column_name_lower for keyword in 
               ['ref', 'reference', 'check', 'cheque', 'no', 'number', 'serial', 'id']):
            return 'reference'
        
        # Description column detection (usually the catch-all)
        if any(keyword in column_name_lower for keyword in 
               ['description', 'particulars', 'details', 'narration', 'transaction', 
                'payee', 'memo', 'remarks', 'note']):
            return 'description'
        
        # If we have sample values, analyze them to determine type
        if sample_values:
            return self._analyze_sample_values(sample_values)
        
        # Default to description for unknown columns
        return 'description'
    
    def _analyze_sample_values(self, values: List[str]) -> str:
        """
        Analyze sample values to determine the most likely data type
        """
        if not values:
            return 'description'
        
        date_count = 0
        amount_count = 0
        reference_count = 0
        
        for value in values[:5]:  # Analyze first 5 values
            value = value.strip()
            if not value:
                continue
                
            if self._looks_like_date(value):
                date_count += 1
            elif self._looks_like_amount(value):
                amount_count += 1
            elif self._looks_like_reference(value):
                reference_count += 1
        
        # Return the type with highest confidence
        if date_count >= 2:
            return 'date'
        elif amount_count >= 2:
            return 'amount'
        elif reference_count >= 2:
            return 'reference'
        else:
            return 'description'
    
    def _looks_like_date(self, value: str) -> bool:
        """
        Check if a value looks like a date using flexible patterns
        """
        value = value.strip()
        if len(value) < 3:
            return False
        
        # Common date patterns (flexible)
        date_indicators = [
            # Numbers with separators
            re.search(r'\d{1,2}[-/\.]\d{1,2}[-/\.]?\d{0,4}', value),
            # Month names
            re.search(r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', value, re.IGNORECASE),
            # Day-month patterns
            re.search(r'\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', value, re.IGNORECASE),
            # Year patterns
            re.search(r'(19|20)\d{2}', value),
        ]
        
        return any(date_indicators)
    
    def _looks_like_amount(self, value: str) -> bool:
        """
        Check if a value looks like a monetary amount
        """
        value = value.strip()
        if not value:
            return False
        
        # Currency symbols
        if any(symbol in value for symbol in ['$', '₹', '£', '€', '¥', '¢']):
            return True
        
        # Parentheses for negative amounts
        if value.startswith('(') and value.endswith(')'):
            return True
        
        # Numbers with decimal points and commas
        if re.search(r'\d+[,\.]?\d*', value):
            # Check for typical amount formatting
            if re.search(r'\d{1,3}(,\d{3})*(\.\d{2})?', value) or re.search(r'\d+\.\d{2}', value):
                return True
        
        # Plus/minus signs
        if value.startswith(('+', '-')) and re.search(r'\d', value):
            return True
        
        return False
    
    def _looks_like_reference(self, value: str) -> bool:
        """
        Check if a value looks like a reference number
        """
        value = value.strip()
        if not value:
            return False
        
        # Typical reference patterns
        if re.search(r'^[A-Z0-9]{6,}$', value):  # Long alphanumeric codes
            return True
        if re.search(r'^\d{6,}$', value):  # Long numeric codes
            return True
        if re.search(r'^[A-Z]{2,}\d+', value):  # Letters followed by numbers
            return True
        
        return False
    
    def _validate_data_type_match(self, value: str, expected_type: str) -> bool:
        """
        Validate if a value matches the expected data type for the column
        """
        value = value.strip()
        if not value:
            return True  # Empty values are acceptable
        
        if expected_type == 'date':
            return self._looks_like_date(value)
        elif expected_type == 'amount':
            return self._looks_like_amount(value)
        elif expected_type == 'reference':
            return self._looks_like_reference(value)
        else:  # description or unknown
            return True  # Description can be anything
        
    def extract_header_fields_from_selection(self, 
                                           words: List[Dict[str, Any]], 
                                           rectangle: Dict[str, float]) -> List[ColumnDefinition]:
        """
        Step 2: Create one large column from user-selected rectangle
        User will manually add boundaries to split into individual columns
        """
        
        # Filter words within rectangle
        header_words = self._get_words_in_rectangle(words, rectangle)
        
        if not header_words:
            return []
        
        # Calculate overall boundaries
        x_min = min(w['x0'] for w in header_words)
        x_max = max(w['x1'] for w in header_words)
        
        # Join all text content
        full_header_text = ' '.join(w['text'] for w in header_words).strip()
        
        # Create single column spanning the entire selection
        columns = [ColumnDefinition(
            name=full_header_text or "Header Area",
            x_min=x_min,
            x_max=x_max,
            index=0,
            user_adjusted=False
        )]
        
        return columns
    
    def update_column_boundaries(self, 
                               columns: List[ColumnDefinition], 
                               boundary_updates: List[Dict[str, Any]]) -> List[ColumnDefinition]:
        """
        Handle user manual adjustments to column boundaries
        boundary_updates format: [{"column_index": 0, "x_min": 50, "x_max": 120}, ...]
        """
        
        updated_columns = columns.copy()
        
        for update in boundary_updates:
            col_index = update.get('column_index')
            if 0 <= col_index < len(updated_columns):
                if 'x_min' in update:
                    updated_columns[col_index].x_min = update['x_min']
                if 'x_max' in update:
                    updated_columns[col_index].x_max = update['x_max']
                if 'name' in update:
                    updated_columns[col_index].name = update['name']
                
                updated_columns[col_index].user_adjusted = True
        
        return updated_columns
    
    def add_column_boundary(self, 
                          columns: List[ColumnDefinition], 
                          x_position: float, 
                          name: str = "New Column") -> List[ColumnDefinition]:
        """
        Add a new column boundary at specified X position
        """
        
        # Find which existing column this splits
        for i, col in enumerate(columns):
            if col.x_min <= x_position <= col.x_max:
                # Split this column
                new_columns = columns.copy()
                
                # Create new column
                new_col = ColumnDefinition(
                    name=name,
                    x_min=x_position,
                    x_max=col.x_max,
                    index=i + 1,
                    user_adjusted=True
                )
                
                # Adjust existing column
                new_columns[i].x_max = x_position
                new_columns[i].user_adjusted = True
                
                # Insert new column and reindex
                new_columns.insert(i + 1, new_col)
                for j in range(i + 2, len(new_columns)):
                    new_columns[j].index = j
                
                return new_columns
        
        return columns
    
    def delete_column_boundary(self, 
                             columns: List[ColumnDefinition], 
                             column_index: int) -> List[ColumnDefinition]:
        """
        Delete a column boundary and merge with adjacent column
        """
        
        if not (0 <= column_index < len(columns)):
            return columns
        
        new_columns = columns.copy()
        
        if column_index < len(columns) - 1:
            # Merge with next column
            next_col = new_columns[column_index + 1]
            new_columns[column_index].x_max = next_col.x_max
            new_columns[column_index].name += " " + next_col.name
            new_columns[column_index].user_adjusted = True
            
            # Remove next column
            del new_columns[column_index + 1]
        elif column_index > 0:
            # Merge with previous column
            prev_col = new_columns[column_index - 1]
            prev_col.x_max = new_columns[column_index].x_max
            prev_col.name += " " + new_columns[column_index].name
            prev_col.user_adjusted = True
            
            # Remove current column
            del new_columns[column_index]
        
        # Reindex remaining columns
        for i, col in enumerate(new_columns):
            col.index = i
        
        return new_columns
    
    def extract_data_rows(self, 
                         all_words: List[Dict[str, Any]], 
                         columns: List[ColumnDefinition],
                         header_y_position: float,
                         start_page: int = 0) -> List[ExtractedRow]:
        """
        Step 3: Extract all data rows from all pages using X-coordinate alignment
        """
        
        extracted_rows = []
        
        # Group words by page and Y position
        pages_data = self._group_words_by_page_and_y(all_words, header_y_position, start_page)
        
        for page_num, page_rows in pages_data.items():
            for y_pos, row_words in page_rows.items():
                extracted_row = self._extract_row_data(row_words, columns, y_pos, page_num)
                if extracted_row:
                    extracted_rows.append(extracted_row)
        
        # Handle multi-line descriptions
        merged_rows = self._merge_multiline_descriptions(extracted_rows, columns)
        
        return merged_rows
    
    def _get_words_in_rectangle(self, 
                              words: List[Dict[str, Any]], 
                              rectangle: Dict[str, float]) -> List[Dict[str, Any]]:
        """Filter words that fall within the user-selected rectangle"""
        
        x_min = rectangle['x']
        y_min = rectangle['y']
        x_max = x_min + rectangle['width']
        y_max = y_min + rectangle['height']
        
        filtered_words = []
        for word in words:
            word_x_center = (word['x0'] + word['x1']) / 2
            word_y_center = (word['top'] + word['bottom']) / 2
            
            if (x_min <= word_x_center <= x_max and 
                y_min <= word_y_center <= y_max):
                filtered_words.append(word)
        return filtered_words
    
    def _group_words_by_gaps(self, words: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Group consecutive words into columns based on horizontal gaps"""
        
        if not words:
            return []
        
        groups = []
        current_group = [words[0]]
        
        for i in range(1, len(words)):
            current_word = words[i]
            prev_word = words[i-1]
            
            # Calculate gap between words
            gap = current_word['x0'] - prev_word['x1']
            
            if gap > self.gap_threshold:
                # Large gap - start new group
                groups.append(current_group)
                current_group = [current_word]
            else:
                # Small gap - continue current group
                current_group.append(current_word)
        
        # Add the last group
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _group_words_by_page_and_y(self, 
                                 words: List[Dict[str, Any]], 
                                 header_y: float,
                                 start_page: int) -> Dict[int, Dict[float, List[Dict[str, Any]]]]:
        """
        Group words by page number and Y position (for rows) with improved Y-axis snapping.
        Uses better tolerance for grouping words into the same horizontal line.
        """
        
        pages_data = {}
        processed_words = 0
        
        for word in words:
            page_num = word.get('page_number', 0)
            
            # Only process pages at or after start_page
            if page_num < start_page:
                continue
            
            # Only process words below header (with buffer)
            word_y = word.get('top', word.get('y0', 0))
            header_buffer = 15  # Slightly larger buffer below header
            
            if page_num == start_page and word_y <= (header_y + header_buffer):
                continue
            
            if page_num not in pages_data:
                pages_data[page_num] = {}
            
            # Improved Y-axis snapping with rounding to nearest bucket
            # Round Y position to nearest 2px bucket for better grouping
            y_bucket = round(word_y / 2.0) * 2.0
            matched_y = None
            
            # Find existing Y position within improved tolerance
            tolerance = 4.0  # Increased tolerance for better row grouping
            for existing_y in pages_data[page_num].keys():
                if abs(y_bucket - existing_y) <= tolerance:
                    matched_y = existing_y
                    break
            
            if matched_y is not None:
                pages_data[page_num][matched_y].append(word)
            else:
                pages_data[page_num][y_bucket] = [word]
            
            processed_words += 1
        
        return pages_data
    
    def _extract_row_data(self, 
                        row_words: List[Dict[str, Any]], 
                        columns: List[ColumnDefinition],
                        y_position: float,
                        page_number: int) -> Optional[ExtractedRow]:
        """
        Extract data from a single row respecting user-defined header structure.
        Allow partial blanks but ensure alignment with user-selected column boundaries.
        """
        
        if not row_words or not columns:
            return None
        
        # Initialize row data structure matching user header exactly
        row_data = {col.name: "" for col in columns}
        
        # Sort words by X position for processing
        sorted_words = sorted(row_words, key=lambda w: w['x0'])
        
        # STEP 1: Assign words to columns based on user-defined boundaries
        for word in sorted_words:
            word_x_center = (word['x0'] + word['x1']) / 2
            assigned = False
            
            # Find the column this word belongs to based on user boundaries
            for col in columns:
                # Use reasonable tolerance for user-defined boundaries
                col_tolerance = 10  # Allow some flexibility for alignment
                if (col.x_min - col_tolerance) <= word_x_center <= (col.x_max + col_tolerance):
                    if row_data[col.name]:
                        row_data[col.name] += " " + word['text']
                    else:
                        row_data[col.name] = word['text']
                    assigned = True
                    break
            
            # If word doesn't fit in any column, try closest column as fallback
            if not assigned:
                closest_col = min(columns, key=lambda c: min(
                    abs(word_x_center - c.x_min), 
                    abs(word_x_center - c.x_max)
                ))
                # Only assign if reasonably close (within reasonable distance)
                min_distance = min(
                    abs(word_x_center - closest_col.x_min), 
                    abs(word_x_center - closest_col.x_max)
                )
                if min_distance <= 50:  # 50px tolerance for fallback assignment
                    if row_data[closest_col.name]:
                        row_data[closest_col.name] += " " + word['text']
                    else:
                        row_data[closest_col.name] = word['text']
        
        # Clean up the data
        for col_name in row_data:
            row_data[col_name] = row_data[col_name].strip()
        
        # Count filled columns
        filled_columns = sum(1 for value in row_data.values() if value.strip())
        
        # VALIDATION 1: Must have at least some data
        if filled_columns == 0:
            return None  # Completely empty row
        
        # VALIDATION 2: Allow partial blanks - only require minimal filling
        # At least 1 column should have data, be more lenient
        min_required_fields = 1
        if filled_columns < min_required_fields:
            return None
        
        # VALIDATION 3: Check if this row is structurally different from header
        # Only reject if it's clearly from a different table structure
        total_text = ' '.join(row_data.values()).lower().strip()
        
        # Skip obvious non-transaction content
        skip_indicators = [
            'page', 'statement', 'account number', 'customer', 'branch',
            'period from', 'period to', 'opening balance', 'closing balance',
            'total number of', 'summary', 'continued on next page'
        ]
        
        # Only skip if it's clearly structural header/footer text
        if any(indicator in total_text for indicator in skip_indicators):
            return None
        
        # VALIDATION 4: Check if row falls within reasonable X boundaries of header
        # Get the overall X range of the user-defined header
        header_x_min = min(col.x_min for col in columns)
        header_x_max = max(col.x_max for col in columns)
        
        # Check if at least some words fall within the header range
        words_in_range = 0
        for word in sorted_words:
            word_x_center = (word['x0'] + word['x1']) / 2
            if (header_x_min - 20) <= word_x_center <= (header_x_max + 20):
                words_in_range += 1
        
        # If no words fall within reasonable range of header, this might be a different section
        if words_in_range == 0 and len(sorted_words) > 0:
            return None
        
        # If validations pass, return the row with user-defined column structure
        return ExtractedRow(
            data=row_data,
            y_position=y_position,
            page_number=page_number
        )
    
    def _merge_multiline_descriptions(self, 
                                    rows: List[ExtractedRow], 
                                    columns: List[ColumnDefinition]) -> List[ExtractedRow]:
        """
        Enhanced multi-line row detection and merging.
        Handles rows that span multiple lines by merging based on leading column values.
        """
        
        if not rows:
            return rows
        
        # Sort rows by page and Y position for proper processing
        sorted_rows = sorted(rows, key=lambda r: (r.page_number, r.y_position))
        
        # Identify key columns that typically identify unique transactions
        key_columns = []  # Columns that identify unique transactions (like Date, Transaction ID)
        description_columns = []  # Columns that can span multiple lines
        
        for col in columns:
            col_name_lower = col.name.lower().strip()
            
            # Key identifier columns (usually leftmost, contain dates or IDs)
            if any(keyword in col_name_lower for keyword in 
                   ['date', 'transaction', 'ref', 'check', 'cheque', 'serial']):
                key_columns.append(col.name)
            
            # Description/detail columns that can span multiple lines
            elif any(keyword in col_name_lower for keyword in 
                     ['description', 'particulars', 'narration', 'details', 'memo', 'payee']):
                description_columns.append(col.name)
        
        # If no explicit key column found, use leftmost column
        if not key_columns:
            leftmost_col = min(columns, key=lambda c: c.x_min)
            key_columns = [leftmost_col.name]
        
        # If no explicit description column found, use widest or rightmost column  
        if not description_columns:
            widest_col = max(columns, key=lambda c: c.x_max - c.x_min)
            description_columns = [widest_col.name]
        
        merged_rows = []
        
        for i, current_row in enumerate(sorted_rows):
            should_merge = False
            
            # Check if this row should be merged with the previous row
            if merged_rows:
                prev_row = merged_rows[-1]
                
                # Check if current row is a continuation (missing key identifiers)
                current_has_key_data = any(current_row.data.get(key_col, '').strip() 
                                         for key_col in key_columns)
                current_has_desc_data = any(current_row.data.get(desc_col, '').strip() 
                                          for desc_col in description_columns)
                
                # Merge conditions:
                # 1. Current row has no key data but has description data
                # 2. Current row is on same page and close in Y position to previous row
                y_distance = abs(current_row.y_position - prev_row.y_position)
                same_page = current_row.page_number == prev_row.page_number
                close_proximity = y_distance < 20  # Within 20px vertically
                
                if (not current_has_key_data and current_has_desc_data and 
                    same_page and close_proximity):
                    should_merge = True
            
            if should_merge:
                # Merge current row with previous row
                prev_row = merged_rows[-1]
                
                for col in columns:
                    col_name = col.name
                    current_value = current_row.data.get(col_name, '').strip()
                    
                    if current_value:
                        if prev_row.data.get(col_name, '').strip():
                            # Append with space or newline based on column type
                            separator = ' ' if col_name in description_columns else ' '
                            prev_row.data[col_name] += separator + current_value
                        else:
                            prev_row.data[col_name] = current_value
                
                # Mark as continuation
                current_row.is_continuation = True
            else:
                # Add as new row
                merged_rows.append(current_row)
        
        return merged_rows
    
    def get_extraction_summary(self, 
                             columns: List[ColumnDefinition], 
                             rows: List[ExtractedRow]) -> Dict[str, Any]:
        """Generate summary of extraction results"""
        
        return {
            'total_columns': len(columns),
            'column_definitions': [
                {
                    'name': col.name,
                    'x_min': col.x_min,
                    'x_max': col.x_max,
                    'width': col.x_max - col.x_min,
                    'user_adjusted': col.user_adjusted
                }
                for col in columns
            ],
            'total_rows': len(rows),
            'continuation_rows': len([r for r in rows if r.is_continuation]),
            'pages_processed': len(set(r.page_number for r in rows)),
            'data_sample': [r.data for r in rows[:3]]  # First 3 rows as sample
        }