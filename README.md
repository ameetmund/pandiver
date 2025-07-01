# PDF Text Extraction & Table Builder

A full-stack application that allows users to upload PDF files, extract text blocks with coordinates, interactively select and drag text to build tables, and export the data to XLSX/CSV formats.

## Features

### Frontend (Next.js + React)
- **PDF Viewer**: Interactive PDF rendering with PDF.js
- **Text Block Selection**: Click on text blocks in the PDF to select them
- **Drag & Drop Interface**: Drag selected text blocks into table cells using react-dnd
- **Editable Table**: Dynamic table with add/remove rows/columns functionality
- **Export Functionality**: Export table data to XLSX/CSV using SheetJS
- **Responsive Design**: Modern UI with Tailwind CSS

### Backend (FastAPI + Python)
- **PDF Processing**: Extract text blocks with coordinates using pdfplumber
- **File Upload**: Accept PDF files and return structured text data
- **Data Export**: Server-side XLSX/CSV export functionality
- **CORS Support**: Configured for frontend integration

## Technology Stack

### Frontend
- **Next.js**: 14.2.5
- **React**: 18.2.0
- **TypeScript**: Latest
- **Tailwind CSS**: 3.4.1
- **PDF.js**: 4.1.392
- **react-dnd**: 16.0.1
- **SheetJS**: Latest

### Backend
- **FastAPI**: 0.110.1
- **pdfplumber**: 0.10.2
- **PyMuPDF**: 1.24.2
- **pandas**: 2.2.2
- **openpyxl**: 3.1.2
- **uvicorn**: Latest

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- npm or yarn package manager

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd pdf-extraction-app/backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI server:
   ```bash
   python main.py
   ```
   Or using uvicorn directly:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

The backend API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd pdf-extraction-app/frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

The frontend application will be available at `http://localhost:3000`

## Usage Instructions

1. **Upload PDF**: Click the file input to select and upload a PDF file
2. **View PDF**: The PDF will be rendered with an interactive viewer
3. **Select Text Blocks**: Click on text blocks in the PDF to select them (they'll be highlighted)
4. **Drag & Drop**: Selected blocks appear as draggable chips - drag them into table cells
5. **Edit Table**: 
   - Add/remove rows and columns using the control buttons
   - Type directly in cells or drop text blocks
   - Clear the entire table if needed
6. **Export Data**: Use the export buttons to save your table as XLSX or CSV

## API Endpoints

### Backend (FastAPI)

- `GET /` - Health check endpoint
- `POST /upload-pdf/` - Upload PDF and extract text blocks
  - **Input**: PDF file (multipart/form-data)
  - **Output**: Array of text blocks with coordinates
- `POST /export-data/` - Export table data to file
  - **Input**: JSON with data array, filename, and format
  - **Output**: File download (XLSX/CSV)

### Example API Usage

```javascript
// Upload PDF
const formData = new FormData();
formData.append('file', pdfFile);

const response = await fetch('http://localhost:8000/upload-pdf/', {
  method: 'POST',
  body: formData,
});

const textBlocks = await response.json();

// Export data
const exportResponse = await fetch('http://localhost:8000/export-data/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: [['cell1', 'cell2'], ['cell3', 'cell4']],
    filename: 'my-data',
    format: 'xlsx'
  }),
});
```

## Project Structure

```
pdf-extraction-app/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   └── venv/                   # Virtual environment
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx        # Main application page
│   │   ├── components/
│   │   │   ├── PDFViewer.tsx   # PDF rendering component
│   │   │   ├── DraggableTextBlock.tsx  # Drag source component
│   │   │   ├── EditableTable.tsx       # Drop target table
│   │   │   └── ExportButton.tsx        # Export functionality
│   │   └── hooks/
│   │       └── useTextBlocks.ts        # State management hook
│   ├── package.json            # Node.js dependencies
│   └── tailwind.config.js      # Tailwind configuration
└── README.md                   # This file
```

## Features in Detail

### PDF Text Extraction
- Extracts text blocks with precise coordinates using pdfplumber
- Maintains page information for each text block
- Returns structured JSON with bounding box positions

### Interactive PDF Viewer
- Renders PDF pages using PDF.js
- Overlays clickable regions on text blocks
- Supports zoom and page navigation
- Highlights selected text blocks

### Drag & Drop System
- Uses react-dnd for smooth drag-and-drop interactions
- Visual feedback during drag operations
- Support for multiple text blocks selection

### Dynamic Table
- Dynamically add/remove rows and columns
- Direct cell editing with textarea inputs
- Visual indicators for dropped content
- Maintains original PDF page references

### Export Options
- Client-side export using SheetJS
- Server-side export via FastAPI
- Support for both XLSX and CSV formats
- Automatic filename generation

## Troubleshooting

### Common Issues

1. **PDF.js Worker Error**
   - Ensure the PDF.js worker URL is accessible
   - Check browser console for network errors

2. **CORS Issues**
   - Verify backend CORS configuration
   - Ensure frontend URL is in allowed origins

3. **File Upload Errors**
   - Check file size limits
   - Ensure PDF file is valid and not corrupted

4. **Export Failures**
   - Verify table has data before exporting
   - Check browser console for errors

### Development

To modify or extend the application:

1. **Adding New PDF Processing Features**
   - Modify the `upload_pdf` endpoint in `main.py`
   - Update the `TextBlock` interface in TypeScript

2. **Enhancing the Table**
   - Extend the `EditableTable` component
   - Add new export formats in `ExportButton`

3. **Improving UI/UX**
   - Modify Tailwind CSS classes
   - Add new interactive features

## License

This project is open source and available under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please create an issue in the project repository. 