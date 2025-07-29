"""
Enhanced Banking Statement Parser
Auto-detects transaction pages and creates pattern rules for parsing
"""

import pdfplumber
import fitz  # PyMuPDF
import re
import os
from typing import List, Dict, Any, Optional, Tuple
import json
from dataclasses import dataclass
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PatternRule:
    """Pattern rule for identifying transaction rows"""
    column_count: int
    header_keywords: List[str]
    row_gap_tolerance: float
    font_size_range: Tuple[float, float]
    first_column_pattern: str
    layout_mode: str  # "text-aligned" or "bounding-box"
    header_positions: List[Tuple[float, float]]  # x0, x1 positions
    row_height: float
    
class TransactionDetector:
    """Detects transaction tables in PDF pages"""
    
    # Common banking keywords to look for in headers
    BANKING_KEYWORDS = [
        "date", "value date", "txn date", "transaction date", "posting date",
        "description", "narration", "particulars", "details", "reference",
        "debit", "credit", "amount", "withdrawal", "deposit", 
        "balance", "closing balance", "running balance", "available balance",
        "cheque", "ref no", "reference no", "transaction id", "utr",
        # US banking format keywords
        "deposits", "credits", "debits", "withdrawals", "checks paid",
        "check number", "date paid", "date credited", "tran date",
        # International banking keywords
        "transaction", "transactions", "opening balance", "ending balance",
        "previous balance", "new balance", "minimum payment", "payment received",
        "activity summary", "account summary", "statement", "current balance",
        # Australian banking
        "total debits", "total credits", "bsb", "account number",
        # UK banking  
        "sort code", "cardholder", "mastercard", "new transactions",
        "fees and charges"
    ]
    
    # Date patterns to identify transaction rows
    DATE_PATTERNS = [
        r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',  # DD-MM-YYYY, DD/MM/YYYY
        r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',  # YYYY-MM-DD, YYYY/MM/DD
        r'\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}',  # DD Mon YYYY
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{2,4}',  # Mon DD, YYYY
        # US banking format dates
        r'\d{2}-\d{2}',  # MM-DD (US short format)
        r'\d{1,2}-\d{1,2}',  # M-D or MM-DD
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}',  # Mon DD
    ]
    
    def __init__(self):
        self.pattern_rule: Optional[PatternRule] = None
        
    def detect_first_transaction_page(self, pdf_path: str) -> Dict[str, Any]:
        """
        Scan PDF pages to find the first page with transaction data
        Returns page number and detected structure info
        """
        logger.info(f"Starting transaction page detection for {pdf_path}")
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                logger.info(f"Scanning {total_pages} pages for transaction data")
                
                for page_num in range(total_pages):
                    page = pdf.pages[page_num]
                    logger.info(f"Analyzing page {page_num + 1}")
                    
                    # Extract tables and text
                    tables = page.extract_tables()
                    text_lines = self._extract_text_lines(page)
                    
                    # Check for transaction patterns
                    detection_result = self._analyze_page_for_transactions(
                        page_num, tables, text_lines, page
                    )
                    
                    if detection_result['is_transaction_page']:
                        logger.info(f"✅ Found transaction page: {page_num + 1}")
                        return {
                            'success': True,
                            'first_transaction_page': page_num,
                            'page_analysis': detection_result,
                            'total_pages': total_pages
                        }
                
                logger.warning("No transaction pages detected")
                return {
                    'success': False,
                    'error': 'No transaction pages found in the PDF',
                    'total_pages': total_pages
                }
                
        except Exception as e:
            logger.error(f"Error during page detection: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to analyze PDF: {str(e)}'
            }
    
    def _extract_text_lines(self, page) -> List[Dict[str, Any]]:
        """Extract text lines with position information"""
        try:
            words = page.extract_words()
            if not words:
                return []
            
            # Group words into lines based on y-position
            lines = {}
            for word in words:
                y_pos = round(word['top'], 1)  # Round to group nearby words
                if y_pos not in lines:
                    lines[y_pos] = []
                lines[y_pos].append(word)
            
            # Sort words in each line by x-position
            text_lines = []
            for y_pos in sorted(lines.keys()):
                line_words = sorted(lines[y_pos], key=lambda w: w['x0'])
                line_text = ' '.join([w['text'] for w in line_words])
                
                if line_text.strip():  # Only include non-empty lines
                    text_lines.append({
                        'text': line_text.strip(),
                        'y_position': y_pos,
                        'words': line_words,
                        'word_count': len(line_words),
                        'bbox': {
                            'x0': min(w['x0'] for w in line_words),
                            'x1': max(w['x1'] for w in line_words),
                            'top': min(w['top'] for w in line_words),
                            'bottom': max(w['bottom'] for w in line_words)
                        }
                    })
            
            return text_lines
            
        except Exception as e:
            logger.error(f"Error extracting text lines: {str(e)}")
            return []
    
    def _analyze_page_for_transactions(self, page_num: int, tables: List, 
                                     text_lines: List[Dict], page) -> Dict[str, Any]:
        """Analyze a page to determine if it contains transaction data"""
        
        analysis = {
            'is_transaction_page': False,
            'confidence_score': 0.0,
            'detected_patterns': [],
            'header_candidates': [],
            'transaction_candidates': [],
            'column_structure': None
        }
        
        # Method 1: Analyze extracted tables
        table_score = self._analyze_tables_for_transactions(tables, analysis)
        
        # Method 2: Analyze text lines for patterns
        text_score = self._analyze_text_patterns(text_lines, analysis, page)
        
        # Calculate overall confidence
        analysis['confidence_score'] = max(table_score, text_score)
        analysis['is_transaction_page'] = analysis['confidence_score'] > 0.55  # Lowered threshold for US banking formats
        
        logger.info(f"Page {page_num + 1} analysis: confidence={analysis['confidence_score']:.2f}, "
                   f"is_transaction_page={analysis['is_transaction_page']}")
        
        return analysis
    
    def _analyze_tables_for_transactions(self, tables: List, analysis: Dict) -> float:
        """Analyze extracted tables for transaction patterns"""
        if not tables:
            return 0.0
        
        max_score = 0.0
        
        for table_idx, table in enumerate(tables):
            if not table or len(table) < 2:  # Need header + at least 1 row
                continue
            
            table_score = 0.0
            header_row = table[0] if table[0] else []
            data_rows = table[1:] if len(table) > 1 else []
            
            # Check header for banking keywords
            header_score = self._score_header_keywords(header_row)
            table_score += header_score * 0.4
            
            # Check data rows for date patterns
            date_score = self._score_date_patterns([row for row in data_rows if row])
            table_score += date_score * 0.4
            
            # Check column count (3-8 columns typical for bank statements)
            col_count = len([cell for cell in header_row if cell and cell.strip()])
            if 3 <= col_count <= 8:
                table_score += 0.2
            
            if table_score > max_score:
                max_score = table_score
                analysis['column_structure'] = {
                    'table_index': table_idx,
                    'column_count': col_count,
                    'header_row': header_row,
                    'sample_rows': data_rows[:3]  # First 3 rows as samples
                }
        
        return max_score
    
    def _analyze_text_patterns(self, text_lines: List[Dict], analysis: Dict, page) -> float:
        """Analyze text lines for transaction patterns when tables aren't detected"""
        if not text_lines:
            return 0.0
        
        # Look for lines with banking keywords (potential headers)
        header_candidates = []
        for line in text_lines:
            keyword_score = self._score_header_keywords([line['text']])
            if keyword_score > 0.3:  # Potential header
                header_candidates.append({
                    'line': line,
                    'score': keyword_score,
                    'words': self._split_line_into_columns(line)
                })
        
        if not header_candidates:
            return 0.0
        
        # Find the best header candidate
        best_header = max(header_candidates, key=lambda h: h['score'])
        analysis['header_candidates'] = header_candidates
        
        # Look for transaction-like rows near the header
        header_y = best_header['line']['y_position']
        transaction_candidates = []
        
        for line in text_lines:
            # Look within reasonable distance from header
            if abs(line['y_position'] - header_y) < 200:  # Within 200 points
                if self._is_transaction_row(line['text']):
                    transaction_candidates.append(line)
        
        analysis['transaction_candidates'] = transaction_candidates
        
        # Calculate score based on header quality and transaction candidates
        score = best_header['score'] * 0.6
        if transaction_candidates:
            score += min(len(transaction_candidates) / 5, 0.4)  # Max 0.4 for having transactions
        
        return score
    
    def _split_line_into_columns(self, line: Dict) -> List[str]:
        """Split a text line into potential columns based on word positions"""
        words = line['words']
        if len(words) <= 1:
            return [line['text']]
        
        # Sort words by x-position
        sorted_words = sorted(words, key=lambda w: w['x0'])
        
        # Group words into columns based on gaps
        columns = []
        current_column = [sorted_words[0]]
        
        for i in range(1, len(sorted_words)):
            prev_word = sorted_words[i-1]
            curr_word = sorted_words[i]
            
            # If there's a significant gap, start new column
            gap = curr_word['x0'] - prev_word['x1']
            if gap > 20:  # 20 points gap threshold
                columns.append(' '.join([w['text'] for w in current_column]))
                current_column = [curr_word]
            else:
                current_column.append(curr_word)
        
        # Add the last column
        if current_column:
            columns.append(' '.join([w['text'] for w in current_column]))
        
        return columns
    
    def _score_header_keywords(self, header_cells: List[str]) -> float:
        """Score header row based on banking keywords"""
        if not header_cells:
            return 0.0
        
        header_text = ' '.join([cell.lower() for cell in header_cells if cell])
        keyword_matches = 0
        
        for keyword in self.BANKING_KEYWORDS:
            if keyword in header_text:
                keyword_matches += 1
        
        # Score based on percentage of keywords found and minimum threshold
        score = keyword_matches / len(self.BANKING_KEYWORDS)
        return min(score * 2, 1.0)  # Amplify score but cap at 1.0
    
    def _score_date_patterns(self, data_rows: List[List[str]]) -> float:
        """Score data rows based on date patterns in first column"""
        if not data_rows:
            return 0.0
        
        date_matches = 0
        total_rows = len(data_rows)
        
        for row in data_rows:
            if not row or not row[0]:
                continue
            
            first_cell = str(row[0]).strip()
            if self._contains_date_pattern(first_cell):
                date_matches += 1
        
        return date_matches / max(total_rows, 1)
    
    def _is_transaction_row(self, text: str) -> bool:
        """Check if a text line looks like a transaction row"""
        # Must start with a date-like pattern
        if not self._contains_date_pattern(text):
            return False
        
        # Should have multiple parts separated by spaces/tabs
        parts = text.split()
        if len(parts) < 3:  # Date + description + amount minimum
            return False
        
        # Look for amount-like patterns (numbers with decimals, commas)
        amount_pattern = r'[\d,]+\.?\d*'
        if not re.search(amount_pattern, text):
            return False
        
        return True
    
    def _contains_date_pattern(self, text: str) -> bool:
        """Check if text contains any date pattern"""
        for pattern in self.DATE_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def generate_pattern_rule(self, pdf_path: str, page_num: int, 
                            selected_header: Dict, selected_rows: List[Dict]) -> PatternRule:
        """
        Generate a pattern rule from user's selection
        
        Args:
            pdf_path: Path to PDF file
            page_num: Page number where selection was made
            selected_header: Header row information
            selected_rows: Selected transaction rows
        """
        logger.info(f"Generating pattern rule from page {page_num + 1}")
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                page = pdf.pages[page_num]
                
                # Extract column information from header
                header_words = selected_header.get('words', [])
                header_positions = []
                header_keywords = []
                
                for word in header_words:
                    header_keywords.append(word['text'])
                    header_positions.append((word['x0'], word['x1']))
                
                # Analyze selected rows for patterns
                font_sizes = []
                row_heights = []
                first_col_patterns = []
                
                for row in selected_rows:
                    if 'words' in row:
                        # Collect font sizes
                        for word in row['words']:
                            if 'size' in word:
                                font_sizes.append(word['size'])
                        
                        # Collect row heights
                        bbox = row.get('bbox', {})
                        if 'top' in bbox and 'bottom' in bbox:
                            row_heights.append(bbox['bottom'] - bbox['top'])
                        
                        # Collect first column text for pattern analysis
                        if row['words']:
                            first_col_patterns.append(row['words'][0]['text'])
                
                # Calculate statistics
                avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10
                font_size_range = (
                    avg_font_size - 1,
                    avg_font_size + 1
                )
                
                avg_row_height = sum(row_heights) / len(row_heights) if row_heights else 15
                
                # Determine first column pattern
                first_column_pattern = self._analyze_first_column_pattern(first_col_patterns)
                
                # Calculate row gap tolerance
                if len(selected_rows) > 1:
                    gaps = []
                    for i in range(1, len(selected_rows)):
                        prev_bottom = selected_rows[i-1].get('bbox', {}).get('bottom', 0)
                        curr_top = selected_rows[i].get('bbox', {}).get('top', 0)
                        if prev_bottom and curr_top:
                            gaps.append(abs(curr_top - prev_bottom))
                    
                    row_gap_tolerance = max(gaps) if gaps else 5
                else:
                    row_gap_tolerance = 5
                
                # Create pattern rule
                pattern_rule = PatternRule(
                    column_count=len(header_keywords),
                    header_keywords=header_keywords,
                    row_gap_tolerance=row_gap_tolerance,
                    font_size_range=font_size_range,
                    first_column_pattern=first_column_pattern,
                    layout_mode="text-aligned",
                    header_positions=header_positions,
                    row_height=avg_row_height
                )
                
                self.pattern_rule = pattern_rule
                logger.info("✅ Pattern rule generated successfully")
                
                return pattern_rule
                
        except Exception as e:
            logger.error(f"Error generating pattern rule: {str(e)}")
            raise
    
    def _analyze_first_column_pattern(self, first_col_texts: List[str]) -> str:
        """Analyze first column texts to determine date pattern"""
        if not first_col_texts:
            return r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'  # Default date pattern
        
        # Test each pattern against the sample texts
        pattern_scores = {}
        
        for pattern in self.DATE_PATTERNS:
            matches = 0
            for text in first_col_texts:
                if re.search(pattern, text, re.IGNORECASE):
                    matches += 1
            
            pattern_scores[pattern] = matches / len(first_col_texts)
        
        # Return the pattern with highest score
        best_pattern = max(pattern_scores.items(), key=lambda x: x[1])
        return best_pattern[0] if best_pattern[1] > 0 else self.DATE_PATTERNS[0]
    
    def apply_pattern_to_pdf(self, pdf_path: str, pattern_rule: PatternRule) -> Dict[str, Any]:
        """
        Apply the pattern rule to extract transactions from entire PDF
        
        Args:
            pdf_path: Path to PDF file
            pattern_rule: Pattern rule to apply
        """
        logger.info("Applying pattern rule to entire PDF")
        
        try:
            extracted_transactions = []
            page_summaries = []
            
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                
                for page_num in range(total_pages):
                    page = pdf.pages[page_num]
                    logger.info(f"Processing page {page_num + 1}/{total_pages}")
                    
                    # Extract transactions from this page
                    page_transactions = self._extract_transactions_from_page(
                        page, pattern_rule
                    )
                    
                    if page_transactions:
                        extracted_transactions.extend(page_transactions)
                        page_summaries.append({
                            'page': page_num,
                            'transactions_found': len(page_transactions),
                            'status': 'success'
                        })
                    else:
                        page_summaries.append({
                            'page': page_num,
                            'transactions_found': 0,
                            'status': 'no_data'
                        })
                
                logger.info(f"✅ Extracted {len(extracted_transactions)} transactions total")
                
                return {
                    'success': True,
                    'total_transactions': len(extracted_transactions),
                    'transactions': extracted_transactions,
                    'page_summaries': page_summaries,
                    'pattern_used': {
                        'column_count': pattern_rule.column_count,
                        'header_keywords': pattern_rule.header_keywords,
                        'first_column_pattern': pattern_rule.first_column_pattern
                    }
                }
                
        except Exception as e:
            logger.error(f"Error applying pattern rule: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _extract_transactions_from_page(self, page, pattern_rule: PatternRule) -> List[Dict]:
        """Extract transactions from a single page using the pattern rule"""
        try:
            text_lines = self._extract_text_lines(page)
            transactions = []
            
            for line in text_lines:
                if self._matches_pattern_rule(line, pattern_rule):
                    # Split line into columns based on pattern rule
                    columns = self._split_line_into_columns(line)
                    
                    # Ensure we have the expected number of columns
                    while len(columns) < pattern_rule.column_count:
                        columns.append('')
                    
                    # Create transaction dict
                    transaction = {}
                    for i, header in enumerate(pattern_rule.header_keywords):
                        if i < len(columns):
                            transaction[header] = columns[i].strip()
                        else:
                            transaction[header] = ''
                    
                    transactions.append(transaction)
            
            return transactions
            
        except Exception as e:
            logger.error(f"Error extracting transactions from page: {str(e)}")
            return []
    
    def _matches_pattern_rule(self, line: Dict, pattern_rule: PatternRule) -> bool:
        """Check if a line matches the pattern rule"""
        # Check if first column matches date pattern
        first_word_text = line['words'][0]['text'] if line['words'] else ''
        if not re.search(pattern_rule.first_column_pattern, first_word_text, re.IGNORECASE):
            return False
        
        # Check column count (allow some flexibility)
        word_count = len(line['words'])
        if word_count < pattern_rule.column_count - 1:  # Allow 1 column less
            return False
        
        # Check font size (if available)
        if line['words'] and 'size' in line['words'][0]:
            font_size = line['words'][0]['size']
            min_size, max_size = pattern_rule.font_size_range
            if not (min_size <= font_size <= max_size):
                return False
        
        return True


class PatternRuleManager:
    """Manages saved pattern rules for different banks"""
    
    def __init__(self, storage_path: str = "bank_patterns.json"):
        self.storage_path = storage_path
        self.patterns = self._load_patterns()
    
    def _load_patterns(self) -> Dict[str, Dict]:
        """Load saved patterns from storage"""
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading patterns: {str(e)}")
        
        return {}
    
    def save_pattern(self, name: str, pattern_rule: PatternRule, 
                    bank_name: str = None) -> bool:
        """Save a pattern rule with a name"""
        try:
            pattern_dict = {
                'column_count': pattern_rule.column_count,
                'header_keywords': pattern_rule.header_keywords,
                'row_gap_tolerance': pattern_rule.row_gap_tolerance,
                'font_size_range': pattern_rule.font_size_range,
                'first_column_pattern': pattern_rule.first_column_pattern,
                'layout_mode': pattern_rule.layout_mode,
                'header_positions': pattern_rule.header_positions,
                'row_height': pattern_rule.row_height,
                'bank_name': bank_name,
                'created_at': datetime.now().isoformat()
            }
            
            self.patterns[name] = pattern_dict
            
            with open(self.storage_path, 'w') as f:
                json.dump(self.patterns, f, indent=2)
            
            logger.info(f"✅ Pattern '{name}' saved successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error saving pattern: {str(e)}")
            return False
    
    def get_pattern(self, name: str) -> Optional[PatternRule]:
        """Retrieve a saved pattern rule"""
        if name not in self.patterns:
            return None
        
        try:
            pattern_dict = self.patterns[name]
            return PatternRule(
                column_count=pattern_dict['column_count'],
                header_keywords=pattern_dict['header_keywords'],
                row_gap_tolerance=pattern_dict['row_gap_tolerance'],
                font_size_range=tuple(pattern_dict['font_size_range']),
                first_column_pattern=pattern_dict['first_column_pattern'],
                layout_mode=pattern_dict['layout_mode'],
                header_positions=[(pos[0], pos[1]) for pos in pattern_dict['header_positions']],
                row_height=pattern_dict['row_height']
            )
        except Exception as e:
            logger.error(f"Error loading pattern '{name}': {str(e)}")
            return None
    
    def list_patterns(self) -> List[Dict[str, Any]]:
        """List all saved patterns"""
        return [
            {
                'name': name,
                'bank_name': pattern.get('bank_name'),
                'column_count': pattern.get('column_count'),
                'created_at': pattern.get('created_at')
            }
            for name, pattern in self.patterns.items()
        ]