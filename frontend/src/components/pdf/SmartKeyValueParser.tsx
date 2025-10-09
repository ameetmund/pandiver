'use client';

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';

import { apiClient, getApiUrl } from '@/lib/api';import { 
  Upload, 
  FileText, 
  Eye, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileSpreadsheet,
  FileDown,
  Check
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

interface AzureDIJob {
  job_id: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  forms_data?: any[];
  error?: string;
}

interface FormPageData {
  page_number: number;
  headers: string[];
  data: string[][];
  key_value_pairs: Array<{key: string; value: string; confidence?: number}>;
}

const SmartKeyValueParser: React.FC = () => {
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

  // Azure DI state
  const [azureDIJob, setAzureDIJob] = useState<AzureDIJob | null>(null);
  const [formsData, setFormsData] = useState<FormPageData[]>([]);

  // Export customization state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Record<number, Set<string>>>({});
  const [activePageIndex, setActivePageIndex] = useState<number | null>(null);

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
    setAzureDIJob(null);
    setFormsData([]);
    setSelectedPages(new Set());
    setSelectedFields({});
    setActivePageIndex(null);
  };

  // Step 2: Start Azure DI analysis
  const startAzureDIAnalysis = async () => {
    if (!pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      const response = await fetch(getApiUrl('/azure-di/smart-key-value/start-analysis'), {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start smart key-value analysis');
      }
      
      const result = await response.json();
      setAzureDIJob(result);
      setCurrentStep(3);
      
      // Start polling for job completion
      startPolling(result.job_id);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start smart key-value analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for job completion
  const startPolling = (jobId: string) => {
    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(getApiUrl(`/azure-di/smart-key-value/job-status/${jobId}`));
        if (response.ok) {
          const result = await response.json();
          setAzureDIJob(result);
          
          if (result.status === 'SUCCEEDED') {
            clearInterval(pollInterval);
            setPolling(false);
            await processAzureDIResults(jobId);
          } else if (result.status === 'FAILED') {
            clearInterval(pollInterval);
            setPolling(false);
            setError(result.error || 'Azure Document Intelligence key-value analysis failed');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Process Azure DI results
  const processAzureDIResults = async (jobId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(getApiUrl(`/azure-di/smart-key-value/process-results/${jobId}`));
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process results');
      }
      
      const result = await response.json();
      setFormsData(result.forms_data || []);
      setCurrentStep(4);
      
      // Initialize selection state
      const allPageIndices = new Set(result.forms_data?.map((_: any, index: number) => index) || []);
      setSelectedPages(allPageIndices);
      
      const fieldsPerPage: Record<number, Set<string>> = {};
      result.forms_data?.forEach((pageData: FormPageData, pageIndex: number) => {
        fieldsPerPage[pageIndex] = new Set(pageData.key_value_pairs?.map(kvp => kvp.key) || []);
      });
      setSelectedFields(fieldsPerPage);
      
    } catch (err: any) {
      setError(err.message || 'Failed to process Azure DI results');
    } finally {
      setIsLoading(false);
    }
  };

  // Export data in various formats
  const exportData = async (format: 'csv' | 'xlsx' | 'json' | 'txt') => {
    setIsLoading(true);
    try {
      // Filter forms data based on selected pages and fields
      const filteredFormsData = formsData
        .filter((_, index) => selectedPages.has(index))
        .map((pageData, originalIndex) => {
          const actualIndex = formsData.indexOf(pageData);
          const selectedFieldsForPage = selectedFields[actualIndex] || new Set();
          
          return {
            ...pageData,
            key_value_pairs: pageData.key_value_pairs?.filter(kvp => selectedFieldsForPage.has(kvp.key)) || [],
            headers: pageData.headers?.filter(header => selectedFieldsForPage.has(header)) || [],
            data: pageData.data?.map(row => 
              row.filter((_, cellIndex) => {
                const header = pageData.headers?.[cellIndex];
                return header && selectedFieldsForPage.has(header);
              })
            ) || []
          };
        });

      if (filteredFormsData.length === 0) {
        throw new Error('No data selected for export');
      }
      
      const response = await fetch(getApiUrl(`/azure-di/smart-key-value/export/${format}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forms_data: filteredFormsData }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to export ${format.toUpperCase()} file`);
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Use appropriate filename
      if (filteredFormsData.length > 1) {
        a.download = `smart-key-value-pages.zip`;
      } else {
        a.download = `smart-key-value-azure.${format}`;
      }
      
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      setError(err.message || `Failed to export ${format.toUpperCase()} file`);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle page selection
  const togglePageSelection = (pageIndex: number) => {
    const newSelectedPages = new Set(selectedPages);
    if (newSelectedPages.has(pageIndex)) {
      newSelectedPages.delete(pageIndex);
      // Remove field selections for this page
      const newSelectedFields = { ...selectedFields };
      delete newSelectedFields[pageIndex];
      setSelectedFields(newSelectedFields);
    } else {
      newSelectedPages.add(pageIndex);
      // Add all fields for this page
      const fieldsForPage = new Set(formsData[pageIndex]?.key_value_pairs?.map(kvp => kvp.key) || []);
      setSelectedFields({
        ...selectedFields,
        [pageIndex]: fieldsForPage
      });
    }
    setSelectedPages(newSelectedPages);
  };

  // Toggle field selection
  const toggleFieldSelection = (pageIndex: number, fieldKey: string) => {
    const currentFields = selectedFields[pageIndex] || new Set();
    const newFields = new Set(currentFields);
    
    if (newFields.has(fieldKey)) {
      newFields.delete(fieldKey);
    } else {
      newFields.add(fieldKey);
    }
    
    setSelectedFields({
      ...selectedFields,
      [pageIndex]: newFields
    });
  };

  // Reset and start over
  const resetParser = () => {
    setPdfFile(null);
    setCurrentStep(1);
    setError('');
    setAzureDIJob(null);
    setFormsData([]);
    setSelectedPages(new Set());
    setSelectedFields({});
    setActivePageIndex(null);
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
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
            Smart Key-Value Parser
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Intelligent Azure-powered key-value extraction. Upload forms or documents and let advanced AI extract field data with exceptional precision.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-start justify-between max-w-6xl mx-auto px-8">
            {[
              { num: 1, title: 'Upload PDF', icon: Upload, desc: 'Choose your file' },
              { num: 2, title: 'Preview & Extract', icon: Eye, desc: 'Start analysis' },
              { num: 3, title: 'Processing', icon: Loader2, desc: 'AI Extraction' },
              { num: 4, title: 'Review Data', icon: FileSpreadsheet, desc: 'Customize export' },
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
                      Upload Form or Document
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
                    Our Azure-powered AI will intelligently analyze your document and extract all key-value pairs with superior accuracy. This process typically takes 30-60 seconds.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Smart field recognition
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Advanced layout analysis
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Multi-page processing
                    </div>
                  </div>
                  
                  <div className="mt-8 space-y-3">
                    <button
                      onClick={startAzureDIAnalysis}
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
                          <FileSpreadsheet className="w-5 h-5 mr-2" />
                          Extract with Azure AI
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
        {currentStep === 3 && azureDIJob && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100 text-center">
              <div className="mb-8">
                {azureDIJob.status === 'IN_PROGRESS' ? (
                  <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {azureDIJob.status === 'IN_PROGRESS' ? 'Processing Document' : 'Analysis Complete'}
                </h3>
                
                <p className="text-gray-600 mb-6">
                  {azureDIJob.status === 'IN_PROGRESS' 
                    ? 'Azure Document Intelligence is analyzing your document for smart key-value extraction...' 
                    : 'Document analysis completed successfully!'
                  }
                </p>
                
                {azureDIJob.status === 'IN_PROGRESS' && (
                  <div className="bg-gray-100 rounded-full h-2 mb-4">
                    <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                )}
                
                <div className="text-sm text-gray-500">
                  Job ID: {azureDIJob.job_id}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review Data */}
        {currentStep === 4 && formsData.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                <FileSpreadsheet className="w-7 h-7 mr-3 text-[#086C67]" />
                Smart Key-Value Data ({formsData.length} pages)
              </h3>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentStep(5)}
                  disabled={selectedPages.size === 0}
                  className="px-8 py-4 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-xl hover:from-[#006CBE] hover:to-[#004A85] transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                >
                  🚀 Proceed to Export ({selectedPages.size} pages)
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl text-center border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">{formsData.length}</div>
                <div className="text-blue-800 font-medium">Pages Processed</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl text-center border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formsData.reduce((sum, page) => sum + (page.key_value_pairs?.length || 0), 0)}
                </div>
                <div className="text-green-800 font-medium">Total Fields</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl text-center border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">{selectedPages.size}</div>
                <div className="text-purple-800 font-medium">Selected Pages</div>
              </div>
            </div>
            
            {/* Pages Data */}
            <div className="space-y-8">
              {formsData.map((pageData, pageIndex) => (
                <div key={pageIndex} className={`border-2 rounded-2xl overflow-hidden transition-all duration-200 ${
                  selectedPages.has(pageIndex) 
                    ? 'border-[#00C7BE] bg-gradient-to-r from-[#00C7BE]/5 to-[#086C67]/5' 
                    : 'border-gray-200'
                }`}>
                  <div className="px-6 py-4 bg-white border-b flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPages.has(pageIndex)}
                          onChange={() => togglePageSelection(pageIndex)}
                          className="w-5 h-5 text-[#00C7BE] rounded focus:ring-[#00C7BE]"
                        />
                        <h4 className="font-semibold text-gray-900 text-lg">
                          Page {pageData.page_number + 1}
                        </h4>
                      </label>
                      <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        {pageData.key_value_pairs?.length || 0} fields found
                      </div>
                    </div>
                    
                    {selectedPages.has(pageIndex) && (
                      <button
                        onClick={() => setActivePageIndex(activePageIndex === pageIndex ? null : pageIndex)}
                        className="text-[#00C7BE] hover:text-[#086C67] font-medium text-sm"
                      >
                        {activePageIndex === pageIndex ? 'Hide Fields' : 'Select Fields'}
                      </button>
                    )}
                  </div>
                  
                  {/* Field Selection */}
                  {selectedPages.has(pageIndex) && activePageIndex === pageIndex && (
                    <div className="p-6 bg-gray-50">
                      <h5 className="font-medium text-gray-900 mb-4">Select fields to include in export:</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pageData.key_value_pairs?.map((kvp, fieldIndex) => (
                          <label key={fieldIndex} className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-[#00C7BE] transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedFields[pageIndex]?.has(kvp.key) || false}
                              onChange={() => toggleFieldSelection(pageIndex, kvp.key)}
                              className="w-4 h-4 text-[#00C7BE] rounded focus:ring-[#00C7BE] mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <div className="font-medium text-gray-900 text-sm truncate">{kvp.key}</div>
                                {kvp.confidence !== undefined && (
                                  <span className={`text-xs px-2 py-1 rounded-full ml-2 flex-shrink-0 ${
                                    kvp.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                                    kvp.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {(kvp.confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-600 text-xs truncate">{kvp.value}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                      
                      <div className="mt-4 flex space-x-3">
                        <button
                          onClick={() => {
                            const allFields = new Set(pageData.key_value_pairs?.map(kvp => kvp.key) || []);
                            setSelectedFields({
                              ...selectedFields,
                              [pageIndex]: allFields
                            });
                          }}
                          className="px-4 py-2 text-sm bg-[#00C7BE] text-white rounded-lg hover:bg-[#086C67] transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFields({
                              ...selectedFields,
                              [pageIndex]: new Set()
                            });
                          }}
                          className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Preview Data */}
                  {selectedPages.has(pageIndex) && pageData.key_value_pairs && pageData.key_value_pairs.length > 0 && (
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pageData.key_value_pairs.slice(0, 6).map((kvp, kvpIndex) => (
                          <div key={kvpIndex} className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-start mb-1">
                              <div className="font-medium text-gray-900 text-sm">{kvp.key}</div>
                              {kvp.confidence !== undefined && (
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  kvp.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                                  kvp.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {(kvp.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <div className="text-gray-700 text-sm">{kvp.value}</div>
                          </div>
                        ))}
                      </div>
                      
                      {pageData.key_value_pairs.length > 6 && (
                        <div className="text-center mt-4 text-sm text-gray-500">
                          Showing first 6 of {pageData.key_value_pairs.length} key-value pairs
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Export */}
        {currentStep === 5 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Data Ready for Export</h3>
              <p className="text-gray-600">
                {selectedPages.size > 1 
                  ? `${selectedPages.size} pages of key-value data are ready to download as separate files.`
                  : 'Your key-value data has been intelligently extracted and is ready to download.'
                }
              </p>
            </div>

            {/* Export Buttons */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Download Options {selectedPages.size > 1 && '(ZIP Archive)'}
              </h4>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => exportData('csv')}
                  disabled={isLoading || selectedPages.size === 0}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  CSV Format
                </button>
                <button
                  onClick={() => exportData('xlsx')}
                  disabled={isLoading || selectedPages.size === 0}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  Excel Format
                </button>
                <button
                  onClick={() => exportData('json')}
                  disabled={isLoading || selectedPages.size === 0}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  JSON Format
                </button>
                <button
                  onClick={() => exportData('txt')}
                  disabled={isLoading || selectedPages.size === 0}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  Text Format
                </button>
              </div>
              
              {selectedPages.size > 1 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3 inline-block">
                    💡 Multiple pages selected! Download will be a ZIP file containing separate files for each page.
                  </p>
                </div>
              )}
            </div>

            {/* Export Summary */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900">Export Summary</h4>
              {Array.from(selectedPages).map((pageIndex) => {
                const pageData = formsData[pageIndex];
                const selectedFieldsCount = selectedFields[pageIndex]?.size || 0;
                return (
                  <div key={pageIndex} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-gray-900">
                          Page {pageData.page_number + 1}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {selectedFieldsCount} of {pageData.key_value_pairs?.length || 0} fields selected
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Sample fields:</div>
                        <div className="text-sm font-medium text-gray-700">
                          {pageData.key_value_pairs?.slice(0, 3).map(kvp => kvp.key).join(', ')}
                          {(pageData.key_value_pairs?.length || 0) > 3 && ` +${(pageData.key_value_pairs?.length || 0) - 3} more`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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

export default SmartKeyValueParser;