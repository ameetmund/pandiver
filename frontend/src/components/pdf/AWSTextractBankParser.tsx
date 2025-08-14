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
  FileDown
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

interface TextractJob {
  job_id: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  tables?: any[];
  error?: string;
}

interface ExtractedTable {
  table_id: number;
  headers: string[];
  rows: string[][];
  page_number: number;
}

interface MergedData {
  headers: string[];
  rows: string[][];
  total_rows: number;
  source_tables: number;
}

const AWSTextractBankParser: React.FC = () => {
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

  // Textract state
  const [textractJob, setTextractJob] = useState<TextractJob | null>(null);
  const [extractedTables, setExtractedTables] = useState<ExtractedTable[]>([]);
  const [mergedData, setMergedData] = useState<MergedData | null>(null);

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
    setTextractJob(null);
    setExtractedTables([]);
    setMergedData(null);
  };

  // Step 2: Start Textract analysis
  const startTextractAnalysis = async () => {
    if (!pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      const response = await fetch('http://localhost:8000/textract/start-analysis', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start Textract analysis');
      }
      
      const result = await response.json();
      setTextractJob(result);
      setCurrentStep(3);
      
      // Start polling for job completion
      startPolling(result.job_id);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start Textract analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for job completion
  const startPolling = (jobId: string) => {
    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/textract/job-status/${jobId}`);
        if (response.ok) {
          const result = await response.json();
          setTextractJob(result);
          
          if (result.status === 'SUCCEEDED') {
            clearInterval(pollInterval);
            setPolling(false);
            await processTextractResults(jobId);
          } else if (result.status === 'FAILED') {
            clearInterval(pollInterval);
            setPolling(false);
            setError(result.error || 'Textract analysis failed');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Process Textract results
  const processTextractResults = async (jobId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/textract/process-results/${jobId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process results');
      }
      
      const result = await response.json();
      setExtractedTables(result.tables);
      setCurrentStep(4);
      
      // Don't auto-merge tables anymore - show them separately
      // await mergeTablesData(result.tables);
      
    } catch (err: any) {
      setError(err.message || 'Failed to process Textract results');
    } finally {
      setIsLoading(false);
    }
  };

  // Merge all tables into single dataset
  const mergeTablesData = async (tables: ExtractedTable[]) => {
    if (!tables || tables.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/textract/merge-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tables }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to merge tables');
      }
      
      const result = await response.json();
      setMergedData(result);
      setCurrentStep(5);
      
    } catch (err: any) {
      setError(err.message || 'Failed to merge table data');
    } finally {
      setIsLoading(false);
    }
  };

  // Export data in various formats
  const exportData = async (format: 'csv' | 'xlsx' | 'json' | 'xml' | 'txt') => {
    setIsLoading(true);
    try {
      let requestData;
      
      // If we have separate tables, export them individually
      if (extractedTables && extractedTables.length > 0) {
        requestData = { tables: extractedTables };
      } else if (mergedData) {
        requestData = mergedData;
      } else {
        throw new Error('No data available for export');
      }
      
      const response = await fetch(`http://localhost:8000/textract/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to export ${format.toUpperCase()} file`);
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Use zip filename when multiple tables
      if (extractedTables && extractedTables.length > 1) {
        a.download = `bank-statement-tables.zip`;
      } else {
        a.download = `bank-statement-textract.${format}`;
      }
      
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      setError(err.message || `Failed to export ${format.toUpperCase()} file`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset and start over
  const resetParser = () => {
    setPdfFile(null);
    setCurrentStep(1);
    setError('');
    setTextractJob(null);
    setExtractedTables([]);
    setMergedData(null);
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
            <Table className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
            Bank Statement Parser - AWS Textract
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            AI-powered table extraction using Amazon Textract. Upload your PDF and let AWS extract all table data automatically.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {[
              { num: 1, title: 'Upload PDF', icon: Upload, desc: 'Choose your file' },
              { num: 2, title: 'Preview & Extract', icon: Eye, desc: 'Start analysis' },
              { num: 3, title: 'Processing', icon: Loader2, desc: 'AWS Textract' },
              { num: 4, title: 'Review Data', icon: Table, desc: 'Verify results' },
              { num: 5, title: 'Export', icon: Download, desc: 'Download files' },
            ].map(({ num, title, icon: Icon, desc }) => (
              <div key={num} className="flex flex-col items-center relative">
                <div className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500
                  ${currentStep >= num 
                    ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white shadow-lg scale-110' 
                    : 'bg-white text-gray-400 border-2 border-gray-200'
                  }
                `}>
                  {currentStep > num ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : currentStep === num && (num === 3) && polling ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>
                <div className="text-center mt-3">
                  <div className={`font-semibold text-sm ${
                    currentStep >= num ? 'text-[#086C67]' : 'text-gray-400'
                  }`}>
                    {title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{desc}</div>
                </div>
                {num < 5 && (
                  <div className={`
                    absolute top-7 left-16 w-24 h-0.5 transition-colors duration-500
                    ${currentStep > num ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67]' : 'bg-gray-200'}
                  `} />
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
                      Upload Bank Statement
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
                  Supported format: PDF • Maximum size: 10MB
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
                    
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage <= 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Prev
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {numPages}
                      </span>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} 
                        disabled={currentPage >= numPages}
                        className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-center bg-white rounded-xl p-4 border">
                    <Document
                      file={pdfFile}
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      loading={<div className="text-center py-8 text-gray-500">Loading PDF...</div>}
                    >
                      <Page
                        pageNumber={currentPage}
                        scale={pageScale}
                        width={600}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        className="shadow-sm rounded-lg"
                      />
                    </Document>
                  </div>
                  
                  <div className="flex items-center justify-center mt-4 space-x-4">
                    <button 
                      onClick={() => setPageScale(s => Math.max(0.5, s - 0.1))}
                      className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50"
                    >
                      Zoom Out
                    </button>
                    <span className="text-sm text-gray-600">{Math.round(pageScale * 100)}%</span>
                    <button 
                      onClick={() => setPageScale(s => Math.min(2.0, s + 0.1))}
                      className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50"
                    >
                      Zoom In
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Action Panel */}
              <div className="lg:w-80">
                <div className="bg-gradient-to-br from-[#00C7BE]/5 to-[#086C67]/5 rounded-2xl p-6 border">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Ready to Extract</h3>
                  <p className="text-gray-600 mb-6">
                    AWS Textract will analyze your document and extract all table data automatically. This process typically takes 30-60 seconds.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Advanced table detection
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Multi-page processing
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Automatic data merging
                    </div>
                  </div>
                  
                  <div className="mt-8 space-y-3">
                    <button
                      onClick={startTextractAnalysis}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white py-4 rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Starting Analysis...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <Table className="w-5 h-5 mr-2" />
                          Extract Data with AWS Textract
                        </span>
                      )}
                    </button>
                    
                    <button
                      onClick={resetParser}
                      className="w-full border border-gray-300 text-gray-700 py-3 rounded-full font-medium hover:bg-gray-50 transition-colors"
                    >
                      Choose Different File
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {currentStep === 3 && textractJob && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100 text-center">
              <div className="mb-8">
                {textractJob.status === 'IN_PROGRESS' ? (
                  <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {textractJob.status === 'IN_PROGRESS' ? 'Processing Document' : 'Analysis Complete'}
                </h3>
                
                <p className="text-gray-600 mb-6">
                  {textractJob.status === 'IN_PROGRESS' 
                    ? 'AWS Textract is analyzing your document for table data...' 
                    : 'Document analysis completed successfully!'
                  }
                </p>
                
                {textractJob.status === 'IN_PROGRESS' && (
                  <div className="bg-gray-100 rounded-full h-2 mb-4">
                    <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                )}
                
                <div className="text-sm text-gray-500">
                  Job ID: {textractJob.job_id}
                </div>
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
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-6 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Proceed to Export
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl text-center border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">{extractedTables.length}</div>
                <div className="text-blue-800 font-medium">Tables Found</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl text-center border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {extractedTables.reduce((sum, table) => sum + table.rows.length, 0)}
                </div>
                <div className="text-green-800 font-medium">Total Rows</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl text-center border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {Math.max(...extractedTables.map(table => table.page_number)) + 1}
                </div>
                <div className="text-purple-800 font-medium">Pages Processed</div>
              </div>
            </div>
            
            <div className="space-y-8">
              {extractedTables.map((table) => (
                <div key={`${table.table_id}-${table.page_number}`} className="border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-[#00C7BE]/5 to-[#086C67]/5 px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900 text-lg">
                        Table {table.table_id} - Page {table.page_number + 1}
                      </h4>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                          {table.rows.length} rows × {table.headers.length} columns
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gradient-to-r from-[#00C7BE]/10 to-[#086C67]/10">
                        <tr>
                          {table.headers.map((header, idx) => (
                            <th key={idx} className="px-4 py-3 text-left font-medium text-gray-900 border-r last:border-r-0">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.slice(0, 15).map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-gray-50 border-b last:border-b-0">
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-3 text-sm text-gray-700 border-r last:border-r-0">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {table.rows.length > 15 && (
                    <div className="bg-gray-50 px-6 py-3 text-center text-sm text-gray-500 border-t">
                      Showing first 15 of {table.rows.length} rows
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Export */}
        {currentStep === 5 && extractedTables.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Tables Ready for Export</h3>
              <p className="text-gray-600">
                {extractedTables.length > 1 
                  ? `${extractedTables.length} separate tables have been extracted and are ready to download as individual files.`
                  : 'Your table data has been extracted and is ready to download.'
                }
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl text-center border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {extractedTables.reduce((sum, table) => sum + table.rows.length, 0)}
                </div>
                <div className="text-blue-800 font-medium">Total Rows</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl text-center border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">{extractedTables.length}</div>
                <div className="text-green-800 font-medium">Tables</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl text-center border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {Math.max(...extractedTables.map(table => table.page_number)) + 1}
                </div>
                <div className="text-purple-800 font-medium">Pages</div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Download Options {extractedTables.length > 1 && '(ZIP Archive)'}
              </h4>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => exportData('csv')}
                  disabled={isLoading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  CSV Format
                </button>
                <button
                  onClick={() => exportData('xlsx')}
                  disabled={isLoading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  Excel Format
                </button>
                <button
                  onClick={() => exportData('json')}
                  disabled={isLoading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  JSON Format
                </button>
                <button
                  onClick={() => exportData('xml')}
                  disabled={isLoading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  XML Format
                </button>
                <button
                  onClick={() => exportData('txt')}
                  disabled={isLoading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  Text Format
                </button>
              </div>
              
              {extractedTables.length > 1 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3 inline-block">
                    💡 Multiple tables detected! Download will be a ZIP file containing separate files for each table.
                  </p>
                </div>
              )}
            </div>

            {/* Table Summary */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900">Export Summary</h4>
              {extractedTables.map((table) => (
                <div key={`${table.table_id}-${table.page_number}`} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-900">
                        Table {table.table_id} - Page {table.page_number + 1}
                      </h5>
                      <p className="text-sm text-gray-600">
                        {table.rows.length} rows × {table.headers.length} columns
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Headers:</div>
                      <div className="text-sm font-medium text-gray-700">
                        {table.headers.slice(0, 3).join(', ')}
                        {table.headers.length > 3 && ` +${table.headers.length - 3} more`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reset Button */}
            <div className="mt-8 text-center">
              <button
                onClick={resetParser}
                className="px-8 py-3 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
              >
                Process Another Document
              </button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && currentStep !== 3 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-[#00C7BE] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing</h3>
                <p className="text-gray-600">Please wait while we process your request...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AWSTextractBankParser;