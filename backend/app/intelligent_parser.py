"""
Intelligent Universal Bank Statement Parser V2025.07.21.01

A sophisticated AI-powered parser that can intelligently detect and extract 
transactions from any bank statement format without relying on templates.

Key Features:
- Multi-page transaction detection
- Adaptive header mapping
- Smart row classification
- Pattern-based field recognition
- Zero truncation with exact field preservation
"""

import re
import pdfplumber
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IntelligentBankStatementParser:
    """
    Universal parser that intelligently detects and extracts bank statement transactions
    """
    
    def __init__(self):
        self.date_patterns = [
            r'\d{2}[-/]\d{2}[-/]\d{4}',  # DD-MM-YYYY or DD/MM/YYYY
            r'\d{2}[-/]\d{2}[-/]\d{2}',  # DD-MM-YY or DD/MM/YY
            r'\d{4}[-/]\d{2}[-/]\d{2}',  # YYYY-MM-DD
            r'\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}',  # 25 May 2025
            r'[A-Za-z]{3}\s+\d{1,2}',   # May 25
        ]
        
        self.amount_patterns = [
            r'\d{1,3}(?:,\d{3})*\.\d{2}',  # 1,234.56
            r'\d+\.\d{2}',                  # 123.45
            r'₹\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?',  # ₹1,234.56
        ]
        
        # Common header keywords for intelligent detection
        self.header_keywords = {
            'date': ['date', 'dt', 'transaction date', 'value date', 'txn date'],
            'description': ['description', 'particulars', 'narration', 'details', 'transaction details', 'remarks'],
            'reference': ['ref', 'reference', 'cheque', 'chq', 'ref no', 'cheque no', 'transaction id'],
            'debit': ['debit', 'withdrawal', 'withdrawals', 'dr', 'debits', 'outflow'],
            'credit': ['credit', 'deposit', 'deposits', 'cr', 'credits', 'inflow'],
            'balance': ['balance', 'bal', 'closing balance', 'running balance', 'available balance'],
            'mode': ['mode', 'type', 'channel', 'method'],
        }
    
    def parse_statement(self, pdf_path: str) -> Dict[str, Any]:
        """
        Main entry point for parsing bank statements
        
        Returns:
            Complete parsed data with all transactions and metadata
        """
        logger.info(f"[Intelligent Parser] Starting analysis of: {pdf_path}")
        
        with pdfplumber.open(pdf_path) as pdf:
            # Step 1: Analyze document structure
            doc_analysis = self._analyze_document_structure(pdf)
            
            # Step 2: Extract all transactions from all pages
            all_transactions = self._extract_all_transactions(pdf, doc_analysis)
            
            # Step 3: Detect and preserve original headers
            headers = self._detect_original_headers(pdf, doc_analysis)
            
            # Step 4: Format results with zero truncation
            results = self._format_results(all_transactions, headers, doc_analysis)
            
        logger.info(f"[Intelligent Parser] Extracted {len(all_transactions)} transactions with {len(headers)} headers")
        return results
    
    def _analyze_document_structure(self, pdf) -> Dict[str, Any]:
        """
        Analyze the overall document structure to understand layout patterns
        """
        logger.info("[Intelligent Parser] Analyzing document structure...")
        
        analysis = {
            'total_pages': len(pdf.pages),
            'page_types': {},
            'transaction_pages': [],
            'table_structures': {},
            'header_patterns': {}
        }
        
        for page_num, page in enumerate(pdf.pages):
            page_analysis = self._analyze_page_type(page, page_num)
            analysis['page_types'][page_num] = page_analysis
            
            if page_analysis['has_transactions']:
                analysis['transaction_pages'].append(page_num)
                
        logger.info(f"[Intelligent Parser] Found {len(analysis['transaction_pages'])} transaction pages: {analysis['transaction_pages']}")
        return analysis
    
    def _analyze_page_type(self, page, page_num: int) -> Dict[str, Any]:
        """
        Classify page type and detect transaction presence
        """
        text = page.extract_text() or ""
        tables = page.extract_tables()
        
        # Count transaction indicators
        date_matches = sum(len(re.findall(pattern, text)) for pattern in self.date_patterns)
        amount_matches = sum(len(re.findall(pattern, text)) for pattern in self.amount_patterns)
        
        # Analyze table structure
        transaction_tables = []
        for table_idx, table in enumerate(tables):
            if self._is_transaction_table(table):
                transaction_tables.append(table_idx)
        
        analysis = {
            'page_num': page_num,
            'has_tables': len(tables) > 0,
            'table_count': len(tables),
            'transaction_tables': transaction_tables,
            'date_count': date_matches,
            'amount_count': amount_matches,
            'has_transactions': (date_matches > 5 and amount_matches > 5) or len(transaction_tables) > 0,
            'text_lines': len(text.split('\n')) if text else 0
        }
        
        logger.info(f"[Intelligent Parser] Page {page_num + 1}: {analysis['has_transactions'] and 'Transaction page' or 'Info page'} "
                   f"({analysis['date_count']} dates, {analysis['amount_count']} amounts, {analysis['table_count']} tables)")
        
        return analysis
    
    def _is_transaction_table(self, table: List[List]) -> bool:
        """
        Determine if a table contains transaction data
        """
        if not table or len(table) < 2:
            return False
            
        # Check header row for transaction-related keywords
        header = table[0] if table[0] else []
        header_text = ' '.join([str(cell).lower() for cell in header if cell]).strip()
        
        # Must have date and amount indicators
        has_date = any(keyword in header_text for keyword in self.header_keywords['date'])
        has_amount = any(keyword in header_text for keyword in 
                        self.header_keywords['debit'] + self.header_keywords['credit'] + self.header_keywords['balance'])
        
        # Check data rows for transaction patterns
        data_rows = table[1:] if len(table) > 1 else []
        has_transaction_data = False
        
        for row in data_rows[:3]:  # Check first 3 data rows
            row_text = ' '.join([str(cell) for cell in row if cell])
            has_date_pattern = any(re.search(pattern, row_text) for pattern in self.date_patterns)
            has_amount_pattern = any(re.search(pattern, row_text) for pattern in self.amount_patterns)
            
            if has_date_pattern and has_amount_pattern:
                has_transaction_data = True
                break
        
        return has_date and has_amount and has_transaction_data
    
    def _extract_all_transactions(self, pdf, doc_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract ALL transactions from ALL pages without truncation
        """
        logger.info("[Intelligent Parser] Extracting all transactions from all pages...")
        
        all_transactions = []
        
        for page_num in doc_analysis['transaction_pages']:
            page = pdf.pages[page_num]
            page_transactions = self._extract_page_transactions(page, page_num)
            all_transactions.extend(page_transactions)
            
            logger.info(f"[Intelligent Parser] Page {page_num + 1}: Extracted {len(page_transactions)} transactions")
        
        return all_transactions
    
    def _extract_page_transactions(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Extract transactions from a single page using intelligent detection
        """
        transactions = []
        
        # Try table-based extraction first (higher priority)
        tables = page.extract_tables()
        table_found = False
        
        for table_idx, table in enumerate(tables):
            if self._is_transaction_table(table):
                table_transactions = self._extract_table_transactions(table, page_num, table_idx)
                if table_transactions:  # Only add if we got meaningful data
                    transactions.extend(table_transactions)
                    table_found = True
                    logger.info(f"[Intelligent Parser] Page {page_num + 1}: Found {len(table_transactions)} transactions in table {table_idx + 1}")
        
        # If no meaningful table transactions found, try text-based extraction
        if not table_found:
            text_transactions = self._extract_text_transactions(page, page_num)
            transactions.extend(text_transactions)
            if text_transactions:
                logger.info(f"[Intelligent Parser] Page {page_num + 1}: Used text extraction, found {len(text_transactions)} transactions")
        
        return transactions
    
    def _extract_table_transactions(self, table: List[List], page_num: int, table_idx: int) -> List[Dict[str, Any]]:
        """
        Extract transactions from a structured table with intelligent header mapping
        """
        if not table or len(table) < 2:
            return []
        
        header = table[0]
        data_rows = table[1:]
        
        # Map headers to standard field types while preserving original names
        header_mapping = self._map_headers_intelligently(header)
        
        transactions = []
        for row_idx, row in enumerate(data_rows):
            if self._is_transaction_row(row, header_mapping):
                transaction = self._parse_transaction_row(row, header, header_mapping, page_num, table_idx, row_idx)
                if transaction:
                    transactions.append(transaction)
        
        return transactions
    
    def _map_headers_intelligently(self, headers: List) -> Dict[str, str]:
        """
        Intelligently map table headers to field types while preserving original names
        """
        mapping = {}
        
        for idx, header in enumerate(headers):
            if not header:
                continue
                
            header_text = str(header).strip().lower()
            original_header = str(header).strip()  # Preserve exact original
            
            # Find best matching field type
            best_match = None
            best_score = 0
            
            for field_type, keywords in self.header_keywords.items():
                for keyword in keywords:
                    if keyword in header_text:
                        score = len(keyword)  # Longer matches get higher priority
                        if score > best_score:
                            best_score = score
                            best_match = field_type
            
            if best_match:
                mapping[idx] = {
                    'field_type': best_match,
                    'original_header': original_header,
                    'position': idx
                }
        
        return mapping
    
    def _is_transaction_row(self, row: List, header_mapping: Dict) -> bool:
        """
        Determine if a row contains transaction data
        """
        if not row or not any(cell for cell in row if cell):
            return False
        
        # Check for date and amount patterns in the row
        row_text = ' '.join([str(cell) for cell in row if cell])
        
        has_date = any(re.search(pattern, row_text) for pattern in self.date_patterns)
        has_amount = any(re.search(pattern, row_text) for pattern in self.amount_patterns)
        
        # Additional checks for balance/total rows to exclude
        is_total_row = any(keyword in row_text.lower() for keyword in ['total', 'subtotal', 'grand total', 'summary'])
        
        return has_date and has_amount and not is_total_row
    
    def _parse_transaction_row(self, row: List, headers: List, header_mapping: Dict, 
                              page_num: int, table_idx: int, row_idx: int) -> Optional[Dict[str, Any]]:
        """
        Parse a single transaction row preserving all original data
        """
        transaction = {
            '_metadata': {
                'page': page_num + 1,
                'table': table_idx,
                'row': row_idx,
                'source': 'table'
            }
        }
        
        # Map each cell to its corresponding field with original header name
        for cell_idx, cell in enumerate(row):
            if cell_idx < len(headers) and cell:
                original_header = str(headers[cell_idx]).strip()
                cell_value = str(cell).strip()
                
                # Use original header name as key (preserving exact formatting)
                if original_header and cell_value:
                    transaction[original_header] = cell_value
        
        # Only return if we have meaningful data
        if len(transaction) > 1:  # More than just metadata
            return transaction
        
        return None
    
    def _extract_text_transactions(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Extract transactions from unstructured text when tables fail
        """
        text = page.extract_text()
        if not text:
            return []
        
        transactions = []
        lines = text.split('\n')
        
        # Enhanced transaction detection for ICICI format
        for line_idx, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Skip header lines and non-transaction lines
            if any(keyword in line.lower() for keyword in 
                  ['statement', 'account', 'balance', 'summary', 'page', 'total:', 'deposits:', 'withdrawals:']):
                continue
            
            # Check if line contains transaction pattern (more strict)
            has_date = any(re.search(pattern, line) for pattern in self.date_patterns)
            has_amount = any(re.search(pattern, line) for pattern in self.amount_patterns)
            
            # More strict filtering for actual transaction lines
            if has_date and has_amount and len(line) > 30:  # Increased minimum length
                # Additional validation: should not be a summary line
                if not any(word in line.lower() for word in ['total', 'subtotal', 'closing balance', 'opening balance']):
                    
                    transaction = {
                        '_metadata': {
                            'page': page_num + 1,
                            'line': line_idx,
                            'source': 'text'
                        },
                        'Transaction_Details': line  # Full line as transaction details
                    }
                    
                    # Try to extract specific fields with better parsing
                    date_match = None
                    for pattern in self.date_patterns:
                        match = re.search(pattern, line)
                        if match:
                            date_match = match.group()
                            break
                    
                    if date_match:
                        transaction['Date'] = date_match
                    
                    # Extract amounts with better logic
                    amount_matches = []
                    for pattern in self.amount_patterns:
                        matches = re.findall(pattern, line)
                        amount_matches.extend(matches)
                    
                    if amount_matches:
                        # Better amount assignment logic
                        if len(amount_matches) >= 3:  # Typical ICICI format: debit, credit, balance
                            transaction['Withdrawal_Amount'] = amount_matches[0]
                            transaction['Deposit_Amount'] = amount_matches[1] if len(amount_matches) > 1 else ''
                            transaction['Balance'] = amount_matches[-1]  # Last is usually balance
                        elif len(amount_matches) == 2:
                            transaction['Amount'] = amount_matches[0]
                            transaction['Balance'] = amount_matches[1]
                        else:
                            transaction['Amount'] = amount_matches[0]
                    
                    transactions.append(transaction)
        
        return transactions
    
    def _detect_original_headers(self, pdf, doc_analysis: Dict[str, Any]) -> List[str]:
        """
        Detect and preserve original header names exactly as they appear in PDF
        """
        all_headers = set()
        
        for page_num in doc_analysis['transaction_pages']:
            page = pdf.pages[page_num]
            tables = page.extract_tables()
            
            for table in tables:
                if self._is_transaction_table(table) and table:
                    headers = table[0]
                    for header in headers:
                        if header and str(header).strip():
                            all_headers.add(str(header).strip())
        
        return sorted(list(all_headers))
    
    def _format_results(self, transactions: List[Dict[str, Any]], headers: List[str], 
                       doc_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format final results with complete data preservation
        """
        # Get all unique field names from transactions (preserving original headers)
        all_fields = set()
        for transaction in transactions:
            for key in transaction.keys():
                if not key.startswith('_'):  # Skip metadata
                    all_fields.add(key)
        
        # Create ordered headers (original headers first, then discovered fields)
        final_headers = []
        for header in headers:
            if header in all_fields:
                final_headers.append(header)
                all_fields.remove(header)
        
        # Add any remaining fields
        final_headers.extend(sorted(all_fields))
        
        return {
            'success': True,
            'parser_version': 'V2025.07.21.01_Intelligent',
            'total_pages': doc_analysis['total_pages'],
            'transaction_pages': doc_analysis['transaction_pages'],
            'total_transactions': len(transactions),
            'headers': final_headers,
            'transactions': transactions,
            'metadata': {
                'extraction_method': 'intelligent_universal',
                'zero_truncation': True,
                'original_headers_preserved': True,
                'multi_page_extraction': True
            }
        }


# Export main parser function
def parse_bank_statement_intelligent(pdf_path: str) -> Dict[str, Any]:
    """
    Main function to parse bank statements using intelligent algorithm
    """
    parser = IntelligentBankStatementParser()
    return parser.parse_statement(pdf_path)