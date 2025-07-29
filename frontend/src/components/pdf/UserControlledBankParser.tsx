'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle, AlertCircle, Save, Download, Upload, Eye, Target, Settings, Trash2 } from 'lucide-react';

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { ssr: false });

// Set PDF.js worker source when component mounts
const usePdfWorker = () => {
  useEffect(() => {
    const setPdfWorker = async () => {
      const pdfjs = await import('react-pdf');
      pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
    };
    setPdfWorker();
  }, []);
};

interface ColumnDefinition {
  index: number;
  name: string;
  x_min: number;
  x_max: number;
  width: number;
  user_adjusted: boolean;
}

interface ExtractedData {
  success: boolean;
  headers: string[];
  data: Record<string, string>[];
  total_rows: number;
  pages_processed: number;
  summary: any;
}

const UserControlledBankParser: React.FC = () => {
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
  const [success, setSuccess] = useState<string>('');
  
  // Header selection state
  const [isSelectingHeader, setIsSelectingHeader] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const [currentRect, setCurrentRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [headerRect, setHeaderRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  
  // Column definition state
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const [isDraggingBoundary, setIsDraggingBoundary] = useState<boolean>(false);
  const [dragInfo, setDragInfo] = useState<{columnIndex: number, edge: 'left' | 'right', startX: number} | null>(null);
  
  // Extraction results
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  
  // Preview mode
  const [showPreview, setShowPreview] = useState<boolean>(false);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    
    setPdfFile(file);
    setError('');
    setSuccess('');
    setCurrentStep(2); // Skip to header selection
    
    // Reset all state
    setHeaderRect(null);
    setColumns([]);
    setExtractedData(null);
    setPreviewData(null);
  };

  // Rectangle selection and boundary drag handlers
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
    if (headerRect && columns.length > 0 && e.altKey) {
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
    
    // Default header selection
    if (!isSelectingHeader) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageScale;
    const y = (e.clientY - rect.top) / pageScale;
    
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
    
    // Handle rectangle selection
    if (!isDrawing || !startPoint) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageScale;
    const y = (e.clientY - rect.top) / pageScale;
    
    const width = x - startPoint.x;
    const height = y - startPoint.y;
    
    setCurrentRect({
      x: width > 0 ? startPoint.x : x,
      y: height > 0 ? startPoint.y : y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = () => {
    // End boundary dragging
    if (isDraggingBoundary) {
      setIsDraggingBoundary(false);
      setDragInfo(null);
      return;
    }
    
    // End rectangle selection
    if (!isDrawing || !currentRect) return;
    
    setIsDrawing(false);
    setHeaderRect(currentRect);
    setCurrentRect(null);
    setStartPoint(null);
    setIsSelectingHeader(false);
    
    // Auto-extract headers after selection
    if (currentRect.width > 10 && currentRect.height > 5) {
      extractHeadersFromSelection(currentRect);
    }
  };

  // Extract headers from user selection
  const extractHeadersFromSelection = async (rect: {x: number, y: number, width: number, height: number}) => {
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
        // Validate that we got meaningful headers
        const hasValidHeaders = result.columns.some((col: any) => 
          col.name && col.name.trim().length > 0 && col.name !== 'Column 1'
        );
        
        if (hasValidHeaders) {
          setColumns(result.columns);
          setCurrentStep(3);
          setSuccess(`Successfully detected ${result.total_columns} columns`);
        } else {
          setError('Headers detected but appear to be invalid. Please select the transaction table headers (Date, Description, Amount, etc.)');
        }
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
    const updatedColumns = [...columns];
    const column = updatedColumns[columnIndex];
    
    if (edge === 'left') {
      column.x_min = newPosition;
    } else {
      column.x_max = newPosition;
    }
    
    column.width = column.x_max - column.x_min;
    column.user_adjusted = true;
    
    setColumns(updatedColumns);
  };

  // Add new column boundary at exact user click position
  const addColumnBoundary = async (xPosition: number) => {
    if (!pdfFile || !headerRect) return;
    
    // Find which column to split
    const columnToSplit = columns.find(col => col.x_min <= xPosition && xPosition <= col.x_max);
    
    if (columnToSplit) {
      // Get text content within the new right column area to name it properly
      const rightColumnText = await getTextInArea(xPosition, columnToSplit.x_max);
      const leftColumnText = await getTextInArea(columnToSplit.x_min, xPosition);
      
      const updatedColumns = [...columns];
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
      
      setColumns(updatedColumns);
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
    if (columns.length <= 1) return;
    
    const updatedColumns = [...columns];
    const columnToDelete = updatedColumns[columnIndex];
    
    if (columnIndex < columns.length - 1) {
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
    setColumns(updatedColumns);
  };

  // Preview column alignment
  const previewAlignment = async () => {
    if (!pdfFile || columns.length === 0 || !headerRect) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('columns_data', JSON.stringify(columns));
      formData.append('page_number', (currentPage - 1).toString());
      formData.append('max_rows', '10');
      formData.append('header_y', headerRect.y.toString());
      
      const response = await fetch('http://localhost:8000/user-controlled/preview-column-alignment', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to preview alignment');
      }
      
      const result = await response.json();
      setPreviewData(result);
      setShowPreview(true);
      
    } catch (err: any) {
      setError(err.message || 'Failed to preview alignment');
    } finally {
      setIsLoading(false);
    }
  };

  // Extract data using defined columns
  const extractData = async () => {
    if (!pdfFile || columns.length === 0 || !headerRect) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('columns_data', JSON.stringify(columns));
      formData.append('header_y', headerRect.y.toString());
      formData.append('start_page', (currentPage - 1).toString());
      
      const response = await fetch('http://localhost:8000/user-controlled/extract-data-with-columns', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to extract data');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setExtractedData(result);
        setCurrentStep(4);
        setSuccess(`Successfully extracted ${result.total_rows} rows from ${result.pages_processed} pages`);
      } else {
        setError('Data extraction failed');
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to extract data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          User-Controlled Bank Statement Parser
        </h1>
        <p className="text-gray-600">
          Take full control: manually select headers and adjust column boundaries for perfect extraction
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">Success</h3>
            <p className="text-sm text-green-700 mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* Step 1: File Upload */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            1
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Upload PDF</h2>
        </div>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload your bank statement PDF
                  </span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    accept=".pdf"
                    className="sr-only"
                    onChange={handleFileUpload}
                  />
                  <span className="mt-1 block text-sm text-gray-500">
                    Select a PDF file to get started
                  </span>
                </label>
              </div>
            </div>
          </div>

          {pdfFile && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>File:</strong> {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Layout - PDF Left, Controls Right */}
      {pdfFile && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* PDF Viewer - Left Side */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">PDF Viewer</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {numPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                      disabled={currentPage >= numPages}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Zoom:</label>
                    <select
                      value={pageScale}
                      onChange={(e) => setPageScale(parseFloat(e.target.value))}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value={0.5}>50%</option>
                      <option value={0.75}>75%</option>
                      <option value={1.0}>100%</option>
                      <option value={1.25}>125%</option>
                      <option value={1.5}>150%</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-auto bg-gray-50" style={{ maxHeight: '70vh' }}>
                <div ref={pdfContainerRef} className="relative inline-block">
                  <Document
                    file={pdfFile}
                    onLoadSuccess={({ numPages }) => {
                      setNumPages(numPages);
                      setCurrentStep(2);
                    }}
                    onLoadError={() => setError('Failed to load PDF')}
                  >
                    <div
                      className={`relative ${
                        isSelectingHeader ? 'cursor-crosshair' : 
                        isDraggingBoundary ? 'cursor-ew-resize' : 
                        'cursor-default'
                      }`}
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
                      <Page
                        pageNumber={currentPage}
                        scale={pageScale}
                        onLoadSuccess={(page) => {
                          setPageDims({ width: page.width, height: page.height });
                        }}
                      />

                      {/* Header Rectangle Overlay */}
                      {(currentRect || headerRect) && (
                        <div
                          className={`absolute border-2 ${
                            currentRect ? 'border-blue-500 bg-blue-100' : 'border-green-500 bg-green-100'
                          } bg-opacity-30`}
                          style={{
                            left: `${(currentRect || headerRect)!.x * pageScale}px`,
                            top: `${(currentRect || headerRect)!.y * pageScale}px`,
                            width: `${(currentRect || headerRect)!.width * pageScale}px`,
                            height: `${(currentRect || headerRect)!.height * pageScale}px`,
                          }}
                        >
                          {headerRect && (
                            <div className="absolute bg-green-600 text-white px-2 py-1 text-xs rounded" style={{
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: '2px',
                              whiteSpace: 'nowrap'
                            }}>
                              Header Selection
                            </div>
                          )}
                        </div>
                      )}

                      {/* Clean Column Boundaries Overlay */}
                      {columns.length > 0 && headerRect && (
                        <div className="absolute pointer-events-none" style={{
                          left: `${headerRect.x * pageScale}px`,
                          top: `${headerRect.y * pageScale}px`,
                          width: `${headerRect.width * pageScale}px`,
                          height: `${headerRect.height * pageScale}px`,
                        }}>
                          {/* Render single boundary lines between columns only */}
                          {columns.slice(0, -1).map((column, index) => (
                            <div
                              key={index}
                              className="absolute h-full bg-red-500 pointer-events-auto boundary-handle cursor-ew-resize hover:bg-red-700 hover:w-1"
                              style={{
                                left: `${(column.x_max - headerRect.x) * pageScale - 1}px`,
                                width: '2px',
                              }}
                              data-column-index={index}
                              data-edge="right"
                              title="Drag to adjust boundary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedColumnIndex(index);
                              }}
                            />
                          ))}
                          
                          {/* Column labels */}
                          {columns.map((column, index) => (
                            <div
                              key={`label-${index}`}
                              className="absolute top-0 bg-white bg-opacity-90 text-gray-800 px-1 text-xs border border-gray-300 rounded shadow-sm pointer-events-none"
                              style={{
                                left: `${(column.x_min - headerRect.x + (column.width * 0.1)) * pageScale}px`,
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
                    </div>
                  </Document>
                </div>
              </div>
            </div>

            {/* Controls Panel - Right Side */}
            <div className="space-y-6">
              
              {/* Step 2: Header Selection Controls */}
              {currentStep >= 2 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      2
                    </div>
                    <h3 className="font-semibold text-gray-900">Select Header</h3>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Draw a rectangle around the header row to define your columns.
                    </p>
                    
                    <button
                      onClick={() => {
                        setIsSelectingHeader(true);
                        setHeaderRect(null);
                        setColumns([]);
                        setError('');
                        setSuccess('');
                      }}
                      disabled={isLoading}
                      className={`w-full px-4 py-2 rounded-lg flex items-center justify-center space-x-2 ${
                        isSelectingHeader
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Target className="h-4 w-4" />
                      <span>{isSelectingHeader ? 'Selecting...' : 'Select Header Rectangle'}</span>
                    </button>

                    {headerRect && (
                      <div className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                        Header selected: {headerRect.width.toFixed(0)} × {headerRect.height.toFixed(0)} px
                      </div>
                    )}

                    {isSelectingHeader && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-xs text-blue-800 mb-2">
                          <strong>Header Selection Tips:</strong>
                        </p>
                        <ul className="text-xs text-blue-800 space-y-1">
                          <li>• Look for the <strong>transaction table headers</strong> (Date, Description, Amount, etc.)</li>
                          <li>• Usually found on <strong>page 2 or 3</strong> of statements</li>
                          <li>• Draw a tight rectangle around <strong>only the header text</strong></li>
                          <li>• Avoid including data rows or extra spacing</li>
                          <li>• Headers should be in a <strong>single horizontal line</strong></li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Column Adjustment Controls */}
              {currentStep >= 3 && columns.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
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

                    {/* Column List */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900 text-sm">Columns ({columns.length}):</h4>
                      {columns.map((column, index) => (
                        <div key={index} className={`bg-white rounded p-2 border text-xs ${
                          selectedColumnIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={column.name}
                              onChange={(e) => {
                                const updated = [...columns];
                                updated[index].name = e.target.value;
                                updated[index].user_adjusted = true;
                                setColumns(updated);
                              }}
                              className="flex-1 text-xs font-medium bg-transparent border-none focus:outline-none text-gray-900"
                            />
                            <button
                              onClick={() => deleteColumn(index)}
                              disabled={columns.length <= 1}
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
                        disabled={selectedColumnIndex === null || columns.length <= 1}
                        className="w-full px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center justify-center space-x-2 disabled:opacity-50 text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Remove Selected</span>
                      </button>
                      
                      <button
                        onClick={previewAlignment}
                        disabled={isLoading}
                        className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center justify-center space-x-2 text-sm"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </button>
                      
                      <button
                        onClick={extractData}
                        disabled={isLoading}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center space-x-2 text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>{isLoading ? 'Extracting...' : 'Extract Data'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}


      {/* Preview Panel */}
      {showPreview && previewData && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Column Alignment Preview</h3>
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              This preview shows how text will be aligned to your column boundaries:
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map((col) => (
                      <th key={col.index} className="border border-gray-300 px-3 py-2 text-left">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.preview_rows?.slice(0, 5).map((row: any, rowIndex: number) => (
                    <tr key={rowIndex} className="border-b border-gray-200">
                      {columns.map((col) => (
                        <td key={col.index} className="border border-gray-300 px-3 py-2">
                          {row.column_data[col.name]?.map((word: any) => (
                            <span key={word.text} className={`${
                              word.confidence === 'fallback' ? 'bg-red-100' :
                              word.confidence === 'edge' ? 'bg-yellow-100' : 'bg-green-100'
                            } px-1 mr-1 rounded`}>
                              {word.text}
                            </span>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-100 rounded"></div>
                  <span>Well-aligned text</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-yellow-100 rounded"></div>
                  <span>Near boundary (may need adjustment)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-100 rounded"></div>
                  <span>Fallback assignment (adjust boundaries)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Extraction Results */}
      {currentStep >= 4 && extractedData && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep >= 4 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              4
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Extraction Results</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{extractedData.total_rows}</div>
                <div className="text-sm text-blue-800">Rows Extracted</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{extractedData.headers.length}</div>
                <div className="text-sm text-green-800">Columns</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{extractedData.pages_processed}</div>
                <div className="text-sm text-purple-800">Pages Processed</div>
              </div>
            </div>

            {/* Sample Data Table */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Sample Data (first 10 rows):</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      {extractedData.headers.map((header, index) => (
                        <th key={index} className="border border-gray-300 px-3 py-2 text-left font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.data.slice(0, 10).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {extractedData.headers.map((header, colIndex) => (
                          <td key={colIndex} className="border border-gray-300 px-3 py-2">
                            {row[header] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Options */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  const dataStr = JSON.stringify(extractedData, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'extracted_data.json';
                  a.click();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export JSON</span>
              </button>
              
              <button
                onClick={() => {
                  const headers = extractedData.headers;
                  const csvContent = [
                    headers.join(','),
                    ...extractedData.data.map(row => 
                      headers.map(header => `"${(row[header] || '').replace(/"/g, '""')}"`).join(',')
                    )
                  ].join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'extracted_data.csv';
                  a.click();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-900">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserControlledBankParser;