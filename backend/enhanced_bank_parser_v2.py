"""
Enhanced Banking Statement Parser V2.0
Improved algorithm for international banking format detection
Handles both table-based and text-based banking statements
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
    layout_mode: str  # "table", "text-aligned", "sectioned"
    header_positions: List[Tuple[float, float]]  # x0, x1 positions
    row_height: float
    format_type: str  # "tabular", "text_based", "sectioned"
    
class EnhancedTransactionDetector:
    """Enhanced detector for transaction tables in PDF pages"""
    
    # Comprehensive international banking keywords
    BANKING_KEYWORDS = [
        # Core transaction terms
        "date", "value date", "txn date", "transaction date", "posting date", "tran date",
        "description", "narration", "particulars", "details", "reference", "transaction details",
        "debit", "credit", "amount", "withdrawal", "deposit", "withdrawals", "deposits",
        "balance", "closing balance", "running balance", "available balance", "current balance",
        "cheque", "ref no", "reference no", "transaction id", "utr", "chq no", "cheque no",
        
        # US banking format keywords
        "deposits", "credits", "debits", "withdrawals", "checks paid", "other credits",
        "check number", "date paid", "date credited", "beginning balance", "ending balance",
        "electronic deposits", "atm", "pos", "account summary", "summary",
        
        # International banking keywords
        "transaction", "transactions", "opening balance", "new balance",
        "previous balance", "minimum payment", "payment received", "transfers",
        "activity summary", "statement", "total", "fees", "charges",
        
        # Australian banking
        "total debits", "total credits", "bsb", "account number", "account name",
        
        # UK banking  
        "sort code", "cardholder", "mastercard", "visa", "new transactions",
        "fees and charges", "direct debit", "standing order", "card payment",
        
        # Additional terms found in analysis
        "mode", "particulars", "init br", "alpha", "srl", "cr/dr", "money in", "money out"
    ]
    
    # Enhanced date patterns for international formats
    DATE_PATTERNS = [
        # Standard formats
        r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b',  # DD-MM-YYYY, DD/MM/YYYY
        r'\b\d{2,4}[-/]\d{1,2}[-/]\d{1,2}\b',  # YYYY-MM-DD, YYYY/MM/DD
        r'\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}\b',  # DD Mon YYYY
        r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{2,4}\b',  # Mon DD, YYYY
        
        # US banking format dates
        r'\b\d{2}-\d{2}\b',  # MM-DD (US short format)
        r'\b\d{1,2}-\d{1,2}\b',  # M-D or MM-DD
        r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b',  # Mon DD
        
        # International date formats
        r'\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{2,4}\b',
        r'\b\d{4}-\d{2}-\d{2}\b',  # ISO format
        r'\b\d{2}\.\d{2}\.\d{4}\b',  # German format DD.MM.YYYY
        
        # Time stamps
        r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?\b',
    ]
    
    # Amount patterns for different currencies
    AMOUNT_PATTERNS = [
        r'[$£€¥₹]\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?',  # Currency symbols
        r'\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\s*(?:CR|DR|Cr|Dr)?',  # Numbers with CR/DR
        r'\d+,\d+\.\d{2}',  # Indian format: 1,234.56
        r'\d+\.\d{2}',  # Simple decimal format
        r'\(\d+\.\d{2}\)',  # Negative amounts in parentheses
    ]
    
    def __init__(self):
        self.pattern_rule: Optional[PatternRule] = None
        
    def detect_first_transaction_page(self, pdf_path: str) -> Dict[str, Any]:
        """
        Enhanced scan for transaction pages with multi-format support
        """
        logger.info(f"Starting enhanced transaction page detection for {pdf_path}")
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                logger.info(f"Scanning {total_pages} pages for transaction data")
                
                best_page = None
                best_score = 0
                
                for page_num in range(total_pages):
                    page = pdf.pages[page_num]
                    logger.info(f"Analyzing page {page_num + 1}")
                    
                    # Multi-method analysis
                    detection_result = self._comprehensive_page_analysis(
                        page_num, page
                    )
                    
                    if detection_result['confidence_score'] > best_score:
                        best_score = detection_result['confidence_score']
                        best_page = {
                            'page_num': page_num,
                            'analysis': detection_result
                        }
                    
                    # Lower threshold for acceptance (0.4 instead of 0.55)
                    if detection_result['confidence_score'] > 0.4:
                        logger.info(f"✅ Found transaction page: {page_num + 1} (confidence: {detection_result['confidence_score']:.2f})")
                        return {
                            'success': True,
                            'first_transaction_page': page_num,
                            'page_analysis': detection_result,
                            'total_pages': total_pages
                        }
                
                # If no page met the threshold, return the best one found
                if best_page and best_score > 0.2:
                    logger.info(f"✅ Best transaction page found: {best_page['page_num'] + 1} (confidence: {best_score:.2f})")
                    return {
                        'success': True,
                        'first_transaction_page': best_page['page_num'],
                        'page_analysis': best_page['analysis'],
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
    
    def _comprehensive_page_analysis(self, page_num: int, page) -> Dict[str, Any]:
        """
        Comprehensive analysis combining multiple detection methods
        """
        analysis = {
            'is_transaction_page': False,
            'confidence_score': 0.0,
            'detected_patterns': [],
            'header_candidates': [],
            'transaction_candidates': [],
            'column_structure': None,
            'format_type': 'unknown'
        }
        
        # Method 1: Traditional table analysis
        table_score = self._analyze_tables_enhanced(page, analysis)
        
        # Method 2: Text-based pattern analysis
        text_score = self._analyze_text_patterns_enhanced(page, analysis)
        
        # Method 3: Sectioned format analysis (US banks)
        section_score = self._analyze_sectioned_format(page, analysis)
        
        # Method 4: List format analysis (Australian banks)
        list_score = self._analyze_list_format(page, analysis)
        
        # Calculate overall confidence with weighted scoring
        scores = [table_score, text_score, section_score, list_score]
        weights = [0.4, 0.3, 0.15, 0.15]  # Prioritize table detection
        
        analysis['confidence_score'] = sum(score * weight for score, weight in zip(scores, weights))
        analysis['is_transaction_page'] = analysis['confidence_score'] > 0.4
        
        # Determine format type
        max_score_idx = scores.index(max(scores))
        format_types = ['tabular', 'text_based', 'sectioned', 'list_format']
        analysis['format_type'] = format_types[max_score_idx]
        
        logger.info(f"Page {page_num + 1} analysis: confidence={analysis['confidence_score']:.2f}, "
                   f"format={analysis['format_type']}, is_transaction_page={analysis['is_transaction_page']}")
        
        return analysis
    
    def _analyze_tables_enhanced(self, page, analysis: Dict) -> float:
        """Enhanced table analysis with better scoring"""
        tables = page.extract_tables()
        if not tables:
            return 0.0
        
        max_score = 0.0
        
        for table_idx, table in enumerate(tables):
            if not table or len(table) < 2:
                continue
            
            table_score = 0.0
            header_row = table[0] if table[0] else []
            data_rows = table[1:] if len(table) > 1 else []
            
            # Clean headers
            clean_headers = []
            for cell in header_row:
                if cell and cell.strip():
                    clean_cell = cell.replace('\n', ' ').replace('\r', ' ').strip()
                    clean_headers.append(clean_cell)
            
            # Enhanced header scoring
            header_score = self._score_header_keywords_enhanced(clean_headers)
            table_score += header_score * 0.4
            
            # Enhanced data row scoring
            date_score = self._score_date_patterns_enhanced(data_rows)
            table_score += date_score * 0.3
            
            # Amount pattern scoring
            amount_score = self._score_amount_patterns(data_rows)
            table_score += amount_score * 0.2
            
            # Column count scoring (more flexible)
            col_count = len(clean_headers)
            if 2 <= col_count <= 12:  # More flexible range
                table_score += min(col_count / 10, 0.1)  # Cap bonus at 0.1
            
            if table_score > max_score:
                max_score = table_score
                analysis['column_structure'] = {
                    'table_index': table_idx,
                    'column_count': col_count,
                    'header_row': clean_headers,
                    'sample_rows': data_rows[:3],
                    'score_breakdown': {
                        'header_score': header_score,
                        'date_score': date_score,
                        'amount_score': amount_score
                    }
                }
        
        return min(max_score, 1.0)  # Cap at 1.0
    
    def _analyze_text_patterns_enhanced(self, page, analysis: Dict) -> float:
        """Enhanced text pattern analysis for text-based statements"""
        try:
            text = page.extract_text()
            if not text:
                return 0.0
            
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            if not lines:
                return 0.0
            
            score = 0.0
            
            # Look for banking keywords in text
            text_lower = text.lower()
            keyword_matches = sum(1 for keyword in self.BANKING_KEYWORDS if keyword in text_lower)
            keyword_score = min(keyword_matches / 10, 0.4)  # Cap at 0.4
            score += keyword_score
            
            # Look for date patterns
            date_matches = 0
            for line in lines:
                for pattern in self.DATE_PATTERNS:
                    if re.search(pattern, line, re.IGNORECASE):
                        date_matches += 1
                        break
            
            date_score = min(date_matches / 10, 0.3)  # Cap at 0.3
            score += date_score
            
            # Look for amount patterns
            amount_matches = 0
            for line in lines:
                for pattern in self.AMOUNT_PATTERNS:
                    if re.search(pattern, line):
                        amount_matches += 1
                        break
            
            amount_score = min(amount_matches / 10, 0.3)  # Cap at 0.3
            score += amount_score
            
            # Look for structured headers
            header_candidates = []
            for line in lines[:20]:  # Check first 20 lines
                line_lower = line.lower()
                if any(keyword in line_lower for keyword in ['date', 'transaction', 'amount', 'balance']):
                    # Check if line has multiple columns
                    words = line.split()
                    if len(words) >= 3:
                        header_candidates.append(line)
            
            if header_candidates:
                analysis['header_candidates'] = header_candidates
                score += min(len(header_candidates) / 5, 0.2)  # Cap at 0.2
            
            analysis['text_analysis'] = {
                'keyword_matches': keyword_matches,
                'date_matches': date_matches,
                'amount_matches': amount_matches,
                'header_candidates': len(header_candidates)
            }
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.error(f"Error in text pattern analysis: {str(e)}")
            return 0.0
    
    def _analyze_sectioned_format(self, page, analysis: Dict) -> float:
        """Analyze US-style sectioned bank statements"""
        try:
            text = page.extract_text()
            if not text:
                return 0.0
            
            score = 0.0
            
            # Look for section headers typical in US banking
            us_sections = [
                'deposits and other credits', 'withdrawals and debits', 'checks paid',
                'electronic deposits', 'atm withdrawals', 'debit card purchases',
                'account summary', 'beginning balance', 'ending balance'
            ]
            
            text_lower = text.lower()
            section_matches = sum(1 for section in us_sections if section in text_lower)
            
            if section_matches >= 2:
                score += 0.4
                analysis['detected_patterns'].append('US_SECTIONED_FORMAT')
            
            # Look for amount summaries
            if re.search(r'total.*\$\d+\.\d{2}', text_lower):
                score += 0.2
            
            # Look for account numbers
            if re.search(r'account.*number.*\d{6,}', text_lower):
                score += 0.1
                
            return min(score, 1.0)
            
        except Exception as e:
            logger.error(f"Error in sectioned format analysis: {str(e)}")
            return 0.0
    
    def _analyze_list_format(self, page, analysis: Dict) -> float:
        """Analyze list-style format (Australian banks)"""
        try:
            text = page.extract_text()
            if not text:
                return 0.0
            
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            score = 0.0
            
            # Look for opening/closing balance format
            balance_patterns = [
                r'opening balance.*\$[\d,]+\.\d{2}',
                r'closing balance.*\$[\d,]+\.\d{2}',
                r'total credits.*\$[\d,]+\.\d{2}',
                r'total debits.*\$[\d,]+\.\d{2}'
            ]
            
            text_lower = text.lower()
            balance_matches = sum(1 for pattern in balance_patterns if re.search(pattern, text_lower))
            
            if balance_matches >= 2:
                score += 0.3
                analysis['detected_patterns'].append('AUSTRALIAN_LIST_FORMAT')
            
            # Look for BSB/Account number format
            if re.search(r'bsb.*\d{3}[-\s]\d{3}', text_lower):
                score += 0.2
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.error(f"Error in list format analysis: {str(e)}")
            return 0.0
    
    def _score_header_keywords_enhanced(self, headers: List[str]) -> float:
        """Enhanced header keyword scoring"""
        if not headers:
            return 0.0
        
        header_text = ' '.join(headers).lower()
        
        # Core banking terms (higher weight)
        core_terms = ['date', 'amount', 'balance', 'transaction', 'description']
        core_matches = sum(2 for term in core_terms if term in header_text)
        
        # Additional banking terms
        additional_matches = sum(1 for keyword in self.BANKING_KEYWORDS if keyword in header_text)
        
        total_score = (core_matches + additional_matches) / (len(core_terms) * 2 + len(self.BANKING_KEYWORDS))
        return min(total_score * 2, 1.0)  # Amplify but cap at 1.0
    
    def _score_date_patterns_enhanced(self, data_rows: List[List[str]]) -> float:
        """Enhanced date pattern scoring"""
        if not data_rows:
            return 0.0
        
        date_matches = 0
        total_rows = len(data_rows)
        
        for row in data_rows:
            if not row:
                continue
            
            # Check all cells in the row for dates, not just first column
            row_text = ' '.join([str(cell) for cell in row if cell])
            
            for pattern in self.DATE_PATTERNS:
                if re.search(pattern, row_text, re.IGNORECASE):
                    date_matches += 1
                    break
        
        return date_matches / max(total_rows, 1)
    
    def _score_amount_patterns(self, data_rows: List[List[str]]) -> float:
        """Score rows based on amount patterns"""
        if not data_rows:
            return 0.0
        
        amount_matches = 0
        total_rows = len(data_rows)
        
        for row in data_rows:
            if not row:
                continue
            
            row_text = ' '.join([str(cell) for cell in row if cell])
            
            for pattern in self.AMOUNT_PATTERNS:
                if re.search(pattern, row_text):
                    amount_matches += 1
                    break
        
        return amount_matches / max(total_rows, 1)
    
    def extract_enhanced_transaction_data(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extract transaction data using enhanced detection
        """
        logger.info(f"Extracting transaction data from {pdf_path}")
        
        try:
            # First detect the transaction page
            detection_result = self.detect_first_transaction_page(pdf_path)
            
            if not detection_result['success']:
                return {
                    'success': False,
                    'error': detection_result.get('error', 'No transaction pages found'),
                    'transactions': []
                }
            
            page_analysis = detection_result['page_analysis']
            format_type = page_analysis.get('format_type', 'unknown')
            
            with pdfplumber.open(pdf_path) as pdf:
                transactions = []
                
                if format_type == 'tabular' and page_analysis.get('column_structure'):
                    # Extract from table format
                    transactions = self._extract_from_table_format(
                        pdf, detection_result['first_transaction_page'], page_analysis
                    )
                
                elif format_type in ['text_based', 'sectioned', 'list_format']:
                    # Extract from text format
                    transactions = self._extract_from_text_format(
                        pdf, detection_result['first_transaction_page'], page_analysis
                    )
                
                return {
                    'success': True,
                    'format_type': format_type,
                    'transactions': transactions,
                    'total_transactions': len(transactions),
                    'page_analysis': page_analysis
                }
                
        except Exception as e:
            logger.error(f"Error extracting transaction data: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'transactions': []
            }
    
    def _extract_from_table_format(self, pdf, page_num: int, analysis: Dict) -> List[Dict]:
        """Extract transactions from table format"""
        transactions = []
        
        try:
            page = pdf.pages[page_num]
            tables = page.extract_tables()
            
            if not tables:
                return transactions
            
            # Find the best table from analysis
            column_structure = analysis.get('column_structure', {})
            table_idx = column_structure.get('table_index', 0)
            
            if table_idx < len(tables):
                table = tables[table_idx]
                headers = column_structure.get('header_row', [])
                
                for row in table[1:]:  # Skip header row
                    if row and any(cell and str(cell).strip() for cell in row):
                        transaction = {}
                        
                        for i, header in enumerate(headers):
                            if i < len(row):
                                cell_value = str(row[i]).strip() if row[i] else ''
                                transaction[header] = cell_value
                            else:
                                transaction[header] = ''
                        
                        # Only add if it looks like a real transaction
                        if self._is_valid_transaction(transaction):
                            transactions.append(transaction)
            
        except Exception as e:
            logger.error(f"Error extracting from table format: {str(e)}")
        
        return transactions
    
    def _extract_from_text_format(self, pdf, page_num: int, analysis: Dict) -> List[Dict]:
        """Extract transactions from text format"""
        transactions = []
        
        try:
            page = pdf.pages[page_num]
            text = page.extract_text()
            
            if not text:
                return transactions
            
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            # Look for header candidates
            header_candidates = analysis.get('header_candidates', [])
            
            if header_candidates:
                # Use the best header candidate to understand structure
                best_header = header_candidates[0]
                header_parts = [part.strip() for part in best_header.split() if part.strip()]
                
                # Extract transaction-like lines
                for line in lines:
                    if self._looks_like_transaction_line(line):
                        transaction = self._parse_transaction_line(line, header_parts)
                        if transaction:
                            transactions.append(transaction)
            else:
                # Generic extraction without headers
                for line in lines:
                    if self._looks_like_transaction_line(line):
                        transaction = self._parse_generic_transaction_line(line)
                        if transaction:
                            transactions.append(transaction)
            
        except Exception as e:
            logger.error(f"Error extracting from text format: {str(e)}")
        
        return transactions
    
    def _is_valid_transaction(self, transaction: Dict) -> bool:
        """Check if extracted data looks like a valid transaction"""
        if not transaction:
            return False
        
        # Check for date pattern in any field
        has_date = False
        for value in transaction.values():
            if isinstance(value, str) and any(re.search(pattern, value, re.IGNORECASE) for pattern in self.DATE_PATTERNS):
                has_date = True
                break
        
        # Check for amount pattern in any field
        has_amount = False
        for value in transaction.values():
            if isinstance(value, str) and any(re.search(pattern, value) for pattern in self.AMOUNT_PATTERNS):
                has_amount = True
                break
        
        return has_date or has_amount or len([v for v in transaction.values() if v and str(v).strip()]) >= 3
    
    def _looks_like_transaction_line(self, line: str) -> bool:
        """Check if a line looks like it contains transaction data"""
        # Must have some numbers and reasonable length
        if len(line) < 20 or not any(char.isdigit() for char in line):
            return False
        
        # Check for date patterns
        has_date = any(re.search(pattern, line, re.IGNORECASE) for pattern in self.DATE_PATTERNS)
        
        # Check for amount patterns
        has_amount = any(re.search(pattern, line) for pattern in self.AMOUNT_PATTERNS)
        
        return has_date or has_amount
    
    def _parse_transaction_line(self, line: str, header_parts: List[str]) -> Optional[Dict]:
        """Parse a transaction line based on header structure"""
        try:
            # Simple parsing - split by multiple spaces
            parts = re.split(r'\s{2,}', line.strip())
            
            if len(parts) >= 2:
                transaction = {}
                
                # Map parts to headers (best effort)
                for i, part in enumerate(parts):
                    if i < len(header_parts):
                        transaction[header_parts[i]] = part
                    else:
                        transaction[f'column_{i+1}'] = part
                
                return transaction
        
        except Exception as e:
            logger.error(f"Error parsing transaction line: {str(e)}")
        
        return None
    
    def _parse_generic_transaction_line(self, line: str) -> Optional[Dict]:
        """Parse a transaction line without header information"""
        try:
            # Extract date
            date_match = None
            for pattern in self.DATE_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    date_match = match.group()
                    break
            
            # Extract amounts
            amount_matches = []
            for pattern in self.AMOUNT_PATTERNS:
                matches = re.findall(pattern, line)
                amount_matches.extend(matches)
            
            if date_match or amount_matches:
                transaction = {
                    'raw_line': line,
                    'date': date_match or '',
                    'amounts': amount_matches,
                    'description': line.replace(date_match or '', '').strip()
                }
                
                return transaction
        
        except Exception as e:
            logger.error(f"Error parsing generic transaction line: {str(e)}")
        
        return None


class EnhancedPatternRuleManager:
    """Enhanced manager for pattern rules with multi-format support"""
    
    def __init__(self, storage_path: str = "enhanced_bank_patterns.json"):
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
        """Save a pattern rule with enhanced metadata"""
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
                'format_type': pattern_rule.format_type,
                'bank_name': bank_name,
                'created_at': datetime.now().isoformat(),
                'version': '2.0'
            }
            
            self.patterns[name] = pattern_dict
            
            with open(self.storage_path, 'w') as f:
                json.dump(self.patterns, f, indent=2)
            
            logger.info(f"✅ Enhanced pattern '{name}' saved successfully")
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
                row_height=pattern_dict['row_height'],
                format_type=pattern_dict.get('format_type', 'tabular')
            )
        except Exception as e:
            logger.error(f"Error loading pattern '{name}': {str(e)}")
            return None
    
    def list_patterns(self) -> List[Dict[str, Any]]:
        """List all saved patterns with enhanced metadata"""
        return [
            {
                'name': name,
                'bank_name': pattern.get('bank_name'),
                'column_count': pattern.get('column_count'),
                'format_type': pattern.get('format_type', 'tabular'),
                'created_at': pattern.get('created_at'),
                'version': pattern.get('version', '1.0')
            }
            for name, pattern in self.patterns.items()
        ]