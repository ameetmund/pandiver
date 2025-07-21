'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';

// Export as dynamic component to avoid SSR issues with DOMMatrix
import dynamic from 'next/dynamic';

function BankStatementParser() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Rectangle selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [selectedRect, setSelectedRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  // Update extractedTableData type to include page_summaries and text_fallback
  const [extractedTableData, setExtractedTableData] = useState<{
    headers?: string[];
    data?: string[][];
    page_summaries?: Array<{ page: number; type: string; rows?: number; length?: number }>;
    text_fallback?: Array<{ page: number; text: string }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [multiPageMode, setMultiPageMode] = useState(false);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  
  // Column-based extraction state
  const [columns, setColumns] = useState<Array<{id: string, name: string, x0: number, x1: number, color: string}>>([]);
  const [isColumnMode, setIsColumnMode] = useState(false);
  const [hoveredTextSpan, setHoveredTextSpan] = useState<{x: number, y: number, width: number, height: number, text: string} | null>(null);
  
  // Smart Bank Statement Mode
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [smartExtractionResult, setSmartExtractionResult] = useState<{transactions: any[], summary: any} | null>(null);

  // Table state
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [tableRows, setTableRows] = useState<string[][]>([]);

  // Export and persistence state
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedTables, setSavedTables] = useState<any[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Add missing state variables and fix linter errors
  const [numPages, setNumPages] = useState<number>(0);
  const [textSpans, setTextSpans] = useState<Array<{text: string, x0: number, y0: number, x1: number, y1: number, width: number, height: number}>>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageScale, setPageScale] = useState<number>(1.0);
  const [pageDims, setPageDims] = useState<{width: number, height: number} | null>(null);

  // Add state for column mode page range
  const [columnStartPage, setColumnStartPage] = useState(1);
  const [columnEndPage, setColumnEndPage] = useState(1);

  // Add state for PDF-faithful tables
  const [faithfulTables, setFaithfulTables] = useState<Array<{headers: string[], rows: string[][]}>>([]);
  const [isFaithfulMode, setIsFaithfulMode] = useState(false);

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        window.location.href = '/auth/login';
        return;
      }
      try {
        const response = await fetch('http://localhost:8000/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Auth failed');
        const user = await response.json();
        setIsAuthenticated(true);
        setUserName(user.name || 'User');
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/auth/login';
      }
    };
    checkAuth();
  }, []);

  // Handle PDF upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    setPdfFile(file);
    setPdfUrl(URL.createObjectURL(file));
    setError('');
  };

  // Update onPageLoadSuccess to set pageDims only if not already set (to avoid flicker)
  const onPageLoadSuccess = (page: any) => {
    if (!pageDims) {
      setPageDims({ width: page.originalWidth, height: page.originalHeight });
    }
  };

  // Rectangle selection handlers (updated for react-pdf)
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageScale;
    const y = (e.clientY - rect.top) / pageScale;
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
    setSelectedRect(null);
    setExtractedText(null);
    setShowPreview(false);
  };
  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageScale;
    const y = (e.clientY - rect.top) / pageScale;
    setSelectionEnd({ x, y });
  };
  const handleOverlayMouseUp = async () => {
    // Always log selection state at the start
    console.log('[Extract] START', {
      isSelecting,
      selectionStart,
      selectionEnd,
      pageDims,
      currentPage,
      pageScale
    });
    if (!isSelecting || !selectionStart || !selectionEnd || !pageDims) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setSelectedRect(null);
      setExtractedText(null);
      setShowPreview(false);
      setError('Selection was not completed. Please try again.');
      return;
    }
    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    // Prevent zero-area or too-small selections
    if (width < 10 || height < 10) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setSelectedRect(null);
      setExtractedText(null);
      setShowPreview(false);
      setError('Selection area is too small. Please select a larger region.');
      // Log invalid selection
      console.log('[Extract] INVALID selection', { minX, minY, width, height });
      return;
    }
    setSelectedRect({ x: minX, y: minY, width, height });
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsLoading(true);
    setError('');
    // pdfplumber uses top-left coordinate system (like browser), so NO coordinate conversion needed
    const pdfY = minY;
    // Log before fetch with direct coordinates
    console.log('[Extract] FETCH', {
      page: currentPage - 1,
      x: minX,
      y: pdfY,
      width,
      height,
      pageDims,
      scale: pageScale
    });
    try {
      const formData = new FormData();
      if (!pdfFile) return;
      formData.append('file', pdfFile);
      formData.append('page', (currentPage - 1).toString());
      formData.append('x', minX.toString());
      formData.append('y', pdfY.toString());
      formData.append('width', width.toString());
      formData.append('height', height.toString());
      
      // Debug: Log what we're sending
      console.log('[Extract] Sending to backend:', {
        page: currentPage - 1,
        x: minX,
        y: pdfY,
        width: width,
        height: height
      });
      const response = await fetch('http://localhost:8000/extract-text-region', {
        method: 'POST',
        body: formData,
      });
      // Log response status
      console.log('[Extract] RESPONSE', response.status, response.statusText);
      if (!response.ok) {
        let errorText = '';
        try {
          const data = await response.json();
          errorText = data.detail || JSON.stringify(data);
        } catch (e) {
          errorText = await response.text();
        }
        setError(`Failed to extract text: ${errorText}`);
        setIsLoading(false);
        setSelectedRect(null);
        setExtractedText(null);
        setShowPreview(false);
        // Log error
        console.log('[Extract] ERROR', errorText);
        return;
      }
      const data = await response.json();
      
      // Handle both structured table data and plain text
      if (Array.isArray(data.text) && data.text.length > 0) {
        // Structured table data
        setExtractedTableData({
          headers: data.text[0] || [],
          data: data.text.slice(1) || []
        });
        setExtractedText(null);
        console.log('[Extract] SUCCESS - Table data:', data.text.length, 'rows');
      } else if (data.text && typeof data.text === 'string' && data.text.trim()) {
        // Plain text
        setExtractedText(data.text);
        setExtractedTableData(null);
        console.log('[Extract] SUCCESS - Text:', data.text.substring(0, 100) + '...');
      } else {
        setError('No text found in the selected region. Try a different area.');
        setIsLoading(false);
        setSelectedRect(null);
        setExtractedText(null);
        setExtractedTableData(null);
        setShowPreview(false);
        console.log('[Extract] NO TEXT', data);
        return;
      }
      
      setShowPreview(true);
    } catch (err) {
      setError('Failed to extract text from selection.');
      setSelectedRect(null);
      setExtractedText(null);
      setShowPreview(false);
      // Log catch error
      console.log('[Extract] CATCH ERROR', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch text spans for column-based selection
  const fetchTextSpans = async (pageNum: number) => {
    if (!pdfFile) return;
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('page', (pageNum - 1).toString());
      
      console.log('[TextSpans] Fetching for page', pageNum);
      
      const response = await fetch('http://localhost:8000/get-text-spans', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TextSpans] Failed to fetch:', response.status, errorText);
        return;
      }
      
      const data = await response.json();
      console.log('[TextSpans] Raw response:', data);
      
      if (data.words && Array.isArray(data.words)) {
        setTextSpans(data.words);
        console.log('[TextSpans] Loaded', data.words.length, 'words for page', pageNum);
        console.log('[TextSpans] Sample words:', data.words.slice(0, 5));
      } else {
        console.error('[TextSpans] Invalid response format:', data);
        setTextSpans([]);
      }
    } catch (err) {
      console.error('[TextSpans] Error:', err);
      setTextSpans([]);
    }
  };

  // Handle text span click for column creation
  const handleTextSpanClick = (e: React.MouseEvent, span: {text: string, x0: number, y0: number, x1: number, y1: number}) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isColumnMode) return;
    
    console.log('[Column] Clicked span:', span);
    
    // Check if column already exists for this text
    const existingColumn = columns.find(col => col.name === span.text);
    if (existingColumn) {
      console.log('[Column] Column already exists for:', span.text);
      return;
    }
    
    // Smart column boundary detection
    const columnPadding = 10; // pixels
    const detectedX0 = Math.max(0, span.x0 - columnPadding);
    const detectedX1 = span.x1 + columnPadding;
    
    // Generate unique color for this column
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'];
    const newColumn = {
      id: Date.now().toString(),
      name: span.text,
      x0: detectedX0,
      x1: detectedX1,
      color: colors[columns.length % colors.length]
    };
    
    setColumns(prev => [...prev, newColumn]);
    console.log('[Column] Added:', newColumn);
  };

  // Remove column
  const removeColumn = (columnId: string) => {
    setColumns(prev => prev.filter(col => col.id !== columnId));
  };

  // Update column boundaries
  const updateColumnBoundary = (columnId: string, boundary: 'x0' | 'x1', delta: number) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId 
        ? { ...col, [boundary]: col[boundary] + delta }
        : col
    ));
  };

  // Smart Bank Statement extraction function
  const handleSmartExtraction = async () => {
    if (!pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      console.log('[Smart Extract] Starting smart extraction...');
      
      const response = await fetch('http://localhost:8000/intelligent-bank-extract', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(`Smart extraction failed: ${errorData.detail}`);
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('[Smart Extract V2025.07.21.01] Success:', data);
      
      if (data.success && data.transactions && data.transactions.length > 0) {
        // Set the smart extraction result
        setSmartExtractionResult(data);
        
        // Use the headers provided by the intelligent parser (preserves original PDF headers)
        const headers = data.headers || Object.keys(data.transactions[0]).filter(key => !key.startsWith('_'));
        
        // Create rows using the actual transaction data (skip metadata fields)
        const rows = data.transactions.map((txn: any) => 
          headers.map((header: string) => txn[header]?.toString() || '')
        );
        
        setTableHeaders(headers);
        setTableRows(rows);
        
        console.log(`[Smart Extract V2025.07.21.01] Successfully extracted ${data.total_transactions} transactions from ${data.total_pages} pages`);
        console.log(`[Smart Extract V2025.07.21.01] Original headers preserved: ${headers.join(', ')}`);
      } else {
        setError(data.error || 'No transactions found in the bank statement. Please try manual mode.');
      }
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to process bank statement. Please try manual mode.');
      setIsLoading(false);
      console.error('[Smart Extract] Error:', err);
    }
  };

  // Multi-page extraction function
  const handleMultiPageExtraction = async () => {
    if (!selectedRect || !pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('start_page', (startPage - 1).toString());
      formData.append('end_page', (endPage - 1).toString());
      formData.append('x', selectedRect.x.toString());
      formData.append('y', selectedRect.y.toString());
      formData.append('width', selectedRect.width.toString());
      formData.append('height', selectedRect.height.toString());
      
      console.log('[Multi-page] Extracting pages', startPage, 'to', endPage);
      
      const response = await fetch('http://localhost:8000/extract-multi-page-table', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(`Failed to extract multi-page table: ${errorData.detail}`);
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.headers && data.data) {
        setExtractedTableData({
          headers: data.headers,
          data: data.data
        });
        setExtractedText(null);
        console.log('[Multi-page] SUCCESS:', data.total_rows, 'rows from', data.pages_processed.length, 'pages');
      } else {
        setError('No table data found in the selected region across pages.');
      }
      
      setShowPreview(true);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to extract multi-page table.');
      setIsLoading(false);
      console.error('[Multi-page] ERROR:', err);
    }
  };

  // Add extracted column to table
  const handleAddToTable = () => {
    // Handle structured table data
    if (extractedTableData && extractedTableData.headers) {
      if (tableHeaders.length === 0) {
        // Create new table with all headers and data
        setTableHeaders(extractedTableData.headers);
        setTableRows(extractedTableData.data || []);
      } else {
        // Merge with existing table (add new columns)
        const newHeaders = [...tableHeaders, ...extractedTableData.headers];
        const newRows = tableRows.map((row, index) => {
          const newRowData = extractedTableData.data?.[index] || [];
          return [...row, ...newRowData];
        });
        setTableHeaders(newHeaders);
        setTableRows(newRows);
      }
    }
    // Handle plain text data
    else if (extractedText) {
      const lines = extractedText.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length === 0) return;
      const header = lines[0];
      const dataRows = lines.slice(1);
      // If table is empty, create new table
      if (tableHeaders.length === 0) {
        setTableHeaders([header]);
        setTableRows(dataRows.map(val => [val]));
      } else {
        // Add as new column, align rows
        const newHeaders = [...tableHeaders, header];
        const maxRows = Math.max(tableRows.length, dataRows.length);
        const newRows: string[][] = [];
        for (let i = 0; i < maxRows; i++) {
          const row = [...(tableRows[i] || Array(tableHeaders.length).fill(''))];
          row.push(dataRows[i] || '');
          newRows.push(row);
        }
        setTableHeaders(newHeaders);
        setTableRows(newRows);
      }
    }
    setShowPreview(false);
    setExtractedText(null);
    setExtractedTableData(null);
    setSelectedRect(null);
  };

  // Table editing: add/remove rows/columns
  const handleAddRow = () => {
    setTableRows([...tableRows, Array(tableHeaders.length).fill('')]);
  };
  const handleRemoveRow = (rowIdx: number) => {
    setTableRows(tableRows.filter((_, idx) => idx !== rowIdx));
  };
  const handleRemoveCol = (colIdx: number) => {
    setTableHeaders(tableHeaders.filter((_, idx) => idx !== colIdx));
    setTableRows(tableRows.map(row => row.filter((_, idx) => idx !== colIdx)));
  };
  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    setTableRows(tableRows.map((row, r) => r === rowIdx ? row.map((cell, c) => c === colIdx ? value : cell) : row));
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (tableHeaders.length === 0 && tableRows.length === 0) {
      setError('No data to export');
      return;
    }
    setIsExporting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:8000/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ headers: tableHeaders, rows: tableRows }),
      });
      if (!response.ok) throw new Error('Failed to export to Excel');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bank-statement-data.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export to Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV (client-side)
  const handleExportCSV = () => {
    if (tableHeaders.length === 0 && tableRows.length === 0) {
      setError('No data to export');
      return;
    }
    let csvContent = '';
    if (tableHeaders.length > 0) csvContent += tableHeaders.join(',') + '\n';
    tableRows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank-statement-data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Save table to backend
  const handleSaveTable = async () => {
    if (!saveName.trim()) {
      setError('Please enter a table name');
      return;
    }
    setIsSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:8000/save-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: saveName, data: { headers: tableHeaders, rows: tableRows } }),
      });
      if (!response.ok) throw new Error('Failed to save table');
      setShowSaveModal(false);
      setSaveName('');
      await fetchSavedTables();
    } catch (err) {
      setError('Failed to save table');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch saved tables
  const fetchSavedTables = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:8000/get-tables', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch tables');
      const data = await response.json();
      setSavedTables(data);
    } catch (err) {
      setSavedTables([]);
    }
  };
  useEffect(() => { if (isAuthenticated) fetchSavedTables(); }, [isAuthenticated]);

  // Load a saved table
  const handleLoadTable = (table: any) => {
    setTableHeaders(table.data.headers || []);
    setTableRows(table.data.rows || []);
  };

  // Add help text for extraction modes
  const extractionModeHelp: Record<string, string> = {
    Rectangle: 'Select a region on the page. If a table is found, it will be extracted. Otherwise, all text in the region will be shown. Use for both tabular and free-form data.',
    Column: 'Click on column headers to define vertical boundaries. These boundaries will apply across all pages. Use for extracting specific columns from tables.',
    Smart: 'Automatically extract all transactions from your bank statement. Works for both digital and scanned PDFs using AI-powered OCR.'
  };

  // Handle multi-page column extraction
  const handleMultiPageColumnExtraction = async () => {
    if (!pdfFile || columns.length === 0) return;
    setIsLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("start_page", (columnStartPage - 1).toString());
      formData.append("end_page", (columnEndPage - 1).toString());
      // Only send x0, x1, name for each column
      const columnsPayload = columns.map(col => ({ name: col.name, x0: col.x0, x1: col.x1 }));
      formData.append("columns", JSON.stringify(columnsPayload));
      const response = await fetch("http://localhost:8000/extract-multi-page-columns", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(`Failed to extract columns: ${errorData.detail}`);
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      // Set extracted table data
      if (data.columns && Array.isArray(data.columns)) {
        setExtractedTableData({
          headers: data.columns.map((col: any) => col.name),
          data: transpose(data.columns.map((col: any) => col.data)),
          page_summaries: data.page_summaries || []
        });
        setShowPreview(true);
      } else {
        setError("No column data found.");
      }
      setIsLoading(false);
    } catch (err) {
      setError("Failed to extract columns.");
      setIsLoading(false);
    }
  };
  // Helper to transpose array of columns to rows
  function transpose(arrays: string[][]): string[][] {
    if (!arrays.length) return [];
    const maxLen = Math.max(...arrays.map(a => a.length));
    return Array.from({ length: maxLen }, (_, i) => arrays.map(a => a[i] || ""));
  }

  // Handler for PDF-faithful extraction
  const handleFaithfulExtraction = async () => {
    if (!pdfFile) return;
    setIsLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const response = await fetch("http://localhost:8000/extract-pdf-tables-faithful", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(`Failed to extract tables: ${errorData.detail}`);
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      if (data.tables && Array.isArray(data.tables)) {
        setFaithfulTables(data.tables);
        setShowPreview(true);
      } else {
        setError("No tables found in the PDF.");
      }
      setIsLoading(false);
    } catch (err) {
      setError("Failed to extract tables.");
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FFFEFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#00C7BE] mx-auto"></div>
          <p className="mt-4 text-[#0D0D0C]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFEFC] text-[#0D0D0C]">
      {/* Header */}
      <nav className="bg-[#FFFEFC] py-4 px-4 md:px-16 border-b border-gray-200">
        <div className="max-w-[1312px] mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <Image
              src="/images/pandiver-logo.svg"
              alt="PandiVer"
              width={120}
              height={31}
              className="h-8 w-auto"
            />
          </Link>
          <div className="flex items-center space-x-4">
            <span className="text-[#0D0D0C] font-medium">Welcome, {userName}</span>
            <button
              onClick={() => { localStorage.removeItem('accessToken'); window.location.href = '/auth/login'; }}
              className="px-4 py-2 text-[#0D0D0C] font-medium border border-[#086C67] rounded-lg hover:bg-[#086C67] hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-[1312px] mx-auto py-8 px-4 md:px-16">
        <div className="mb-8">
          <h1 className="text-[#0D0D0C] text-[32px] font-bold font-['Urbanist'] mb-4">
            Bank Statement Parser
          </h1>
          <p className="text-[#0D0D0C] text-base font-['Hind'] mb-6">
            Upload your bank statement PDF and extract columns easily.
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-[#0D0D0C] text-xl font-bold font-['Urbanist'] mb-4">
            Upload Bank Statement
          </h2>
          <div className="border-2 border-dashed border-[#00C7BE] rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
              <svg className="w-12 h-12 text-[#00C7BE] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[#0D0D0C] text-lg font-medium">
                Choose PDF file or drag and drop
              </span>
              <span className="text-[#666] text-sm mt-2">
                PDF files only
              </span>
            </label>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* PDF Viewer with navigation and overlay */}
        {pdfFile && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 flex flex-col items-center">
            <div className="flex items-center mb-4 gap-2 flex-wrap">
              {/* Extraction Mode Selection */}
              <div className="flex gap-4 mb-6">
                <button
                  className={`px-4 py-2 rounded-lg font-medium border ${isFaithfulMode ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border-blue-600'}`}
                  onClick={() => { setIsFaithfulMode(true); setIsSmartMode(false); setIsColumnMode(false); }}
                >
                  PDF Table (Original Headers)
                </button>
                <label className="text-sm font-medium text-gray-700">Mode:</label>
                <label className="flex items-center gap-2" title={extractionModeHelp.Rectangle}>
                  <input
                    type="radio"
                    name="extractionMode"
                    checked={!isColumnMode && !isSmartMode}
                    onChange={() => {
                      setIsColumnMode(false);
                      setIsSmartMode(false);
                      setTextSpans([]);
                    }}
                    className="text-[#00C7BE] focus:ring-[#00C7BE]"
                  />
                  <span className="text-sm">Rectangle</span>
                </label>
                <label className="flex items-center gap-2" title={extractionModeHelp.Column}>
                  <input
                    type="radio"
                    name="extractionMode"
                    checked={isColumnMode}
                    onChange={() => {
                      setIsColumnMode(true);
                      setIsSmartMode(false);
                      fetchTextSpans(currentPage);
                    }}
                    className="text-[#00C7BE] focus:ring-[#00C7BE]"
                  />
                  <span className="text-sm">Column</span>
                </label>
                <label className="flex items-center gap-2" title={extractionModeHelp.Smart}>
                  <input
                    type="radio"
                    name="extractionMode"
                    checked={isSmartMode}
                    onChange={() => {
                      setIsSmartMode(true);
                      setIsColumnMode(false);
                      setTextSpans([]);
                    }}
                    className="text-[#00C7BE] focus:ring-[#00C7BE]"
                  />
                  <span className="text-sm font-medium text-blue-600">Smart Bank Statement</span>
                </label>
              </div>
              
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Prev</button>
              <span>Page {currentPage} of {numPages}</span>
              <button onClick={() => {
                const newPage = Math.min(numPages, currentPage + 1);
                setCurrentPage(newPage);
                if (isColumnMode) {
                  fetchTextSpans(newPage);
                }
              }} disabled={currentPage >= numPages} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Next</button>
              <span className="ml-4">Zoom:</span>
              <button onClick={() => setPageScale(s => Math.max(0.5, s - 0.1))} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">-</button>
              <span>{Math.round(pageScale * 100)}%</span>
              <button onClick={() => setPageScale(s => Math.min(2.0, s + 0.1))} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">+</button>
            </div>
            <div style={{ position: 'relative', width: pageDims ? pageDims.width * pageScale : 800, height: pageDims ? pageDims.height * pageScale : 1000 }}>
              <Document
                file={pdfFile}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="text-center">Loading PDF...</div>}
                onLoadError={err => setError('Failed to load PDF file: ' + err.message)}
              >
                <Page
                  pageNumber={currentPage}
                  scale={pageScale}
                  onLoadSuccess={onPageLoadSuccess}
                  width={pageDims ? pageDims.width * pageScale : 800}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </Document>
              {/* Overlay for selection */}
              <div
                ref={overlayRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 10, cursor: isColumnMode ? 'pointer' : 'crosshair' }}
                onMouseDown={!isColumnMode ? handleOverlayMouseDown : undefined}
                onMouseMove={!isColumnMode ? handleOverlayMouseMove : undefined}
                onMouseUp={!isColumnMode ? handleOverlayMouseUp : undefined}
              >
                {/* Column Mode: Text Spans */}
                {isColumnMode && textSpans.map((span, idx) => (
                  <div
                    key={idx}
                    className="absolute border border-blue-300 bg-blue-100 bg-opacity-30 hover:bg-blue-200 hover:bg-opacity-50 cursor-pointer transition-colors"
                    style={{
                      left: span.x0 * pageScale,
                      top: span.y0 * pageScale,
                      width: span.width * pageScale,
                      height: span.height * pageScale,
                    }}
                    onClick={(e) => handleTextSpanClick(e, span)}
                    title={`Click to create column: "${span.text}"`}
                  />
                ))}

                {/* Column Mode: Visual Column Guides */}
                {isColumnMode && columns.map((column) => (
                  <div key={column.id} className="absolute pointer-events-none">
                    {/* Left boundary line */}
                    <div
                      className="absolute border-l-2 opacity-70"
                      style={{
                        borderColor: column.color,
                        left: column.x0 * pageScale,
                        top: 0,
                        height: pageDims ? pageDims.height * pageScale : 1000,
                      }}
                    />
                    {/* Right boundary line */}
                    <div
                      className="absolute border-l-2 opacity-70"
                      style={{
                        borderColor: column.color,
                        left: column.x1 * pageScale,
                        top: 0,
                        height: pageDims ? pageDims.height * pageScale : 1000,
                      }}
                    />
                    {/* Column area highlight */}
                    <div
                      className="absolute opacity-10"
                      style={{
                        backgroundColor: column.color,
                        left: column.x0 * pageScale,
                        top: 0,
                        width: (column.x1 - column.x0) * pageScale,
                        height: pageDims ? pageDims.height * pageScale : 1000,
                      }}
                    />
                  </div>
                ))}

                {/* Rectangle Mode: Selection rectangles */}
                {!isColumnMode && (isSelecting && selectionStart && selectionEnd) && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
                    style={{
                      left: Math.min(selectionStart.x, selectionEnd.x) * pageScale,
                      top: Math.min(selectionStart.y, selectionEnd.y) * pageScale,
                      width: Math.abs(selectionEnd.x - selectionStart.x) * pageScale,
                      height: Math.abs(selectionEnd.y - selectionStart.y) * pageScale,
                    }}
                  />
                )}
                {!isColumnMode && selectedRect && !isSelecting && (
                  <div
                    className="absolute border-2 border-green-500 bg-green-200 bg-opacity-20 pointer-events-none"
                    style={{
                      left: selectedRect.x * pageScale,
                      top: selectedRect.y * pageScale,
                      width: selectedRect.width * pageScale,
                      height: selectedRect.height * pageScale,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Column Management Panel */}
        {isColumnMode && columns.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">Defined Columns ({columns.length})</h3>
            <div className="space-y-3">
              {columns.map((column) => (
                <div key={column.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: column.color }}
                    />
                    <div>
                      <span className="font-medium">{column.name}</span>
                      <div className="text-sm text-gray-500">
                        x: {Math.round(column.x0)} - {Math.round(column.x1)} (width: {Math.round(column.x1 - column.x0)})
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Nudger buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateColumnBoundary(column.id, 'x0', -1)}
                        className="px-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        title="Move left boundary left"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => updateColumnBoundary(column.id, 'x0', 1)}
                        className="px-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        title="Move left boundary right"
                      >
                        →
                      </button>
                      <span className="text-xs text-gray-400 mx-1">|</span>
                      <button
                        onClick={() => updateColumnBoundary(column.id, 'x1', -1)}
                        className="px-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        title="Move right boundary left"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => updateColumnBoundary(column.id, 'x1', 1)}
                        className="px-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        title="Move right boundary right"
                      >
                        →
                      </button>
                    </div>
                    <button
                      onClick={() => removeColumn(column.id)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Page Range:</label>
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={columnStartPage}
                  onChange={e => setColumnStartPage(Number(e.target.value))}
                  className="w-16 border rounded p-1 text-sm"
                />
                <span className="mx-1">to</span>
                <input
                  type="number"
                  min={columnStartPage}
                  max={numPages}
                  value={columnEndPage}
                  onChange={e => setColumnEndPage(Number(e.target.value))}
                  className="w-16 border rounded p-1 text-sm"
                />
              </div>
              <button
                className="px-4 py-2 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] transition-colors"
                onClick={handleMultiPageColumnExtraction}
                disabled={isLoading || columns.length === 0}
              >
                {isLoading ? "Extracting..." : "Extract All Columns from Pages"}
              </button>
            </div>
          </div>
        )}

        {/* Smart Bank Statement Mode Panel */}
        {isSmartMode && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-8 mt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Smart Bank Statement Parser</h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Automatically detects and extracts transactions from bank statements. 
                Works with both digital PDFs and scanned documents using AI-powered OCR.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                 <button
                   onClick={handleSmartExtraction}
                  disabled={isLoading || !pdfFile}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Bank Statement...
                    </>
                  ) : (
                    'Extract All Transactions'
                  )}
                </button>
                
                <div className="text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Auto-detects dates, amounts & descriptions</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Supports both digital & scanned PDFs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Smart Extraction Results */}
        {smartExtractionResult && (
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Smart Extraction Complete!</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{smartExtractionResult.summary.total_transactions}</div>
                <div className="text-sm text-gray-600">Transactions Found</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ₹{smartExtractionResult.summary.total_deposits?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-gray-600">Total Deposits</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  ₹{smartExtractionResult.summary.total_withdrawals?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-gray-600">Total Withdrawals</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  ₹{smartExtractionResult.summary.final_balance?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-gray-600">Final Balance</div>
              </div>
            </div>
            
            {smartExtractionResult.summary.date_range && (
              <div className="text-sm text-gray-600 mb-4">
                <span className="font-medium">Statement Period:</span> {smartExtractionResult.summary.date_range.start} to {smartExtractionResult.summary.date_range.end}
              </div>
            )}
            
            <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              ✅ All transactions have been automatically extracted and added to your table below. You can edit any details if needed.
            </div>
          </div>
        )}

        {/* Multi-page extraction controls */}
        {selectedRect && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={multiPageMode}
                  onChange={(e) => setMultiPageMode(e.target.checked)}
                  className="rounded border-gray-300 text-[#00C7BE] focus:ring-[#00C7BE]"
                />
                <span className="text-sm font-medium">Multi-page extraction</span>
                <span className="ml-2 text-xs text-gray-500" title="Select a region (header + data or just data), then enable multi-page mode and specify the page range. The system will extract tables if found, or fallback to text.">?
                </span>
              </label>
            </div>
            
            {multiPageMode && (
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">From page:</label>
                  <input
                    type="number"
                    min="1"
                    max={numPages}
                    value={startPage}
                    onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">To page:</label>
                  <input
                    type="number"
                    min="1"
                    max={numPages}
                    value={endPage}
                    onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <button
                  onClick={handleMultiPageExtraction}
                  disabled={isLoading}
                  className="px-4 py-2 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Extracting...' : 'Extract from Multiple Pages'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Preview extracted text or table, with fallback and summary for multi-page */}
        {showPreview && (extractedText || extractedTableData) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mt-8">
            <h3 className="text-lg font-semibold mb-4">Extracted Preview</h3>
            {/* Show table if present */}
            {extractedTableData && extractedTableData.headers && extractedTableData.data && extractedTableData.data.length > 0 && (
              <>
                <div className="mb-2 text-green-700 text-sm">Table detected and extracted.</div>
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        {extractedTableData.headers.map((header, idx) => (
                          <th key={idx} className="px-3 py-2 text-left font-medium text-gray-900 border-b">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {extractedTableData.data.slice(0, 10).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-gray-50">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-3 py-2 border-b">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {extractedTableData.data.length > 10 && (
                    <p className="text-sm text-gray-500 mt-2">Showing first 10 rows of {extractedTableData.data.length} total rows</p>
                  )}
                </div>
              </>
            )}
            {/* Show text fallback if no table found */}
            {extractedText && (
              <>
                <div className="mb-2 text-yellow-700 text-sm">No table detected. Showing all text in the selected region.</div>
                <div className="p-4 bg-gray-50 rounded-lg border max-h-48 overflow-y-auto mb-4">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{extractedText}</pre>
                </div>
              </>
            )}
            <button
              className="px-4 py-2 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] transition-colors"
              onClick={handleAddToTable}
            >
              Add to Table
            </button>
          </div>
        )}

        {/* Multi-page extraction: show page summaries and text fallback if present */}
        {showPreview && multiPageMode && extractedTableData && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mt-8">
            <h3 className="text-lg font-semibold mb-4">Multi-Page Extraction Summary</h3>
            {extractedTableData.page_summaries && (
              <div className="mb-4">
                <ul className="text-sm text-gray-700 list-disc pl-5">
                  {extractedTableData.page_summaries.map((summary: { page: number; type: string; rows?: number; length?: number }, idx: number) => (
                    <li key={idx}>
                      Page {summary.page + 1}: {summary.type === 'table' ? `Table (${summary.rows} rows)` : summary.type === 'text' ? `Text fallback (${summary.length} chars)` : 'No data'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extractedTableData.text_fallback && extractedTableData.text_fallback.length > 0 && (
              <div className="mb-4">
                <div className="text-yellow-700 text-sm mb-2">Text fallback for pages without tables:</div>
                <div className="p-4 bg-gray-50 rounded-lg border max-h-48 overflow-y-auto">
                  {extractedTableData.text_fallback.map((tf: { page: number; text: string }, idx: number) => (
                    <div key={idx} className="mb-2">
                      <div className="font-semibold">Page {tf.page + 1}:</div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">{tf.text}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table display and editing */}
        {(tableHeaders.length > 0) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Extracted Table</h3>
                <button
                  className="px-3 py-1 bg-[#00C7BE] text-white rounded-md text-sm font-medium hover:bg-[#086C67]"
                  onClick={handleAddRow}
                >
                  Add Row
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 bg-gray-100 text-gray-900 rounded-md text-sm font-medium hover:bg-gray-200"
                  onClick={handleExportCSV}
                  disabled={isExporting}
                >
                  Export CSV
                </button>
                <button
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export XLS'}
                </button>
                <button
                  className="px-3 py-1 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                  onClick={() => setShowSaveModal(true)}
                >
                  Save Table
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    {tableHeaders.map((header, colIdx) => (
                      <th key={colIdx} className="px-3 py-2 text-left font-medium text-gray-900 border-b relative">
                        {header}
                        <button
                          className="ml-2 text-red-500 hover:text-red-700 text-xs"
                          onClick={() => handleRemoveCol(colIdx)}
                          title="Remove column"
                        >
                          ✕
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50">
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="px-3 py-2 border-b">
                          <input
                            className="w-full bg-transparent outline-none"
                            value={cell}
                            onChange={e => handleCellChange(rowIdx, colIdx, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 border-b">
                        <button
                          className="text-red-500 hover:text-red-700 text-xs"
                          onClick={() => handleRemoveRow(rowIdx)}
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Saved tables list and save modal */}
        <div className="mt-8 flex flex-col md:flex-row gap-8">
          {/* Saved tables */}
          <div className="flex-1">
            <h4 className="text-md font-semibold mb-2">Your Saved Tables</h4>
            {savedTables.length === 0 ? (
              <p className="text-gray-500 text-sm">No saved tables yet.</p>
            ) : (
              <ul className="space-y-2">
                {savedTables.map(table => (
                  <li key={table.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                    <span className="font-medium">{table.name}</span>
                    <button
                      className="px-2 py-1 text-xs bg-[#00C7BE] text-white rounded hover:bg-[#086C67]"
                      onClick={() => handleLoadTable(table)}
                    >
                      Load
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Save modal */}
          {showSaveModal && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-lg font-semibold mb-4">Save Table</h3>
                <input
                  className="w-full border rounded px-3 py-2 mb-4"
                  placeholder="Table name"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  disabled={isSaving}
                />
                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                    onClick={() => setShowSaveModal(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700"
                    onClick={handleSaveTable}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-900">Extracting text...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 

export default dynamic(() => Promise.resolve(BankStatementParser), {
  ssr: false
}); 