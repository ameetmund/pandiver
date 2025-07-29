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
        """Group words by page number and Y position (for rows)"""
        
        pages_data = {}
        processed_words = 0
        
        for word in words:
            page_num = word.get('page_number', 0)
            
            # Only process pages at or after start_page
            if page_num < start_page:
                continue
            
            # Only process words below header (with small buffer)
            word_y = word.get('top', word.get('y0', 0))
            header_buffer = 10  # Small buffer below header
            
            if page_num == start_page and word_y <= (header_y + header_buffer):
                continue
            
            if page_num not in pages_data:
                pages_data[page_num] = {}
            
            # Group by Y position with tolerance
            y_pos = word_y
            matched_y = None
            
            # Find existing Y position within tolerance
            for existing_y in pages_data[page_num].keys():
                if abs(y_pos - existing_y) <= self.y_tolerance:
                    matched_y = existing_y
                    break
            
            if matched_y is not None:
                pages_data[page_num][matched_y].append(word)
            else:
                pages_data[page_num][y_pos] = [word]
            
            processed_words += 1
        
        
        return pages_data
    
    def _extract_row_data(self, 
                        row_words: List[Dict[str, Any]], 
                        columns: List[ColumnDefinition],
                        y_position: float,
                        page_number: int) -> Optional[ExtractedRow]:
        """Extract data from a single row by assigning words to columns based on X-alignment"""
        
        row_data = {col.name: "" for col in columns}
        has_data = False
        words_assigned = 0
        
        # Sort words by X position for better processing
        sorted_words = sorted(row_words, key=lambda w: w['x0'])
        
        for word in sorted_words:
            word_x_center = (word['x0'] + word['x1']) / 2
            assigned = False
            
            # Find which column this word belongs to based on X-coordinate alignment
            for col in columns:
                # Use a slightly more flexible boundary check
                col_tolerance = 5  # Small tolerance for boundary matching
                if (col.x_min - col_tolerance) <= word_x_center <= (col.x_max + col_tolerance):
                    if row_data[col.name]:
                        row_data[col.name] += " " + word['text']
                    else:
                        row_data[col.name] = word['text']
                    has_data = True
                    words_assigned += 1
                    assigned = True
                    break
            
            # If word doesn't fit in any column, assign to closest column
            if not assigned:
                closest_col = min(columns, key=lambda c: min(
                    abs(word_x_center - c.x_min), 
                    abs(word_x_center - c.x_max)
                ))
                if row_data[closest_col.name]:
                    row_data[closest_col.name] += " " + word['text']
                else:
                    row_data[closest_col.name] = word['text']
                has_data = True
                words_assigned += 1
        
        # Only return row if we have meaningful data
        if not has_data or words_assigned == 0:
            return None
        
        # Clean up empty columns
        cleaned_data = {k: v.strip() for k, v in row_data.items() if v.strip()}
        
        # Only return if we have at least one non-empty column
        if not cleaned_data:
            return None
        
        return ExtractedRow(
            data=row_data,
            y_position=y_position,
            page_number=page_number
        )
    
    def _merge_multiline_descriptions(self, 
                                    rows: List[ExtractedRow], 
                                    columns: List[ColumnDefinition]) -> List[ExtractedRow]:
        """
        Step 4: Merge multi-line descriptions
        If a row only contains values in description-like columns, merge with previous row
        """
        
        if not rows:
            return rows
        
        # Identify description columns (usually the widest or named description/particulars/narration)
        description_cols = []
        for col in columns:
            col_name_lower = col.name.lower()
            if any(keyword in col_name_lower for keyword in 
                   ['description', 'particulars', 'narration', 'details', 'memo']):
                description_cols.append(col.name)
        
        # If no explicit description column found, use the widest column
        if not description_cols:
            widest_col = max(columns, key=lambda c: c.x_max - c.x_min)
            description_cols = [widest_col.name]
        
        merged_rows = []
        
        for i, row in enumerate(rows):
            # Check if this row only has description data
            non_desc_data = {k: v for k, v in row.data.items() 
                           if k not in description_cols and v.strip()}
            desc_data = {k: v for k, v in row.data.items() 
                        if k in description_cols and v.strip()}
            
            if not non_desc_data and desc_data and merged_rows:
                # This row only has description data - merge with previous row
                prev_row = merged_rows[-1]
                for desc_col in description_cols:
                    if row.data.get(desc_col, '').strip():
                        if prev_row.data[desc_col]:
                            prev_row.data[desc_col] += "\n" + row.data[desc_col]
                        else:
                            prev_row.data[desc_col] = row.data[desc_col]
                
                # Mark as continuation
                row.is_continuation = True
            else:
                # Regular row
                merged_rows.append(row)
        
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