"""
Export utilities for bank statement data.
Converts parsed transaction data to Excel (.xlsx) and CSV formats.
"""

import pandas as pd
import xlsxwriter
from typing import List, Dict, Any, Optional
from datetime import datetime
import io
import os
from pathlib import Path

class StatementExporter:
    """Handles exporting parsed bank statement data to various formats."""
    
    def __init__(self):
        self.required_columns = ['Date', 'Description', 'Debit', 'Credit', 'Balance']
    
    def prepare_dataframe(self, transactions: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Convert transaction list to properly formatted pandas DataFrame.
        Handles bank-specific field names and maps them to standard format.
        
        Args:
            transactions: List of transaction dictionaries
            
        Returns:
            Formatted pandas DataFrame
        """
        if not transactions:
            # Return empty DataFrame with required columns
            return pd.DataFrame(columns=self.required_columns)
        
        # Convert to DataFrame
        df = pd.DataFrame(transactions)
        
        # Map bank-specific field names to standard format
        df = self._normalize_field_names(df)
        
        # Ensure all required columns exist
        for col in self.required_columns:
            if col not in df.columns:
                df[col] = ''
        
        # Reorder columns to standard format
        df = df[self.required_columns]
        
        # Clean and format data
        df = self._clean_dataframe(df)
        
        return df
    
    def _normalize_field_names(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map bank-specific field names to standard format."""
        
        # Define field mapping for different banks
        field_mappings = {
            # HDFC Bank mappings
            'Narration': 'Description',
            'Chq_Ref_No': 'ReferenceID', 
            'Value_Date': 'ValueDate',
            'Withdrawal_Amount': 'Debit',
            'Deposit_Amount': 'Credit', 
            'Closing_Balance': 'Balance',
            
            # IDFC Bank mappings
            'Date_and_Time': 'Date',
            'Transaction_Details': 'Description',
            'Ref_Cheque_No': 'ReferenceID',
            'Withdrawals_INR': 'Debit',
            'Deposits_INR': 'Credit',
            'Balance_INR': 'Balance',
            
            # ICICI Bank mappings
            'Mode': 'TransactionMode',
            'Particulars': 'Description',
            'Deposits': 'Credit',
            'Withdrawals': 'Debit',
            
            # Generic mappings
            'Amount': 'Credit',  # Default amount to credit
            'Description': 'Description',  # Keep as is
        }
        
        # Apply mappings
        df = df.rename(columns=field_mappings)
        
        # Handle numeric conversions for amounts
        for col in ['Debit', 'Credit', 'Balance']:
            if col in df.columns:
                df[col] = df[col].apply(self._convert_to_float)
        
        return df
    
    def _convert_to_float(self, value) -> float:
        """Convert various formats to float."""
        if pd.isna(value) or value == '' or value is None:
            return 0.0
        
        if isinstance(value, (int, float)):
            return float(value)
        
        # Handle string values
        if isinstance(value, str):
            # Remove common currency indicators and commas
            clean_value = value.replace(',', '').replace('CR', '').replace('DR', '').strip()
            
            # Try to extract number
            import re
            number_match = re.search(r'[\d.]+', clean_value)
            if number_match:
                try:
                    return float(number_match.group())
                except ValueError:
                    return 0.0
        
        return 0.0
    
    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and format DataFrame data."""
        
        # Convert Date column to datetime if possible
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'], errors='coerce', dayfirst=True)
        
        # Convert numeric columns
        for col in ['Debit', 'Credit', 'Balance']:
            if col in df.columns:
                numeric_series = pd.to_numeric(df[col], errors='coerce')
                df[col] = numeric_series.fillna(0)
        
        # Clean Description
        if 'Description' in df.columns:
            df['Description'] = df['Description'].astype(str).str.strip()
        
        # Sort by date
        if 'Date' in df.columns:
            df = df.sort_values('Date', na_position='last')
        
        # Reset index
        df = df.reset_index(drop=True)
        
        return df
    
    def to_excel(self, transactions: List[Dict[str, Any]], 
                 output_path: Optional[str] = None,
                 bank_name: str = "Bank",
                 statement_period: str = "") -> bytes:
        """
        Export transactions to Excel format with formatting.
        
        Args:
            transactions: List of transaction dictionaries
            output_path: Optional file path to save to
            bank_name: Name of the bank for the header
            statement_period: Statement period string
            
        Returns:
            Excel file as bytes
        """
        df = self.prepare_dataframe(transactions)
        
        # Create Excel file in memory
        output = io.BytesIO()
        
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            workbook = writer.book
            
            # Define formats
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#4CAF50',
                'font_color': 'white',
                'border': 1,
                'align': 'center'
            })
            
            title_format = workbook.add_format({
                'bold': True,
                'font_size': 16,
                'align': 'center'
            })
            
            date_format = workbook.add_format({
                'num_format': 'dd/mm/yyyy',
                'border': 1
            })
            
            currency_format = workbook.add_format({
                'num_format': '#,##0.00',
                'border': 1
            })
            
            text_format = workbook.add_format({
                'border': 1,
                'text_wrap': True
            })
            
            # Write to worksheet
            worksheet = workbook.add_worksheet('Bank Statement')
            
            # Add title
            title = f"{bank_name} Bank Statement"
            if statement_period:
                title += f" - {statement_period}"
            worksheet.merge_range(0, 0, 0, len(self.required_columns) - 1, title, title_format)
            
            # Add export info
            export_info = f"Exported on: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
            worksheet.merge_range(1, 0, 1, len(self.required_columns) - 1, export_info)
            
            # Add headers
            for col_idx, column in enumerate(self.required_columns):
                worksheet.write(3, col_idx, column, header_format)
            
            # Add data
            for row_idx, (_, row) in enumerate(df.iterrows(), start=4):
                worksheet.write(row_idx, 0, row['Date'], date_format)
                worksheet.write(row_idx, 1, row['Description'], text_format)
                worksheet.write(row_idx, 2, row['Debit'], currency_format)
                worksheet.write(row_idx, 3, row['Credit'], currency_format)
                worksheet.write(row_idx, 4, row['Balance'], currency_format)
            
            # Auto-adjust column widths
            worksheet.set_column(0, 0, 12)  # Date
            worksheet.set_column(1, 1, 40)  # Description
            worksheet.set_column(2, 2, 12)  # Debit
            worksheet.set_column(3, 3, 12)  # Credit
            worksheet.set_column(4, 4, 15)  # Balance
            
            # Add summary row if there are transactions
            if len(df) > 0:
                summary_row = len(df) + 5
                worksheet.write(summary_row, 0, "Summary:", header_format)
                worksheet.write(summary_row, 1, f"Total Transactions: {len(df)}", text_format)
                
                total_debit = df['Debit'].sum()
                total_credit = df['Credit'].sum()
                worksheet.write(summary_row, 2, total_debit, currency_format)
                worksheet.write(summary_row, 3, total_credit, currency_format)
        
        # Get the Excel data
        excel_data = output.getvalue()
        
        # Save to file if path provided
        if output_path:
            with open(output_path, 'wb') as f:
                f.write(excel_data)
        
        return excel_data
    
    def to_csv(self, transactions: List[Dict[str, Any]], 
               output_path: Optional[str] = None) -> str:
        """
        Export transactions to CSV format.
        
        Args:
            transactions: List of transaction dictionaries
            output_path: Optional file path to save to
            
        Returns:
            CSV data as string
        """
        df = self.prepare_dataframe(transactions)
        
        # Convert DataFrame to CSV
        csv_data = df.to_csv(index=False, date_format='%d/%m/%Y')
        
        # Save to file if path provided
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(csv_data)
        
        return csv_data
    
    def get_export_filename(self, bank_name: str, format_type: str, 
                           statement_period: str = "") -> str:
        """
        Generate a standardized filename for exports.
        
        Args:
            bank_name: Name of the bank
            format_type: 'xlsx' or 'csv'
            statement_period: Optional period string
            
        Returns:
            Formatted filename
        """
        # Clean bank name
        clean_bank = bank_name.replace(" ", "_").replace("/", "_")
        
        # Add timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Build filename
        if statement_period:
            clean_period = statement_period.replace(" ", "_").replace("/", "_")
            filename = f"{clean_bank}_Statement_{clean_period}_{timestamp}.{format_type}"
        else:
            filename = f"{clean_bank}_Statement_{timestamp}.{format_type}"
        
        return filename

# Create a global instance for easy import
exporter = StatementExporter() 