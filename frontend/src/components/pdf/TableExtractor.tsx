'use client';

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  Upload, 
  FileText, 
  Eye, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Table,
  FileDown,
  Check,
  Grid,
  Settings
} from 'lucide-react';

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { 
  ssr: false,
  loading: () => <div className="text-center p-4 text-gray-500">Loading PDF viewer...</div>
});
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { 
  ssr: false,
  loading: () => <div className="text-center p-2 text-gray-400">Loading page...</div>
});

// Set PDF.js worker source when component mounts
const usePdfWorker = () => {
  React.useEffect(() => {
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

interface TableExtractionJob {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  tables?: ExtractedTable[];
  error?: string;
}

interface ExtractedTable {
  table_id: string;
  method: 'camelot_lattice' | 'camelot_stream' | 'paddleocr_structure';
  confidence: number;
  rows: number;
  columns: number;
  bbox: [number, number, number, number];
  data: string[][];
  page: number;
}

const TableExtractor: React.FC = () => {
  // Initialize PDF worker
  usePdfWorker();
  
  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageScale, setPageScale] = useState<number>(1.0);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Extraction state
  const [extractionJob, setExtractionJob] = useState<TableExtractionJob | null>(null);
  const [extractedTables, setExtractedTables] = useState<ExtractedTable[]>([]);

  // Settings
  const [extractionSettings, setExtractionSettings] = useState({
    prefer_native: true,
    ocr_fallback: true,
    confidence_threshold: 0.5,
    merge_nearby_tables: false
  });

  // Polling for job status
  const [polling, setPolling] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    
    setPdfFile(file);
    setError('');
    setCurrentStep(2);
    
    // Reset state
    setExtractionJob(null);
    setExtractedTables([]);
  };

  // Step 2: Start table extraction
  const startTableExtraction = async () => {
    if (!pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('prefer_native', extractionSettings.prefer_native.toString());
      formData.append('ocr_fallback', extractionSettings.ocr_fallback.toString());
      formData.append('confidence_threshold', extractionSettings.confidence_threshold.toString());
      formData.append('merge_nearby', extractionSettings.merge_nearby_tables.toString());
      
      const response = await fetch('http://localhost:8000/api/v1/table-extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start table extraction');
      }
      
      const result = await response.json();
      setExtractionJob(result);
      setCurrentStep(3);
      
      // Start polling for job completion
      startPolling(result.job_id);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start table extraction');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for job completion
  const startPolling = (jobId: string) => {
    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/table-extract/${jobId}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });
        if (response.ok) {
          const result = await response.json();
          setExtractionJob(prev => ({ ...prev!, ...result }));
          
          if (result.status === 'completed') {
            // Handle different result formats from the backend
            let tables = [];
            if (result.result?.tables) {
              tables = result.result.tables;
            } else if (Array.isArray(result.result)) {
              tables = result.result;
            }
            
            setExtractedTables(tables);
            setCurrentStep(4);
            setPolling(false);
            clearInterval(pollInterval);
          } else if (result.status === 'failed') {
            setError(result.error || 'Table extraction failed');
            setPolling(false);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  // Export data in various formats
  const exportData = async (format: 'csv' | 'xlsx' | 'json' | 'txt') => {
    if (!extractionJob?.job_id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/table-extract/${extractionJob.job_id}/download?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to export ${format.toUpperCase()} file`);
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tables_${extractionJob.job_id}.${format === 'xlsx' ? 'zip' : format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      setError(err.message || `Failed to export ${format.toUpperCase()} file`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset and start over
  const resetExtractor = () => {
    setPdfFile(null);
    setCurrentStep(1);
    setError('');
    setExtractionJob(null);
    setExtractedTables([]);
    setPolling(false);
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mb-6">
            <Grid className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
            Table Extractor
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Extract tables from any PDF using OCR and native parsing. Supports both digital and scanned documents with high accuracy.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-start justify-between max-w-6xl mx-auto px-8">
            {[
              { num: 1, title: 'Upload PDF', icon: Upload, desc: 'Choose your file' },
              { num: 2, title: 'Preview & Extract', icon: Eye, desc: 'Start analysis' },
              { num: 3, title: 'Processing', icon: Loader2, desc: 'Table Extraction' },
              { num: 4, title: 'Review Data', icon: Table, desc: 'Verify results' },
              { num: 5, title: 'Export', icon: Download, desc: 'Download files' },
            ].map(({ num, title, icon: Icon, desc }, index) => (
              <div key={num} className="flex items-start relative">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 z-10 relative
                    ${currentStep >= num 
                      ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white shadow-lg scale-110' 
                      : 'bg-white text-gray-400 border-2 border-gray-200'
                    }
                  `}>
                    {currentStep > num ? (
                      <Check className="w-6 h-6" />
                    ) : currentStep === num && (num === 3) && polling ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-center mt-4 min-w-[140px]">
                    <div className={`font-semibold text-sm ${
                      currentStep >= num ? 'text-[#086C67]' : 'text-gray-400'
                    }`}>
                      {title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{desc}</div>
                  </div>
                </div>
                {index < 4 && (
                  <div className={`
                    absolute top-7 left-14 h-0.5 transition-colors duration-500 z-0
                    ${currentStep > num ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67]' : 'bg-gray-200'}
                  `} 
                  style={{
                    width: 'calc(100vw / 5 + 3rem)',
                    maxWidth: '240px'
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start">
              <AlertCircle className="w-6 h-6 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">Error</h3>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="mt-3 text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
              <div className="text-center">
                <div className="border-2 border-dashed border-[#00C7BE] rounded-2xl p-12 hover:border-[#086C67] transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mb-6">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      Upload PDF Document
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Choose a PDF file or drag and drop it here
                    </p>
                    <div className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                      <FileText className="w-5 h-5 mr-2" />
                      Choose PDF File
                    </div>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-6">
                  Supported format: PDF • Maximum size: 100MB • Up to 500 pages
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Preview & Extract */}
        {currentStep === 2 && pdfFile && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* PDF Preview */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <Eye className="w-6 h-6 mr-2 text-[#086C67]" />
                  Document Preview
                </h3>
                
                <div className="bg-gray-50 rounded-2xl p-6 border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">{pdfFile.name}</span>
                      <span className="ml-2">({(pdfFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 bg-white rounded-full px-3 py-1 border border-gray-200 shadow-sm">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                          disabled={currentPage <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="text-sm font-bold">‹</span>
                        </button>
                        <span className="text-sm text-gray-600 px-2">
                          {currentPage} / {numPages}
                        </span>
                        <button 
                          onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} 
                          disabled={currentPage >= numPages}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="text-sm font-bold">›</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[500px] flex items-center justify-center">
                    <Document
                      file={pdfFile}
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      className="max-w-full"
                    >
                      <Page 
                        pageNumber={currentPage} 
                        scale={pageScale}
                        className="shadow-lg rounded-lg"
                      />
                    </Document>
                  </div>
                </div>
              </div>

              {/* Extraction Settings & Start */}
              <div className="lg:w-96">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <Settings className="w-6 h-6 mr-2 text-[#086C67]" />
                  Extraction Settings
                </h3>
                
                <div className="bg-gray-50 rounded-2xl p-6 border space-y-6">
                  <div>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={extractionSettings.prefer_native}
                        onChange={(e) => setExtractionSettings(prev => ({...prev, prefer_native: e.target.checked}))}
                        className="w-4 h-4 text-[#00C7BE] border-gray-300 rounded focus:ring-[#00C7BE]"
                      />
                      <span className="text-sm font-medium text-gray-700">Prefer native PDF extraction</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-7">Faster for digital PDFs with selectable text</p>
                  </div>

                  <div>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={extractionSettings.ocr_fallback}
                        onChange={(e) => setExtractionSettings(prev => ({...prev, ocr_fallback: e.target.checked}))}
                        className="w-4 h-4 text-[#00C7BE] border-gray-300 rounded focus:ring-[#00C7BE]"
                      />
                      <span className="text-sm font-medium text-gray-700">Use OCR fallback</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-7">Enable for scanned PDFs and images</p>
                  </div>

                  <div>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={extractionSettings.merge_nearby_tables}
                        onChange={(e) => setExtractionSettings(prev => ({...prev, merge_nearby_tables: e.target.checked}))}
                        className="w-4 h-4 text-[#00C7BE] border-gray-300 rounded focus:ring-[#00C7BE]"
                      />
                      <span className="text-sm font-medium text-gray-700">Merge nearby tables</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-7">Combine tables that are close together</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confidence Threshold: {Math.round(extractionSettings.confidence_threshold * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={extractionSettings.confidence_threshold}
                      onChange={(e) => setExtractionSettings(prev => ({...prev, confidence_threshold: parseFloat(e.target.value)}))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum confidence for table detection</p>
                  </div>

                  <button
                    onClick={startTableExtraction}
                    disabled={isLoading}
                    className="w-full px-6 py-4 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-2xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Starting Extraction...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Grid className="w-5 h-5 mr-2" />
                        Extract Tables
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {currentStep === 3 && extractionJob && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Extracting Tables...
                </h3>
                <p className="text-gray-600 mb-6">
                  Our AI is analyzing your document and extracting table data. This may take a few moments.
                </p>
                <div className="bg-gray-100 rounded-full h-2 mb-4">
                  <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] h-2 rounded-full transition-all duration-300" 
                       style={{ width: '75%' }}></div>
                </div>
                <p className="text-sm text-gray-500">
                  Status: {extractionJob.status} • Job ID: {extractionJob.job_id}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review Data */}
        {currentStep === 4 && extractedTables.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                <Table className="w-7 h-7 mr-3 text-[#086C67]" />
                Extracted Tables ({extractedTables.length})
              </h3>
              <button
                onClick={() => setCurrentStep(5)}
                className="px-6 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
              >
                Proceed to Export
              </button>
            </div>

            <div className="space-y-6">
              {extractedTables.map((table) => (
                <div key={table.table_id} className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="font-semibold text-gray-900">Table {table.table_id}</span>
                      <span className="text-sm text-gray-500">
                        {table.rows} rows × {table.columns} columns
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                        {table.method || 'unknown'}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        {Math.round((table.confidence || 0) * 100)}% confidence
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                        Page {table.page || 1}
                      </span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <tbody>
                        {table.data && table.data.slice(0, 5).map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-50' : 'bg-white'}>
                            {row.slice(0, 6).map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-3 py-2 border border-gray-200 truncate max-w-32 text-gray-900 bg-white">
                                {cell || '-'}
                              </td>
                            ))}
                            {row.length > 6 && (
                              <td className="px-3 py-2 border border-gray-200 text-gray-500 bg-white">
                                +{row.length - 6} more
                              </td>
                            )}
                          </tr>
                        ))}
                        {table.data && table.data.length > 5 && (
                          <tr className="bg-white">
                            <td colSpan={Math.min(table.columns, 7)} className="px-3 py-2 text-center text-gray-500 text-xs bg-white">
                              +{table.data.length - 5} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Export */}
        {currentStep === 5 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mb-6 mx-auto">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Extraction Complete!
                </h3>
                <p className="text-gray-600 mb-6">
                  Your tables have been successfully extracted. Choose your preferred download format.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { format: 'xlsx', label: 'Excel (.xlsx)', desc: 'Multiple sheets', icon: '📊' },
                  { format: 'csv', label: 'CSV (.csv)', desc: 'Comma separated', icon: '📄' },
                  { format: 'json', label: 'JSON (.json)', desc: 'Structured data', icon: '🔗' },
                  { format: 'txt', label: 'Text (.txt)', desc: 'Plain text', icon: '📝' },
                ].map(({ format, label, desc, icon }) => (
                  <button
                    key={format}
                    onClick={() => exportData(format as any)}
                    disabled={isLoading}
                    className="p-4 border border-gray-200 rounded-xl hover:border-[#00C7BE] hover:bg-[#00C7BE]/5 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center mb-2">
                      <span className="text-xl mr-2">{icon}</span>
                      <span className="font-semibold text-gray-900">{label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={resetExtractor}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Extract Another File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableExtractor;