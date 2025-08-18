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
  FileSpreadsheet,
  FileDown,
  Check
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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
  forms_data?: any[];
  error?: string;
}

interface FormPageData {
  page_number: number;
  headers: string[];
  data: string[][];
  key_value_pairs: Array<{key: string; value: string}>;
}

const FormDataParser: React.FC = () => {
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
    setTextractJob(null);
    setFormsData([]);
  };

  // Step 2: Start Textract forms analysis
  const startFormsAnalysis = async () => {
    if (!pdfFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      const response = await fetch('http://localhost:8000/textract/start-forms-analysis', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start Textract forms analysis');
      }
      
      const result = await response.json();
      setTextractJob(result);
      setCurrentStep(3);
      
      // Start polling for job completion
      startPolling(result.job_id);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start Textract forms analysis');
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
            await processFormsResults(jobId);
          } else if (result.status === 'FAILED') {
            clearInterval(pollInterval);
            setPolling(false);
            setError(result.error || 'Textract forms analysis failed');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Process Textract forms results
  const processFormsResults = async (jobId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/textract/process-forms-results/${jobId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process forms results');
      }
      
      const result = await response.json();
      setFormsData(result.forms_data);
      
      // Initialize selection state - all pages and all fields selected by default
      const allPages = new Set(result.forms_data.map((_: any, index: number) => index));
      setSelectedPages(allPages);
      
      const allFields: Record<number, Set<string>> = {};
      result.forms_data.forEach((pageData: FormPageData, pageIndex: number) => {
        allFields[pageIndex] = new Set(pageData.headers);
      });
      setSelectedFields(allFields);
      
      setCurrentStep(4);
      
    } catch (err: any) {
      setError(err.message || 'Failed to process Textract forms results');
    } finally {
      setIsLoading(false);
    }
  };

  // Export data in various formats
  const exportData = async (format: 'csv' | 'xlsx' | 'json' | 'txt') => {
    setIsLoading(true);
    try {
      // Filter data based on selections
      const filteredFormsData = formsData
        .map((pageData, pageIndex) => {
          // Only include selected pages
          if (!selectedPages.has(pageIndex)) return null;
          
          // Only include selected fields
          const pageSelectedFields = selectedFields[pageIndex] || new Set();
          if (pageSelectedFields.size === 0) return null;
          
          const filteredHeaders = pageData.headers.filter(header => pageSelectedFields.has(header));
          const filteredKeyValuePairs = pageData.key_value_pairs.filter(pair => pageSelectedFields.has(pair.key));
          
          // Filter data rows to match selected headers
          const filteredData = pageData.data.map(row => 
            pageData.headers
              .map((header, headerIndex) => pageSelectedFields.has(header) ? row[headerIndex] : null)
              .filter((_, headerIndex) => pageSelectedFields.has(pageData.headers[headerIndex]))
          );
          
          return {
            ...pageData,
            headers: filteredHeaders,
            data: filteredData,
            key_value_pairs: filteredKeyValuePairs
          };
        })
        .filter(pageData => pageData !== null);
      
      const requestData = { forms_data: filteredFormsData };
      
      const response = await fetch(`http://localhost:8000/textract/export-forms/${format}`, {
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
      
      // Use zip filename when multiple selected pages
      const selectedPageCount = Array.from(selectedPages).length;
      if (selectedPageCount > 1) {
        a.download = `form-data-selected-pages.zip`;
      } else {
        a.download = `form-data-page-${Array.from(selectedPages)[0] + 1}.${format}`;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <Image
                src="/images/pandiver-logo.svg"
                alt="PandiVer"
                width={120}
                height={31}
                className="h-8 w-auto"
              />
            </Link>
            
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="px-4 py-2 text-[#086C67] font-medium border border-[#086C67] rounded-full hover:bg-[#086C67] hover:text-white transition-all duration-300">
                Dashboard
              </Link>
              <button
                onClick={() => { 
                  localStorage.removeItem('accessToken'); 
                  window.location.href = '/auth/login'; 
                }}
                className="px-6 py-2 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white font-medium rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mb-6">
              <FileSpreadsheet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              Form Data Parser
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Advanced AI-powered key-value extraction technology. Upload your PDF forms and let intelligent algorithms extract all field data automatically.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-start justify-between max-w-6xl mx-auto px-8">
              {[
                { num: 1, title: 'Upload PDF', icon: Upload, desc: 'Choose your file' },
                { num: 2, title: 'Preview & Extract', icon: Eye, desc: 'Start analysis' },
                { num: 3, title: 'Processing', icon: Loader2, desc: 'AI Extraction' },
                { num: 4, title: 'Review Data', icon: FileSpreadsheet, desc: 'Verify results' },
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
                        Upload Form Document
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Choose a PDF file with forms or drag and drop it here
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
                      Our AI will analyze your document and extract all form fields and key-value pairs automatically. This process typically takes 30-60 seconds.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Advanced forms detection
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Key-value pair extraction
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Multi-page processing
                      </div>
                    </div>
                    
                    <div className="mt-8 space-y-3">
                      <button
                        onClick={startFormsAnalysis}
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
                            Extract Form Data with AI
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
                      ? 'Our AI is analyzing your document for form fields and key-value pairs...' 
                      : 'Document analysis completed successfully!'
                    }
                  </p>
                  
                  {textractJob.status === 'IN_PROGRESS' && (
                    <div className="bg-gray-100 rounded-full h-2 mb-4">
                      <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  )}
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
                  Extracted Form Data ({formsData.length} {formsData.length === 1 ? 'Page' : 'Pages'})
                </h3>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="px-8 py-4 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-xl hover:from-[#00B4AB] hover:to-[#074E4A] transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
                  >
                    Proceed to Export
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
                    {formsData.reduce((sum, page) => sum + page.headers.length, 0)}
                  </div>
                  <div className="text-green-800 font-medium">Form Fields</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl text-center border border-purple-200">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {formsData.reduce((sum, page) => sum + page.key_value_pairs.length, 0)}
                  </div>
                  <div className="text-purple-800 font-medium">Key-Value Pairs</div>
                </div>
              </div>
              
              <div className="space-y-8">
                {formsData.map((pageData, pageIndex) => (
                  <div key={pageIndex} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-[#00C7BE]/5 to-[#086C67]/5 px-6 py-4 border-b">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900 text-lg">
                          Page {pageData.page_number + 1}
                        </h4>
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                            {pageData.headers.length} fields
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {pageData.headers.length > 0 && pageData.data.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gradient-to-r from-[#00C7BE]/10 to-[#086C67]/10">
                            <tr>
                              {pageData.headers.map((header, idx) => (
                                <th key={idx} className="px-4 py-3 text-left font-medium text-gray-900 border-r last:border-r-0">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pageData.data.map((row, rowIdx) => (
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
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No form fields detected on this page</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Export */}
          {currentStep === 5 && formsData.length > 0 && (
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100">
              {/* Header */}
              <div className="text-center p-8 pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Customize Your Export</h3>
                <p className="text-gray-600">
                  Select pages on the left and their fields on the right. Only selected items will be exported.
                </p>
              </div>

              {/* Sticky Summary Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-green-50 border-b border-gray-200 px-8 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                        <span className="text-white text-sm font-bold">{Array.from(selectedPages).length}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Selected Pages</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
                        <span className="text-white text-sm font-bold">
                          {Array.from(selectedPages).reduce((sum, pageIndex) => sum + (selectedFields[pageIndex]?.size || 0), 0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Selected Fields</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mr-2">
                        <span className="text-white text-xs font-bold">
                          {Array.from(selectedPages).length > 1 ? 'ZIP' : 'FILE'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Download Type</span>
                    </div>
                  </div>
                  
                  {activePageIndex !== null && (
                    <div className="text-sm text-gray-600">
                      Editing: <span className="font-semibold">Page {formsData[activePageIndex].page_number + 1}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Two Panel Layout */}
              <div className="p-8 pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[500px]">
                  
                  {/* Left Panel: Page Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Pages to Export</h4>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedPages(new Set(formsData.map((_, i) => i)))}
                          className="px-3 py-1 text-sm bg-[#086C67] text-white rounded-lg hover:bg-[#074E4A] transition-colors"
                        >
                          All
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPages(new Set());
                            setActivePageIndex(null);
                          }}
                          className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {formsData.map((pageData, pageIndex) => (
                        <div 
                          key={pageIndex} 
                          className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            activePageIndex === pageIndex
                              ? 'border-orange-400 bg-orange-50 shadow-md'
                              : selectedPages.has(pageIndex) 
                                ? 'border-[#00C7BE] bg-[#00C7BE]/5' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => setActivePageIndex(pageIndex)}
                        >
                          {/* Active page indicator */}
                          {activePageIndex === pageIndex && (
                            <div className="absolute top-2 right-2">
                              <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">Page {pageData.page_number + 1}</h5>
                            <div 
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                selectedPages.has(pageIndex) 
                                  ? 'border-[#00C7BE] bg-[#00C7BE]' 
                                  : 'border-gray-300'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newSelected = new Set(selectedPages);
                                if (newSelected.has(pageIndex)) {
                                  newSelected.delete(pageIndex);
                                } else {
                                  newSelected.add(pageIndex);
                                }
                                setSelectedPages(newSelected);
                              }}
                            >
                              {selectedPages.has(pageIndex) && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-600">
                            {pageData.headers.length} fields • {pageData.key_value_pairs.length} pairs
                          </p>
                          
                          <div className="mt-2 text-xs text-gray-500">
                            {selectedFields[pageIndex]?.size || 0} of {pageData.headers.length} fields selected
                          </div>
                          
                          {activePageIndex === pageIndex && (
                            <div className="mt-2 text-xs font-medium text-orange-600">
                              ← Click fields on the right to select
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Panel: Field Selection */}
                  <div className="border-l border-gray-200 pl-8">
                    {activePageIndex === null ? (
                      <div className="flex items-center justify-center h-full text-center">
                        <div>
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Eye className="w-8 h-8 text-gray-400" />
                          </div>
                          <h4 className="text-lg font-medium text-gray-500 mb-2">Select a Page to View Fields</h4>
                          <p className="text-gray-400">Click on a page from the left panel to see its fields here</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-gray-900">
                            Page {formsData[activePageIndex].page_number + 1} Fields
                          </h4>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedFields(prev => ({
                                  ...prev,
                                  [activePageIndex]: new Set(formsData[activePageIndex].headers)
                                }));
                              }}
                              className="px-3 py-1 text-sm bg-[#086C67] text-white rounded-lg hover:bg-[#074E4A] transition-colors"
                            >
                              All
                            </button>
                            <button
                              onClick={() => {
                                setSelectedFields(prev => ({
                                  ...prev,
                                  [activePageIndex]: new Set()
                                }));
                              }}
                              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              None
                            </button>
                          </div>
                        </div>
                        
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {formsData[activePageIndex].headers.map((header, headerIndex) => {
                            const pageSelectedFields = selectedFields[activePageIndex] || new Set();
                            const keyValuePair = formsData[activePageIndex].key_value_pairs.find(p => p.key === header);
                            
                            return (
                              <div 
                                key={headerIndex}
                                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                                  pageSelectedFields.has(header)
                                    ? 'border-[#00C7BE] bg-[#00C7BE]/5'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                                onClick={() => {
                                  const newFields = new Set(pageSelectedFields);
                                  if (newFields.has(header)) {
                                    newFields.delete(header);
                                  } else {
                                    newFields.add(header);
                                  }
                                  setSelectedFields(prev => ({
                                    ...prev,
                                    [activePageIndex]: newFields
                                  }));
                                }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center">
                                      <span className="text-sm font-medium text-gray-900 truncate mr-2">
                                        {header}
                                      </span>
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                        pageSelectedFields.has(header)
                                          ? 'border-[#00C7BE] bg-[#00C7BE]'
                                          : 'border-gray-300'
                                      }`}>
                                        {pageSelectedFields.has(header) && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                    </div>
                                    {keyValuePair?.value && (
                                      <div className="text-xs text-gray-500 mt-1 break-words">
                                        <span className="font-medium">Value:</span> {keyValuePair.value}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  {Array.from(selectedPages).length > 0 && Array.from(selectedPages).some(pageIndex => (selectedFields[pageIndex]?.size || 0) > 0) ? (
                    <div className="text-center">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Download Your Selected Data
                      </h4>
                      <div className="flex flex-wrap justify-center gap-4">
                        <button
                          onClick={() => exportData('csv')}
                          disabled={isLoading}
                          className="flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                        >
                          <FileDown className="w-5 h-5 mr-2" />
                          CSV Format
                        </button>
                        <button
                          onClick={() => exportData('xlsx')}
                          disabled={isLoading}
                          className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                        >
                          <FileDown className="w-5 h-5 mr-2" />
                          Excel Format
                        </button>
                        <button
                          onClick={() => exportData('json')}
                          disabled={isLoading}
                          className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                        >
                          <FileDown className="w-5 h-5 mr-2" />
                          JSON Format
                        </button>
                        <button
                          onClick={() => exportData('txt')}
                          disabled={isLoading}
                          className="flex items-center px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-full font-semibold hover:shadow-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                        >
                          <FileDown className="w-5 h-5 mr-2" />
                          Text Format
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 inline-block">
                        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                        <h4 className="font-semibold text-yellow-800 mb-2">No Data Selected</h4>
                        <p className="text-yellow-700">
                          Select at least one page and one field to export data.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reset Button */}
                  <div className="mt-6 text-center">
                    <button
                      onClick={resetParser}
                      className="px-8 py-3 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                    >
                      Process Another Document
                    </button>
                  </div>
                </div>
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
    </div>
  );
};

export default FormDataParser;