"""
Bank-specific parsers that know the exact structure and expected output format for each bank.
This replaces the generic universal parser with targeted, bank-specific parsing logic.
"""

from typing import List, Dict, Any, Optional
import re
from datetime import datetime
from .synonyms import normalize_number, DATE_REGEX

class BankParser:
    """Base class for bank-specific parsers."""
    
    def __init__(self):
        self.bank_name = ""
        self.expected_columns = []
        self.header_patterns = []
    
    def detect_bank(self, all_text: str) -> bool:
        """Detect if this parser should handle the given text."""
        raise NotImplementedError
    
    def find_transaction_table(self, rows: List[List[Dict[str, Any]]]) -> Optional[int]:
        """Find the row index where the transaction table starts."""
        raise NotImplementedError
    
    def extract_transactions(self, rows: List[List[Dict[str, Any]]], header_idx: int) -> List[Dict[str, Any]]:
        """Extract transactions from rows starting after the header."""
        raise NotImplementedError

class HDFCParser(BankParser):
    """Parser for HDFC Bank statements."""
    
    def __init__(self):
        super().__init__()
        self.bank_name = "HDFC"
        self.expected_columns = ["Date", "Narration", "Chq_Ref_No", "Value_Date", "Withdrawal_Amount", "Deposit_Amount", "Closing_Balance"]
        self.header_patterns = [
            r"date.*narration.*ref.*value.*withdrawal.*deposit.*balance",
            r"date.*description.*reference.*amount.*balance"
        ]
    
    def detect_bank(self, all_text: str) -> bool:
        """Detect HDFC bank from text content."""
        text_lower = all_text.lower()
        hdfc_indicators = [
            "hdfc", "hdfc bank", "housing development finance corporation"
        ]
        return any(indicator in text_lower for indicator in hdfc_indicators)
    
    def find_transaction_table(self, rows: List[List[Dict[str, Any]]]) -> Optional[int]:
        """Find HDFC transaction table header."""
        for idx, row in enumerate(rows):
            row_text = ' '.join(word.get('text', '') for word in row).lower()
            
            # Look for specific HDFC header pattern
            if any(re.search(pattern, row_text) for pattern in self.header_patterns):
                print(f"[HDFC Parser] Found transaction table at row {idx}: {row_text[:100]}...")
                return idx
        
        return None
    
    def extract_transactions(self, rows: List[List[Dict[str, Any]]], header_idx: int) -> List[Dict[str, Any]]:
        """Extract HDFC transactions."""
        transactions = []
        
        # Get header row for column positions
        header_row = rows[header_idx]
        column_positions = self._get_column_positions(header_row)
        
        print(f"[HDFC Parser] Column positions: {column_positions}")
        
        # Process transaction rows (skip header and any immediate non-transaction rows)
        for row_idx in range(header_idx + 1, len(rows)):
            row = rows[row_idx]
            if not row:
                continue
                
            row_text = ' '.join(word.get('text', '') for word in row)
            
            # Skip non-transaction rows
            if not self._is_transaction_row(row_text):
                continue
            
            # Extract transaction data
            transaction = self._extract_transaction_from_row(row, column_positions)
            if transaction:
                transactions.append(transaction)
                print(f"[HDFC Parser] ✓ Transaction: {transaction['Date']} - {transaction['Narration'][:30]}...")
        
        print(f"[HDFC Parser] Extracted {len(transactions)} transactions")
        return transactions
    
    def _get_column_positions(self, header_row: List[Dict[str, Any]]) -> Dict[str, tuple]:
        """Get approximate column positions from header row."""
        positions = {}
        
        # Sort header words by x position
        header_words = sorted(header_row, key=lambda w: w.get('x0', 0))
        
        # Identify columns based on text content
        for word in header_words:
            text = word.get('text', '').lower()
            x0, x1 = word.get('x0', 0), word.get('x1', 0)
            
            if 'date' in text and 'value' not in text:
                positions['date'] = (max(0, x0 - 10), x1 + 10)
            elif 'narration' in text or 'description' in text:
                positions['narration'] = (max(0, x0 - 10), x1 + 50)  # Wider for description
            elif 'ref' in text or 'chq' in text:
                positions['ref'] = (max(0, x0 - 10), x1 + 20)
            elif 'value' in text and 'date' in text:
                positions['value_date'] = (max(0, x0 - 10), x1 + 10)
            elif 'withdrawal' in text:
                positions['withdrawal'] = (max(0, x0 - 10), x1 + 10)
            elif 'deposit' in text:
                positions['deposit'] = (max(0, x0 - 10), x1 + 10)
            elif 'balance' in text and 'closing' in text:
                positions['balance'] = (max(0, x0 - 10), x1 + 10)
        
        return positions
    
    def _is_transaction_row(self, row_text: str) -> bool:
        """Check if row contains transaction data."""
        # Must have a date pattern
        if not DATE_REGEX.search(row_text):
            return False
        
        # Must have some numbers (amounts)
        if not re.search(r'\d+\.?\d*', row_text):
            return False
        
        # Skip header-like text
        text_lower = row_text.lower()
        skip_patterns = [
            r'date.*narration', r'opening.*balance', r'total.*amount',
            r'page.*\d+', r'statement.*period', r'account.*summary'
        ]
        
        if any(re.search(pattern, text_lower) for pattern in skip_patterns):
            return False
        
        return True
    
    def _extract_transaction_from_row(self, row: List[Dict[str, Any]], positions: Dict[str, tuple]) -> Optional[Dict[str, Any]]:
        """Extract transaction data from a single row."""
        try:
            # Sort words by x position
            words = sorted(row, key=lambda w: w.get('x0', 0))
            
            # Extract data for each column
            transaction = {
                "Date": "",
                "Narration": "",
                "Chq_Ref_No": "",
                "Value_Date": "",
                "Withdrawal_Amount": 0.00,
                "Deposit_Amount": 0.00,
                "Closing_Balance": 0.00
            }
            
            # Group words by column positions
            for word in words:
                text = word.get('text', '').strip()
                x = word.get('x0', 0)
                
                # Find which column this word belongs to
                for col_name, (x0, x1) in positions.items():
                    if x0 <= x <= x1:
                        if col_name == 'date' and not transaction["Date"]:
                            if re.search(r'\d{2}/\d{2}/\d{4}', text):
                                transaction["Date"] = text
                        elif col_name == 'narration':
                            if transaction["Narration"]:
                                transaction["Narration"] += " " + text
                            else:
                                transaction["Narration"] = text
                        elif col_name == 'ref':
                            if transaction["Chq_Ref_No"]:
                                transaction["Chq_Ref_No"] += " " + text
                            else:
                                transaction["Chq_Ref_No"] = text
                        elif col_name == 'value_date' and not transaction["Value_Date"]:
                            if re.search(r'\d{2}/\d{2}/\d{4}', text):
                                transaction["Value_Date"] = text
                        elif col_name == 'withdrawal':
                            amount = normalize_number(text)
                            if amount and amount > 0:
                                transaction["Withdrawal_Amount"] = amount
                        elif col_name == 'deposit':
                            amount = normalize_number(text)
                            if amount and amount > 0:
                                transaction["Deposit_Amount"] = amount
                        elif col_name == 'balance':
                            amount = normalize_number(text)
                            if amount is not None:
                                transaction["Closing_Balance"] = amount
                        break
            
            # Validate transaction has minimum required data
            if transaction["Date"] and (transaction["Withdrawal_Amount"] > 0 or transaction["Deposit_Amount"] > 0):
                return transaction
            
            return None
            
        except Exception as e:
            print(f"[HDFC Parser] Error extracting transaction: {e}")
            return None

class IDFCParser(BankParser):
    """Parser for IDFC Bank statements."""
    
    def __init__(self):
        super().__init__()
        self.bank_name = "IDFC"
        self.expected_columns = ["Date_and_Time", "Value_Date", "Transaction_Details", "Ref_Cheque_No", "Withdrawals_INR", "Deposits_INR", "Balance_INR"]
        self.header_patterns = [
            r"date.*time.*value.*transaction.*details.*withdrawals.*deposits.*balance",
            r"date.*value.*particulars.*debit.*credit.*balance"
        ]
    
    def detect_bank(self, all_text: str) -> bool:
        """Detect IDFC bank from text content."""
        text_lower = all_text.lower()
        idfc_indicators = [
            "idfc", "idfc first bank", "idfc bank"
        ]
        return any(indicator in text_lower for indicator in idfc_indicators)
    
    def find_transaction_table(self, rows: List[List[Dict[str, Any]]]) -> Optional[int]:
        """Find IDFC transaction table header."""
        for idx, row in enumerate(rows):
            row_text = ' '.join(word.get('text', '') for word in row).lower()
            
            # Look for IDFC specific patterns
            if any(re.search(pattern, row_text) for pattern in self.header_patterns):
                print(f"[IDFC Parser] Found transaction table at row {idx}: {row_text[:100]}...")
                return idx
        
        return None
    
    def extract_transactions(self, rows: List[List[Dict[str, Any]]], header_idx: int) -> List[Dict[str, Any]]:
        """Extract IDFC transactions."""
        transactions = []
        
        # Process transaction rows
        for row_idx in range(header_idx + 1, len(rows)):
            row = rows[row_idx]
            if not row:
                continue
                
            row_text = ' '.join(word.get('text', '') for word in row)
            
            # Skip non-transaction rows
            if not self._is_transaction_row(row_text):
                continue
            
            # Extract transaction data
            transaction = self._extract_transaction_from_row(row)
            if transaction:
                transactions.append(transaction)
                print(f"[IDFC Parser] ✓ Transaction: {transaction['Date_and_Time']} - {transaction['Transaction_Details'][:30]}...")
        
        print(f"[IDFC Parser] Extracted {len(transactions)} transactions")
        return transactions
    
    def _is_transaction_row(self, row_text: str) -> bool:
        """Check if row contains IDFC transaction data."""
        # Must have date pattern
        if not re.search(r'\d{2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2}', row_text):
            return False
        
        # Must have amounts or balance
        if not re.search(r'\d+[,.]?\d*', row_text):
            return False
        
        return True
    
    def _extract_transaction_from_row(self, row: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Extract IDFC transaction data from a single row."""
        try:
            words = sorted(row, key=lambda w: w.get('x0', 0))
            row_text = ' '.join(word.get('text', '') for word in words)
            
            transaction = {
                "Date_and_Time": "",
                "Value_Date": "",
                "Transaction_Details": "",
                "Ref_Cheque_No": "",
                "Withdrawals_INR": "",
                "Deposits_INR": "",
                "Balance_INR": ""
            }
            
            # Extract date and time (first date found)
            date_match = re.search(r'(\d{2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2})\s*(\d{2}:\d{2})?', row_text)
            if date_match:
                date_part = date_match.group(1)
                time_part = date_match.group(3) if date_match.group(3) else ""
                transaction["Date_and_Time"] = f"{date_part} {time_part}".strip()
                transaction["Value_Date"] = date_part
            
            # Extract amounts and balance
            amounts = re.findall(r'[\d,]+\.?\d*', row_text)
            if amounts:
                # Last amount is usually balance
                transaction["Balance_INR"] = amounts[-1]
                
                # Look for withdrawal/deposit indicators
                if "cr" in row_text.lower() or "credit" in row_text.lower():
                    if len(amounts) > 1:
                        transaction["Deposits_INR"] = amounts[-2]
                elif "dr" in row_text.lower() or "debit" in row_text.lower():
                    if len(amounts) > 1:
                        transaction["Withdrawals_INR"] = amounts[-2]
            
            # Extract transaction details (everything between date and amounts)
            details_match = re.search(r'(\d{2}\s+\w+\s+\d{2}\s*\d{2}:\d{2})\s+(.+?)\s+[\d,]+', row_text)
            if details_match:
                transaction["Transaction_Details"] = details_match.group(2).strip()
            
            return transaction if transaction["Date_and_Time"] else None
            
        except Exception as e:
            print(f"[IDFC Parser] Error extracting transaction: {e}")
            return None

class ICICIParser(BankParser):
    """Parser for ICICI Bank statements."""
    
    def __init__(self):
        super().__init__()
        self.bank_name = "ICICI"
        self.expected_columns = ["Date", "Mode", "Particulars", "Deposits", "Withdrawals", "Balance"]
        self.header_patterns = [
            r"date.*mode.*particulars.*deposits.*withdrawals.*balance",
            r"date.*description.*debit.*credit.*balance"
        ]
    
    def detect_bank(self, all_text: str) -> bool:
        """Detect ICICI bank from text content."""
        text_lower = all_text.lower()
        icici_indicators = [
            "icici", "icici bank", "industrial credit and investment corporation"
        ]
        return any(indicator in text_lower for indicator in icici_indicators)
    
    def find_transaction_table(self, rows: List[List[Dict[str, Any]]]) -> Optional[int]:
        """Find ICICI transaction table header."""
        for idx, row in enumerate(rows):
            row_text = ' '.join(word.get('text', '') for word in row).lower()
            
            # Look for ICICI specific patterns
            if any(re.search(pattern, row_text) for pattern in self.header_patterns):
                print(f"[ICICI Parser] Found transaction table at row {idx}: {row_text[:100]}...")
                return idx
        
        return None
    
    def extract_transactions(self, rows: List[List[Dict[str, Any]]], header_idx: int) -> List[Dict[str, Any]]:
        """Extract ICICI transactions."""
        transactions = []
        
        # Process transaction rows
        for row_idx in range(header_idx + 1, len(rows)):
            row = rows[row_idx]
            if not row:
                continue
                
            row_text = ' '.join(word.get('text', '') for word in row)
            
            # Skip non-transaction rows
            if not self._is_transaction_row(row_text):
                continue
            
            # Extract transaction data
            transaction = self._extract_transaction_from_row(row)
            if transaction:
                transactions.append(transaction)
                print(f"[ICICI Parser] ✓ Transaction: {transaction['Date']} - {transaction['Mode']} - {transaction['Particulars'][:30]}...")
        
        print(f"[ICICI Parser] Extracted {len(transactions)} transactions")
        return transactions
    
    def _is_transaction_row(self, row_text: str) -> bool:
        """Check if row contains ICICI transaction data."""
        # Must have date pattern (DD-MM-YYYY)
        if not re.search(r'\d{2}-\d{2}-\d{4}', row_text):
            return False
        
        # Must have amounts
        if not re.search(r'[\d,]+\.?\d*', row_text):
            return False
        
        return True
    
    def _extract_transaction_from_row(self, row: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Extract ICICI transaction data from a single row."""
        try:
            words = sorted(row, key=lambda w: w.get('x0', 0))
            row_text = ' '.join(word.get('text', '') for word in words)
            
            transaction = {
                "Date": "",
                "Mode": "",
                "Particulars": "",
                "Deposits": "",
                "Withdrawals": "",
                "Balance": ""
            }
            
            # Extract date (DD-MM-YYYY format)
            date_match = re.search(r'(\d{2}-\d{2}-\d{4})', row_text)
            if date_match:
                transaction["Date"] = date_match.group(1)
            
            # Extract mode (UPI, BIL/NEFT, etc.)
            mode_patterns = [
                r'\b(UPI|BIL/NEFT|CASH|CHQ|IMPS|RTGS|ATM|POS)\b'
            ]
            for pattern in mode_patterns:
                mode_match = re.search(pattern, row_text)
                if mode_match:
                    transaction["Mode"] = mode_match.group(1)
                    break
            
            # Extract amounts (last 3 numbers are usually deposits, withdrawals, balance)
            amounts = re.findall(r'[\d,]+\.?\d*', row_text)
            if len(amounts) >= 3:
                # Typically: deposits, withdrawals, balance (last 3)
                transaction["Balance"] = amounts[-1]
                
                # Check for specific patterns to identify deposits/withdrawals
                if len(amounts) >= 2:
                    # If there are 2+ amounts, second to last might be withdrawal or deposit
                    second_last = amounts[-2]
                    third_last = amounts[-3] if len(amounts) >= 3 else ""
                    
                    # Simple heuristic: if we see typical deposit/withdrawal patterns
                    if "from" in row_text.lower() or "credit" in row_text.lower():
                        transaction["Deposits"] = second_last
                    elif "to" in row_text.lower() or "debit" in row_text.lower():
                        transaction["Withdrawals"] = second_last
            
            # Extract particulars (text between date+mode and amounts)
            particulars_text = row_text
            # Remove date
            if transaction["Date"]:
                particulars_text = particulars_text.replace(transaction["Date"], "")
            # Remove mode
            if transaction["Mode"]:
                particulars_text = particulars_text.replace(transaction["Mode"], "")
            # Remove amounts
            for amount in amounts[-3:]:  # Remove last 3 amounts
                particulars_text = particulars_text.replace(amount, "")
            
            transaction["Particulars"] = particulars_text.strip()
            
            return transaction if transaction["Date"] else None
            
        except Exception as e:
            print(f"[ICICI Parser] Error extracting transaction: {e}")
            return None

class BankParserManager:
    """Manages bank-specific parsers and routes to the appropriate one."""
    
    def __init__(self):
        self.parsers = [
            HDFCParser(),
            IDFCParser(), 
            ICICIParser()
        ]
    
    def detect_bank_and_parse(self, rows: List[List[Dict[str, Any]]], page_width: float = 595) -> List[Dict[str, Any]]:
        """Detect bank type and parse transactions using the appropriate parser."""
        
        # Get all text for bank detection
        all_text = ""
        for row in rows[:20]:  # Check first 20 rows for bank indicators
            row_text = ' '.join(word.get('text', '') for word in row)
            all_text += " " + row_text
        
        print(f"[Bank Parser Manager] Analyzing text for bank detection...")
        
        # Try each parser
        for parser in self.parsers:
            if parser.detect_bank(all_text):
                print(f"[Bank Parser Manager] Detected {parser.bank_name} bank")
                
                # Find transaction table
                header_idx = parser.find_transaction_table(rows)
                if header_idx is not None:
                    print(f"[Bank Parser Manager] Found transaction table at row {header_idx}")
                    
                    # Extract transactions
                    transactions = parser.extract_transactions(rows, header_idx)
                    print(f"[Bank Parser Manager] Extracted {len(transactions)} transactions using {parser.bank_name} parser")
                    return transactions
                else:
                    print(f"[Bank Parser Manager] No transaction table found for {parser.bank_name}")
        
        print(f"[Bank Parser Manager] No suitable parser found")
        return []

# Create global instance
bank_parser_manager = BankParserManager() 