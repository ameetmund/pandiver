'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle, AlertCircle, Save, Download, Upload, Eye, Target, Settings, Trash2 } from 'lucide-react';

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { 
  ssr: false,
  loading: () => <div className="text-center p-4">Loading PDF viewer...</div>
});
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { 
  ssr: false,
  loading: () => <div className="text-center p-2">Loading page...</div>
});

// Set PDF.js worker source when component mounts
const usePdfWorker = () => {
  useEffect(() => {
    const setPdfWorker = async () => {
      try {
        const reactPdf = await import('react-pdf');
        reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
      } catch (error) {
        console.error('Failed to load PDF.js worker:', error);
      }
    };
    setPdfWorker();
  }, []);
};

interface TableRow {
  row_index: number;
  words: Array<{text: string, x0: number, y0: number, x1: number, y1: number, top: number, bottom: number}>;
  text: string;
  y_position: number;
  column_count: number;
  bounding_box: {x0: number, x1: number, y0: number, y1: number};
}

interface DetectionResult {
  success: boolean;
  message: string;
  suggested_start_page?: number;
  candidates: Array<{
    page: number;
    confidence_score: number;
    suggested_header_row: any;
  }>;
}

interface HeaderSelection {
  headers: string[];
  positions: number[][];
  y_position: number;
  page_number: number;
}

interface ColumnDefinition {
  index: number;
  name: string;
  x_min: number;
  x_max: number;
  width: number;
  user_adjusted: boolean;
}

interface SampleRowSelection {
  data: string[];
  y_position: number;
  page_number: number;
}

interface ExtractedData {
  success: boolean;
  headers: string[];
  transactions: string[][];
  total_transactions: number;
  pages_processed: number[];
  errors: string[];
}

const ManualBankStatementParser: React.FC = () => {
  // Initialize PDF worker
  usePdfWorker();
  
  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageScale, setPageScale] = useState<number>(1.0);
  const [pageDims, setPageDims] = useState<{width: number, height: number} | null>(null);
  
  // Workflow state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Detection results
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  
  // User selections - Rectangle Selection Mode
  const [isSelectingHeaderRect, setIsSelectingHeaderRect] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const [currentRect, setCurrentRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [headerRect, setHeaderRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [headerSelection, setHeaderSelection] = useState<HeaderSelection | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
  
  // Manual boundary control state
  const [manualColumns, setManualColumns] = useState<ColumnDefinition[]>([]);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const [isDraggingBoundary, setIsDraggingBoundary] = useState<boolean>(false);
  const [dragInfo, setDragInfo] = useState<{columnIndex: number, edge: 'left' | 'right', startX: number} | null>(null);
  const [boundaryHeightMultiplier, setBoundaryHeightMultiplier] = useState<number>(1.0); // Default 100% height
  
  // Intelligent column detection results
  const [detectedColumns, setDetectedColumns] = useState<any[]>([]);
  
  // Pattern and extraction results
  const [createdPattern, setCreatedPattern] = useState<any>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [savedPatterns, setSavedPatterns] = useState<any[]>([]);
  
  // Debug mode state
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [lastApiResponse, setLastApiResponse] = useState<any>(null);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Debug logging function
  const addDebugLog = (step: string, data: any) => {
    if (debugMode) {
      const logEntry = {
        timestamp: new Date().toLocaleTimeString(),
        step,
        data: JSON.parse(JSON.stringify(data)) // Deep copy to avoid reference issues
      };
      setDebugLogs(prev => [...prev, logEntry]);
      console.log(`[DEBUG] ${step}:`, data);
    }
  };

  const clearDebugLogs = () => setDebugLogs([]);

  // Step 1: Upload and detect transaction pages
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    
    setPdfFile(file);
    setError('');
    setCurrentStep(1);
    
    // Reset all header selection state when new file is uploaded
    setHeaderSelection(null);
    setHeaderRect(null);
    setSelectedColumns([]);
    setDetectedColumns([]);
    setManualColumns([]);
    setSelectedColumnIndex(null);
    setIsSelectingHeaderRect(false);
    setIsDraggingBoundary(false);
    setDragInfo(null);
    setCurrentRect(null);
    setStartPoint(null);
    setCreatedPattern(null);
    setExtractedData(null);
    setBoundaryHeightMultiplier(1.0); // Reset boundary height to default
    
    // Auto-detect transaction pages
    await detectTransactionPages(file);
  };

  const detectTransactionPages = async (file: File) => {
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:8000/manual/detect-transaction-pages', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to detect transaction pages');
      }
      
      const result = await response.json();
      setDetectionResult(result.detection_result);
      
      if (result.detection_result.success && result.suggested_page !== null) {
        setCurrentPage(result.suggested_page + 1); // Convert to 1-based
        setCurrentStep(2);
      } else {
        setError('No transaction-like pages found. Please try a different PDF or navigate manually.');
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to detect transaction pages');
    } finally {
      setIsLoading(false);
    }
  };


  // Rectangle selection handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if clicking on a boundary drag handle
    const target = e.target as HTMLElement;
    if (target.classList.contains('boundary-handle')) {
      const columnIndex = parseInt(target.dataset.columnIndex || '0');
      const edge = target.dataset.edge as 'left' | 'right';
      
      const rect = e.currentTarget.getBoundingClientRect();
      const startX = (e.clientX - rect.left) / pageScale;
      
      setIsDraggingBoundary(true);
      setDragInfo({ columnIndex, edge, startX });
      return;
    }
    
    // Check if clicking to add a new boundary
    if (headerRect && manualColumns.length > 0 && e.altKey) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / pageScale;
      const y = (e.clientY - rect.top) / pageScale;
      
      // Check if click is within header area
      if (x >= headerRect.x && x <= headerRect.x + headerRect.width &&
          y >= headerRect.y && y <= headerRect.y + headerRect.height) {
        addColumnBoundary(x);
        return;
      }
    }
    
    if (!isSelectingHeaderRect) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Handle boundary dragging
    if (isDraggingBoundary && dragInfo) {
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = (e.clientX - rect.left) / pageScale;
      
      handleColumnBoundaryDrag(dragInfo.columnIndex, dragInfo.edge, currentX);
      return;
    }
    
    if (!isDrawing || !startPoint) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = x - startPoint.x;
    const height = y - startPoint.y;
    
    setCurrentRect({
      x: width < 0 ? x : startPoint.x,
      y: height < 0 ? y : startPoint.y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = async () => {
    // End boundary dragging
    if (isDraggingBoundary) {
      setIsDraggingBoundary(false);
      setDragInfo(null);
      return;
    }
    
    if (!isDrawing || !currentRect || !pdfFile) return;
    
    setIsDrawing(false);
    
    // Convert screen coordinates to PDF coordinates
    const pdfRect = {
      x: currentRect.x / pageScale,
      y: currentRect.y / pageScale,
      width: currentRect.width / pageScale,
      height: currentRect.height / pageScale
    };
    
    if (isSelectingHeaderRect) {
      setHeaderRect(currentRect);
      setIsSelectingHeaderRect(false);
      await extractHeadersFromUserSelection(pdfRect);
    }
    
    setCurrentRect(null);
    setStartPoint(null);
  };

  // NEW: Extract headers from user selection using user-controlled approach
  const extractHeadersFromUserSelection = async (rect: {x: number, y: number, width: number, height: number}) => {
    if (!pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      const rectangleData = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        page_number: currentPage - 1 // Convert to 0-based
      };
      
      formData.append('rectangle', JSON.stringify(rectangleData));
      
      const response = await fetch('http://localhost:8000/user-controlled/extract-headers-from-selection', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to extract headers');
      }
      
      const result = await response.json();
      
      if (result.success && result.columns && result.columns.length > 0) {
        // Convert to our ColumnDefinition format
        const columns: ColumnDefinition[] = result.columns.map((col: any, index: number) => ({
          index,
          name: col.name || `Column ${index + 1}`,
          x_min: col.x_min,
          x_max: col.x_max,
          width: col.x_max - col.x_min,
          user_adjusted: false
        }));
        
        setManualColumns(columns);
        
        // Also set headerSelection for compatibility with existing flow
        const headers = columns.map(col => col.name);
        const positions = columns.map(col => [col.x_min, col.x_max]);
        
        setHeaderSelection({
          headers,
          positions,
          y_position: rect.y,
          page_number: currentPage - 1
        });
        setSelectedColumns(Array.from({length: headers.length}, (_, i) => i));
        
        addDebugLog('Manual Header Extraction', {
          columns_count: columns.length,
          column_names: headers,
          boundaries: positions
        });
      } else {
        setError('No headers detected in selected area. Make sure to select the transaction table header row.');
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to extract headers');
    } finally {
      setIsLoading(false);
    }
  };

  // Column boundary adjustment handlers
  const handleColumnBoundaryDrag = (columnIndex: number, edge: 'left' | 'right', newPosition: number) => {
    const updatedColumns = [...manualColumns];
    const column = updatedColumns[columnIndex];
    
    if (edge === 'left') {
      column.x_min = newPosition;
    } else {
      column.x_max = newPosition;
    }
    
    column.width = column.x_max - column.x_min;
    column.user_adjusted = true;
    
    setManualColumns(updatedColumns);
    
    // Update headerSelection for compatibility
    if (headerSelection) {
      const updatedPositions = updatedColumns.map(col => [col.x_min, col.x_max]);
      setHeaderSelection({
        ...headerSelection,
        positions: updatedPositions
      });
    }
  };

  // Add new column boundary at exact user click position
  const addColumnBoundary = async (xPosition: number) => {
    if (!pdfFile || !headerRect) return;
    
    // Find which column to split
    const columnToSplit = manualColumns.find(col => col.x_min <= xPosition && xPosition <= col.x_max);
    
    if (columnToSplit) {
      // Get text content within the new right column area to name it properly
      const rightColumnText = await getTextInArea(xPosition, columnToSplit.x_max);
      const leftColumnText = await getTextInArea(columnToSplit.x_min, xPosition);
      
      const updatedColumns = [...manualColumns];
      const splitIndex = columnToSplit.index;
      
      // Create new right column with proper name
      const newColumn: ColumnDefinition = {
        index: splitIndex + 1,
        name: rightColumnText || 'Column',
        x_min: xPosition,
        x_max: columnToSplit.x_max,
        width: columnToSplit.x_max - xPosition,
        user_adjusted: true
      };
      
      // Update existing left column with proper name
      columnToSplit.x_max = xPosition;
      columnToSplit.width = xPosition - columnToSplit.x_min;
      columnToSplit.name = leftColumnText || columnToSplit.name;
      columnToSplit.user_adjusted = true;
      
      // Insert new column and reindex
      updatedColumns.splice(splitIndex + 1, 0, newColumn);
      updatedColumns.forEach((col, idx) => col.index = idx);
      
      setManualColumns(updatedColumns);
      
      // Update headerSelection for compatibility
      if (headerSelection) {
        const updatedHeaders = updatedColumns.map(col => col.name);
        const updatedPositions = updatedColumns.map(col => [col.x_min, col.x_max]);
        setHeaderSelection({
          ...headerSelection,
          headers: updatedHeaders,
          positions: updatedPositions
        });
        setSelectedColumns(Array.from({length: updatedHeaders.length}, (_, i) => i));
      }
    }
  };
  
  // Helper function to get text content in a specific area
  const getTextInArea = async (xMin: number, xMax: number): Promise<string> => {
    if (!pdfFile || !headerRect) return '';
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('rectangle', JSON.stringify({
        x: xMin,
        y: headerRect.y,
        width: xMax - xMin,
        height: headerRect.height,
        page_number: currentPage - 1
      }));
      
      const response = await fetch('http://localhost:8000/user-controlled/extract-headers-from-selection', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.columns && result.columns[0]) {
          return result.columns[0].name;
        }
      }
    } catch (error) {
      console.log('Could not get text for area:', error);
    }
    
    return '';
  };

  // Delete column boundary (merge with adjacent)
  const deleteColumn = (columnIndex: number) => {
    if (manualColumns.length <= 1) return;
    
    const updatedColumns = [...manualColumns];
    const columnToDelete = updatedColumns[columnIndex];
    
    if (columnIndex < manualColumns.length - 1) {
      // Merge with next column
      const nextColumn = updatedColumns[columnIndex + 1];
      nextColumn.x_min = columnToDelete.x_min;
      nextColumn.name = `${columnToDelete.name} ${nextColumn.name}`;
      nextColumn.width = nextColumn.x_max - nextColumn.x_min;
      nextColumn.user_adjusted = true;
      
      updatedColumns.splice(columnIndex, 1);
    } else if (columnIndex > 0) {
      // Merge with previous column
      const prevColumn = updatedColumns[columnIndex - 1];
      prevColumn.x_max = columnToDelete.x_max;
      prevColumn.name = `${prevColumn.name} ${columnToDelete.name}`;
      prevColumn.width = prevColumn.x_max - prevColumn.x_min;
      prevColumn.user_adjusted = true;
      
      updatedColumns.splice(columnIndex, 1);
    }
    
    // Reindex columns
    updatedColumns.forEach((col, idx) => col.index = idx);
    setManualColumns(updatedColumns);
    
    // Update headerSelection for compatibility
    if (headerSelection) {
      const updatedHeaders = updatedColumns.map(col => col.name);
      const updatedPositions = updatedColumns.map(col => [col.x_min, col.x_max]);
      setHeaderSelection({
        ...headerSelection,
        headers: updatedHeaders,
        positions: updatedPositions
      });
      setSelectedColumns(Array.from({length: updatedHeaders.length}, (_, i) => i));
    }
  };

  // Column boundary height adjustment functions
  const increaseBoundaryHeight = () => {
    setBoundaryHeightMultiplier(prev => prev + 0.2); // No maximum limit
  };

  const decreaseBoundaryHeight = () => {
    setBoundaryHeightMultiplier(prev => Math.max(0.5, prev - 0.2)); // Min 50% height
  };

  const resetBoundaryHeight = () => {
    setBoundaryHeightMultiplier(1.0); // Reset to 100% height
  };

  // Calculate maximum possible boundary height based on page dimensions
  const getMaxBoundaryHeight = () => {
    if (!pageDims || !headerRect) return 500; // Fallback value
    return Math.max(500, pageDims.height * pageScale - headerRect.y);
  };

  // Slider-based height adjustment (in absolute pixels)
  const handleSliderHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const absoluteHeight = parseInt(e.target.value);
    if (headerRect) {
      const multiplier = absoluteHeight / headerRect.height;
      setBoundaryHeightMultiplier(multiplier);
    }
  };

  // Get current absolute height for slider
  const getCurrentAbsoluteHeight = () => {
    if (!headerRect) return 100;
    return Math.round(headerRect.height * boundaryHeightMultiplier);
  };

  // Extract text from selected rectangle using intelligent column detection
  const extractTextFromRect = async (rect: {x: number, y: number, width: number, height: number}, type: 'header' | 'sample') => {
    try {
      addDebugLog('📍 Rectangle Selection', {
        type,
        coordinates: rect,
        page: currentPage - 1
      });

      const formData = new FormData();
      formData.append('file', pdfFile!);
      formData.append('page', (currentPage - 1).toString());
      formData.append('x', rect.x.toString());
      formData.append('y', rect.y.toString());
      formData.append('width', rect.width.toString());
      formData.append('height', rect.height.toString());
      formData.append('is_header', type === 'header' ? 'true' : 'false');
      
      addDebugLog('📤 API Request', {
        endpoint: '/manual/detect-columns-in-rectangle',
        params: {
          page: currentPage - 1,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          is_header: type === 'header'
        }
      });

      const response = await fetch('http://localhost:8000/manual/detect-columns-in-rectangle', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        setLastApiResponse(result);
        
        addDebugLog('📥 API Response', {
          success: result.success,
          total_columns: result.total_columns,
          confidence_score: result.confidence_score,
          method_used: result.method_used,
          columns: result.columns,
          raw_response: result
        });
        
        if (type === 'header' && result.success) {
          // Use ALL columns detected within user's selection - no filtering
          addDebugLog('🔄 Processing Headers', {
            raw_columns: result.columns,
            column_count: result.columns.length
          });

          const headers = result.columns.map((col: any, index: number) => {
            const text = col.text || '';
            // Take the raw text and clean it up minimally
            const cleanText = text.trim();
            
            addDebugLog(`📝 Header ${index + 1} Processing`, {
              raw_text: text,
              clean_text: cleanText,
              word_count: cleanText.split(/\s+/).length,
              column_bounds: { x_start: col.x_start, x_end: col.x_end, width: col.width }
            });

            // If it's a single word and looks like a header, use it
            if (cleanText.length > 0 && cleanText.split(/\s+/).length <= 3) {
              addDebugLog(`✅ Header ${index + 1} - Using as-is`, { result: cleanText });
              return cleanText;
            }
            // Otherwise, take first meaningful words
            const words = cleanText.split(/\s+/).filter((word: string) => 
              word.length > 1 && /^[a-zA-Z0-9]+$/.test(word)
            );
            const finalHeader = words.slice(0, 2).join(' ') || `Column ${col.column_index + 1}`;
            
            addDebugLog(`🔄 Header ${index + 1} - Filtered`, { 
              original_words: cleanText.split(/\s+/),
              filtered_words: words,
              final_result: finalHeader
            });
            
            return finalHeader;
          });
          
          // USE THE PRECISE COLUMN BOUNDARIES FROM INTELLIGENT DETECTION
          const positions = result.columns.map((col: any) => [col.x_start, col.x_end]);
          
          addDebugLog('📍 Final Header Results', {
            headers,
            positions,
            header_count: headers.length
          });
          
          if (headers.length > 0) {
            setHeaderSelection({
              headers,
              positions,
              y_position: rect.y,
              page_number: currentPage - 1
            });
            setSelectedColumns(Array.from({length: headers.length}, (_: any, i: number) => i));
            
            // Store detected column information for visualization
            setDetectedColumns(result.columns);
          }
        } else if (type === 'header') {
          // Fallback to simple text extraction if intelligent detection fails
          await extractTextFromRectFallback(rect, type);
        } else if (type === 'sample') {
          // For sample area, show exactly what user selected (all columns in order)
          if (result.success && result.columns && result.columns.length > 0) {
            // Sort columns by position and take ALL of them
            const sortedColumns = result.columns.sort((a: any, b: any) => a.x_start - b.x_start);
            // Sample area content is displayed via the sorted columns - no separate storage needed
          }
        }
      } else {
        // Fallback to simple text extraction
        await extractTextFromRectFallback(rect, type);
      }
    } catch (error) {
      setError('Failed to extract text from selected area');
      // Try fallback method
      await extractTextFromRectFallback(rect, type);
    }
  };

  // Fallback method for simple text extraction
  const extractTextFromRectFallback = async (rect: {x: number, y: number, width: number, height: number}, type: 'header' | 'sample') => {
    try {
      const formData = new FormData();
      formData.append('file', pdfFile!);
      formData.append('page', (currentPage - 1).toString());
      formData.append('x', rect.x.toString());
      formData.append('y', rect.y.toString());
      formData.append('width', rect.width.toString());
      formData.append('height', rect.height.toString());
      
      const response = await fetch('http://localhost:8000/extract-text-region', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (type === 'header') {
          // Process header text - split by spaces/tabs to get column headers
          const headerText = result.text || '';
          const headers = headerText.split(/\s{2,}|\t/).filter((h: string) => h.trim().length > 0);
          
          if (headers.length > 0) {
            // For fallback mode, calculate approximate equal positions
            const positions = headers.map((_: string, i: number) => [
              rect.x + (i * rect.width / headers.length), 
              rect.x + ((i + 1) * rect.width / headers.length)
            ]);
            
            setHeaderSelection({
              headers,
              positions,
              y_position: rect.y,
              page_number: currentPage - 1
            });
            setSelectedColumns(Array.from({length: headers.length}, (_: any, i: number) => i));
          }
        }
      }
    } catch (error) {
      setError('Failed to extract text from selected area');
    }
  };

  // Step 3: Create pattern from header selection and extract data immediately
  const createPatternFromSelection = async () => {
    if (!pdfFile || !headerSelection) {
      setError('Please select header area');
      return;
    }
    
    addDebugLog('🚀 Starting Pattern Creation & Extraction', {
      header_selection: headerSelection,
      selected_columns: selectedColumns,
      selected_column_names: selectedColumns.map(idx => headerSelection.headers[idx]),
      pdf_file: pdfFile.name
    });
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      // Create dummy sample rows from header selection for pattern creation
      const sampleRows = [{
        data: headerSelection.headers,
        y_position: headerSelection.y_position + 30, // Estimate where data would be
        page_number: currentPage - 1
      }];

      const patternRequest = {
        header_selection: headerSelection,
        sample_rows: sampleRows,
        selected_column_indices: selectedColumns
      };
      
      addDebugLog('📤 Pattern Creation Request', {
        endpoint: '/manual/create-pattern-from-selection',
        pattern_request: patternRequest
      });
      
      formData.append('pattern_request', JSON.stringify(patternRequest));
      
      const response = await fetch('http://localhost:8000/manual/create-pattern-from-selection', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create pattern');
      }
      
      const result = await response.json();
      
      addDebugLog('📥 Pattern Creation Response', {
        success: result.success,
        pattern: result.pattern,
        message: result.message
      });
      
      setCreatedPattern(result.pattern);
      
      // Immediately proceed to extract data
      await extractDataWithCreatedPattern(result.pattern);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create pattern');
      setIsLoading(false);
    }
  };

  // Helper function to extract data with created pattern
  const extractDataWithCreatedPattern = async (pattern: any) => {
    try {
      addDebugLog('📊 Starting Data Extraction', {
        pattern_columns: pattern.column_count,
        pattern_names: pattern.column_names,
        selected_fields: pattern.selected_fields,
        column_boundaries: pattern.column_boundaries
      });

      const formData = new FormData();
      formData.append('file', pdfFile!);
      formData.append('pattern_data', JSON.stringify(pattern));
      formData.append('start_page', '0');
      
      const response = await fetch('http://localhost:8000/manual/extract-with-pattern', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to extract data');
      }
      
      const result = await response.json();
      
      addDebugLog('🎉 Extraction Complete', {
        success: result.success,
        total_transactions: result.total_transactions,
        headers: result.headers,
        pages_processed: result.pages_processed,
        sample_transactions: result.transactions?.slice(0, 3),
        errors: result.errors
      });
      
      setExtractedData(result);
      setCurrentStep(4); // Skip to review step
      
    } catch (err: any) {
      setError(err.message || 'Failed to extract data');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Extract data using the pattern
  const extractDataWithPattern = async () => {
    if (!pdfFile || !createdPattern) {
      setError('No pattern available for extraction');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('pattern_data', JSON.stringify(createdPattern));
      formData.append('start_page', '0');
      
      const response = await fetch('http://localhost:8000/manual/extract-with-pattern', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to extract data');
      }
      
      const result = await response.json();
      setExtractedData(result);
      setCurrentStep(5);
      
    } catch (err: any) {
      setError(err.message || 'Failed to extract data');
    } finally {
      setIsLoading(false);
    }
  };

  // Export functions for multiple formats
  const exportData = (format: string) => {
    if (!extractedData) return;
    
    const filename = `bank-statement-transactions`;
    
    switch (format) {
      case 'csv':
        exportCSV(filename);
        break;
      case 'xlsx':
        exportExcel(filename);
        break;
      case 'json':
        exportJSON(filename);
        break;
      case 'txt':
        exportTXT(filename);
        break;
      case 'xml':
        exportXML(filename);
        break;
      default:
        exportCSV(filename);
    }
  };

  const exportCSV = (filename: string) => {
    let csvContent = '';
    if (extractedData!.headers.length > 0) {
      csvContent += extractedData!.headers.join(',') + '\n';
    }
    
    extractedData!.transactions.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  };

  const exportExcel = (filename: string) => {
    // Import xlsx library dynamically to avoid SSR issues
    import('xlsx').then((XLSX) => {
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare data with headers
      const wsData = [];
      if (extractedData!.headers.length > 0) {
        wsData.push(extractedData!.headers);
      }
      
      // Add transaction data
      extractedData!.transactions.forEach(row => {
        wsData.push(row);
      });
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Auto-size columns
      const colWidths = extractedData!.headers.map((header, idx) => {
        const headerLength = header.length;
        const maxDataLength = Math.max(
          ...extractedData!.transactions.map(row => String(row[idx] || '').length)
        );
        return { wch: Math.max(headerLength, maxDataLength, 10) };
      });
      ws['!cols'] = colWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Bank Transactions');
      
      // Generate Excel file and download
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }).catch(error => {
      console.error('Error loading xlsx library:', error);
      // Fallback to CSV if xlsx fails
      exportCSV(filename);
    });
  };

  const exportJSON = (filename: string) => {
    const jsonData = {
      headers: extractedData!.headers,
      transactions: extractedData!.transactions.map(row => {
        const obj: any = {};
        extractedData!.headers.forEach((header, idx) => {
          obj[header] = row[idx] || '';
        });
        return obj;
      }),
      metadata: {
        total_transactions: extractedData!.total_transactions,
        pages_processed: extractedData!.pages_processed,
        export_date: new Date().toISOString()
      }
    };
    
    const jsonContent = JSON.stringify(jsonData, null, 2);
    downloadFile(jsonContent, `${filename}.json`, 'application/json');
  };

  const exportTXT = (filename: string) => {
    let txtContent = 'Bank Statement Transactions\n';
    txtContent += '============================\n\n';
    
    if (extractedData!.headers.length > 0) {
      txtContent += extractedData!.headers.join(' | ') + '\n';
      txtContent += '-'.repeat(extractedData!.headers.join(' | ').length) + '\n';
    }
    
    extractedData!.transactions.forEach(row => {
      txtContent += row.join(' | ') + '\n';
    });
    
    txtContent += `\nTotal Transactions: ${extractedData!.total_transactions}\n`;
    txtContent += `Pages Processed: ${extractedData!.pages_processed.join(', ')}\n`;
    
    downloadFile(txtContent, `${filename}.txt`, 'text/plain');
  };

  const exportXML = (filename: string) => {
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<bank_statement>\n';
    xmlContent += '  <metadata>\n';
    xmlContent += `    <total_transactions>${extractedData!.total_transactions}</total_transactions>\n`;
    xmlContent += `    <pages_processed>${extractedData!.pages_processed.join(',')}</pages_processed>\n`;
    xmlContent += `    <export_date>${new Date().toISOString()}</export_date>\n`;
    xmlContent += '  </metadata>\n';
    xmlContent += '  <transactions>\n';
    
    extractedData!.transactions.forEach((row, idx) => {
      xmlContent += `    <transaction id="${idx + 1}">\n`;
      extractedData!.headers.forEach((header, headerIdx) => {
        const value = row[headerIdx] || '';
        const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        xmlContent += `      <${cleanHeader}>${escapeXml(value)}</${cleanHeader}>\n`;
      });
      xmlContent += '    </transaction>\n';
    });
    
    xmlContent += '  </transactions>\n';
    xmlContent += '</bank_statement>';
    
    downloadFile(xmlContent, `${filename}.xml`, 'application/xml');
  };

  const escapeXml = (text: string) => {
    return text.replace(/[<>&'"]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return char;
      }
    });
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const onPageLoadSuccess = (page: any) => {
    if (!pageDims) {
      setPageDims({ width: page.originalWidth, height: page.originalHeight });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manual Bank Statement Parser
          </h1>
          <p className="text-gray-600">
            Extract transaction data with full user control - no AI guessing, exact field preservation.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, title: 'Upload & Detect', icon: Upload },
              { num: 2, title: 'Select Headers', icon: Target },
              { num: 3, title: 'Extract Data', icon: Eye },
              { num: 4, title: 'Review & Export', icon: Download },
            ].map(({ num, title, icon: Icon }) => (
              <div key={num} className="flex flex-col items-center">
                <button
                  onClick={() => {
                    if (num < currentStep) {
                      setCurrentStep(num);
                      setError(''); // Clear any errors when navigating back
                    }
                  }}
                  disabled={num > currentStep}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    currentStep >= num 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-200 text-gray-600'
                  } ${num < currentStep ? 'cursor-pointer' : num === currentStep ? 'cursor-default' : 'cursor-not-allowed'}`}
                >
                  {(currentStep > num || (num === 4 && extractedData?.success)) ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </button>
                <span className="text-sm mt-2 text-center">{title}</span>
              </div>
            ))}
          </div>
          
          {/* Navigation Buttons */}
          {currentStep > 1 && (
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                ← Back
              </button>
              <div></div> {/* Spacer */}
            </div>
          )}
        </div>

        {/* Debug Toggle */}
        <div className="mb-4">
          <button
            onClick={() => {
              setDebugMode(!debugMode);
              if (!debugMode) clearDebugLogs();
            }}
            className={`px-4 py-2 rounded transition-colors ${
              debugMode 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            🔧 Debug Mode: {debugMode ? 'ON' : 'OFF'}
          </button>
          {debugMode && (
            <span className="ml-2 text-sm text-gray-600">
              Debug information will be logged for column detection and processing
            </span>
          )}
        </div>

        {/* Debug Panel */}
        {debugMode && (
          <div className="mb-6 border border-gray-300 rounded-lg">
            <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
              <h3 className="font-medium text-gray-900">🔧 Debug Information</h3>
              <button
                onClick={clearDebugLogs}
                className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear Logs
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto bg-gray-50">
              {debugLogs.length === 0 ? (
                <div className="text-gray-500 text-sm">
                  No debug logs yet. Draw a rectangle around headers to start debugging.
                </div>
              ) : (
                <div className="space-y-3">
                  {debugLogs.map((log, index) => (
                    <div key={index} className="border border-gray-200 rounded p-3 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm text-blue-600">{log.step}</span>
                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                      </div>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Last API Response */}
            {lastApiResponse && (
              <div className="border-t bg-blue-50 p-4">
                <h4 className="font-medium text-blue-900 mb-2">📡 Last API Response (Raw)</h4>
                <pre className="text-xs bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(lastApiResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-xl font-semibold mb-4">Step 1: Upload Bank Statement</h2>
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-12 h-12 text-blue-500 mb-4" />
                <span className="text-lg font-medium text-gray-900">
                  Choose PDF file or drag and drop
                </span>
                <span className="text-gray-500 text-sm mt-2">
                  PDF files only - Any bank statement format
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: PDF Viewer and Header Selection */}
        {currentStep === 2 && pdfFile && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Step 2: Select Header Row</h2>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage <= 1}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <span>Page {currentPage} of {numPages}</span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} 
                  disabled={currentPage >= numPages}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
                <div className="flex items-center space-x-2">
                  <span>Zoom:</span>
                  <button 
                    onClick={() => setPageScale(s => Math.max(0.5, s - 0.1))}
                    className="px-2 py-1 border rounded hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span>{Math.round(pageScale * 100)}%</span>
                  <button 
                    onClick={() => setPageScale(s => Math.min(2.0, s + 0.1))}
                    className="px-2 py-1 border rounded hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-6">
              {/* PDF Viewer */}
              <div className="flex-1">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div ref={pdfContainerRef} className="flex justify-center">
                    <div style={{ 
                      position: 'relative', 
                      width: pageDims ? pageDims.width * pageScale : 800, 
                      height: pageDims ? pageDims.height * pageScale : 1000 
                    }}>
                      <Document
                        file={pdfFile}
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        loading={<div className="text-center">Loading PDF...</div>}
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

                      {/* Rectangle selection overlay */}
                      <div
                        className="absolute inset-0 w-full h-full"
                        style={{ 
                          cursor: isSelectingHeaderRect ? 'crosshair' : 
                                 isDraggingBoundary ? 'ew-resize' : 
                                 'default' 
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={() => {
                          // Reset drag states if mouse leaves area
                          if (isDraggingBoundary) {
                            setIsDraggingBoundary(false);
                            setDragInfo(null);
                          }
                        }}
                      >
                        {/* Header rectangle */}
                        {headerRect && (
                          <div
                            className="absolute border-2 border-green-500 bg-green-100 bg-opacity-30"
                            style={{
                              left: headerRect.x,
                              top: headerRect.y,
                              width: headerRect.width,
                              height: headerRect.height,
                            }}
                          >
                            <div className="absolute -top-6 left-0 text-xs bg-green-500 text-white px-2 py-1 rounded">
                              Headers
                            </div>
                          </div>
                        )}

                        {/* Current drawing rectangle */}
                        {currentRect && (
                          <div
                            className="absolute border-2 border-dashed border-gray-500"
                            style={{
                              left: currentRect.x,
                              top: currentRect.y,
                              width: currentRect.width,
                              height: currentRect.height,
                            }}
                          />
                        )}

                        {/* User-controlled column boundaries overlay */}
                        {manualColumns.length > 0 && headerRect && (
                          <div className="absolute pointer-events-none" style={{
                            left: `${headerRect.x}px`,
                            top: `${headerRect.y}px`,
                            width: `${headerRect.width}px`,
                            height: `${headerRect.height}px`,
                          }}>
                            {/* Render single boundary lines between columns only */}
                            {manualColumns.slice(0, -1).map((column, index) => (
                              <div
                                key={index}
                                className="absolute bg-red-500 pointer-events-auto boundary-handle cursor-ew-resize hover:bg-red-700 hover:w-1"
                                style={{
                                  left: `${((column.x_max * pageScale) - (headerRect.x / pageScale) * pageScale) - 1}px`,
                                  width: '2px',
                                  height: `${headerRect.height * boundaryHeightMultiplier}px`,
                                  top: headerRect.height > headerRect.height * boundaryHeightMultiplier ? 
                                    `${(headerRect.height - headerRect.height * boundaryHeightMultiplier) / 2}px` : '0px',
                                }}
                                data-column-index={index}
                                data-edge="right"
                                title={`Drag to adjust boundary (Height: ${Math.round(boundaryHeightMultiplier * 100)}%)`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedColumnIndex(index);
                                }}
                              />
                            ))}
                            
                            {/* Column labels */}
                            {manualColumns.map((column, index) => (
                              <div
                                key={`label-${index}`}
                                className="absolute top-0 bg-white bg-opacity-90 text-gray-800 px-1 text-xs border border-gray-300 rounded shadow-sm pointer-events-none"
                                style={{
                                  left: `${((column.x_min * pageScale) - (headerRect.x / pageScale) * pageScale + (column.width * pageScale * 0.1))}px`,
                                  transform: 'translateY(-100%)',
                                  fontSize: '10px',
                                  maxWidth: `${column.width * pageScale * 0.8}px`,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {column.name}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Detected column boundaries (fallback display) */}
                        {detectedColumns.length > 0 && headerRect && manualColumns.length === 0 && (
                          <>
                            {detectedColumns.map((col, idx) => (
                              <div
                                key={`col-${idx}`}
                                className="absolute border-l-2 border-purple-400 opacity-70"
                                style={{
                                  left: (col.x_start * pageScale),
                                  top: headerRect.y,
                                  height: headerRect.height,
                                  width: 2,
                                }}
                                title={`Column ${idx + 1}: ${col.text}`}
                              />
                            ))}
                            {/* Show column end boundaries too */}
                            {detectedColumns.map((col, idx) => (
                              <div
                                key={`col-end-${idx}`}
                                className="absolute border-l-2 border-purple-400 opacity-70"
                                style={{
                                  left: (col.x_end * pageScale),
                                  top: headerRect.y,
                                  height: headerRect.height,
                                  width: 2,
                                }}
                                title={`End of Column ${idx + 1}`}
                              />
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selection Panel */}
              <div className="w-80">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div>
                    <h3 className="font-semibold mb-3">Select Header Area</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Draw a rectangle around the column headers (Date, Description, Amount, etc.)
                    </p>
                    
                    <button
                      onClick={() => setIsSelectingHeaderRect(!isSelectingHeaderRect)}
                      className={`w-full mb-2 py-2 px-4 rounded transition-colors ${
                        isSelectingHeaderRect 
                          ? 'bg-green-600 text-white' 
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {isSelectingHeaderRect ? 'Click & Drag to Select Headers' : 'Select Header Area'}
                    </button>

                    {headerSelection && (
                      <button
                        onClick={() => {
                          setHeaderSelection(null);
                          setHeaderRect(null);
                          setSelectedColumns([]);
                          setDetectedColumns([]);
                          setManualColumns([]);
                          setSelectedColumnIndex(null);
                        }}
                        className="w-full mb-4 py-1 px-3 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Reset Selection
                      </button>
                    )}

                    {headerSelection && (
                      <div className="bg-white rounded p-3 mb-4">
                        <div className="text-sm font-medium">Selected Headers:</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {headerSelection.headers.join(' | ')}
                        </div>
                      </div>
                    )}

                    {/* Column boundary controls - only show if we have manual columns */}
                    {manualColumns.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-blue-600 text-white">
                            3
                          </div>
                          <h3 className="font-semibold text-gray-900">Adjust Boundaries</h3>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <h4 className="font-medium text-blue-900 text-sm mb-2">Controls:</h4>
                            <div className="text-xs text-blue-800 space-y-1">
                              <div>• <strong>Click red lines</strong> to select</div>
                              <div>• <strong>Drag red lines</strong> to adjust</div>
                              <div>• <strong>Alt + Click</strong> PDF to add boundary</div>
                            </div>
                          </div>

                          {/* Boundary Height Controls */}
                          <div className="bg-green-50 border border-green-200 rounded p-3">
                            <h4 className="font-medium text-green-900 text-sm mb-2">Boundary Height:</h4>
                            
                            {/* +/- Button Controls */}
                            <div className="flex items-center justify-between space-x-2 mb-3">
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={decreaseBoundaryHeight}
                                  disabled={boundaryHeightMultiplier <= 0.5}
                                  className="w-8 h-8 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center justify-center text-lg font-bold disabled:opacity-50"
                                  title="Decrease boundary height"
                                >
                                  −
                                </button>
                                <button
                                  onClick={increaseBoundaryHeight}
                                  className="w-8 h-8 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center justify-center text-lg font-bold"
                                  title="Increase boundary height (no limit)"
                                >
                                  +
                                </button>
                              </div>
                              <div className="text-xs text-green-800 font-medium">
                                {Math.round(boundaryHeightMultiplier * 100)}%
                              </div>
                              <button
                                onClick={resetBoundaryHeight}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
                                title="Reset to default height"
                              >
                                Reset
                              </button>
                            </div>

                            {/* Slider Control */}
                            {headerRect && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-green-800">
                                  <span>Drag to adjust:</span>
                                  <span>{getCurrentAbsoluteHeight()}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={Math.round(headerRect.height * 0.5)}
                                  max={getMaxBoundaryHeight()}
                                  value={getCurrentAbsoluteHeight()}
                                  onChange={handleSliderHeightChange}
                                  className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer slider"
                                  title={`Adjust height: ${getCurrentAbsoluteHeight()}px (Max: ${getMaxBoundaryHeight()}px)`}
                                />
                                <div className="flex justify-between text-xs text-green-600">
                                  <span>{Math.round(headerRect.height * 0.5)}px</span>
                                  <span>Max: {getMaxBoundaryHeight()}px</span>
                                </div>
                              </div>
                            )}

                            <div className="text-xs text-green-700 mt-2">
                              Use +/- buttons for quick adjustments or drag slider for precise control
                            </div>
                          </div>

                          {/* Column List */}
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900 text-sm">Columns ({manualColumns.length}):</h4>
                            {manualColumns.map((column, index) => (
                              <div key={index} className={`bg-white rounded p-2 border text-xs ${selectedColumnIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                                <div className="flex items-center justify-between">
                                  <input
                                    type="text"
                                    value={column.name}
                                    onChange={(e) => {
                                      const updated = [...manualColumns];
                                      updated[index].name = e.target.value;
                                      updated[index].user_adjusted = true;
                                      setManualColumns(updated);
                                      
                                      // Update headerSelection for compatibility
                                      if (headerSelection) {
                                        const updatedHeaders = updated.map(col => col.name);
                                        setHeaderSelection({
                                          ...headerSelection,
                                          headers: updatedHeaders
                                        });
                                      }
                                    }}
                                    className="flex-1 text-xs font-medium bg-transparent border-none focus:outline-none text-gray-900"
                                  />
                                  <button
                                    onClick={() => deleteColumn(index)}
                                    disabled={manualColumns.length <= 1}
                                    className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                                    title="Delete column"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                                {column.user_adjusted && (
                                  <div className="text-xs text-blue-600 mt-1">• Modified</div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="space-y-2">
                            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
                              <p className="text-blue-800 text-xs mb-2 font-medium">
                                Add Boundary:
                              </p>
                              <p className="text-blue-700 text-xs">
                                <strong>Alt + Click</strong> on the PDF where you want to add a column boundary
                              </p>
                            </div>
                            
                            <button
                              onClick={() => {
                                if (selectedColumnIndex !== null) {
                                  deleteColumn(selectedColumnIndex);
                                  setSelectedColumnIndex(null);
                                }
                              }}
                              disabled={selectedColumnIndex === null || manualColumns.length <= 1}
                              className="w-full px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center justify-center space-x-2 disabled:opacity-50 text-sm"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Remove Selected</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {headerSelection && (
                      <div className="mb-4">
                        <div className="text-sm font-medium mb-2">Select Columns to Extract:</div>
                        {headerSelection.headers.map((header, idx) => (
                          <label key={idx} className="flex items-center mb-1">
                            <input
                              type="checkbox"
                              checked={selectedColumns.includes(idx)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedColumns(prev => [...prev, idx]);
                                } else {
                                  setSelectedColumns(prev => prev.filter(i => i !== idx));
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{header}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={createPatternFromSelection}
                      disabled={!headerSelection || selectedColumns.length === 0 || isLoading}
                      className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLoading ? 'Creating Pattern...' : 'Extract Data'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {currentStep === 3 && extractedData && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Step 3: Data Extraction</h2>
              <div className="flex space-x-2">
                <button
                  onClick={extractDataWithPattern}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Re-extracting...' : 'Re-extract Data'}
                </button>
              </div>
            </div>

            {createdPattern && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-900">Pattern Generated & Applied</span>
                </div>
                <div className="text-sm text-green-800">
                  {createdPattern.column_count} columns detected, {createdPattern.selected_fields?.length || selectedColumns.length} selected for extraction
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Selected fields: {headerSelection?.headers.filter((_, idx) => selectedColumns.includes(idx)).join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Results */}
        {currentStep === 4 && extractedData && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Step 4: Review & Export</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => exportData('csv')}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </button>
                <button
                  onClick={() => exportData('xlsx')}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Excel
                </button>
                <button
                  onClick={() => exportData('json')}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  JSON
                </button>
                <button
                  onClick={() => exportData('txt')}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  TXT
                </button>
                <button
                  onClick={() => exportData('xml')}
                  className="flex items-center px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  XML
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{extractedData.total_transactions}</div>
                <div className="text-sm text-gray-600">Transactions Found</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{extractedData.pages_processed.length}</div>
                <div className="text-sm text-gray-600">Pages Processed</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{extractedData.headers.length}</div>
                <div className="text-sm text-gray-600">Fields Extracted</div>
              </div>
            </div>

            {extractedData.success && extractedData.transactions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {extractedData.headers.map((header, idx) => (
                        <th key={idx} className="px-4 py-2 text-left font-medium text-gray-900 border-b">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.transactions.slice(0, 20).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-50">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-2 border-b text-sm">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {extractedData.transactions.length > 20 && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    Showing first 20 rows of {extractedData.transactions.length} total transactions
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-900">Processing...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualBankStatementParser;