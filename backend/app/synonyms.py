# synonyms.py - Universal header mapping for bank statement parsing

import re
from typing import Dict, List, Optional

# Comprehensive header synonym mapping for universal field detection
HEADER_SYNONYMS = {
    "Date": [
        # English variants
        "date", "posting date", "book date", "value date", "transaction date", "txn date",
        "trans date", "process date", "effective date", "settlement date", "entry date",
        "acct date", "processed date", "posted date", "booking date", "clearing date",
        
        # Common abbreviations
        "dt", "trn dt", "post dt", "val dt", "eff dt", "txn dt", "proc dt",
        
        # International variants
        "fecha", "data", "datum", "날짜", "日期", "تاريخ", "дата", "ημερομηνία",
        "дат", "päivämäärä", "dátum", "szám", "дан", "tanggal", "วันที่",
        
        # Bank-specific formats
        "trans. date", "transaction dt", "posting dt", "value dt", "eff. date",
        "sett. date", "settle date", "clear date", "book dt", "entry dt"
    ],
    
    "Description": [
        # English variants
        "description", "narration", "particulars", "details", "transaction details",
        "transaction description", "trans description", "trans details", "txn details",
        "purpose", "remarks", "memo", "reference", "transaction type", "type",
        "merchant", "vendor", "payee", "transaction info", "info", "note", "notes",
        "payment details", "transfer details", "comment", "comments", "summary",
        "narrative", "transaction narrative", "payment info", "transaction summary",
        "operation", "activity", "movement", "entry details", "payment purpose",
        
        # Abbreviations
        "desc", "descr", "narr", "part", "txn desc", "trans desc", "ref", "rmks",
        "dtls", "det", "purp", "nar", "tran desc", "trans info", "txn info",
        
        # International variants
        "libellé", "concepto", "descripción", "detalhes", "beschreibung", "説明", "설명",
        "تفاصيل", "описание", "περιγραφή", "beskrivning", "beskrivelse", "kuvaus",
        "descripció", "opis", "descrizione", "περιγραφή", "açıklama", "deskripsi",
        
        # Bank-specific terms
        "transaction particulars", "payment particulars", "transfer particulars",
        "cheque details", "draft details", "instrument details", "party details",
        "beneficiary details", "payer details", "counterparty", "third party"
    ],
    
    "Debit": [
        # English variants
        "debit", "withdrawal", "dr", "paid out", "outgoing", "expense", "payment",
        "charge", "fee", "deduction", "outflow", "withdraw", "debited", "spent",
        "disbursement", "expenditure", "payout", "remittance", "transfer out",
        "sent", "paid", "debited amount", "debit amount", "withdrawal amount",
        "outgoing amount", "paid amount", "transfer amount", "payment amount",
        
        # Abbreviations
        "dbt", "wdl", "wthdl", "wd", "db", "d", "out", "exp", "pay", "chg",
        "deb", "debits", "withdrawals", "payments", "charges", "outflows",
        
        # International variants
        "débito", "déb", "abzug", "ausgabe", "支出", "출금", "خصم", "дебет",
        "χρέωση", "debitering", "veloitus", "débito", "obciążenie", "uscita",
        "gider", "pengeluaran", "การหัก", "デビット", "débito", "дебит",
        
        # Bank-specific terms
        "money out", "funds out", "account debited", "amount debited", "debited for",
        "towards", "transfer to", "payment to", "sent to", "paid to", "by transfer",
        "by payment", "by withdrawal", "by debit", "amount paid", "amt paid",
        "amt debited", "funds transferred", "money transferred", "amount sent"
    ],
    
    "Credit": [
        # English variants
        "credit", "deposit", "cr", "paid in", "incoming", "receipt", "received",
        "credited", "income", "inflow", "addition", "lodgement", "credit amount",
        "deposit amount", "incoming amount", "received amount", "credited amount",
        "receipts", "collections", "recovery", "refund", "interest", "dividend",
        "salary", "transfer in", "money in", "funds in", "cash in", "amount in",
        
        # Abbreviations
        "cdt", "dep", "cr", "rcpt", "rec", "inc", "in", "cred", "credits",
        "deposits", "receipts", "inflows", "c", "cd", "crdt", "depo",
        
        # International variants
        "crédito", "créd", "eingang", "einzahlung", "收入", "입금", "إيداع", "кредит",
        "πίστωση", "kreditering", "talletus", "crédito", "wpływ", "entrata",
        "gelir", "pemasukan", "การฝาก", "クレジット", "crédito", "кредит",
        
        # Bank-specific terms
        "money received", "funds received", "account credited", "amount credited",
        "credited by", "received from", "transfer from", "payment from", "from",
        "by credit", "by deposit", "amount received", "amt received", "amt credited",
        "funds deposited", "money deposited", "amount deposited", "cash deposited"
    ],
    
    "Balance": [
        # English variants
        "balance", "running balance", "closing balance", "available balance", 
        "current balance", "book balance", "ledger balance", "account balance",
        "outstanding balance", "remaining balance", "net balance", "end balance",
        "balance after transaction", "balance b/f", "balance c/f", "bal after txn",
        "running total", "cumulative balance", "progressive balance", "live balance",
        
        # Abbreviations
        "bal", "closing bal", "running bal", "avail bal", "curr bal", "acct bal",
        "end bal", "rem bal", "out bal", "net bal", "bal b/f", "bal c/f",
        "cl bal", "op bal", "cb", "rb", "ab", "bb", "lb", "ob",
        
        # International variants
        "saldo", "solde", "guthaben", "kontostand", "残高", "잔액", "رصيد", "баланс",
        "υπόλοιπο", "saldo", "saldos", "saldi", "saldo", "bakiye", "saldo",
        "ยอดคงเหลือ", "バランス", "saldo", "баланс", "saldos", "остаток",
        
        # Bank-specific terms
        "account balance", "total balance", "final balance", "balance amount",
        "balance figure", "balance total", "balance sum", "balance value",
        "running amount", "progressive amount", "cumulative amount", "net amount"
    ],
    
    "Amount": [
        # English variants
        "amount", "transaction amount", "value", "sum", "total", "figure",
        "transaction value", "txn amount", "trans amount", "payment amount",
        "transfer amount", "cheque amount", "draft amount", "instrument amount",
        "principal amount", "net amount", "gross amount", "base amount",
        
        # Abbreviations
        "amt", "txn amt", "trans amt", "pay amt", "transfer amt", "chq amt",
        "val", "ttl", "tot", "fig", "prin amt", "net amt", "gross amt",
        
        # International variants
        "monto", "montant", "betrag", "importo", "金額", "금액", "مبلغ", "сумма",
        "ποσό", "belopp", "määrä", "quantidade", "kwota", "miktar", "jumlah",
        "จำนวน", "金額", "montante", "сума", "cantidad", "quantità",
        
        # Bank-specific terms
        "transaction amt", "payment amt", "transfer amt", "withdrawal amt",
        "deposit amt", "cheque amt", "instrument amt", "amount involved",
        "amount processed", "amount cleared", "amount settled", "amount posted"
    ],
    
    "Currency": [
        # English variants
        "currency", "curr.", "ccy", "denomination", "unit", "monetary unit",
        
        # International variants
        "moneda", "devise", "währung", "valuta", "通貨", "통화", "عملة", "валюта",
        "νόμισμα", "valuta", "valuutta", "moeda", "waluta", "valuta", "para birimi",
        "mata uang", "สกุลเงิน", "通貨", "moeda", "валута",
        
        # Abbreviations
        "cur", "curr", "denom", "unit", "monetary", "ccy code", "curr code"
    ],
    
    "TransactionType": [
        # English variants
        "mode", "channel", "type", "transaction type", "txn type", "payment mode",
        "transfer mode", "transaction mode", "payment type", "transfer type",
        "instrument", "mechanism", "method", "way", "means", "operation type",
        "activity type", "movement type", "entry type", "transaction category",
        
        # Abbreviations
        "typ", "cat", "meth", "mech", "inst", "oper", "act", "mov", "ent",
        "txn typ", "pay typ", "trans typ", "xfer typ", "trx typ",
        
        # International variants
        "código", "code", "tipo", "mode de paiement", "zahlungsart", "種類", "유형",
        "نوع", "тип", "τύπος", "typ", "tyyppi", "tipo", "typ", "tür", "jenis",
        "ประเภท", "タイプ", "tipo", "тип", "modalidad", "modalità",
        
        # Bank-specific terms
        "payment method", "transfer method", "transaction method", "payment channel",
        "transfer channel", "transaction channel", "clearing method", "settlement method"
    ],
    
    "ReferenceID": [
        # English variants
        "utr", "reference", "ref", "cheque", "payment id", "transaction id", "txn id",
        "transfer id", "reference number", "ref number", "ref no", "reference no",
        "transaction reference", "payment reference", "transfer reference",
        "cheque number", "check number", "draft number", "instrument number",
        "voucher number", "receipt number", "slip number", "document number",
        "serial number", "sequence number", "batch number", "confirmation number",
        
        # Abbreviations
        "ref no", "chq no", "check no", "receipt no", "voucher no", "slip no",
        "doc no", "ser no", "seq no", "batch no", "conf no", "txn ref",
        "pay ref", "trans ref", "xfer ref", "trx ref", "id", "no", "num",
        
        # International variants
        "referencia", "référence", "referenz", "参照", "참조", "مرجع", "ссылка",
        "αναφορά", "referens", "viite", "referência", "odniesienie", "riferimento",
        "referans", "referensi", "การอ้างอิง", "参照", "referência", "референс",
        
        # Bank-specific terms
        "chq./ref no.", "chq / ref no", "cheque/ref no", "instrument ref",
        "payment ref no", "transfer ref no", "transaction ref no", "clearing ref",
        "settlement ref", "ach ref", "wire ref", "swift ref", "batch ref"
    ],
    
    "ValueDate": [
        # English variants
        "value date", "val date", "effective date", "settlement date", "clearing date",
        "maturity date", "due date", "processing date", "execution date",
        
        # International variants
        "fecha valor", "date de valeur", "valutadatum", "決済日", "결제일", "تاريخ القيمة",
        
        # Abbreviations
        "val dt", "eff dt", "sett dt", "clear dt", "mat dt", "due dt", "proc dt"
    ],
    
    "CheckNumber": [
        # English variants
        "cheque no", "check no", "chq no", "cheque number", "check number",
        "chq ref no", "chq./ref no.", "chq / ref no", "ref no",
        
        # International variants
        "número de cheque", "numéro de chèque", "schecknummer", "小切手番号", "수표번호"
    ],
    
    # Additional fields commonly found in bank statements
    "WithdrawalAmount": [
        "withdrawal amount", "withdrawl amount", "withdraw amt", "debit amount",
        "outgoing amount", "paid out amount", "expense amount", "amount withdrawn",
        "withdrawn", "debited amt", "paid amt", "outflow amt", "sent amt"
    ],
    
    "DepositAmount": [
        "deposit amount", "credit amount", "incoming amount", "paid in amount",
        "receipt amount", "income amount", "amount deposited", "deposited",
        "credited amt", "received amt", "inflow amt", "collected amt"
    ],
    
    "ClosingBalance": [
        "closing balance", "closing bal", "balance", "running balance", "current balance",
        "end balance", "final balance", "balance c/f", "balance carried forward"
    ],
    
    "OpeningBalance": [
        "opening balance", "opening bal", "balance b/f", "balance brought forward",
        "starting balance", "initial balance", "previous balance", "begin balance"
    ],
    
    "RunningBalance": [
        "running balance", "running bal", "progressive balance", "cumulative balance",
        "live balance", "current balance", "balance after transaction"
    ],
    
    "Particulars": [
        "particulars", "transaction particulars", "payment particulars", "details",
        "transaction details", "payment details", "description", "narration"
    ],
    
    "Deposits": [
        "deposits", "credits", "receipts", "income", "inflows", "collections",
        "money in", "funds in", "cash in", "amounts received"
    ],
    
    "Withdrawals": [
        "withdrawals", "debits", "payments", "expenses", "outflows", "charges",
        "money out", "funds out", "cash out", "amounts paid"
    ]
}

