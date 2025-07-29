"""
Pattern Rule Applicator for Enhanced Banking Parser
Applies generated pattern rules to extract transactions from all pages
"""

import pdfplumber
import re
import os
from typing import List, Dict, Any, Optional, Tuple
import json
from dataclasses import dataclass
import logging
from enhanced_bank_parser_v2 import EnhancedTransactionDetector, PatternRule

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ExtractionResult:
    """Result of pattern rule application"""
    success: bool
    total_transactions: int
    transactions: List[Dict[str, Any]]
    pages_processed: List[int]
    pattern_rule_used: Dict[str, Any]
    extraction_summary: Dict[str, Any]
    errors: List[str]

class PatternRuleApplicator:
    """Applies pattern rules to extract complete transaction data"""
    
    def __init__(self):
        self.detector = EnhancedTransactionDetector()
        
    def generate_and_apply_pattern_rule(self, pdf_path: str) -> ExtractionResult:
        """
        Complete workflow: detect, generate pattern rule, and apply to all pages
        """
        logger.info(f"Starting complete extraction workflow for {pdf_path}")
        
        try:
            # Step 1: Detect transaction page and structure
            detection_result = self.detector.detect_first_transaction_page(pdf_path)
            
            if not detection_result['success']:
                return ExtractionResult(
                    success=False,
                    total_transactions=0,
                    transactions=[],
                    pages_processed=[],
                    pattern_rule_used={},
                    extraction_summary={},
                    errors=[f"Detection failed: {detection_result.get('error', 'Unknown error')}"]
                )
            
            # Step 2: Generate pattern rule from detected structure
            pattern_rule = self._generate_pattern_rule_from_detection(
                pdf_path, detection_result
            )
            
            if not pattern_rule:
                return ExtractionResult(
                    success=False,
                    total_transactions=0,
                    transactions=[],
                    pages_processed=[],
                    pattern_rule_used={},
                    extraction_summary={},
                    errors=["Failed to generate pattern rule from detected structure"]
                )
            
            # Step 3: Apply pattern rule to all pages
            extraction_result = self._apply_pattern_rule_to_all_pages(
                pdf_path, pattern_rule, detection_result
            )
            
            return extraction_result
            
        except Exception as e:
            logger.error(f"Error in complete extraction workflow: {str(e)}")
            return ExtractionResult(
                success=False,
                total_transactions=0,
                transactions=[],
                pages_processed=[],
                pattern_rule_used={},
                extraction_summary={},
                errors=[str(e)]
            )
    
    def _generate_pattern_rule_from_detection(self, pdf_path: str, detection_result: Dict) -> Optional[PatternRule]:
        """
        Generate a pattern rule from the detection result
        """
        logger.info("Generating pattern rule from detection result")
        
        try:
            page_analysis = detection_result['page_analysis']
            format_type = page_analysis.get('format_type', 'text_based')
            
            # Extract pattern information based on format type
            if format_type == 'text_based' and page_analysis.get('column_structure'):
                # Table-based pattern rule generation
                return self._generate_table_pattern_rule(pdf_path, detection_result)
            
            elif format_type in ['text_based', 'sectioned', 'list_format']:
                # Text-based pattern rule generation
                return self._generate_text_pattern_rule(pdf_path, detection_result)
            
            else:
                logger.warning(f"Unknown format type: {format_type}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating pattern rule: {str(e)}")
            return None
    
    def _generate_table_pattern_rule(self, pdf_path: str, detection_result: Dict) -> Optional[PatternRule]:
        """Generate pattern rule for table-based statements"""
        try:
            page_analysis = detection_result['page_analysis']
            column_structure = page_analysis['column_structure']
            
            headers = column_structure['header_row']
            sample_rows = column_structure.get('sample_rows', [])
            
            # Analyze sample rows for patterns
            date_pattern = self._detect_date_pattern_from_samples(sample_rows)
            font_size_range = (9.0, 12.0)  # Default font size range
            row_height = 15.0  # Default row height
            
            # Create pattern rule
            pattern_rule = PatternRule(
                column_count=len(headers),
                header_keywords=headers,
                row_gap_tolerance=5.0,
                font_size_range=font_size_range,
                first_column_pattern=date_pattern,
                layout_mode="table",
                header_positions=[(i * 100, (i + 1) * 100) for i in range(len(headers))],
                row_height=row_height,
                format_type="tabular"
            )
            
            logger.info(f"Generated table pattern rule with {len(headers)} columns")
            return pattern_rule
            
        except Exception as e:
            logger.error(f"Error generating table pattern rule: {str(e)}")
            return None
    
    def _generate_text_pattern_rule(self, pdf_path: str, detection_result: Dict) -> Optional[PatternRule]:
        """Generate pattern rule for text-based statements"""
        try:
            page_analysis = detection_result['page_analysis']
            
            # Extract header candidates
            header_candidates = page_analysis.get('header_candidates', [])
            text_analysis = page_analysis.get('text_analysis', {})
            
            # Use best header candidate or create generic headers
            if header_candidates:
                best_header = header_candidates[0]
                headers = self._parse_header_into_columns(best_header)
            else:
                # Generic headers based on common banking fields
                headers = ['Date', 'Description', 'Amount', 'Balance']
            
            # Detect date pattern from text analysis
            date_pattern = r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'  # Default date pattern
            
            # Create pattern rule
            pattern_rule = PatternRule(
                column_count=len(headers),
                header_keywords=headers,
                row_gap_tolerance=10.0,
                font_size_range=(8.0, 14.0),
                first_column_pattern=date_pattern,
                layout_mode="text-aligned",
                header_positions=[(i * 120, (i + 1) * 120) for i in range(len(headers))],
                row_height=18.0,
                format_type="text_based"
            )
            
            logger.info(f"Generated text pattern rule with {len(headers)} columns")
            return pattern_rule
            
        except Exception as e:
            logger.error(f"Error generating text pattern rule: {str(e)}")
            return None
    
    def _detect_date_pattern_from_samples(self, sample_rows: List[List[str]]) -> str:
        """Detect date pattern from sample transaction rows"""
        date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',  # DD-MM-YYYY, DD/MM/YYYY
            r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',  # YYYY-MM-DD
            r'\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}',  # DD Mon YYYY
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\s+\d{1,2}:\d{2}:\d{2}',  # Date with time
        ]
        
        # Test patterns against sample data
        pattern_scores = {}
        for pattern in date_patterns:
            matches = 0
            for row in sample_rows:
                if row:
                    row_text = ' '.join([str(cell) for cell in row if cell])
                    if re.search(pattern, row_text, re.IGNORECASE):
                        matches += 1
            pattern_scores[pattern] = matches
        
        # Return the pattern with most matches
        if pattern_scores:
            best_pattern = max(pattern_scores.items(), key=lambda x: x[1])
            return best_pattern[0]
        
        # Default pattern
        return r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'
    
    def _parse_header_into_columns(self, header_text: str) -> List[str]:
        """Parse header text into column names"""
        # Split by common separators
        separators = [r'\s{2,}', r'\t', r'\|', r':', r';']
        
        for separator in separators:
            parts = re.split(separator, header_text.strip())
            if len(parts) > 1:
                return [part.strip() for part in parts if part.strip()]
        
        # If no clear separation, look for banking keywords
        banking_terms = ['date', 'transaction', 'description', 'amount', 'balance', 'debit', 'credit']
        words = header_text.lower().split()
        
        headers = []
        for word in words:
            if any(term in word for term in banking_terms):
                headers.append(word.title())
        
        # Ensure we have at least some headers
        if not headers:
            headers = ['Date', 'Description', 'Amount', 'Balance']
        
        return headers
    
    def _apply_pattern_rule_to_all_pages(self, pdf_path: str, pattern_rule: PatternRule, detection_result: Dict) -> ExtractionResult:
        """
        Apply the pattern rule to extract transactions from all pages
        """
        logger.info("Applying pattern rule to all pages")
        
        try:
            all_transactions = []
            pages_processed = []
            errors = []
            
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                
                for page_num in range(total_pages):
                    page = pdf.pages[page_num]
                    logger.info(f"Processing page {page_num + 1}/{total_pages}")
                    
                    try:
                        # Extract transactions from this page
                        page_transactions = self._extract_transactions_from_page(
                            page, pattern_rule, page_num
                        )
                        
                        if page_transactions:
                            all_transactions.extend(page_transactions)
                            pages_processed.append(page_num + 1)
                            logger.info(f"Extracted {len(page_transactions)} transactions from page {page_num + 1}")
                        
                    except Exception as e:
                        error_msg = f"Error processing page {page_num + 1}: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
            
            # Create extraction summary
            extraction_summary = {
                'total_pages_scanned': total_pages,
                'pages_with_transactions': len(pages_processed),
                'total_transactions_found': len(all_transactions),
                'average_transactions_per_page': len(all_transactions) / max(len(pages_processed), 1),
                'pattern_rule_type': pattern_rule.format_type,
                'extraction_method': pattern_rule.layout_mode
            }
            
            # Pattern rule summary
            pattern_rule_used = {
                'column_count': pattern_rule.column_count,
                'headers': pattern_rule.header_keywords,
                'format_type': pattern_rule.format_type,
                'layout_mode': pattern_rule.layout_mode,
                'date_pattern': pattern_rule.first_column_pattern
            }
            
            logger.info(f"✅ Extraction complete: {len(all_transactions)} transactions from {len(pages_processed)} pages")
            
            return ExtractionResult(
                success=True,
                total_transactions=len(all_transactions),
                transactions=all_transactions,
                pages_processed=pages_processed,
                pattern_rule_used=pattern_rule_used,
                extraction_summary=extraction_summary,
                errors=errors
            )
            
        except Exception as e:
            logger.error(f"Error applying pattern rule to all pages: {str(e)}")
            return ExtractionResult(
                success=False,
                total_transactions=0,
                transactions=[],
                pages_processed=[],
                pattern_rule_used={},
                extraction_summary={},
                errors=[str(e)]
            )
    
    def _extract_transactions_from_page(self, page, pattern_rule: PatternRule, page_num: int) -> List[Dict[str, Any]]:
        """
        Extract transactions from a single page using the pattern rule
        """
        transactions = []
        
        try:
            if pattern_rule.format_type == "tabular":
                # Extract from table format
                transactions = self._extract_from_table_format(page, pattern_rule)
            else:
                # Extract from text format
                transactions = self._extract_from_text_format(page, pattern_rule)
            
            # Add page number to each transaction
            for transaction in transactions:
                transaction['_page_number'] = page_num + 1
                transaction['_extraction_method'] = pattern_rule.layout_mode
            
        except Exception as e:
            logger.error(f"Error extracting transactions from page {page_num + 1}: {str(e)}")
        
        return transactions
    
    def _extract_from_table_format(self, page, pattern_rule: PatternRule) -> List[Dict[str, Any]]:
        """Extract transactions from table format using pattern rule"""
        transactions = []
        
        try:
            tables = page.extract_tables()
            if not tables:
                return transactions
            
            # Find the best table (usually the largest one)
            best_table = max(tables, key=lambda t: len(t) if t else 0)
            
            if not best_table or len(best_table) < 2:
                return transactions
            
            # Skip header row and process data rows
            headers = pattern_rule.header_keywords
            
            for row in best_table[1:]:  # Skip header
                if row and any(cell and str(cell).strip() for cell in row):
                    # Check if this looks like a transaction row
                    if self._matches_transaction_pattern(row, pattern_rule):
                        transaction = {}
                        
                        # Map row cells to headers
                        for i, header in enumerate(headers):
                            if i < len(row):
                                cell_value = str(row[i]).strip() if row[i] else ''
                                transaction[header] = cell_value
                            else:
                                transaction[header] = ''
                        
                        # Add raw row data for debugging
                        transaction['_raw_row'] = [str(cell) if cell else '' for cell in row]
                        
                        transactions.append(transaction)
            
        except Exception as e:
            logger.error(f"Error extracting from table format: {str(e)}")
        
        return transactions
    
    def _extract_from_text_format(self, page, pattern_rule: PatternRule) -> List[Dict[str, Any]]:
        """Extract transactions from text format using pattern rule"""
        transactions = []
        
        try:
            text = page.extract_text()
            if not text:
                return transactions
            
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            headers = pattern_rule.header_keywords
            
            for line in lines:
                if self._matches_text_transaction_pattern(line, pattern_rule):
                    # Parse line into transaction
                    transaction = self._parse_text_line_to_transaction(line, headers)
                    if transaction:
                        transactions.append(transaction)
            
        except Exception as e:
            logger.error(f"Error extracting from text format: {str(e)}")
        
        return transactions
    
    def _matches_transaction_pattern(self, row: List, pattern_rule: PatternRule) -> bool:
        """Check if a table row matches the transaction pattern"""
        if not row:
            return False
        
        # Convert row to text for pattern matching
        row_text = ' '.join([str(cell) for cell in row if cell])
        
        # Check for date pattern
        if re.search(pattern_rule.first_column_pattern, row_text, re.IGNORECASE):
            return True
        
        # Check for amount patterns
        amount_patterns = [
            r'\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?',  # Standard amount format
            r'[$£€¥₹]\s*\d+(?:\.\d{2})?',          # Currency format
        ]
        
        if any(re.search(pattern, row_text) for pattern in amount_patterns):
            return True
        
        return False
    
    def _matches_text_transaction_pattern(self, line: str, pattern_rule: PatternRule) -> bool:
        """Check if a text line matches the transaction pattern"""
        if len(line) < 20:  # Too short to be a transaction
            return False
        
        # Check for date pattern
        if re.search(pattern_rule.first_column_pattern, line, re.IGNORECASE):
            return True
        
        # Check for amount and banking keywords
        has_amount = bool(re.search(r'\d+(?:\.\d{2})?', line))
        has_banking_terms = any(term.lower() in line.lower() for term in 
                               ['transfer', 'payment', 'deposit', 'withdrawal', 'balance'])
        
        return has_amount and has_banking_terms
    
    def _parse_text_line_to_transaction(self, line: str, headers: List[str]) -> Optional[Dict[str, Any]]:
        """Parse a text line into a transaction dictionary"""
        try:
            # Split line by multiple spaces or tabs
            parts = re.split(r'\s{2,}|\t', line.strip())
            
            if len(parts) < 2:
                return None
            
            transaction = {}
            
            # Map parts to headers (best effort)
            for i, header in enumerate(headers):
                if i < len(parts):
                    transaction[header] = parts[i].strip()
                else:
                    transaction[header] = ''
            
            # If we have extra parts, add them as additional fields
            for i in range(len(headers), len(parts)):
                transaction[f'additional_field_{i}'] = parts[i].strip()
            
            # Add raw line for reference
            transaction['_raw_line'] = line
            
            return transaction
            
        except Exception as e:
            logger.error(f"Error parsing text line to transaction: {str(e)}")
            return None
    
    def get_extraction_statistics(self, extraction_result: ExtractionResult) -> Dict[str, Any]:
        """Generate detailed statistics from extraction result"""
        if not extraction_result.success:
            return {'error': 'Extraction failed', 'details': extraction_result.errors}
        
        transactions = extraction_result.transactions
        
        stats = {
            'total_transactions': len(transactions),
            'pages_processed': len(extraction_result.pages_processed),
            'pages_with_data': extraction_result.pages_processed,
            'extraction_method': extraction_result.pattern_rule_used.get('layout_mode', 'unknown'),
            'format_type': extraction_result.pattern_rule_used.get('format_type', 'unknown'),
            'headers_detected': extraction_result.pattern_rule_used.get('headers', []),
        }
        
        if transactions:
            # Field completeness analysis
            field_stats = {}
            for header in extraction_result.pattern_rule_used.get('headers', []):
                non_empty_count = sum(1 for txn in transactions if txn.get(header, '').strip())
                field_stats[header] = {
                    'total_values': non_empty_count,
                    'completion_rate': non_empty_count / len(transactions) * 100
                }
            
            stats['field_completeness'] = field_stats
            
            # Page distribution
            page_counts = {}
            for txn in transactions:
                page = txn.get('_page_number', 'unknown')
                page_counts[page] = page_counts.get(page, 0) + 1
            
            stats['transactions_per_page'] = page_counts
        
        return stats