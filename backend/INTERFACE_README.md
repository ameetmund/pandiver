# Banking Statement Transaction Extractor Interface

A comprehensive web-based interface for extracting, viewing, adjusting, and exporting transaction data from banking PDF statements.

## Features

### 🔍 Smart Transaction Extraction
- **Automatic Detection**: Detects transaction tables across different banking formats
- **International Support**: Works with banks from US, UK, Australia, India, and more
- **Multi-format Support**: Handles tabular, text-based, sectioned, and list formats
- **Multi-page Processing**: Extracts transactions from all pages automatically

### 📊 Interactive Data Viewing
- **Structured Display**: View extracted transactions in clean, organized tables
- **Advanced Filtering**: Filter by pages, search across all fields
- **Raw Data Inspector**: Examine individual transaction details
- **Field Validation**: Check data completeness and quality

### ⚙️ Pattern Adjustment
- **Header Customization**: Modify column headers to match your needs
- **Pattern Rules**: Adjust detection patterns for better accuracy
- **Real-time Preview**: See changes immediately
- **Custom Patterns**: Save successful patterns for reuse

### 📈 Analytics & Insights
- **Transaction Statistics**: View counts, distributions, and summaries
- **Page Analysis**: See transaction distribution across pages
- **Field Completeness**: Analyze data quality metrics
- **Visual Charts**: Interactive graphs using Plotly

### 💾 Export & Save
- **Multiple Formats**: Export to CSV, JSON, Excel
- **Metadata Inclusion**: Include extraction details in exports
- **Session Management**: Save extraction sessions for later review
- **Pattern Storage**: Save custom patterns for different banks

## Quick Start

### Prerequisites

```bash
pip install streamlit plotly pandas pdfplumber openpyxl
```

### Running the Interface

#### Option 1: Using the Launcher Script
```bash
cd backend
python run_interface.py
```

#### Option 2: Direct Streamlit Command
```bash
cd backend
streamlit run transaction_display_interface.py
```

The interface will open in your web browser at `http://localhost:8501`

## Usage Guide

### 1. Upload or Select PDF
- **Upload**: Use the file uploader in the sidebar to upload your bank statement PDF
- **Sample Files**: Select from pre-loaded sample statements

### 2. Configure Settings
- **Detection Threshold**: Adjust confidence threshold for page detection
- **Page Limit**: Set maximum number of pages to process
- **Saved Patterns**: Load previously saved extraction patterns

### 3. Extract Data
1. Click **"Extract Transactions"** in the "Extract Data" tab
2. Wait for the analysis and extraction to complete
3. Review the extraction summary and detected patterns

### 4. View Results
- Navigate to the **"View Results"** tab
- Filter transactions by page or search terms
- Examine individual transaction details
- Check data quality and completeness

### 5. Adjust Patterns (Optional)
- Go to the **"Adjust Patterns"** tab
- Modify column headers if needed
- Change pattern settings for better extraction
- Save successful patterns for reuse

### 6. Analyze Data
- Use the **"Analytics"** tab for insights
- View transaction distribution charts
- Check field completeness statistics
- Identify data quality issues

### 7. Export Results
- Visit the **"Export & Save"** tab
- Choose your preferred export format (CSV, JSON, Excel)
- Include metadata if needed
- Save extraction sessions for future reference

## Supported Bank Formats

### ✅ Tested Banks
- **Indian Banks**: HDFC, ICICI, IDBI, IDFC, PNB, SBI, Axis, Bank of Baroda
- **US Banks**: Bank of America, Wells Fargo, Chase, Capital One, TD Bank, Truist, US Bank, PNC
- **UK Banks**: Natwest, Barclays, Lloyds
- **Australian Banks**: ANZ, Commonwealth, NAB, Westpac

### 📋 Format Types
- **Tabular**: Traditional table-based statements with clear columns
- **Text-based**: Text-aligned transaction lists with consistent spacing
- **Sectioned**: US-style statements with categorized sections
- **List Format**: Simple transaction lists with minimal structure

## Technical Architecture

### Core Components
1. **EnhancedTransactionDetector**: Advanced PDF analysis and pattern detection
2. **PatternRuleApplicator**: Complete extraction workflow management
3. **TransactionDisplayInterface**: Streamlit-based web interface
4. **EnhancedPatternRuleManager**: Pattern storage and retrieval system

### Key Algorithms
- **Multi-method Detection**: Combines table, text, sectioned, and list format analysis
- **Confidence Scoring**: Weighted scoring system for reliable detection
- **Pattern Rule Generation**: Automatic creation of extraction rules from detected structure
- **Cross-page Consolidation**: Intelligent merging of multi-page transaction data

## Configuration

### Detection Settings
- **Confidence Threshold**: Default 0.4 (adjustable 0.1-1.0)
- **Page Processing**: Default 50 pages maximum
- **Font Size Range**: 8.0-14.0pt for text detection
- **Row Gap Tolerance**: 10.0px for text-based formats

### Export Options
- **CSV**: Plain comma-separated values
- **JSON**: Structured data with metadata
- **Excel**: Formatted spreadsheets with multiple sheets

## Troubleshooting

### Common Issues

#### 1. No Transactions Detected
- **Check PDF Quality**: Ensure the PDF contains readable text
- **Lower Threshold**: Reduce confidence threshold in settings
- **Try Manual Mode**: Use pattern adjustment for difficult formats

#### 2. Incomplete Data Extraction
- **Adjust Headers**: Modify column headers in the adjustment tab
- **Check Pattern Rules**: Review and adjust pattern settings
- **Multi-page Issues**: Verify all pages are being processed

#### 3. Performance Issues
- **Reduce Page Limit**: Process fewer pages at once
- **Close Other Tabs**: Free up browser memory
- **Restart Interface**: Close and reopen Streamlit

### Error Messages

- **"No transaction pages found"**: The PDF doesn't contain recognizable transaction data
- **"Pattern generation failed"**: Unable to create extraction rules from detected structure
- **"Extraction timeout"**: Large PDFs may take longer - try reducing page limit

## Advanced Features

### Custom Pattern Rules
Create and save custom extraction patterns:

```python
# Example pattern rule structure
{
    "column_count": 4,
    "header_keywords": ["Date", "Description", "Amount", "Balance"],
    "layout_mode": "text-aligned",
    "format_type": "text_based",
    "bank_name": "Custom Bank"
}
```

### API Integration
The interface works with FastAPI endpoints:
- `/detect-transaction-pages`: Page detection
- `/extract-complete-transactions`: Full extraction workflow
- `/saved-patterns`: Pattern management
- `/extraction-statistics`: Analytics generation

### Session Management
Extraction sessions are automatically saved with:
- Transaction data
- Pattern rules used
- Extraction metadata
- Quality metrics

## Contributing

### Adding New Bank Support
1. Add bank-specific keywords to `BANKING_KEYWORDS`
2. Create detection patterns in `DATE_PATTERNS` and `AMOUNT_PATTERNS`
3. Test with sample statements
4. Update documentation

### Extending Export Formats
1. Add new format to export options
2. Implement format-specific generation logic
3. Update MIME types and file extensions
4. Test with various data sizes

## License

This interface is part of the Pandiver Banking Statement Parser project. See the main project license for details.

## Support

For issues, questions, or feature requests:
1. Check this README for common solutions
2. Review the troubleshooting section
3. Create an issue in the project repository
4. Include sample files and error messages when reporting bugs