# Regex patterns for international formats
DATE_PATTERNS = [
    r'\b\d{1,2}[./\-\s]\d{1,2}[./\-\s]\d{2,4}\b',  # DD/MM/YYYY, MM/DD/YYYY
    r'\b\d{4}[./\-\s]\d{1,2}[./\-\s]\d{1,2}\b',    # YYYY/MM/DD
    r'\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b',      # DD MMM YYYY
    r'\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}\b',    # MMM DD, YYYY
    r'\b\d{1,2}[./\-]\d{1,2}[./\-]\d{2}\b'         # DD/MM/YY
]

NUMBER_PATTERNS = [
    r'[+-]?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}',         # 1,234.56 or 1.234,56
    r'[+-]?\d+[.,]\d{2}',                           # 123.45 or 123,45
    r'[+-]?\d+(?:[.,]\d{3})*',                      # 1,234 or 1.234
    r'[+-]?\d+'                                     # 123
]

CURRENCY_PATTERNS = [
    r'[€£¥₹$¢₨₽₩₪₦₴₵₡₲₸₺₼₻]',                      # Currency symbols
    r'\b(?:USD|EUR|GBP|JPY|INR|AUD|CAD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB|BRL|MXN|ZAR|KRW|SGD|HKD|THB|MYR|IDR|PHP|VND|EGP|AED|SAR|QAR|KWD|BHD|OMR|JOD|LBP|TRY|ILS|RON|BGN|HRK|RSD|BAM|MKD|ALL|AMD|AZN|GEL|KZT|KGS|TJS|TMT|UZS|AFN|PKR|LKR|NPR|BTN|BDT|MMK|LAK|KHR|MNT|KPW|TWD|HKD|MOP|BND|FJD|PGK|SBD|VUV|NCX|XPF)\b',  # Currency codes
]

