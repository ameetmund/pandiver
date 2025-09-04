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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/v1/pdf-splitter/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('page_numbers', JSON.stringify(selectedPages));

      const response = await fetch('http://localhost:8000/api/v1/pdf-splitter/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/pdf-splitter/jobs/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/v1/pdf-splitter/download/${job.job_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
          <p className="text-[#086C67] font-semibold">Loading...</p>
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

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PDF Page Splitter</h1>
          <p className="text-gray-600">
            Extract specific pages from PDF documents. Select the pages you want and create a new PDF file.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* File Upload Section */}
        {!analysis && !job && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload PDF File</h2>
            
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#00C7BE] file:text-white hover:file:bg-[#086C67] file:cursor-pointer"
              />
              
              {file && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <strong>Selected:</strong> {file.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}

              <button
                onClick={analyzeFile}
                disabled={!file || isAnalyzing}
                className="w-full bg-[#00C7BE] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#086C67] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAnalyzing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Analyzing PDF...
                  </div>
                ) : (
                  'Analyze PDF'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Page Selection Section */}
        {analysis && !job && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Select Pages to Extract</h2>
                <p className="text-gray-600">
                  Document: {analysis.filename} ({analysis.total_pages} pages)
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={selectAllPages}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {selectedPages.length > 0 && (
              <div className="mb-6 p-4 bg-[#00C7BE]/10 border border-[#00C7BE]/20 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Selected pages:</strong> {selectedPages.sort((a, b) => a - b).join(', ')}
                </p>
              </div>
            )}

            {/* Page Thumbnails Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-6">
              {analysis.pages.map((page) => (
                <div
                  key={page.page_number}
                  className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all duration-200 ${
                    selectedPages.includes(page.page_number)
                      ? 'border-[#00C7BE] bg-[#00C7BE]/10'
                      : 'border-gray-200 hover:border-[#00C7BE]/50'
                  }`}
                  onClick={() => togglePageSelection(page.page_number)}
                >
                  <div className="aspect-[3/4] relative mb-2">
                    <img
                      src={page.thumbnail}
                      alt={`Page ${page.page_number}`}
                      className="w-full h-full object-contain rounded"
                    />
                    {selectedPages.includes(page.page_number) && (
                      <div className="absolute top-1 right-1 w-6 h-6 bg-[#00C7BE] rounded-full flex items-center justify-center">
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

            {/* Extract Button */}
            <div className="flex justify-between items-center">
              <button
                onClick={resetForm}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Start Over
              </button>
              
              <button
                onClick={extractPages}
                disabled={selectedPages.length === 0 || isExtracting}
                className="px-8 py-3 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExtracting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  `Extract ${selectedPages.length} Page${selectedPages.length === 1 ? '' : 's'}`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Job Status Section */}
        {job && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Extraction Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {job.original_filename}
                  </p>
                  <p className="text-sm text-gray-600">
                    Pages: {job.selected_pages.join(', ')}
                  </p>
                  {job.output_filename && (
                    <p className="text-sm text-gray-600">
                      Output: {job.output_filename}
                    </p>
                  )}
                </div>
                
                <div className="text-right">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    job.status === 'COMPLETED' 
                      ? 'bg-green-100 text-green-800'
                      : job.status === 'FAILED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {job.status === 'PROCESSING' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                    )}
                    {job.status}
                  </div>
                </div>
              </div>

              {job.error_message && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">{job.error_message}</p>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={resetForm}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Extract More Pages
                </button>
                
                {job.status === 'COMPLETED' && (
                  <button
                    onClick={downloadResult}
                    className="px-8 py-3 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] transition-colors"
                  >
                    Download PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}