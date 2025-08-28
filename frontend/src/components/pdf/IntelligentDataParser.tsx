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
  FileType,
  FileDown,
  Check,
  Filter
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

interface IntelligentDataJob {
  job_id: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  error?: string;
}

interface ExtractedTable {
  table_id: number;
  headers: string[];
  rows: string[][];
  page_number: number;
}

interface KeyValuePair {
  key: string;
  value: string;
  confidence: number;
}

interface FormData {
  page_number: number;
  key_value_pairs: KeyValuePair[];
}

interface IntelligentDataResults {
  success: boolean;
  tables: ExtractedTable[];
  total_tables: number;
  forms_data: FormData[];
  total_pages: number;
}

interface MergedData {
  headers: string[];
  rows: string[][];
  total_rows: number;
  source_tables: number;
}

type TabType = 'tables' | 'keyvalues';

const IntelligentDataParser: React.FC = () => {
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

  // Intelligent Data job state
  const [intelligentDataJob, setIntelligentDataJob] = useState<IntelligentDataJob | null>(null);
  const [extractedData, setExtractedData] = useState<IntelligentDataResults | null>(null);
  const [mergedData, setMergedData] = useState<MergedData | null>(null);
  
  // Active tab and filtering
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectedKeyValues, setSelectedKeyValues] = useState<{[pageNumber: number]: number[]}>({});
  const [exportMode, setExportMode] = useState<'individual' | 'merged'>('individual');

  // Polling for job status
  const [polling, setPolling] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get clean filename without extension
  const getCleanFileName = (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '-');
  };

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
    setIntelligentDataJob(null);
    setExtractedData(null);
    setMergedData(null);
    setSelectedTables([]);
    setSelectedPages([]);
    setSelectedKeyValues({});
  };

  // Step 2: Start Intelligent Data analysis
  const startIntelligentDataAnalysis = async () => {
    if (!pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      const response = await fetch('http://localhost:8000/azure-di/intelligent-data/start-analysis', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start intelligent data analysis');
      }
      
      const result = await response.json();
      setIntelligentDataJob(result);
      setCurrentStep(3);
      
      // Start polling for job completion
      startPolling(result.job_id);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start intelligent data analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for job completion
  const startPolling = (jobId: string) => {
    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/azure-di/intelligent-data/job-status/${jobId}`);
        if (response.ok) {
          const result = await response.json();
          setIntelligentDataJob(result);
          
          if (result.status === 'SUCCEEDED') {
            clearInterval(pollInterval);
            setPolling(false);
            await processIntelligentDataResults(jobId);
          } else if (result.status === 'FAILED') {
            clearInterval(pollInterval);
            setPolling(false);
            setError(result.error || 'Intelligent data analysis failed');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Process Intelligent Data results
  const processIntelligentDataResults = async (jobId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/azure-di/intelligent-data/process-results/${jobId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process results');
      }
      
      const result = await response.json();
      setExtractedData(result);
      
      // Initialize selection - all tables and pages selected by default
      if (result.tables) {
        setSelectedTables(result.tables.map((t: ExtractedTable) => t.table_id));
      }
      if (result.forms_data) {
        setSelectedPages(result.forms_data.map((f: FormData) => f.page_number));
        // Initialize all key-value pairs as selected
        const initialKeyValues: {[pageNumber: number]: number[]} = {};
        result.forms_data.forEach((page: FormData) => {
          initialKeyValues[page.page_number] = Array.from(
            { length: page.key_value_pairs.length }, 
            (_, index) => index
          );
        });
        setSelectedKeyValues(initialKeyValues);
      }
      
      setCurrentStep(4);
      
    } catch (err: any) {
      setError(err.message || 'Failed to process intelligent data results');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle table selection
  const handleTableSelect = (tableId: number) => {
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(id => id !== tableId)
        : [...prev, tableId]
    );
  };

  // Handle page selection
  const handlePageSelect = (pageNumber: number) => {
    setSelectedPages(prev => 
      prev.includes(pageNumber) 
        ? prev.filter(p => p !== pageNumber)
        : [...prev, pageNumber]
    );
  };

  // Handle individual key-value pair selection
  const handleKeyValueSelect = (pageNumber: number, kvIndex: number) => {
    setSelectedKeyValues(prev => {
      const pageSelections = prev[pageNumber] || [];
      const isSelected = pageSelections.includes(kvIndex);
      
      return {
        ...prev,
        [pageNumber]: isSelected 
          ? pageSelections.filter(i => i !== kvIndex)
          : [...pageSelections, kvIndex]
      };
    });
  };

  // Select all key-value pairs for a page
  const handleSelectAllKeyValues = (pageNumber: number, totalCount: number) => {
    setSelectedKeyValues(prev => ({
      ...prev,
      [pageNumber]: Array.from({ length: totalCount }, (_, index) => index)
    }));
  };

  // Clear all key-value pairs for a page
  const handleClearAllKeyValues = (pageNumber: number) => {
    setSelectedKeyValues(prev => ({
      ...prev,
      [pageNumber]: []
    }));
  };

  // Merge selected tables
  const mergeTablesData = async () => {
    if (!extractedData || selectedTables.length === 0) return;
    
    const tablesToMerge = extractedData.tables.filter(table => 
      selectedTables.includes(table.table_id)
    );
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/azure-di/intelligent-tables/merge-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tables: tablesToMerge }),
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
  const exportData = async (format: 'csv' | 'xlsx' | 'json' | 'xml' | 'txt', dataType: TabType, useMerged = false) => {
    if (!extractedData || !pdfFile) return;
    
    setIsLoading(true);
    try {
      let requestData;
      let endpoint;
      let baseFileName = getCleanFileName(pdfFile.name);
      
      if (dataType === 'tables') {
        if (useMerged && mergedData) {
          requestData = mergedData;
          endpoint = `http://localhost:8000/azure-di/intelligent-data/export-tables/${format}`;
        } else {
          // Filter selected tables
          const filteredTables = extractedData.tables.filter(table => 
            selectedTables.includes(table.table_id)
          );
          requestData = { tables: filteredTables };
          endpoint = `http://localhost:8000/azure-di/intelligent-data/export-tables/${format}`;
        }
      } else {
        // Filter selected pages
        const filteredFormData = extractedData.forms_data.filter(form => 
          selectedPages.includes(form.page_number)
        );
        requestData = { forms_data: filteredFormData };
        endpoint = `http://localhost:8000/azure-di/intelligent-data/export-key-values/${format}`;
      }
      
      const response = await fetch(endpoint, {
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
      
      // Use original filename with proper naming convention
      if (dataType === 'tables') {
        if (useMerged && mergedData) {
          a.download = `${baseFileName}-Tables-Merged.${format}`;
        } else if (selectedTables.length > 1) {
          a.download = `${baseFileName}-Tables.zip`;
        } else {
          const table = extractedData.tables.find(t => selectedTables.includes(t.table_id));
          a.download = `${baseFileName}-Table-Page${table ? table.page_number + 1 : 1}.${format}`;
        }
      } else {
        if (selectedPages.length > 1) {
          a.download = `${baseFileName}-KeyValues.zip`;
        } else {
          a.download = `${baseFileName}-KeyValue-Page${selectedPages[0] + 1}.${format}`;
        }
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
    setIntelligentDataJob(null);
    setExtractedData(null);
    setMergedData(null);
    setPolling(false);
    setCurrentPage(1);
    setSelectedTables([]);
    setSelectedPages([]);
    setSelectedKeyValues({});
    setActiveTab('tables');
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
            <FileType className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
            Intelligent Data Parser
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Advanced intelligent table and key-value extraction. Upload your PDF and let cutting-edge AI extract both table data and form fields in a single analysis.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-start justify-between max-w-6xl mx-auto px-8">
            {[
              { num: 1, title: 'Upload PDF', icon: Upload, desc: 'Choose your file' },
              { num: 2, title: 'Preview & Extract', icon: Eye, desc: 'Start analysis' },
              { num: 3, title: 'Processing', icon: Loader2, desc: 'AI Extraction' },
              { num: 4, title: 'Review & Filter', icon: Filter, desc: 'Select & filter' },
              { num: 5, title: 'Export', icon: Download, desc: 'Download files' },
            ].map(({ num, title, icon: Icon, desc }, index) => (
              <div key={num} className="flex items-start relative">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => {
                      if (num <= currentStep || (num === 2 && pdfFile) || (num === 4 && extractedData) || (num === 5 && extractedData)) {
                        setCurrentStep(num);
                      }
                    }}
                    disabled={num > currentStep && !(num === 2 && pdfFile) && !(num === 4 && extractedData) && !(num === 5 && extractedData)}
                    className={`
                      w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 z-10 relative
                      ${currentStep >= num 
                        ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white shadow-lg scale-110 hover:shadow-xl cursor-pointer' 
                        : (num <= currentStep || (num === 2 && pdfFile) || (num === 4 && extractedData) || (num === 5 && extractedData))
                          ? 'bg-white text-gray-400 border-2 border-gray-200 hover:border-[#00C7BE] cursor-pointer'
                          : 'bg-white text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                      }
                    `}>
                    {currentStep > num ? (
                      <Check className="w-6 h-6" />
                    ) : currentStep === num && (num === 3) && polling ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </button>
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
                      Upload Document
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
                    
                    <div className="flex items-center space-x-4">
                      {/* Page Navigation */}
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

                      {/* Zoom Controls */}
                      <div className="flex items-center space-x-2 bg-white rounded-full px-3 py-1 border border-gray-200 shadow-sm">
                        <button 
                          onClick={() => setPageScale(s => Math.max(0.5, s - 0.1))}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-sm font-bold">−</span>
                        </button>
                        <span className="text-sm text-gray-600 px-2 min-w-[3rem] text-center">
                          {Math.round(pageScale * 100)}%
                        </span>
                        <button 
                          onClick={() => setPageScale(s => Math.min(2.0, s + 0.1))}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-sm font-bold">+</span>
                        </button>
                      </div>
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
                </div>
              </div>
              
              {/* Action Panel */}
              <div className="lg:w-80">
                <div className="bg-gradient-to-br from-[#00C7BE]/5 to-[#086C67]/5 rounded-2xl p-6 border">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Ready to Extract</h3>
                  <p className="text-gray-600 mb-6">
                    Our intelligent AI will analyze your document and extract both table data and key-value pairs with superior accuracy. This process typically takes 30-60 seconds.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Intelligent table detection
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Advanced key-value extraction
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Single combined analysis
                    </div>
                  </div>
                  
                  <div className="mt-8 space-y-3">
                    <button
                      onClick={startIntelligentDataAnalysis}
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
                          <FileType className="w-5 h-5 mr-2" />
                          Extract with AI
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
        {currentStep === 3 && intelligentDataJob && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100 text-center">
              <div className="mb-8">
                {intelligentDataJob.status === 'IN_PROGRESS' ? (
                  <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {intelligentDataJob.status === 'IN_PROGRESS' ? 'Processing Document' : 'Analysis Complete'}
                </h3>
                
                <p className="text-gray-600 mb-6">
                  {intelligentDataJob.status === 'IN_PROGRESS' 
                    ? 'AI is analyzing your document for intelligent data extraction...' 
                    : 'Document analysis completed successfully!'
                  }
                </p>
                
                {intelligentDataJob.status === 'IN_PROGRESS' && (
                  <div className="bg-gray-100 rounded-full h-2 mb-4">
                    <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                )}
                
                <div className="text-sm text-gray-500">
                  Job ID: {intelligentDataJob.job_id}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Filter Data */}
        {currentStep === 4 && extractedData && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            {/* Tab Headers */}
            <div className="border-b border-gray-200 mb-8">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`px-8 py-4 font-medium text-sm border-b-2 transition-colors duration-200 ${
                    activeTab === 'tables'
                      ? 'border-[#00C7BE] text-[#086C67] bg-[#00C7BE]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Tables ({extractedData.total_tables})
                </button>
                <button
                  onClick={() => setActiveTab('keyvalues')}
                  className={`px-8 py-4 font-medium text-sm border-b-2 transition-colors duration-200 ${
                    activeTab === 'keyvalues'
                      ? 'border-[#00C7BE] text-[#086C67] bg-[#00C7BE]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Key-Value Pairs ({extractedData.total_pages} pages)
                </button>
              </nav>
            </div>

            {/* Proceed Button */}
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                <Filter className="w-7 h-7 mr-3 text-[#086C67]" />
                Review & Filter Data
              </h3>
              
              <button
                onClick={() => setCurrentStep(5)}
                className="px-8 py-4 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-xl hover:from-[#006CBE] hover:to-[#004A85] transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
              >
                Proceed to Export
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl text-center border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">{extractedData.total_tables}</div>
                <div className="text-blue-800 font-medium">Tables Found</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl text-center border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {extractedData.tables.reduce((sum, table) => sum + table.rows.length, 0)}
                </div>
                <div className="text-green-800 font-medium">Total Rows</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl text-center border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {extractedData.forms_data.reduce((sum, page) => sum + page.key_value_pairs.length, 0)}
                </div>
                <div className="text-purple-800 font-medium">Key-Value Pairs</div>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'tables' && (
              <div>
                {/* Tables Selection */}
                <div className="mb-6 flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setSelectedTables(extractedData.tables.map(t => t.table_id))}
                      className="text-sm text-[#086C67] hover:underline hover:bg-[#00C7BE]/10 px-2 py-1 rounded transition-colors duration-200"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedTables([])}
                      className="text-sm text-gray-500 hover:underline hover:bg-gray-100 px-2 py-1 rounded transition-colors duration-200"
                    >
                      Clear Selection
                    </button>
                    <span className="text-sm text-gray-600">
                      ({selectedTables.length}/{extractedData.tables.length} selected)
                    </span>
                  </div>
                </div>

                {/* Tables List */}
                <div className="space-y-6">
                  {extractedData.tables.map((table) => (
                    <div key={table.table_id} className="border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="bg-gradient-to-r from-[#00C7BE]/5 to-[#086C67]/5 px-6 py-4 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedTables.includes(table.table_id)}
                              onChange={() => handleTableSelect(table.table_id)}
                              className="mr-3 w-4 h-4 text-[#00C7BE] border-gray-300 rounded focus:ring-[#00C7BE]"
                            />
                            <h4 className="font-semibold text-gray-900 text-lg">
                              Table {table.table_id} - Page {table.page_number + 1}
                            </h4>
                          </div>
                          <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                            {table.rows.length} rows × {table.headers.length} columns
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

            {activeTab === 'keyvalues' && (
              <div>
                {/* Pages Selection */}
                <div className="mb-6 flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setSelectedPages(extractedData.forms_data.map(f => f.page_number))}
                      className="text-sm text-[#086C67] hover:underline hover:bg-[#00C7BE]/10 px-2 py-1 rounded transition-colors duration-200"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedPages([])}
                      className="text-sm text-gray-500 hover:underline hover:bg-gray-100 px-2 py-1 rounded transition-colors duration-200"
                    >
                      Clear Selection
                    </button>
                    <span className="text-sm text-gray-600">
                      ({selectedPages.length}/{extractedData.forms_data.length} pages selected)
                    </span>
                  </div>
                </div>

                {/* Key-Values by Page */}
                <div className="space-y-6">
                  {extractedData.forms_data.map((pageData) => (
                    <div key={pageData.page_number} className="border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="bg-gradient-to-r from-[#00C7BE]/5 to-[#086C67]/5 px-6 py-4 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedPages.includes(pageData.page_number)}
                              onChange={() => handlePageSelect(pageData.page_number)}
                              className="mr-3 w-4 h-4 text-[#00C7BE] border-gray-300 rounded focus:ring-[#00C7BE]"
                            />
                            <h4 className="font-semibold text-gray-900 text-lg">
                              Page {pageData.page_number + 1}
                            </h4>
                          </div>
                          <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                            {pageData.key_value_pairs.length} key-value pairs
                          </div>
                        </div>
                      </div>
                      
                      {pageData.key_value_pairs.length > 0 ? (
                        <div className="p-6">
                          {/* Individual Key-Value Selection */}
                          <div className="mb-4 flex justify-between items-center">
                            <div className="flex items-center space-x-4">
                              <button
                                onClick={() => handleSelectAllKeyValues(pageData.page_number, pageData.key_value_pairs.length)}
                                className="text-sm text-[#086C67] hover:underline hover:bg-[#00C7BE]/10 px-2 py-1 rounded transition-colors duration-200"
                              >
                                Select All
                              </button>
                              <button
                                onClick={() => handleClearAllKeyValues(pageData.page_number)}
                                className="text-sm text-gray-500 hover:underline hover:bg-gray-100 px-2 py-1 rounded transition-colors duration-200"
                              >
                                Clear All
                              </button>
                              <span className="text-sm text-gray-600">
                                ({(selectedKeyValues[pageData.page_number] || []).length}/{pageData.key_value_pairs.length} pairs selected)
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid gap-4">
                            {pageData.key_value_pairs.slice(0, 10).map((kvp, index) => (
                              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center mr-4">
                                  <input
                                    type="checkbox"
                                    checked={(selectedKeyValues[pageData.page_number] || []).includes(index)}
                                    onChange={() => handleKeyValueSelect(pageData.page_number, index)}
                                    className="w-4 h-4 text-[#00C7BE] border-gray-300 rounded focus:ring-[#00C7BE]"
                                  />
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">Key</div>
                                    <div className="text-sm text-gray-900">{kvp.key || 'Empty Key'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">Value</div>
                                    <div className="text-sm text-gray-900">{kvp.value || 'Empty Value'}</div>
                                  </div>
                                </div>
                                {kvp.confidence !== undefined && (
                                  <div className="ml-4">
                                    <div className="text-xs font-medium text-gray-500 mb-1">Confidence Level</div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      kvp.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                                      kvp.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {(kvp.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {pageData.key_value_pairs.length > 10 && (
                            <div className="text-center text-sm text-gray-500 mt-4">
                              Showing first 10 of {pageData.key_value_pairs.length} pairs
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-gray-500">
                          No key-value pairs found on this page
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Export */}
        {currentStep === 5 && extractedData && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Data Ready for Export</h3>
              <p className="text-gray-600">
                Your intelligent data extraction is complete and ready to download in your preferred format.
              </p>
            </div>

            {/* Tab Headers */}
            <div className="border-b border-gray-200 mb-8">
              <nav className="flex justify-center">
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`px-8 py-4 font-medium text-sm border-b-2 transition-colors duration-200 ${
                    activeTab === 'tables'
                      ? 'border-[#00C7BE] text-[#086C67] bg-[#00C7BE]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Export Tables ({selectedTables.length})
                </button>
                <button
                  onClick={() => setActiveTab('keyvalues')}
                  className={`px-8 py-4 font-medium text-sm border-b-2 transition-colors duration-200 ${
                    activeTab === 'keyvalues'
                      ? 'border-[#00C7BE] text-[#086C67] bg-[#00C7BE]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Export Key-Values ({selectedPages.length} pages)
                </button>
              </nav>
            </div>

            {/* Export Options */}
            {activeTab === 'tables' && (
              <div className="text-center">
                <h4 className="text-lg font-semibold text-gray-900 mb-6">
                  Export Tables
                </h4>
                
                {/* Export Mode Toggle (only show if multiple tables selected) */}
                {selectedTables.length > 1 && (
                  <div className="mb-8">
                    <div className="inline-flex bg-gray-100 rounded-full p-1">
                      <button
                        onClick={() => setExportMode('individual')}
                        className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                          exportMode === 'individual'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Individual Tables
                      </button>
                      <button
                        onClick={() => setExportMode('merged')}
                        className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                          exportMode === 'merged'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Merged Tables
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Individual Export */}
                {exportMode === 'individual' && (
                  <div className="p-6 bg-gray-50 rounded-2xl max-w-2xl mx-auto">
                    <h5 className="text-md font-semibold text-gray-900 mb-4">
                      {selectedTables.length > 1 ? 'Export as ZIP Archive' : 'Export Single Table'}
                    </h5>
                    <p className="text-sm text-gray-600 mb-6">
                      {selectedTables.length > 1 
                        ? 'Each table will be exported as a separate file within a ZIP archive.'
                        : 'Export the selected table in your preferred format.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                      {['csv', 'xlsx', 'json', 'txt'].map((format) => {
                        const getButtonStyle = (fmt: string) => {
                          switch (fmt) {
                            case 'csv':
                              return 'bg-gradient-to-r from-green-500 to-green-600 hover:shadow-xl hover:from-green-600 hover:to-green-700';
                            case 'xlsx':
                              return 'bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-xl hover:from-blue-600 hover:to-blue-700';
                            case 'json':
                              return 'bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-xl hover:from-purple-600 hover:to-purple-700';
                            case 'txt':
                              return 'bg-gradient-to-r from-gray-500 to-gray-600 hover:shadow-xl hover:from-gray-600 hover:to-gray-700';
                            default:
                              return 'bg-gradient-to-r from-gray-500 to-gray-600 hover:shadow-xl hover:from-gray-600 hover:to-gray-700';
                          }
                        };
                        return (
                        <button
                          key={format}
                          onClick={() => exportData(format as any, 'tables', false)}
                          disabled={isLoading || selectedTables.length === 0}
                          className={`flex items-center px-6 py-3 ${getButtonStyle(format)} text-white rounded-full font-semibold transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none`}
                        >
                          <FileDown className="w-5 h-5 mr-2" />
                          {format.toUpperCase()}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Merged Export */}
                {exportMode === 'merged' && selectedTables.length > 1 && (
                  <div className="p-6 bg-blue-50 rounded-2xl max-w-2xl mx-auto">
                    <h5 className="text-md font-semibold text-blue-900 mb-4">
                      Export as Single Merged File
                    </h5>
                    <p className="text-sm text-blue-700 mb-6">
                      All selected tables will be combined into a single file with proper spacing between tables.
                    </p>
                    
                    {/* Merge Button */}
                    {!mergedData && (
                      <div className="mb-6">
                        <button
                          onClick={mergeTablesData}
                          disabled={isLoading}
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Merging Tables...
                            </>
                          ) : (
                            <>
                              <FileType className="w-5 h-5 mr-2" />
                              Merge Selected Tables
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Merged Success Message */}
                    {mergedData && (
                      <div className="mb-6">
                        <span className="bg-green-100 text-green-800 text-sm px-4 py-2 rounded-full">
                          ✓ Tables merged successfully - {mergedData.source_tables} tables, {mergedData.total_rows} total rows
                        </span>
                      </div>
                    )}
                    
                    {/* Download Buttons */}
                    {mergedData && (
                      <div className="flex flex-wrap justify-center gap-4">
                        {['csv', 'xlsx', 'json', 'txt'].map((format) => {
                          const getButtonStyle = (fmt: string) => {
                            switch (fmt) {
                              case 'csv':
                                return 'bg-gradient-to-r from-green-500 to-green-600 hover:shadow-xl hover:from-green-600 hover:to-green-700';
                              case 'xlsx':
                                return 'bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-xl hover:from-blue-600 hover:to-blue-700';
                              case 'json':
                                return 'bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-xl hover:from-purple-600 hover:to-purple-700';
                              case 'txt':
                                return 'bg-gradient-to-r from-gray-500 to-gray-600 hover:shadow-xl hover:from-gray-600 hover:to-gray-700';
                              default:
                                return 'bg-gradient-to-r from-gray-500 to-gray-600 hover:shadow-xl hover:from-gray-600 hover:to-gray-700';
                            }
                          };
                          return (
                          <button
                            key={`merged-${format}`}
                            onClick={() => exportData(format as any, 'tables', true)}
                            disabled={isLoading}
                            className={`flex items-center px-6 py-3 ${getButtonStyle(format)} text-white rounded-full font-semibold transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none`}
                          >
                            <FileDown className="w-5 h-5 mr-2" />
                            {format.toUpperCase()}
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'keyvalues' && (
              <div className="text-center">
                <h4 className="text-lg font-semibold text-gray-900 mb-6">
                  Export Key-Value Pairs
                </h4>
                <div className="p-6 bg-purple-50 rounded-2xl max-w-2xl mx-auto">
                  <h5 className="text-md font-semibold text-purple-900 mb-4">
                    {selectedPages.length > 1 ? 'Export as ZIP Archive' : 'Export Single Page'}
                  </h5>
                  <p className="text-sm text-purple-700 mb-6">
                    {selectedPages.length > 1 
                      ? 'Each page\'s key-value pairs will be exported as a separate file within a ZIP archive.'
                      : 'Export the key-value pairs from the selected page in your preferred format.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    {['csv', 'xlsx', 'json', 'txt'].map((format) => {
                      const getButtonStyle = (fmt: string) => {
                        switch (fmt) {
                          case 'csv':
                            return 'bg-gradient-to-r from-green-500 to-green-600 hover:shadow-xl hover:from-green-600 hover:to-green-700';
                          case 'xlsx':
                            return 'bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-xl hover:from-blue-600 hover:to-blue-700';
                          case 'json':
                            return 'bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-xl hover:from-purple-600 hover:to-purple-700';
                          case 'txt':
                            return 'bg-gradient-to-r from-gray-500 to-gray-600 hover:shadow-xl hover:from-gray-600 hover:to-gray-700';
                          default:
                            return 'bg-gradient-to-r from-gray-500 to-gray-600 hover:shadow-xl hover:from-gray-600 hover:to-gray-700';
                        }
                      };
                      return (
                      <button
                        key={format}
                        onClick={() => exportData(format as any, 'keyvalues')}
                        disabled={isLoading || selectedPages.length === 0}
                        className={`flex items-center px-6 py-3 ${getButtonStyle(format)} text-white rounded-full font-semibold transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none`}
                      >
                        <FileDown className="w-5 h-5 mr-2" />
                        {format.toUpperCase()}
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Reset Button */}
            <div className="text-center mt-8">
              <button
                onClick={resetParser}
                className="px-8 py-3 border-2 border-[#00C7BE] text-[#086C67] rounded-full font-semibold hover:bg-[#00C7BE] hover:text-white transition-all duration-300 transform hover:scale-105"
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

export default IntelligentDataParser;