NEGATIVE_INDICATORS = [
    r'\([0-9.,\s]+\)',                              # (123.45)
    r'\b(?:DR|DEBIT|débito|дебет)\b',               # DR indicators
    r'-\s*[0-9.,]+',                                # -123.45
    r'[0-9.,]+\s*-'                                 # 123.45-
]

POSITIVE_INDICATORS = [
    r'\b(?:CR|CREDIT|crédito|кредит)\b',            # CR indicators
    r'\+\s*[0-9.,]+',                               # +123.45
    r'[0-9.,]+\s*\+'                                # 123.45+
]

# Compiled regex patterns for performance  
DATE_REGEX = re.compile('|'.join(f'({pattern})' for pattern in DATE_PATTERNS), re.IGNORECASE)
# Fix: Use non-capturing groups to avoid tuple returns from findall()
NUMBER_REGEX = re.compile('|'.join(f'(?:{pattern})' for pattern in NUMBER_PATTERNS))
CURRENCY_REGEX = re.compile('|'.join(f'({pattern})' for pattern in CURRENCY_PATTERNS), re.IGNORECASE)
NEGATIVE_REGEX = re.compile('|'.join(f'({pattern})' for pattern in NEGATIVE_INDICATORS), re.IGNORECASE)
POSITIVE_REGEX = re.compile('|'.join(f'({pattern})' for pattern in POSITIVE_INDICATORS), re.IGNORECASE)

