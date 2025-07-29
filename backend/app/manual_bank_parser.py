"""
Manual Bank Statement Parser - User-Controlled Extraction

This module implements the new manual selection approach where users have full control
over header detection and field selection without AI guessing.

Key Features:
- User selects headers and sample rows manually
- Exact field preservation (no standardization)
- Pattern rule generation from user selection
- Multi-page application of user-defined patterns
"""

import pdfplumber
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime


@dataclass
class UserSelection:
    """Represents user's manual selection of headers and rows"""
    header_text: List[str]
    header_positions: List[Tuple[float, float]]  # (x0, x1) for each column
    sample_rows: List[List[str]]
    row_y_positions: List[float]
    page_number: int
    column_count: int


@dataclass 
class PatternRule:
    """Pattern rule generated from user selection"""
    column_count: int
    column_names: List[str]
    selected_fields: List[int]  # Which columns user wants to extract
    row_gap_tolerance: float
    font_size_range: Tuple[float, float]
    first_column_pattern: str  # Regex for first column (usually date)
    multiline_merge: bool
    header_y_position: float
    layout_mode: str
    column_boundaries: List[Tuple[float, float]]  # (x0, x1) for each column


class TransactionPageDetector:
    """Detects pages that likely contain transaction tables"""
    
    def __init__(self):
        # Financial keywords that suggest transaction tables
        self.financial_keywords = [
            'date', 'description', 'amount', 'balance', 'debit', 'credit',
            'transaction', 'particulars', 'narration', 'deposits', 'withdrawals',
            'value date', 'txn date', 'ref no', 'cheque', 'transfer'
        ]
    
    def detect_transaction_pages(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Scan PDF and find pages that likely contain transaction tables.
        Returns list of candidate pages with metadata.
        """
        candidates = []
        
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_analysis = self._analyze_page_for_transactions(page, page_num)
                if page_analysis['is_candidate']:
                    candidates.append(page_analysis)
        
        return candidates
    
    def _analyze_page_for_transactions(self, page, page_num: int) -> Dict[str, Any]:
        """Analyze a single page to determine if it contains transaction tables"""
        
        # Extract words with positions
        words = page.extract_words()
        if not words:
            return {'is_candidate': False, 'page': page_num, 'reason': 'No text found'}
        
        # Group words into potential rows based on Y coordinates
        rows = self._group_words_into_rows(words)
        
        # Look for rows with 4-8 aligned terms containing financial keywords
        transaction_like_rows = []
        
        for row in rows:
            if len(row) >= 4 and len(row) <= 8:  # Transaction tables typically have 4-8 columns
                row_text = ' '.join([word['text'] for word in row]).lower()
                
                # Check for financial keywords
                keyword_count = sum(1 for keyword in self.financial_keywords if keyword in row_text)
                
                if keyword_count >= 2:  # At least 2 financial keywords
                    transaction_like_rows.append({
                        'row_words': row,
                        'keyword_count': keyword_count,
                        'column_count': len(row),
                        'y_position': row[0]['top']
                    })
        
        if not transaction_like_rows:
            return {'is_candidate': False, 'page': page_num, 'reason': 'No transaction-like rows found'}
        
        # Find the best candidate row (likely header)
        best_row = max(transaction_like_rows, key=lambda x: x['keyword_count'])
        
        # Check if next row looks like transaction data
        next_row_validation = self._validate_next_row_as_transaction(rows, best_row['y_position'])
        
        return {
            'is_candidate': True,
            'page': page_num,
            'suggested_header_row': best_row,
            'next_row_validation': next_row_validation,
            'total_potential_rows': len(transaction_like_rows),
            'confidence_score': min(best_row['keyword_count'] / 4.0, 1.0)  # Max confidence of 1.0
        }
    
    def _group_words_into_rows(self, words: List[Dict], y_tolerance: float = 3.0) -> List[List[Dict]]:
        """Group words into rows based on Y coordinate proximity"""
        if not words:
            return []
        
        # Sort words by Y position first, then X position
        sorted_words = sorted(words, key=lambda w: (w['top'], w['x0']))
        
        rows = []
        current_row = [sorted_words[0]]
        current_y = sorted_words[0]['top']
        
        for word in sorted_words[1:]:
            if abs(word['top'] - current_y) <= y_tolerance:
                # Same row
                current_row.append(word)
            else:
                # New row
                if current_row:
                    rows.append(sorted(current_row, key=lambda w: w['x0']))  # Sort by X within row
                current_row = [word]
                current_y = word['top']
        
        # Don't forget the last row
        if current_row:
            rows.append(sorted(current_row, key=lambda w: w['x0']))
        
        return rows
    
    def _validate_next_row_as_transaction(self, rows: List[List[Dict]], header_y: float) -> Dict[str, Any]:
        """Check if the row following the header looks like transaction data"""
        
        # Find rows that come after the header
        subsequent_rows = [row for row in rows if row[0]['top'] > header_y]
        
        if not subsequent_rows:
            return {'is_valid': False, 'reason': 'No rows found after header'}
        
        # Check the first subsequent row
        next_row = subsequent_rows[0]
        
        # Look for date-like pattern in first column
        first_column_text = next_row[0]['text'] if next_row else ''
        date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',  # DD-MM-YYYY or MM/DD/YY
            r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',  # YYYY-MM-DD
            r'\d{1,2}\s+\w{3}\s+\d{2,4}',      # DD MMM YYYY
        ]
        
        has_date = any(re.search(pattern, first_column_text) for pattern in date_patterns)
        
        # Look for numeric values (amounts)
        numeric_columns = 0
        for word in next_row:
            if re.search(r'\d+[\.,]\d{2}', word['text']):  # Decimal numbers
                numeric_columns += 1
        
        return {
            'is_valid': has_date and numeric_columns >= 1,
            'has_date_in_first_column': has_date,
            'numeric_columns_count': numeric_columns,
            'first_column_text': first_column_text
        }


class ManualBankStatementParser:
    """Main parser that handles user-driven manual selection workflow"""
    
    def __init__(self):
        self.detector = TransactionPageDetector()
    
    def detect_transaction_pages(self, pdf_path: str) -> Dict[str, Any]:
        """Step 1: Detect and preview transaction-like pages"""
        candidates = self.detector.detect_transaction_pages(pdf_path)
        
        if not candidates:
            return {
                'success': False,
                'message': 'No transaction-like pages found in the PDF',
                'candidates': []
            }
        
        # Return the best candidate as the starting point
        best_candidate = max(candidates, key=lambda x: x['confidence_score'])
        
        return {
            'success': True,
            'message': f'Found {len(candidates)} potential transaction pages',
            'suggested_start_page': best_candidate['page'],
            'candidates': candidates,
            'preview_page': best_candidate
        }
    
    def create_pattern_from_selection(self, 
                                    pdf_path: str,
                                    page_number: int,
                                    header_selection: Dict[str, Any],
                                    sample_rows_selection: List[Dict[str, Any]]) -> PatternRule:
        """
        Step 2: Generate pattern rule from user's manual selection
        
        Args:
            pdf_path: Path to PDF file
            page_number: Page where user made selection
            header_selection: User's header selection with positions
            sample_rows_selection: User's sample row selections
        """
        
        # Extract column information from user selection
        column_names = header_selection['headers']
        column_boundaries = header_selection['positions']  # List of (x0, x1) tuples
        column_count = len(column_names)
        
        # Analyze sample rows to determine row spacing and patterns
        y_positions = [row['y_position'] for row in sample_rows_selection]
        row_gap = self._calculate_row_gap(y_positions)
        
        # Extract first column pattern (usually date)
        first_column_texts = [row['data'][0] for row in sample_rows_selection if row['data']]
        first_column_pattern = self._derive_date_pattern(first_column_texts)
        
        # Default selections: extract all columns
        selected_fields = list(range(column_count))
        
        return PatternRule(
            column_count=column_count,
            column_names=column_names,
            selected_fields=selected_fields,
            row_gap_tolerance=max(row_gap * 0.5, 2.0),  # Allow 50% variance in row spacing
            font_size_range=(8.0, 14.0),  # Reasonable range for PDF text
            first_column_pattern=first_column_pattern,
            multiline_merge=True,
            header_y_position=header_selection['y_position'],
            layout_mode='manual_selection',
            column_boundaries=column_boundaries
        )
    
    def apply_pattern_to_pdf(self, 
                           pdf_path: str, 
                           pattern: PatternRule,
                           start_page: int = 0) -> Dict[str, Any]:
        """
        Step 3: Apply the user-defined pattern to extract data from all pages
        """
        extracted_data = []
        pages_processed = []
        errors = []
        
        with pdfplumber.open(pdf_path) as pdf:
            for page_num in range(start_page, len(pdf.pages)):
                try:
                    page = pdf.pages[page_num]
                    page_data = self._extract_from_page_with_pattern(page, pattern, page_num)
                    
                    if page_data['rows']:
                        extracted_data.extend(page_data['rows'])
                        pages_processed.append(page_num)
                    
                    if page_data['errors']:
                        errors.extend(page_data['errors'])
                        
                except Exception as e:
                    errors.append(f"Error processing page {page_num + 1}: {str(e)}")
        
        return {
            'success': len(extracted_data) > 0,
            'total_transactions': len(extracted_data),
            'transactions': extracted_data,
            'headers': [pattern.column_names[i] for i in pattern.selected_fields],
            'pages_processed': pages_processed,
            'errors': errors,
            'pattern_used': {
                'column_count': pattern.column_count,
                'selected_fields': pattern.selected_fields,
                'layout_mode': pattern.layout_mode
            }
        }
    
    def _extract_from_page_with_pattern(self, page, pattern: PatternRule, page_num: int) -> Dict[str, Any]:
        """Extract data from a single page using the pattern rule"""
        
        words = page.extract_words()
        if not words:
            return {'rows': [], 'errors': [f'No text found on page {page_num + 1}']}
        
        # Use a more flexible approach for rectangle-based selection
        if pattern.layout_mode == 'manual_selection':
            return self._extract_with_flexible_matching(page, pattern, page_num, words)
        else:
            return self._extract_with_strict_matching(page, pattern, page_num, words)
    
    def _extract_with_flexible_matching(self, page, pattern: PatternRule, page_num: int, words: List[Dict]) -> Dict[str, Any]:
        """Implements Steps 4-7 of user process: Group words into rows and assign to columns"""
        # Step 4: Group all words into data rows
        rows = self._group_words_into_rows_precise(words, 3.0)  # 3px Y tolerance
        extracted_rows = []
        errors = []
        
        # Filter rows to only process transaction data (below header)
        transaction_rows = []
        for row in rows:
            if not row:
                continue
            
            row_y = row[0]['top']
            
            # Only include rows below the header (with some margin)
            if row_y > pattern.header_y_position + 15:
                # Skip obvious non-transaction rows
                row_text = ' '.join([word['text'] for word in row]).lower()
                if len(row_text.strip()) > 5:  # Minimum content requirement
                    transaction_rows.append(row)
        
        # Step 5 & 6: Assign words to columns based on X position
        for row in transaction_rows:
            # Step 6: For each word in row, compute x_center and match to column
            row_data = [''] * len(pattern.column_boundaries)
            
            for word in row:
                word_x_center = (word['x0'] + word['x1']) / 2
                
                # Find which column this word belongs to
                for col_idx, (col_start, col_end) in enumerate(pattern.column_boundaries):
                    if col_start <= word_x_center <= col_end:
                        # Add word to this column (concatenate if multiple words)
                        if row_data[col_idx]:
                            row_data[col_idx] += ' ' + word['text']
                        else:
                            row_data[col_idx] = word['text']
                        break
            
            # Only include selected fields
            selected_data = [row_data[i] for i in pattern.selected_fields if i < len(row_data)]
            
            # Only add row if it has meaningful content
            if selected_data and any(data.strip() for data in selected_data):
                extracted_rows.append({
                    'data': selected_data,
                    'page': page_num + 1,
                    'source': 'user_specified_process'
                })
        
        return {'rows': extracted_rows, 'errors': errors}
    
    def _group_words_into_rows_precise(self, words: List[Dict], y_tolerance: float = 3.0) -> List[List[Dict]]:
        """Group words into rows with precise Y-coordinate tolerance"""
        if not words:
            return []
        
        # Sort words by Y position first, then X position
        sorted_words = sorted(words, key=lambda w: (w['top'], w['x0']))
        
        rows = []
        current_row = [sorted_words[0]]
        current_y = sorted_words[0]['top']
        
        for word in sorted_words[1:]:
            if abs(word['top'] - current_y) <= y_tolerance:
                # Same row
                current_row.append(word)
            else:
                # New row
                if current_row:
                    rows.append(sorted(current_row, key=lambda w: w['x0']))  # Sort by X within row
                current_row = [word]
                current_y = word['top']
        
        # Don't forget the last row
        if current_row:
            rows.append(sorted(current_row, key=lambda w: w['x0']))
        
        return rows
    
    def _extract_with_strict_matching(self, page, pattern: PatternRule, page_num: int, words: List[Dict]) -> Dict[str, Any]:
        """Original strict extraction method"""
        rows = self.detector._group_words_into_rows(words, pattern.row_gap_tolerance)
        extracted_rows = []
        errors = []
        
        for row in rows:
            if len(row) != pattern.column_count:
                continue  # Skip rows that don't match expected column count
            
            # Check if first column matches the expected pattern
            first_column_text = row[0]['text']
            if not re.search(pattern.first_column_pattern, first_column_text):
                continue  # Skip rows that don't start with expected pattern (e.g., date)
            
            # Extract data based on column boundaries
            row_data = []
            for i, (x0, x1) in enumerate(pattern.column_boundaries):
                column_text = self._extract_column_text(row, x0, x1)
                row_data.append(column_text)
            
            # Only include selected fields
            selected_data = [row_data[i] for i in pattern.selected_fields if i < len(row_data)]
            
            if selected_data:
                extracted_rows.append({
                    'data': selected_data,
                    'page': page_num + 1,
                    'source': 'manual_pattern'
                })
        
        return {'rows': extracted_rows, 'errors': errors}
    
    def _looks_like_transaction_row(self, first_column: str, row: List[Dict]) -> bool:
        """Check if this looks like a transaction row with more flexible criteria"""
        # Look for date patterns
        date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',  # DD-MM-YYYY or MM/DD/YY
            r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',  # YYYY-MM-DD  
            r'\d{1,2}\s+\w{3}\s+\d{2,4}',      # DD MMM YYYY
            r'\d{2}\w{3}\d{2}',                # 01JAN23
        ]
        
        if any(re.search(pattern, first_column) for pattern in date_patterns):
            return True
            
        # Look for numeric values anywhere in the row (amounts)
        for word in row:
            if re.search(r'\d+[.,]\d{2}', word['text']):  # Monetary amounts
                return True
                
        # Look for common transaction keywords
        row_text = ' '.join(word['text'] for word in row).lower()
        transaction_keywords = ['debit', 'credit', 'transfer', 'payment', 'deposit', 'withdrawal', 'atm', 'purchase']
        if any(keyword in row_text for keyword in transaction_keywords):
            return True
            
        return False
    
    def _extract_column_text_flexible(self, row_words: List[Dict], x0: float, x1: float) -> str:
        """More flexible column text extraction"""
        column_words = []
        
        for word in row_words:
            # Use word overlap instead of just center point
            word_start = word['x0']
            word_end = word['x1']
            column_start = x0
            column_end = x1
            
            # Check for overlap
            overlap = max(0, min(word_end, column_end) - max(word_start, column_start))
            word_width = word_end - word_start
            
            # Include word if it has significant overlap with the column
            if overlap > word_width * 0.3:  # 30% overlap threshold
                column_words.append(word['text'])
        
        return ' '.join(column_words).strip()
    
    def _extract_column_text(self, row_words: List[Dict], x0: float, x1: float) -> str:
        """Extract text from words that fall within column boundaries"""
        column_words = []
        
        for word in row_words:
            word_center = (word['x0'] + word['x1']) / 2
            if x0 <= word_center <= x1:
                column_words.append(word['text'])
        
        return ' '.join(column_words).strip()
    
    def _calculate_row_gap(self, y_positions: List[float]) -> float:
        """Calculate average gap between rows"""
        if len(y_positions) < 2:
            return 15.0  # Default row gap
        
        gaps = []
        sorted_positions = sorted(y_positions)
        
        for i in range(1, len(sorted_positions)):
            gap = sorted_positions[i] - sorted_positions[i-1]
            if gap > 0:
                gaps.append(gap)
        
        return sum(gaps) / len(gaps) if gaps else 15.0
    
    def _derive_date_pattern(self, sample_dates: List[str]) -> str:
        """Derive regex pattern from sample date strings"""
        if not sample_dates:
            return r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'  # Default date pattern
        
        # Common date patterns
        patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{4}',      # DD-MM-YYYY or MM/DD/YYYY
            r'\d{2}[-/]\d{2}[-/]\d{2}',          # DD-MM-YY or MM/DD/YY
            r'\d{4}[-/]\d{1,2}[-/]\d{1,2}',      # YYYY-MM-DD
            r'\d{1,2}\s+\w{3}\s+\d{4}',          # DD MMM YYYY
        ]
        
        # Test each pattern against sample dates
        for pattern in patterns:
            matches = sum(1 for date in sample_dates if re.search(pattern, date))
            if matches >= len(sample_dates) * 0.8:  # 80% match rate
                return pattern
        
        # Fallback to default
        return r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'
    
    def save_pattern(self, pattern: PatternRule, pattern_name: str, bank_name: str = "") -> bool:
        """Step 5: Save pattern for future use"""
        try:
            patterns_dir = Path("saved_patterns")
            patterns_dir.mkdir(exist_ok=True)
            
            pattern_data = {
                'name': pattern_name,
                'bank_name': bank_name,
                'created_at': datetime.now().isoformat(),
                'pattern': {
                    'column_count': pattern.column_count,
                    'column_names': pattern.column_names,
                    'selected_fields': pattern.selected_fields,
                    'row_gap_tolerance': pattern.row_gap_tolerance,
                    'font_size_range': pattern.font_size_range,
                    'first_column_pattern': pattern.first_column_pattern,
                    'multiline_merge': pattern.multiline_merge,
                    'header_y_position': pattern.header_y_position,
                    'layout_mode': pattern.layout_mode,
                    'column_boundaries': pattern.column_boundaries
                }
            }
            
            pattern_file = patterns_dir / f"{pattern_name.replace(' ', '_')}.json"
            with open(pattern_file, 'w') as f:
                json.dump(pattern_data, f, indent=2)
            
            return True
        except Exception as e:
            print(f"Error saving pattern: {e}")
            return False
    
    def load_pattern(self, pattern_name: str) -> Optional[PatternRule]:
        """Load a saved pattern"""
        try:
            patterns_dir = Path("saved_patterns")
            pattern_file = patterns_dir / f"{pattern_name.replace(' ', '_')}.json"
            
            if not pattern_file.exists():
                return None
            
            with open(pattern_file, 'r') as f:
                data = json.load(f)
            
            pattern_data = data['pattern']
            return PatternRule(
                column_count=pattern_data['column_count'],
                column_names=pattern_data['column_names'],
                selected_fields=pattern_data['selected_fields'],
                row_gap_tolerance=pattern_data['row_gap_tolerance'],
                font_size_range=tuple(pattern_data['font_size_range']),
                first_column_pattern=pattern_data['first_column_pattern'],
                multiline_merge=pattern_data['multiline_merge'],
                header_y_position=pattern_data['header_y_position'],
                layout_mode=pattern_data['layout_mode'],
                column_boundaries=pattern_data['column_boundaries']
            )
        except Exception as e:
            print(f"Error loading pattern: {e}")
            return None