"""
Universal Bank Statement Parser

A robust parser that can handle bank statements from various international banks
with different layouts, languages, and formats. This implements Task 5 of the
smart PDF parser project.

Key Features:
- Smart header detection with flexible synonym matching
- Intelligent column band management with merging
- Flexible transaction row detection
- Support for RTL layouts
- Robust number parsing with international formats
- Comprehensive fallback parsing
"""

import re
from collections import defaultdict
from typing import List, Dict, Any, Optional, NamedTuple
from .synonyms import (
    normalize_header, extract_date, NUMBER_REGEX, DATE_REGEX,
    normalize_number, NEGATIVE_REGEX
)


def words_to_rows(words: List[Dict[str, Any]], y_tolerance: float = 2.0) -> List[List[Dict[str, Any]]]:
    """
    Convert list of words to rows by grouping words with similar Y coordinates.
    
    Args:
        words: List of word dictionaries with x0, y0, x1, y1, text keys
        y_tolerance: Tolerance for grouping words into same row
        
    Returns:
        List of rows, where each row is a list of words
    """
    if not words:
        return []
    
    # Group words by Y coordinate
    y_groups = defaultdict(list)
    
    for word in words:
        y_pos = word.get('y0', 0)
        
        # Find existing group within tolerance
        matched_y = None
        for existing_y in y_groups.keys():
            if abs(y_pos - existing_y) <= y_tolerance:
                matched_y = existing_y
                break
        
        if matched_y is not None:
            y_groups[matched_y].append(word)
        else:
            y_groups[y_pos] = [word]
    
    # Convert to list of rows sorted by Y position (top to bottom)
    rows = []
    for y_pos in sorted(y_groups.keys()):
        # Sort words in each row by X position (left to right)
        row_words = sorted(y_groups[y_pos], key=lambda w: w.get('x0', 0))
        rows.append(row_words)
    
    return rows


class ColumnBand:
    """Represents a column in the bank statement with field type and position."""
    
    def __init__(self, field_name: str, x0: float, x1: float):
        self.field_name = field_name
        self.x0 = x0
        self.x1 = x1
        
    @property
    def center(self) -> float:
        return (self.x0 + self.x1) / 2
        
    @property
    def width(self) -> float:
        return self.x1 - self.x0
        
    def contains_word(self, word: Dict[str, Any]) -> bool:
        """Check if a word falls within this column band."""
        word_center = (word.get('x0', 0) + word.get('x1', 0)) / 2
        return self.x0 <= word_center <= self.x1
        
    def overlaps_with(self, other: 'ColumnBand') -> bool:
        """Check if this band overlaps with another."""
        return not (self.x1 < other.x0 or other.x1 < self.x0)
        
    def __repr__(self):
        return f"ColumnBand({self.field_name}, {self.x0:.1f}-{self.x1:.1f})"