def normalize_header(header_text: str) -> Optional[str]:
    """
    Normalize a header text to canonical field name using synonym mapping.
    Enhanced with better matching and edge case handling.
    
    Args:
        header_text: Raw header text from PDF
        
    Returns:
        Canonical field name or None if no match found
    """
    if not header_text:
        return None
    
    # Clean and normalize the header text
    clean_header = re.sub(r'[^\w\s]', ' ', header_text.lower().strip())
    clean_header = re.sub(r'\s+', ' ', clean_header).strip()
    
    # Handle common abbreviations and variations
    clean_header = clean_header.replace('&', 'and')
    clean_header = clean_header.replace('/', ' ')
    clean_header = clean_header.replace('-', ' ')
    clean_header = clean_header.replace('_', ' ')
    
    # Check against all synonym lists with improved matching
    best_match = None
    best_score = 0
    
    for canonical_name, synonyms in HEADER_SYNONYMS.items():
        for synonym in synonyms:
            synonym_clean = synonym.lower().strip()
            
            # Exact match (highest priority)
            if clean_header == synonym_clean:
                return canonical_name
            
            # Substring match (both directions)
            if synonym_clean in clean_header or clean_header in synonym_clean:
                # Score based on how close the match is
                score = min(len(synonym_clean), len(clean_header)) / max(len(synonym_clean), len(clean_header))
                if score > best_score and score > 0.5:  # At least 50% match
                    best_score = score
                    best_match = canonical_name
            
            # Word-based matching for multi-word headers
            header_words = set(clean_header.split())
            synonym_words = set(synonym_clean.split())
            
            if header_words and synonym_words:
                overlap = len(header_words.intersection(synonym_words))
                total_words = len(header_words.union(synonym_words))
                
                if overlap > 0:
                    word_score = overlap / total_words
                    if word_score > best_score and word_score > 0.3:  # At least 30% word overlap
                        best_score = word_score
                        best_match = canonical_name
    
    # Special handling for common patterns
    if not best_match:
        # Check for common patterns that might not be in synonyms
        if 'dt' in clean_header or 'date' in clean_header:
            return 'Date'
        elif 'desc' in clean_header or 'particular' in clean_header or 'detail' in clean_header:
            return 'Description'
        elif 'bal' in clean_header:
            return 'Balance'
        elif 'amt' in clean_header or 'amount' in clean_header:
            return 'Amount'
        elif 'dr' in clean_header or 'debit' in clean_header or 'withdraw' in clean_header:
            return 'Debit'
        elif 'cr' in clean_header or 'credit' in clean_header or 'deposit' in clean_header:
            return 'Credit'
        elif 'ref' in clean_header or 'reference' in clean_header:
            return 'ReferenceID'
    
    return best_match

