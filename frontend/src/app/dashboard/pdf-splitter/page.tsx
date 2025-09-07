'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface PageInfo {
  page_number: number;
  thumbnail: string;
  text_preview: string;
}

interface PDFAnalysis {
  total_pages: number;
  filename: string;
  pages: PageInfo[];
}

interface ApiKey {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

interface Job {
  job_id: string;
  status: string;
  original_filename: string;
  selected_pages: number[];
  output_filename?: string;
  total_pages: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export default function PDFSplitterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PDFAnalysis | null>(null);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const loadApiKeys = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    
    try {
      const response = await fetch('http://localhost:8000/auth/api-keys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

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
        await response.json();
        setIsAuthenticated(true);
        // Load API keys after authentication
        loadApiKeys();
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/auth/login';
      }
    };
    checkAuth();
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.includes('pdf')) {
      setError('Please select a PDF file');
      return;
    }
    
    setFile(selectedFile);
    setAnalysis(null);
    setSelectedPages([]);
    setJob(null);
    setError('');
  };

  const analyzeFile = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const activeApiKey = apiKeys.find(key => key.is_active);
      if (!activeApiKey) {
        setError('No active API key found. Please create an API key in the API section.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/v1/pdf-splitter-api/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeApiKey.api_key}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze PDF');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze PDF');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const togglePageSelection = (pageNumber: number) => {
    setSelectedPages(prev => 
      prev.includes(pageNumber)
        ? prev.filter(p => p !== pageNumber)
        : [...prev, pageNumber]
    );
  };

  const selectAllPages = () => {
    if (!analysis) return;
    setSelectedPages(analysis.pages.map(p => p.page_number));
  };

  const clearSelection = () => {
    setSelectedPages([]);
  };

  const extractPages = async () => {
    if (!file || selectedPages.length === 0) return;

    setIsExtracting(true);
    setError('');

    try {
      const activeApiKey = apiKeys.find(key => key.is_active);
      if (!activeApiKey) {
        setError('No active API key found. Please create an API key in the API section.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('selected_pages', JSON.stringify(selectedPages));

      const response = await fetch('http://localhost:8000/api/v1/pdf-splitter-api/split', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeApiKey.api_key}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to extract pages');
      }

      const result = await response.json();
      setJob({
        ...result,
        original_filename: file.name,
        selected_pages: selectedPages,
        total_pages: analysis?.total_pages || 0,
        created_at: new Date().toISOString(),
      });

      // Start polling for job status
      pollJobStatus(result.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract pages');
    } finally {
      setIsExtracting(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const activeApiKey = apiKeys.find(key => key.is_active);
    if (!activeApiKey) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/pdf-splitter-api/jobs/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${activeApiKey.api_key}`,
        },
      });

      if (response.ok) {
        const jobData = await response.json();
        setJob(jobData);

        if (jobData.status === 'PROCESSING' || jobData.status === 'PENDING') {
          setTimeout(() => pollJobStatus(jobId), 2000);
        }
      }
    } catch (err) {
      console.error('Failed to poll job status:', err);
    }
  };

  const downloadResult = async () => {
    if (!job?.job_id) return;

    try {
      const activeApiKey = apiKeys.find(key => key.is_active);
      if (!activeApiKey) {
        setError('No active API key found. Please create an API key in the API section.');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/v1/pdf-splitter-api/download/${job.job_id}`, {
        headers: {
          'Authorization': `Bearer ${activeApiKey.api_key}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = job.output_filename || 'extracted_pages.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    }
  };

  const resetForm = () => {
    setFile(null);
    setAnalysis(null);
    setSelectedPages([]);
    setJob(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00C7BE] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#086C67] font-semibold">Loading</p>
        </div>
      </div>
    );
  }

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

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="18" r="3"/>
                <circle cx="12" cy="12" r="1"/>
                <path d="M12 12L9 15"/>
                <path d="M12 12L15 15"/>
                <path d="M12 12L6 3"/>
                <path d="M12 12L18 3"/>
                <path d="M18 3L19 3L18.5 3.5"/>
                <path d="M6 3L5 3L5.5 3.5"/>
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              PDF Page Splitter
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Extract specific pages from PDF documents with professional precision. Upload your PDF and select exactly which pages you need.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8 max-w-4xl mx-auto">
              <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex items-start">
                <svg className="w-6 h-6 text-red-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
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
          {!file && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
                <div className="text-center">
                  <div className="border-2 border-dashed border-[#00C7BE] rounded-2xl p-12 hover:border-[#086C67] transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) handleFileSelect(selectedFile);
                      }}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">
                        Upload PDF Document
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Choose a PDF file or drag and drop it here
                      </p>
                      <div className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <circle cx="6" cy="18" r="3"/>
                          <circle cx="18" cy="18" r="3"/>
                          <circle cx="12" cy="12" r="1"/>
                          <path d="M12 12L9 15"/>
                          <path d="M12 12L15 15"/>
                          <path d="M12 12L6 3"/>
                          <path d="M12 12L18 3"/>
                          <path d="M18 3L19 3L18.5 3.5"/>
                          <path d="M6 3L5 3L5.5 3.5"/>
                        </svg>
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

          {/* Step 2: Preview & Analyze */}
          {file && !analysis && !job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Analyze</h3>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                  Your PDF "<span className="font-medium">{file.name}</span>" is ready for analysis. We'll extract page thumbnails and preview content so you can select exactly which pages to extract.
                </p>
              </div>
              
              <div className="flex justify-center space-x-6">
                <button
                  onClick={analyzeFile}
                  disabled={isAnalyzing}
                  className="px-8 py-4 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  {isAnalyzing ? (
                    <span className="flex items-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Analyzing PDF
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      Analyze PDF
                    </span>
                  )}
                </button>
                
                <button
                  onClick={resetForm}
                  className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                >
                  Choose Different File
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Page Selection */}
          {analysis && !job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Select Pages to Extract</h3>
                <p className="text-gray-600">
                  Document: <span className="font-medium">{analysis.filename}</span> • <span className="font-medium">{analysis.total_pages}</span> pages
                </p>
              </div>
              
              <div className="flex justify-center space-x-4 mb-8">
                <button
                  onClick={selectAllPages}
                  className="px-6 py-2 bg-[#00C7BE]/10 text-[#086C67] rounded-full font-medium hover:bg-[#00C7BE]/20 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="px-6 py-2 bg-gray-50 text-gray-600 rounded-full font-medium hover:bg-gray-100 transition-colors"
                >
                  Clear Selection
                </button>
                <span className="px-6 py-2 bg-gradient-to-r from-[#00C7BE]/10 to-[#086C67]/10 text-[#086C67] rounded-full font-medium">
                  {selectedPages.length} pages selected
                </span>
              </div>

              {/* Page Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
                {analysis.pages.map((page) => (
                  <div
                    key={page.page_number}
                    className={`relative border-2 rounded-2xl p-3 cursor-pointer transition-all duration-200 ${
                      selectedPages.includes(page.page_number)
                        ? 'border-[#00C7BE] bg-[#00C7BE]/10 shadow-lg transform scale-105'
                        : 'border-gray-200 hover:border-[#00C7BE] hover:shadow-md'
                    }`}
                    onClick={() => togglePageSelection(page.page_number)}
                  >
                    <div className="aspect-[3/4] relative mb-3">
                      <img
                        src={page.thumbnail}
                        alt={`Page ${page.page_number}`}
                        className="w-full h-full object-contain rounded-xl"
                      />
                      {selectedPages.includes(page.page_number) && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#00C7BE] rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        Page {page.page_number}
                      </p>
                      {page.text_preview && (
                        <p className="text-xs text-gray-500 truncate" title={page.text_preview}>
                          {page.text_preview}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-6">
                <button
                  onClick={resetForm}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                >
                  Start Over
                </button>
                
                <button
                  onClick={extractPages}
                  disabled={selectedPages.length === 0 || isExtracting}
                  className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  {isExtracting ? (
                    <span className="flex items-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="18" r="3"/>
                        <circle cx="12" cy="12" r="1"/>
                        <path d="M12 12L9 15"/>
                        <path d="M12 12L15 15"/>
                        <path d="M12 12L6 3"/>
                        <path d="M12 12L18 3"/>
                        <path d="M18 3L19 3L18.5 3.5"/>
                        <path d="M6 3L5 3L5.5 3.5"/>
                      </svg>
                      Extract {selectedPages.length} Page{selectedPages.length === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Processing & Download */}
          {job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
              <div className="mb-8">
                {job.status === 'COMPLETED' ? (
                  <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : job.status === 'FAILED' ? (
                  <div className="w-20 h-20 bg-gradient-to-r from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                    <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {job.status === 'COMPLETED' ? 'Extraction Complete!' : 
                   job.status === 'FAILED' ? 'Extraction Failed' : 'Processing Document'}
                </h3>
                
                <p className="text-gray-600 mb-6">
                  {job.status === 'COMPLETED' ? 'Your pages have been extracted successfully!' : 
                   job.status === 'FAILED' ? 'There was an error extracting your pages.' :
                   'Please wait while we extract your selected pages'}
                </p>
                
                <div className="bg-gray-50 rounded-2xl p-6 max-w-md mx-auto mb-8">
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between">
                      <span>File:</span>
                      <span className="font-medium">{job.original_filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Selected Pages:</span>
                      <span className="font-medium">{job.selected_pages.join(', ')}</span>
                    </div>
                    {job.output_filename && (
                      <div className="flex justify-between">
                        <span>Output:</span>
                        <span className="font-medium">{job.output_filename}</span>
                      </div>
                    )}
                  </div>
                </div>

                {job.error_message && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 max-w-md mx-auto">
                    <p className="text-red-800 text-sm">{job.error_message}</p>
                  </div>
                )}
                
                <div className="flex justify-center space-x-6">
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                  >
                    Extract More Pages
                  </button>
                  
                  {job.status === 'COMPLETED' && (
                    <button
                      onClick={downloadResult}
                      className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download PDF
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}