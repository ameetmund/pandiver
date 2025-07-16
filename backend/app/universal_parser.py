# universal_parser.py - Universal bank statement parser

import re
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import statistics
from .synonyms import (
    HEADER_SYNONYMS, normalize_header, normalize_number, extract_date, 
    extract_currency, DATE_REGEX, NUMBER_REGEX, NEGATIVE_REGEX, POSITIVE_REGEX
)

class ColumnBand:
    """Represents a column band with its boundaries and field type"""
    def __init__(self, field_name: str, x0: float, x1: float):
        self.field_name = field_name
        self.x0 = x0
        self.x1 = x1
        self.center = (x0 + x1) / 2
    
    def contains_word(self, word: Dict[str, Any]) -> bool:
        """Check if a word falls within this column band"""
        word_center = (word.get('x0', 0) + word.get('x1', 0)) / 2
        return self.x0 <= word_center <= self.x1
    
    def __repr__(self):
        return f"ColumnBand({self.field_name}, {self.x0:.1f}-{self.x1:.1f})"

class UniversalBankStatementParser:
    """Universal parser for bank statements from any bank, country, or format"""
    
    def __init__(self):
        self.column_bands: List[ColumnBand] = []
        self.page_width = 0
        self.is_rtl = False
        self.transactions = []
        self.current_transaction = None
        self.previous_balance = None
        
    def cluster_words_by_rows(self, words: List[Dict[str, Any]], y_tolerance: float = 2.0) -> List[List[Dict[str, Any]]]:
        """
        Cluster words into rows based on Y-coordinate proximity.
        
        Args:
            words: List of word dictionaries with position information
            y_tolerance: Maximum Y difference to consider words in same row
            
        Returns:
            List of rows, each containing words in that row
        """
        if not words:
            return []
        
        # Sort words by Y coordinate (top to bottom)
        sorted_words = sorted(words, key=lambda w: w.get('y0', w.get('top', 0)))
        
        rows = []
        current_row = [sorted_words[0]]
        current_y = sorted_words[0].get('y0', sorted_words[0].get('top', 0))
        
        for word in sorted_words[1:]:
            word_y = word.get('y0', word.get('top', 0))
            
            if abs(word_y - current_y) <= y_tolerance:
                # Same row
                current_row.append(word)
            else:
                # New row
                if current_row:
                    rows.append(sorted(current_row, key=lambda w: w.get('x0', 0)))
                current_row = [word]
                current_y = word_y
        
        # Add the last row
        if current_row:
            rows.append(sorted(current_row, key=lambda w: w.get('x0', 0)))
        
        return rows
    
    def detect_header_row_and_columns(self, rows: List[List[Dict[str, Any]]]) -> Optional[int]:
        """
        Detect the header row and establish column bands with VERY strict criteria.
        
        Args:
            rows: List of word rows
            
        Returns:
            Index of the header row, or None if not found
        """
        header_row_idx = None
        best_score = 0
        best_row_info = None
        
        # Look for the row with the most header synonyms
        for idx, row in enumerate(rows):
            # Skip rows that are too early (likely document headers) or too late
            if idx > len(rows) * 0.6:  # Don't look in the last 40% of document
                continue
                
            score = 0
            row_text = ' '.join(word.get('text', '') for word in row).lower()
            
            # Count how many canonical field names we can detect
            detected_fields = set()
            valid_header_words = 0
            total_words = 0
            
            for word in row:
                word_text = word.get('text', '').strip()
                if not word_text:
                    continue
                    
                total_words += 1
                canonical = normalize_header(word_text)
                if canonical:
                    detected_fields.add(canonical)
                    valid_header_words += 1
                    score += 2  # Higher score for valid headers
            
            # ULTRA STRICT CRITERIA: Must have at least 4 valid header fields INCLUDING Date
            if len(detected_fields) < 4 or 'Date' not in detected_fields:
                continue
                
            # ULTRA STRICT CRITERIA: At least 70% of words should be valid headers
            if total_words > 0 and (valid_header_words / total_words) < 0.7:
                continue
                
            # MUST have essential fields for bank statements
            essential_fields = {'Date', 'Balance'}
            amount_fields = {'Debit', 'Credit', 'Amount', 'WithdrawalAmount', 'DepositAmount'}
            desc_fields = {'Description', 'Particulars', 'Narration'}
            
            if not essential_fields.intersection(detected_fields):
                continue  # Must have Date AND Balance
                
            if not amount_fields.intersection(detected_fields):
                continue  # Must have at least one amount field
                
            if not desc_fields.intersection(detected_fields):
                continue  # Must have description field
            
            # Bonus scoring for perfect combinations
            if 'Date' in detected_fields:
                score += 10  # Date is absolutely crucial
            if 'Balance' in detected_fields:
                score += 8   # Balance is crucial
            if any(field in detected_fields for field in desc_fields):
                score += 6   # Description is important
            if any(field in detected_fields for field in amount_fields):
                score += 6   # Amount fields are crucial
            
            # Perfect column count bonus
            if 5 <= len(row) <= 7:  # Ideal bank statement column count
                score += 5
            elif len(row) > 10:     # Too many columns is very suspicious
                score -= 10
            
            # SEVERE PENALTY for rows with numbers (headers shouldn't have amounts)
            number_count = sum(1 for word in row if NUMBER_REGEX.search(word.get('text', '')))
            if number_count > 0:
                score -= 15  # Any numbers in header row is very bad
            
            # SEVERE PENALTY for dates in header row (headers shouldn't contain transaction dates)
            if DATE_REGEX.search(row_text):
                score -= 15
            
            # PENALTY for email addresses, account numbers, or other non-header content
            if '@' in row_text or re.search(r'\d{10,}', row_text):  # Long numbers like account IDs
                score -= 10
            
            # Look for PERFECT header patterns only
            perfect_header_keywords = ['date', 'description', 'particulars', 'balance', 'debit', 'credit', 'amount']
            keyword_matches = sum(1 for keyword in perfect_header_keywords if keyword in row_text)
            score += keyword_matches * 2
            
            # ULTRA STRICT CRITERIA: Must have minimum score of 30 and perfect conditions
            if (score >= 30 and len(detected_fields) >= 4 and 
                'Date' in detected_fields and score > best_score):
                best_score = score
                header_row_idx = idx
                best_row_info = {
                    'detected_fields': detected_fields,
                    'score': score,
                    'row_text': row_text,
                    'valid_header_ratio': valid_header_words / total_words if total_words > 0 else 0
                }
        
        # If we found a potential header row, establish column bands
        if header_row_idx is not None and best_row_info is not None:
            print(f"[Universal Parser] Found header row at index {header_row_idx}")
            print(f"[Universal Parser] Detected fields: {best_row_info['detected_fields']}")
            print(f"[Universal Parser] Score: {best_row_info['score']}")
            print(f"[Universal Parser] Valid header ratio: {best_row_info['valid_header_ratio']:.2f}")
            print(f"[Universal Parser] Row text: {best_row_info['row_text']}")
            
            # Create column bands
            self._establish_column_bands(rows[header_row_idx])
            
            # Validate column bands - reject if too many overlapping bands
            if len(self.column_bands) > 8:  # Even stricter - max 8 bands
                print(f"[Universal Parser] WARNING: Too many column bands ({len(self.column_bands)}), rejecting header")
                self.column_bands = []
                return None
            
            return header_row_idx
        
        print("[Universal Parser] No valid header row found with ultra-strict criteria - will use fallback")
        return None
    
    def _establish_column_bands(self, header_row: List[Dict[str, Any]]):
        """
        Establish column bands based on header row positions.
        
        Args:
            header_row: List of words in the header row
        """
        self.column_bands = []
        
        # Create column bands for each recognized header
        for word in header_row:
            word_text = word.get('text', '')
            canonical = normalize_header(word_text)
            
            if canonical:
                x0 = word.get('x0', 0)
                x1 = word.get('x1', 0)
                
                # Expand band to capture aligned content
                band = ColumnBand(canonical, x0 - 5, x1 + 5)
                self.column_bands.append(band)
        
        # Sort bands by X position
        self.column_bands.sort(key=lambda b: b.x0)
        
        # Detect RTL layout
        if self.column_bands:
            # If Date column is on the right side, likely RTL
            date_bands = [b for b in self.column_bands if b.field_name == 'Date']
            if date_bands and self.page_width > 0:
                date_band = date_bands[0]
                if date_band.center > self.page_width * 0.7:
                    self.is_rtl = True
                    self.column_bands.reverse()
    
    def assign_words_to_columns(self, row: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Assign words in a row to their respective column bands.
        
        Args:
            row: List of words in the row
            
        Returns:
            Dictionary mapping field names to text values
        """
        field_values = defaultdict(list)
        
        for word in row:
            word_text = word.get('text', '').strip()
            if not word_text:
                continue
                
            # Find which column band this word belongs to
            assigned = False
            for band in self.column_bands:
                if band.contains_word(word):
                    field_values[band.field_name].append(word_text)
                    assigned = True
                    break
            
            # If not assigned to any band, add to description (most flexible field)
            if not assigned:
                field_values['Description'].append(word_text)
        
        # Convert lists to joined strings
        result = {}
        for field, values in field_values.items():
            result[field] = ' '.join(values).strip()
        
        return result
    
    def is_transaction_row(self, field_values: Dict[str, str]) -> bool:
        """
        Determine if a row represents a transaction.
        
        Args:
            field_values: Dictionary of field values for the row
            
        Returns:
            True if this appears to be a transaction row
        """
        # Must have a date and at least one number
        has_date = False
        has_number = False
        
        for field, value in field_values.items():
            if field == 'Date' and value and extract_date(value):
                has_date = True
            if value and NUMBER_REGEX.search(value):
                has_number = True
        
        return has_date and has_number
    
    def init_transaction(self, field_values: Dict[str, str]) -> Dict[str, Any]:
        """
        Initialize a transaction from field values.
        
        Args:
            field_values: Dictionary of field values
            
        Returns:
            Transaction dictionary with detected fields
        """
        # Start with empty transaction and populate based on detected fields
        transaction = {}
        
        # Directly map all detected fields to preserve original structure
        for field_name, field_value in field_values.items():
            if field_value and field_value.strip():
                transaction[field_name] = field_value.strip()
        
        # Extract date from appropriate field
        date_fields = ['Date', 'ValueDate']
        for field in date_fields:
            if field in field_values and field_values[field]:
                date_extracted = extract_date(field_values[field])
                if date_extracted:
                    transaction[field] = date_extracted
                    break
        
        # Extract amounts and determine debit/credit
        numbers = []
        for field, value in field_values.items():
            if value:
                for match in NUMBER_REGEX.finditer(value):
                    num_str = match.group()
                    normalized = normalize_number(num_str)
                    if normalized is not None:
                        numbers.append({
                            'value': normalized,
                            'text': num_str,
                            'field': field,
                            'is_negative': NEGATIVE_REGEX.search(value) is not None
                        })
        
        if numbers:
            # Sort by absolute value (largest last)
            numbers.sort(key=lambda x: abs(x['value']))
            
            # Balance is typically the largest number
            if len(numbers) >= 1:
                balance_num = numbers[-1]
                transaction['Balance'] = balance_num['value']
            
            # Transaction amount is typically the second largest
            if len(numbers) >= 2:
                amount_num = numbers[-2]
                amount = amount_num['value']
                
                # Determine if debit or credit
                if self.previous_balance is not None and transaction['Balance'] is not None:
                    # Use balance change to determine debit/credit
                    balance_change = transaction['Balance'] - self.previous_balance
                    if balance_change > 0:
                        transaction['Credit'] = abs(amount)
                    else:
                        transaction['Debit'] = abs(amount)
                    transaction['Amount'] = balance_change
                elif amount_num['is_negative'] or any(field in amount_num['field'].lower() for field in ['debit', 'withdrawal', 'dr']):
                    transaction['Debit'] = abs(amount)
                    transaction['Amount'] = -abs(amount)
                else:
                    transaction['Credit'] = abs(amount)
                    transaction['Amount'] = abs(amount)
            
            # Handle single amount column scenarios
            elif len(numbers) == 1 and self.previous_balance is not None and transaction['Balance'] is not None:
                balance_change = transaction['Balance'] - self.previous_balance
                if balance_change != 0:
                    if balance_change > 0:
                        transaction['Credit'] = abs(balance_change)
                    else:
                        transaction['Debit'] = abs(balance_change)
                    transaction['Amount'] = balance_change
        
        # Update previous balance for next transaction
        if transaction['Balance'] is not None:
            self.previous_balance = transaction['Balance']
        
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
        print(f"[Universal Parser] Starting parse with {len(all_words)} words, page_width: {page_width}")
        
        self.page_width = page_width
        self.transactions = []
        self.current_transaction = None
        self.previous_balance = None
        
        if not all_words:
            print("[Universal Parser] ERROR: No words provided for parsing")
            return []
        
        # Cluster words into rows
        print("[Universal Parser] Clustering words into rows...")
        rows = self.cluster_words_by_rows(all_words)
        
        if not rows:
            print("[Universal Parser] ERROR: No rows found after clustering")
            return []
        
        print(f"[Universal Parser] Found {len(rows)} rows")
        
        # Log first few rows for debugging
        for i, row in enumerate(rows[:10]):  # Show first 10 rows
            row_text = ' '.join(word.get('text', '') for word in row)
            print(f"[Universal Parser] Row {i}: {row_text}")
        
        # Detect header row and establish column bands
        header_idx = self.detect_header_row_and_columns(rows)
        
        if header_idx is None or not self.column_bands:
            print("[Universal Parser] No header row found or no column bands established, using fallback parsing")
            fallback_transactions = self._parse_without_column_bands(rows)
            
            if not fallback_transactions:
                print("[Universal Parser] ERROR: Fallback parsing also found no transactions")
                print("[Universal Parser] DEBUG: Analyzing content for clues...")
                self._debug_content_analysis(rows)
            else:
                print(f"[Universal Parser] SUCCESS: Fallback parsing found {len(fallback_transactions)} transactions")
                
            return fallback_transactions
        
        print(f"[Universal Parser] Using column-based parsing with {len(self.column_bands)} bands")
        for band in self.column_bands:
            print(f"[Universal Parser] Column band: {band}")
        
        # Process rows after header
        transaction_rows_processed = 0
        for row_idx in range(header_idx + 1, len(rows)):
            row = rows[row_idx]
            if not row:
                continue
            
            # Assign words to columns
            field_values = self.assign_words_to_columns(row)
            
            if self.is_transaction_row(field_values):
                transaction_rows_processed += 1
                print(f"[Universal Parser] Processing transaction row {transaction_rows_processed}: {field_values}")
                
                # Finalize previous transaction if any
                if self.current_transaction:
                    self.transactions.append(self.current_transaction)
                
                # Start new transaction
                self.current_transaction = self.init_transaction(field_values)
            else:
                # Continue description of current transaction
                if self.current_transaction and field_values.get('Description'):
                    desc_text = field_values['Description']
                    if desc_text and desc_text.strip():
                        current_desc = self.current_transaction.get('Description', '')
                        self.current_transaction['Description'] = f"{current_desc} {desc_text.strip()}".strip()
        
        # Add the last transaction
        if self.current_transaction:
            self.transactions.append(self.current_transaction)
        
        print(f"[Universal Parser] Final result: {len(self.transactions)} transactions found")
        
        if not self.transactions:
            print("[Universal Parser] ERROR: Column-based parsing found no transactions")
            print("[Universal Parser] DEBUG: Analyzing content for clues...")
            self._debug_content_analysis(rows)
        
        return self.transactions
    
    def _parse_without_column_bands(self, rows: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        Enhanced fallback parsing method when column bands cannot be established.
        Uses multiple intelligent heuristics to extract transactions.
        
        Args:
            rows: List of word rows
            
        Returns:
            List of transactions
        """
        print("[Universal Parser] Using enhanced fallback parsing method")
        transactions = []
        current_transaction = None
        previous_balance = None
        
        # Phase 1: Identify potential transaction rows using multiple criteria
        potential_transaction_rows = []
        
        for row_idx, row in enumerate(rows):
            if not row:
                continue
                
            row_text = ' '.join(word.get('text', '') for word in row).strip()
            
            # Skip obvious non-data rows
            if not row_text or len(row_text) < 5:
                continue
            
            # Multiple criteria for transaction detection
            has_date = bool(DATE_REGEX.search(row_text))
            numbers = NUMBER_REGEX.findall(row_text)
            # Handle tuples from regex capturing groups
            number_strings = []
            for n in numbers:
                if isinstance(n, tuple):
                    # Join all non-empty parts of the tuple
                    number_strings.extend([part for part in n if part])
                else:
                    number_strings.append(n)
            has_meaningful_numbers = len(number_strings) >= 1 and any(float(normalize_number(n) or 0) > 0 for n in number_strings)
            
            # Transaction type indicators
            transaction_keywords = [
                'transfer', 'payment', 'deposit', 'withdrawal', 'cheque', 'check',
                'atm', 'pos', 'online', 'mobile', 'upi', 'neft', 'rtgs', 'imps',
                'salary', 'interest', 'charges', 'fee', 'refund', 'cashback',
                'mir', 'int', 'paid', 'received', 'cr', 'dr', 'debit', 'credit'
            ]
            
            lower_text = row_text.lower()
            has_transaction_keyword = any(keyword in lower_text for keyword in transaction_keywords)
            
            # Bank-specific patterns that strongly indicate transactions
            bank_patterns = [
                r'\b\d{2}/\d{2}/\d{4}\b',  # Date patterns
                r'\bmr\d+\b',  # Reference numbers like MR123
                r'\bint\b',    # Interest
                r'\bcr\b|\bdr\b',  # Credit/Debit indicators
                r'\b\d+\.\d{2}\b',  # Monetary amounts
                r'\b\d{10,}\b',    # Long reference numbers
                r'\b\d+,\d+\.\d{2}\b'  # Formatted amounts like 100,501.22
            ]
            
            has_bank_pattern = any(re.search(pattern, lower_text) for pattern in bank_patterns)
            
            # AGGRESSIVE TRANSACTION DETECTION - Score this row
            score = 0
            
            # Date bonus (nice to have but not required)
            if has_date:
                score += 8
            
            # Multiple numbers is a strong indicator
            if len(numbers) >= 2:
                score += 10  # Multiple numbers likely means amounts + balance
            elif len(numbers) >= 1:
                score += 5
            
            # Transaction keywords
            if has_transaction_keyword:
                score += 8
            
            # Bank patterns (especially CR/DR and formatted amounts)
            if has_bank_pattern:
                score += 8
            
            # Multiple columns indicates structured data
            if len(row) >= 4:
                score += 5
            elif len(row) >= 6:
                score += 8  # Even better structure
            
            # SPECIAL PATTERNS for obvious transactions:
            
            # Pattern 1: Multiple decimal numbers (like "202.00 0.00 202.00")
            decimal_numbers = [n for n in numbers if '.' in n]
            if len(decimal_numbers) >= 2:
                score += 15  # Very strong indicator
            
            # Pattern 2: CR/DR indicators with numbers
            if re.search(r'\b(cr|dr)\b', lower_text) and len(numbers) >= 1:
                score += 20  # Extremely strong indicator
            
            # Pattern 3: Long reference number + multiple amounts
            if re.search(r'\b\d{10,}\b', row_text) and len(numbers) >= 2:
                score += 15  # Account/ref number + amounts
            
            # Pattern 4: Formatted currency amounts (1,234.56 format)
            if re.search(r'\b\d{1,3}(,\d{3})*\.\d{2}\b', row_text):
                score += 12  # Well-formatted amounts
            
            # Penalty for obvious non-transaction content
            non_transaction_indicators = [
                'statement', 'period', 'customer', 'account summary', 'branch', 'address',
                'ifsc', 'page', 'continued', 'total', 'opening', 'closing', 'summary',
                'consolidated', 'important', 'notification', 'abbreviation'
            ]
            
            penalty_hits = sum(1 for indicator in non_transaction_indicators if indicator in lower_text)
            score -= penalty_hits * 3
            
            # VERY LOW THRESHOLD - we want to catch everything that might be a transaction
            if score >= 8:  # Much lower threshold than before
                potential_transaction_rows.append({
                    'row_idx': row_idx,
                    'row': row,
                    'row_text': row_text,
                    'score': score,
                    'has_date': has_date,
                    'numbers': numbers,
                    'decimal_count': len(decimal_numbers),
                    'has_cr_dr': bool(re.search(r'\b(cr|dr)\b', lower_text))
                })
        
        print(f"[Universal Parser] Found {len(potential_transaction_rows)} potential transaction rows")
        
        # Show top scoring rows for debugging
        potential_transaction_rows.sort(key=lambda x: x['score'], reverse=True)
        for i, info in enumerate(potential_transaction_rows[:5]):  # Show top 5
            print(f"[Universal Parser] Potential transaction {i+1} (score {info['score']}): {info['row_text'][:100]}")
        
        # Phase 2: Process potential transaction rows
        for transaction_info in potential_transaction_rows:
            row = transaction_info['row']
            row_text = transaction_info['row_text']
            
            # Parse this row as a transaction
            transaction = self._parse_row_intelligently(row, row_text, previous_balance)
            
            # Validate the transaction has essential fields
            if self._validate_transaction(transaction):
                transactions.append(transaction)
                
                # Update previous balance for calculations
                if transaction.get('Balance') is not None:
                    previous_balance = transaction['Balance']
                    
                print(f"[Universal Parser] Extracted transaction: Date={transaction.get('Date')}, "
                      f"Amount={transaction.get('Amount')}, Balance={transaction.get('Balance')}")
        
        # Phase 3: Post-processing to improve transaction quality
        transactions = self._post_process_transactions(transactions)
        
        print(f"[Universal Parser] Enhanced fallback parsing extracted {len(transactions)} transactions")
        return transactions
    
    def _validate_transaction(self, transaction: Dict[str, Any]) -> bool:
        """
        Validate that a transaction has essential fields.
        
        Args:
            transaction: Transaction dictionary
            
        Returns:
            True if transaction is valid
        """
        # Must have either a date or meaningful description
        has_date = bool(transaction.get('Date'))
        has_description = bool(transaction.get('Description') and len(str(transaction['Description']).strip()) > 2)
        
        # Must have some amount information
        has_amount = any([
            transaction.get('Amount') is not None,
            transaction.get('Debit') is not None,
            transaction.get('Credit') is not None,
            transaction.get('Balance') is not None
        ])
        
        return (has_date or has_description) and has_amount
    
    def _post_process_transactions(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Post-process transactions to improve data quality.
        
        Args:
            transactions: List of raw transactions
            
        Returns:
            List of improved transactions
        """
        if not transactions:
            return transactions
        
        # Sort by date if possible
        dated_transactions = []
        undated_transactions = []
        
        for trans in transactions:
            if trans.get('Date'):
                try:
                    # Try to parse the date for sorting
                    date_obj = extract_date(trans['Date'])
                    if date_obj:
                        dated_transactions.append((date_obj, trans))
                    else:
                        undated_transactions.append(trans)
                except:
                    undated_transactions.append(trans)
            else:
                undated_transactions.append(trans)
        
        # Sort dated transactions
        dated_transactions.sort(key=lambda x: x[0])
        sorted_transactions = [trans for date_obj, trans in dated_transactions] + undated_transactions
        
        # Calculate running balances if missing
        for i, trans in enumerate(sorted_transactions):
            if trans.get('Balance') is None:
                # Try to calculate based on previous balance and amount
                if i > 0:
                    prev_balance = sorted_transactions[i-1].get('Balance')
                    amount = trans.get('Amount')
                    if prev_balance is not None and amount is not None:
                        trans['Balance'] = prev_balance + amount
        
        return sorted_transactions
    
    def _parse_row_intelligently(self, row: List[Dict[str, Any]], row_text: str, previous_balance: Optional[float]) -> Dict[str, Any]:
        """
        Intelligently parse a row to extract transaction fields.
        
        Args:
            row: List of word dictionaries in the row
            row_text: Combined text of the row
            previous_balance: Previous transaction balance for calculation
            
        Returns:
            Transaction dictionary
        """
        transaction = {
            'Date': None,
            'Description': '',
            'Debit': None,
            'Credit': None,
            'Balance': None,
            'Amount': None,
            'Currency': extract_currency(row_text),
            'ReferenceID': None,
            'TransactionType': None,
            'ValueDate': None
        }
        
        # Extract date
        date_match = DATE_REGEX.search(row_text)
        if date_match:
            transaction['Date'] = date_match.group().strip()
        
        # Extract all numbers from the row
        numbers = []
        for match in NUMBER_REGEX.finditer(row_text):
            num_str = match.group()
            normalized = normalize_number(num_str)
            if normalized is not None and normalized != 0:
                numbers.append({
                    'value': normalized,
                    'text': num_str,
                    'start': match.start(),
                    'end': match.end()
                })
        
        # Sort numbers by their position in text and value
        numbers.sort(key=lambda x: (x['start'], abs(x['value'])))
        
        # Intelligent number assignment based on position and context
        if len(numbers) == 1:
            # Single number - could be amount or balance
            num = numbers[0]
            if previous_balance is not None:
                # Treat as balance, calculate amount
                transaction['Balance'] = num['value']
                amount_change = transaction['Balance'] - previous_balance
                transaction['Amount'] = amount_change
                if amount_change > 0:
                    transaction['Credit'] = abs(amount_change)
                else:
                    transaction['Debit'] = abs(amount_change)
            else:
                # No previous balance context, treat as amount
                transaction['Amount'] = num['value']
                if num['value'] > 0:
                    transaction['Credit'] = num['value']
                else:
                    transaction['Debit'] = abs(num['value'])
                    
        elif len(numbers) == 2:
            # Two numbers - likely amount and balance
            first_num, second_num = numbers[0], numbers[1]
            
            # Heuristic: larger number is usually balance
            if abs(second_num['value']) > abs(first_num['value']):
                transaction['Amount'] = first_num['value']
                transaction['Balance'] = second_num['value']
            else:
                transaction['Amount'] = second_num['value']
                transaction['Balance'] = first_num['value']
            
            # Determine debit/credit
            amount = transaction['Amount']
            if amount > 0:
                transaction['Credit'] = amount
            else:
                transaction['Debit'] = abs(amount)
                
        elif len(numbers) >= 3:
            # Multiple numbers - try to identify patterns
            # Usually: [potential ref], amount, balance (or) debit, credit, balance
            
            # Take the largest as balance (usually last or second to last)
            balance_candidates = sorted(numbers, key=lambda x: abs(x['value']), reverse=True)
            transaction['Balance'] = balance_candidates[0]['value']
            
            # Remove balance from consideration
            remaining_numbers = [n for n in numbers if n != balance_candidates[0]]
            
            if remaining_numbers:
                # Use context clues to determine debit/credit
                context_text = row_text.lower()
                
                # Look for debit/credit indicators
                debit_indicators = ['dr', 'debit', 'withdrawal', 'paid', 'transfer to', 'sent']
                credit_indicators = ['cr', 'credit', 'deposit', 'received', 'transfer from', 'salary']
                
                is_debit = any(indicator in context_text for indicator in debit_indicators)
                is_credit = any(indicator in context_text for indicator in credit_indicators)
                
                if len(remaining_numbers) >= 2:
                    # Could be separate debit/credit columns
                    first_amt = remaining_numbers[0]['value']
                    second_amt = remaining_numbers[1]['value']
                    
                    if first_amt > 0 and second_amt <= 0:
                        transaction['Credit'] = first_amt
                        transaction['Debit'] = abs(second_amt) if second_amt < 0 else None
                    elif second_amt > 0 and first_amt <= 0:
                        transaction['Credit'] = second_amt
                        transaction['Debit'] = abs(first_amt) if first_amt < 0 else None
                    else:
                        # Both positive or both negative - use first as amount
                        amount = first_amt
                        transaction['Amount'] = amount
                        if is_debit or amount < 0:
                            transaction['Debit'] = abs(amount)
                        else:
                            transaction['Credit'] = abs(amount)
                else:
                    # Single amount
                    amount = remaining_numbers[0]['value']
                    transaction['Amount'] = amount
                    if is_debit or amount < 0:
                        transaction['Debit'] = abs(amount)
                    else:
                        transaction['Credit'] = abs(amount)
        
        # Extract description (everything that's not a number or date)
        description_parts = []
        temp_text = row_text
        
        # Remove date from description
        if transaction['Date']:
            temp_text = temp_text.replace(transaction['Date'], ' ')
        
        # Remove numbers from description
        for num in numbers:
            temp_text = temp_text.replace(num['text'], ' ')
        
        # Clean up description
        description = re.sub(r'\s+', ' ', temp_text).strip()
        transaction['Description'] = description
        
        # Try to extract reference ID from description
        ref_patterns = [
            r'ref[:\s]*([a-zA-Z0-9]+)',
            r'utr[:\s]*([a-zA-Z0-9]+)',
            r'txn[:\s]*([a-zA-Z0-9]+)',
            r'id[:\s]*([a-zA-Z0-9]+)',
            r'([0-9]{6,})',  # Long numbers could be reference
        ]
        
        for pattern in ref_patterns:
            ref_match = re.search(pattern, description.lower())
            if ref_match:
                transaction['ReferenceID'] = ref_match.group(1)
                break
        
        return transaction 

    def _debug_content_analysis(self, rows: List[List[Dict[str, Any]]]):
        """
        Analyze content to provide debugging information when no transactions are found.
        
        Args:
            rows: List of word rows
        """
        print("[Universal Parser] === CONTENT ANALYSIS DEBUG ===")
        
        date_rows = []
        number_rows = []
        potential_headers = []
        
        for i, row in enumerate(rows):
            row_text = ' '.join(word.get('text', '') for word in row)
            
            # Check for dates
            if DATE_REGEX.search(row_text):
                date_rows.append((i, row_text))
            
            # Check for numbers
            numbers = NUMBER_REGEX.findall(row_text)
            if numbers:
                number_rows.append((i, row_text, len(numbers)))
            
            # Check for potential headers
            lower_text = row_text.lower()
            header_keywords = ['date', 'description', 'amount', 'balance', 'debit', 'credit', 'particulars', 'narration']
            if any(keyword in lower_text for keyword in header_keywords):
                potential_headers.append((i, row_text))
        
        print(f"[Universal Parser] Found {len(date_rows)} rows with dates:")
        for i, (row_idx, text) in enumerate(date_rows[:5]):  # Show first 5
            print(f"  Row {row_idx}: {text}")
        
        print(f"[Universal Parser] Found {len(number_rows)} rows with numbers:")
        for i, (row_idx, text, num_count) in enumerate(number_rows[:5]):  # Show first 5
            print(f"  Row {row_idx} ({num_count} numbers): {text}")
        
        print(f"[Universal Parser] Found {len(potential_headers)} potential header rows:")
        for i, (row_idx, text) in enumerate(potential_headers[:3]):  # Show first 3
            print(f"  Row {row_idx}: {text}")
        
        # Analyze word distribution
        total_words = sum(len(row) for row in rows)
        avg_words_per_row = total_words / len(rows) if rows else 0
        print(f"[Universal Parser] Total words: {total_words}, Avg per row: {avg_words_per_row:.1f}")
        
        # Check for common bank statement indicators
        all_text = ' '.join(' '.join(word.get('text', '') for word in row) for row in rows).lower()
        bank_indicators = ['bank', 'statement', 'account', 'transaction', 'balance', 'deposit', 'withdrawal']
        found_indicators = [indicator for indicator in bank_indicators if indicator in all_text]
        print(f"[Universal Parser] Bank statement indicators found: {found_indicators}")
        
        print("[Universal Parser] === END DEBUG ANALYSIS ===")
        
        return {
            'date_rows': len(date_rows),
            'number_rows': len(number_rows),
            'potential_headers': len(potential_headers),
            'bank_indicators': found_indicators
        } 