def detect_field_type(text: str) -> List[str]:
    """
    Detect what type of fields a text string might contain.
    
    Args:
        text: Text to analyze
        
    Returns:
        List of field types detected in the text
    """
    detected_types = []
    
    if DATE_REGEX.search(text):
        detected_types.append("Date")
    
    if NUMBER_REGEX.search(text):
        detected_types.append("Number")
    
    if CURRENCY_REGEX.search(text):
        detected_types.append("Currency")
    
    if NEGATIVE_REGEX.search(text):
        detected_types.append("Negative")
    
    if POSITIVE_REGEX.search(text):
        detected_types.append("Positive")
    
    return detected_types

def normalize_number(num_str) -> Optional[float]:
    """
    Normalize a number string to float, handling international formats.
    
    Args:
        num_str: Number string to normalize (can be string, tuple, or other)
        
    Returns:
        Normalized float value or None if invalid
    """
    if not num_str:
        return None
    
    # Handle various input types (string, tuple, etc.)
    if isinstance(num_str, tuple):
        # Join non-empty parts of tuple
        num_str = ''.join(str(part) for part in num_str if part)
    elif not isinstance(num_str, str):
        num_str = str(num_str)
    
    if not num_str.strip():
        return None
    
    # Remove currency symbols and extra spaces
    clean_num = re.sub(r'[€£¥₹$¢₨₽₩₪₦₴₵₡₲₸₺₼₻]', '', num_str.strip())
    clean_num = re.sub(r'\s+', '', clean_num)
    
    # Handle negative indicators
    is_negative = bool(NEGATIVE_REGEX.search(num_str))
    clean_num = re.sub(r'[()+-]', '', clean_num)
    
    try:
        # Handle different decimal separators
        if clean_num.count(',') and clean_num.count('.'):
            # Both comma and dot present - determine which is decimal separator
            if clean_num.rfind(',') > clean_num.rfind('.'):
                # Comma is decimal separator (European format)
                clean_num = clean_num.replace('.', '').replace(',', '.')
            else:
                # Dot is decimal separator (US format)
                clean_num = clean_num.replace(',', '')
        elif clean_num.count(',') == 1 and '.' not in clean_num:
            # Only comma present - could be decimal separator
            parts = clean_num.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                # Likely decimal separator
                clean_num = clean_num.replace(',', '.')
            else:
                # Likely thousands separator
                clean_num = clean_num.replace(',', '')
        else:
            # Standard format or only thousands separators
            clean_num = clean_num.replace(',', '')
        
        result = float(clean_num)
        return -result if is_negative else result
    
    except (ValueError, TypeError):
        return None

def extract_date(text: str) -> Optional[str]:
    """
    Extract the first date found in text.
    
    Args:
        text: Text to search for dates
        
    Returns:
        First date found or None
    """
    match = DATE_REGEX.search(text)
    return match.group().strip() if match else None

def extract_currency(text: str) -> Optional[str]:
    """
    Extract currency symbol or code from text.
    
    Args:
        text: Text to search for currency
        
    Returns:
        Currency symbol/code or None
    """
    match = CURRENCY_REGEX.search(text)
    return match.group().strip() if match else None 