class UniversalBankStatementParser:
    """Universal parser for bank statements from various international banks."""
    
    def __init__(self):
        self.column_bands: List[ColumnBand] = []
        self.transactions: List[Dict[str, Any]] = []
        self.page_width: float = 0
        self.is_rtl: bool = False
        self.previous_balance: Optional[float] = None
        
    def cluster_words_by_rows(self, words: List[Dict[str, Any]], tolerance: float = 2.0) -> List[List[Dict[str, Any]]]:
        """
        Cluster words into rows based on Y-coordinate proximity.
        
        Args:
            words: List of word dictionaries with x0, y0, x1, y1 coordinates
            tolerance: Y-coordinate tolerance for grouping (pixels)
            
        Returns:
            List of rows, each containing words in that row
        """
        if not words:
            return []
            
        # Sort by Y coordinate (top to bottom)
        sorted_words = sorted(words, key=lambda w: w.get('y0', 0))
        
        rows = []
        current_row = [sorted_words[0]]
        current_y = sorted_words[0].get('y0', 0)
        
        for word in sorted_words[1:]:
            word_y = word.get('y0', 0)
            
            # Check if word belongs to current row (within tolerance)
            if abs(word_y - current_y) <= tolerance:
                current_row.append(word)
            else:
                # Start new row
                if current_row:
                    # Sort current row by X coordinate (left to right)
                    current_row.sort(key=lambda w: w.get('x0', 0))
                    rows.append(current_row)
                    
                current_row = [word]
                current_y = word_y
                
        # Add the last row
        if current_row:
            current_row.sort(key=lambda w: w.get('x0', 0))
            rows.append(current_row)
            
        return rows
        
    def detect_header_row(self, rows: List[List[Dict[str, Any]]]) -> Optional[int]:
        """
        Detect the header row containing column names.
        
        Args:
            rows: List of word rows
            
        Returns:
            Index of header row, or None if not found
        """
        best_score = 0
        best_row_idx = None
        
        for idx, row in enumerate(rows):
            if not row:
                continue
                
            # Create row text for analysis
            row_text = ' '.join(word.get('text', '') for word in row).lower()
            
            # Skip very short rows
            if len(row_text.strip()) < 10:
                continue
                
            # Count recognized field headers
            score = 0
            field_types = set()
            
            for word in row:
                word_text = word.get('text', '').strip()
                if not word_text:
                    continue
                    
                canonical = normalize_header(word_text)
                if canonical:
                    score += 1
                    field_types.add(canonical)
                    
            # Bonus for having essential fields
            if 'Date' in field_types:
                score += 5
            if 'Description' in field_types or 'Particulars' in field_types:
                score += 3
            if 'Debit' in field_types or 'Credit' in field_types:
                score += 3
            if 'Balance' in field_types:
                score += 2
                
            # Require minimum score and field diversity
            if score >= 8 and len(field_types) >= 3:
                if score > best_score:
                    best_score = score
                    best_row_idx = idx
                    
        if best_row_idx is not None:
            print(f"[Universal Parser] Found header row at index {best_row_idx} (score: {best_score})")
            
        return best_row_idx
        
    def establish_column_bands(self, header_row: List[Dict[str, Any]]) -> List[ColumnBand]:
        """
        Create column bands from header row words.
        
        Args:
            header_row: List of words in the header row
            
        Returns:
            List of column bands
        """
        bands = []
        
        # Create initial bands for each recognized header
        for word in header_row:
            word_text = word.get('text', '').strip()
            if not word_text:
                continue
                
            canonical = normalize_header(word_text)
            if canonical:
                x0 = word.get('x0', 0)
                x1 = word.get('x1', 0)
                
                # Expand band slightly for better capture
                band = ColumnBand(canonical, x0 - 3, x1 + 3)
                bands.append(band)
                
        # Sort by position
        bands.sort(key=lambda b: b.x0)
        
        # Merge overlapping bands of same type
        merged_bands = self.merge_column_bands(bands)
        
        print(f"[Universal Parser] Created {len(merged_bands)} column bands from {len(bands)} initial bands")
        for band in merged_bands:
            print(f"[Universal Parser] {band}")
            
        return merged_bands
        
    def merge_column_bands(self, bands: List[ColumnBand]) -> List[ColumnBand]:
        """
        Merge overlapping or closely positioned bands of the same field type.
        
        Args:
            bands: List of column bands to merge
            
        Returns:
            List of merged column bands
        """
        if not bands:
            return []
            
        # Group by field type
        field_groups = defaultdict(list)
        for band in bands:
            field_groups[band.field_name].append(band)
            
        merged_bands = []
        
        for field_name, field_bands in field_groups.items():
            if len(field_bands) == 1:
                merged_bands.append(field_bands[0])
                continue
                
            # Sort by x0 position
            field_bands.sort(key=lambda b: b.x0)
            
            # Merge closely positioned bands (within 50 pixels) - increased tolerance
            current_group = [field_bands[0]]
            
            for band in field_bands[1:]:
                last_band = current_group[-1]
                
                # If bands are close or overlapping, merge them
                if band.x0 <= last_band.x1 + 50:
                    current_group.append(band)
                else:
                    # Finalize current group and start new one
                    if current_group:
                        merged_band = self.create_merged_band(field_name, current_group)
                        merged_bands.append(merged_band)
                    current_group = [band]
                    
            # Process last group
            if current_group:
                merged_band = self.create_merged_band(field_name, current_group)
                merged_bands.append(merged_band)
                
        # Sort final bands by position
        merged_bands.sort(key=lambda b: b.x0)
        return merged_bands
        
    def create_merged_band(self, field_name: str, bands: List[ColumnBand]) -> ColumnBand:
        """Create a single merged band from multiple bands."""
        min_x0 = min(band.x0 for band in bands)
        max_x1 = max(band.x1 for band in bands)
        return ColumnBand(field_name, min_x0, max_x1)
        
    def assign_words_to_columns(self, row: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Assign words in a row to their respective column bands.
        
        Args:
            row: List of words in the row
            
        Returns:
            Dictionary mapping field names to concatenated text values
        """
        field_values = defaultdict(list)
        
        for word in row:
            word_text = word.get('text', '').strip()
            if not word_text:
                continue
                
            # Find best matching column band
            assigned = False
            for band in self.column_bands:
                if band.contains_word(word):
                    field_values[band.field_name].append(word_text)
                    assigned = True
                    break
                    
            # If no band matches, add to Description (most flexible)
            if not assigned:
                field_values['Description'].append(word_text)
                
        # Convert lists to joined strings
        result = {}
        for field, values in field_values.items():
            result[field] = ' '.join(values).strip()
            
        return result
        
    def is_transaction_row(self, field_values: Dict[str, str]) -> bool:
        """
        Determine if a row represents a transaction using flexible criteria.
        
        Args:
            field_values: Dictionary of field values for the row
            
        Returns:
            True if this appears to be a transaction row
        """
        score = 0
        
        # Check for date (most important indicator)
        for field, value in field_values.items():
            if not value or not value.strip():
                continue
                
            # Date detection (flexible patterns)
            if field == 'Date' and value:
                if (extract_date(value) or 
                    re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', value) or
                    re.search(r'\d{2,4}[/-]\d{1,2}[/-]\d{1,2}', value)):
                    score += 5  # Date is crucial
                    
            # Amount fields
            if field in ['Debit', 'Credit', 'Amount', 'Balance', 'Withdrawal', 'Deposit']:
                if self.safe_extract_numbers(value):
                    score += 3  # Amount fields are strong indicators
                    
            # Any numeric value
            if self.safe_extract_numbers(value):
                score += 1
                
            # Substantial description
            if field in ['Description', 'Particulars', 'Narration'] and len(value.strip()) > 5:
                score += 2
                
        # Accept if score indicates strong transaction likelihood
        return score >= 6
        
    def safe_extract_numbers(self, text: str) -> List[str]:
        """
        Safely extract numbers from text, handling tuple results from regex.
        
        Args:
            text: Text to extract numbers from
            
        Returns:
            List of number strings
        """
        if not text:
            return []
            
        try:
            matches = NUMBER_REGEX.findall(text)
            numbers = []
            
            for match in matches:
                if isinstance(match, tuple):
                    # Join non-empty parts of tuple
                    number_str = ''.join(str(part) for part in match if part)
                    if number_str.strip():
                        numbers.append(number_str.strip())
                else:
                    numbers.append(str(match).strip())
                    
            return [n for n in numbers if n]
        except Exception as e:
            print(f"[Universal Parser] Warning: Error extracting numbers from '{text}': {e}")
            return []
            
    def create_transaction(self, field_values: Dict[str, str]) -> Dict[str, Any]:
        """
        Create a standardized transaction from field values.
        
        Args:
            field_values: Dictionary of field values
            
        Returns:
            Standardized transaction dictionary
        """
        transaction = {
            'Date': None,
            'Description': '',
            'Debit': None,
            'Credit': None,
            'Balance': None,
            'Amount': None
        }
        
        # Process each field
        for field, value in field_values.items():
            if not value or not value.strip():
                continue
                
            value = value.strip()
            
            if field == 'Date':
                parsed_date = extract_date(value)
                if parsed_date:
                    transaction['Date'] = parsed_date
                else:
                    transaction['Date'] = value  # Keep original if parsing fails
                    
            elif field in ['Description', 'Particulars', 'Narration']:
                if transaction['Description']:
                    transaction['Description'] += f" {value}"
                else:
                    transaction['Description'] = value
                    
            elif field in ['Debit', 'Withdrawal']:
                normalized = normalize_number(value)
                if normalized is not None and normalized > 0:
                    transaction['Debit'] = normalized
                    
            elif field in ['Credit', 'Deposit']:
                normalized = normalize_number(value)
                if normalized is not None and normalized > 0:
                    transaction['Credit'] = normalized
                    
            elif field == 'Balance':
                normalized = normalize_number(value)
                if normalized is not None:
                    transaction['Balance'] = normalized
                    
            elif field == 'Amount':
                normalized = normalize_number(value)
                if normalized is not None:
                    transaction['Amount'] = normalized
                    
        # Clean up description
        transaction['Description'] = transaction['Description'].strip()
        
        # Ensure at least one amount field is populated
        if (transaction['Debit'] is None and 
            transaction['Credit'] is None and 
            transaction['Amount'] is not None):
            # Determine if amount is debit or credit based on context
            if transaction['Amount'] < 0:
                transaction['Debit'] = abs(transaction['Amount'])
            else:
                transaction['Credit'] = transaction['Amount']
                
        return transaction
        
    def parse_statement(self, all_words: List[Dict[str, Any]], page_width: float = 0) -> List[Dict[str, Any]]:
        """
        Parse bank statement from word list across all pages.
        
        Args:
            all_words: List of all words from all pages
            page_width: Width of the page for RTL detection
            
        Returns:
            List of transaction dictionaries
        """
        print(f"[Universal Parser] Starting parse with {len(all_words)} words")
        
        self.page_width = page_width
        self.transactions = []
        
        if not all_words:
            print("[Universal Parser] ERROR: No words provided")
            return []
            
        # Cluster words into rows
        print("[Universal Parser] Clustering words into rows...")
        rows = self.cluster_words_by_rows(all_words)
        
        if not rows:
            print("[Universal Parser] ERROR: No rows found")
            return []
            
        print(f"[Universal Parser] Found {len(rows)} rows")
        
        # Detect header row
        header_idx = self.detect_header_row(rows)
        
        if header_idx is None:
            print("[Universal Parser] No header found, using fallback parsing")
            return self.fallback_parse(rows)
            
        # Establish column bands
        self.column_bands = self.establish_column_bands(rows[header_idx])
        
        if not self.column_bands:
            print("[Universal Parser] No column bands established, using fallback")
            return self.fallback_parse(rows)
            
        # Validate reasonable number of bands
        if len(self.column_bands) > 15:  # Increased from 10 to 15
            print(f"[Universal Parser] Too many column bands ({len(self.column_bands)}), using fallback")
            return self.fallback_parse(rows)
            
        # Process transaction rows
        print(f"[Universal Parser] Processing transaction rows after header {header_idx}")
        
        for row_idx in range(header_idx + 1, len(rows)):
            row = rows[row_idx]
            if not row:
                continue
                
            # Assign words to columns
            field_values = self.assign_words_to_columns(row)
            
            # Check if this is a transaction row
            if self.is_transaction_row(field_values):
                transaction = self.create_transaction(field_values)
                self.transactions.append(transaction)
                print(f"[Universal Parser] ✓ Transaction: {transaction.get('Date')} - {transaction.get('Description', '')[:50]}")
                
        print(f"[Universal Parser] Extracted {len(self.transactions)} transactions using column-based parsing")
        
        if not self.transactions:
            print("[Universal Parser] Column parsing found no transactions, trying fallback")
            return self.fallback_parse(rows)
            
        return self.transactions
        
    def fallback_parse(self, rows: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        Fallback parsing when column detection fails.
        
        Args:
            rows: List of word rows
            
        Returns:
            List of transactions from fallback parsing
        """
        print("[Universal Parser] Using fallback parsing method")
        
        transactions = []
        
        for row_idx, row in enumerate(rows):
            if not row:
                continue
                
            # Create row text
            row_text = ' '.join(word.get('text', '') for word in row)
            
            # Look for potential transaction indicators
            has_date = bool(DATE_REGEX.search(row_text))
            numbers = self.safe_extract_numbers(row_text)
            has_meaningful_numbers = len(numbers) >= 1
            
            # Simple transaction detection
            if has_date and has_meaningful_numbers and len(row_text.strip()) > 10:
                # Try to extract a basic transaction
                transaction = self.extract_basic_transaction(row_text, row)
                if transaction:
                    transactions.append(transaction)
                    print(f"[Universal Parser] ✓ Fallback transaction: {transaction.get('Date')} - {transaction.get('Description', '')[:50]}")
                    
        print(f"[Universal Parser] Fallback parsing extracted {len(transactions)} transactions")
        return transactions
        
    def extract_basic_transaction(self, row_text: str, row: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Extract a basic transaction from a row using pattern matching.
        
        Args:
            row_text: Combined text of the row
            row: List of word dictionaries
            
        Returns:
            Transaction dictionary or None
        """
        # Find date
        date_match = DATE_REGEX.search(row_text)
        if not date_match:
            return None
            
        # Extract numbers
        numbers = self.safe_extract_numbers(row_text)
        if not numbers:
            return None
            
        # Create basic transaction
        transaction = {
            'Date': date_match.group(),
            'Description': row_text.strip(),
            'Debit': None,
            'Credit': None,
            'Balance': None,
            'Amount': None
        }
        
        # Try to assign amounts (simple heuristic)
        normalized_numbers = []
        for num_str in numbers:
            normalized = normalize_number(num_str)
            if normalized is not None:
                normalized_numbers.append(normalized)
                
        if normalized_numbers:
            # Use largest number as main amount
            main_amount = max(normalized_numbers)
            transaction['Amount'] = main_amount
            
            # If multiple numbers, try to infer balance
            if len(normalized_numbers) > 1:
                transaction['Balance'] = normalized_numbers[-1]  # Often last number
                
        return transaction 