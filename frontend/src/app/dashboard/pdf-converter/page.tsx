'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

import { getApiUrl } from '@/lib/api';

interface SupportedFormats {
  from_pdf: { [key: string]: { name: string; extension: string } };
  to_pdf: { [key: string]: { name: string; extension: string } };
  is_configured: boolean;
}

interface FileAnalysis {
  filename: string;
  file_size_bytes: number;
  file_size_mb: number;
  file_extension: string;
  is_pdf: boolean;
  detected_format: string | null;
}

interface Job {
  job_id: string;
  status: string;
  original_filename: string;
  conversion_type: string;
  target_formats?: string[];
  source_format?: string;
  total_conversions?: number;
  successful_conversions?: number;
  failed_conversions?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export default function PDFConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [supportedFormats, setSupportedFormats] = useState<SupportedFormats | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [conversionType, setConversionType] = useState<'from_pdf' | 'to_pdf' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      try {
        const response = await fetch(getApiUrl('/auth/me'), {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Auth failed');
        await response.json();
        setIsAuthenticated(true);
        await loadSupportedFormats();
      } catch {
        localStorage.removeItem('accessToken');
        router.push('/auth/login');
      }
    };
    checkAuth();
  }, [router]);

  const loadSupportedFormats = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(getApiUrl('/api/v1/pdf-converter/supported-formats'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const formats = await response.json();
        setSupportedFormats(formats);
      }
    } catch (err) {
      console.error('Failed to load supported formats:', err);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type based on conversion direction
    const isPdfFile = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');

    if (conversionType === 'to_pdf' && isPdfFile) {
      setError('Please select a non-PDF file for Office → PDF conversion. You selected a PDF file.');
      return;
    }

    if (conversionType === 'from_pdf' && !isPdfFile) {
      setError('Please select a PDF file for PDF → Office conversion. You selected a non-PDF file.');
      return;
    }

    setFile(selectedFile);
    setAnalysis(null);
    setSelectedFormats([]);
    setJob(null);
    setError('');
  };

  const analyzeFile = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(getApiUrl('/api/v1/pdf-converter/analyze'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze file');
      }

      const result = await response.json();
      setAnalysis(result);

      // Validation: Check if file matches selected conversion type
      if (conversionType === 'from_pdf' && !result.is_pdf) {
        throw new Error('Please select a PDF file for PDF to Office conversion');
      } else if (conversionType === 'to_pdf' && result.is_pdf) {
        throw new Error('Please select a non-PDF file for Office to PDF conversion');
      } else if (conversionType === 'to_pdf' && result.detected_format && !supportedFormats?.to_pdf[result.detected_format]) {
        throw new Error('Unsupported file format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleFormatSelection = (format: string) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const selectAllFormats = () => {
    if (!supportedFormats || !conversionType) return;
    const allFormats = Object.keys(supportedFormats.from_pdf).filter(key => key !== 'doc' && key !== 'rtf' && key !== 'jpeg' && key !== 'png');
    setSelectedFormats(allFormats);
  };

  const clearSelection = () => {
    setSelectedFormats([]);
  };

  const startConversion = async () => {
    if (!file) return;

    setIsConverting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      let response;

      if (conversionType === 'from_pdf') {
        if (selectedFormats.length === 0) {
          throw new Error('Please select at least one target format');
        }
        formData.append('target_formats', selectedFormats.join(','));
        response = await fetch(getApiUrl('/api/v1/pdf-converter/convert-from-pdf'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: formData,
        });
      } else {
        // to_pdf conversion
        response = await fetch(getApiUrl('/api/v1/pdf-converter/convert-to-pdf'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: formData,
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start conversion');
      }

      const result = await response.json();
      setJob({
        ...result,
        original_filename: file.name,
        conversion_type: conversionType || 'unknown',
        created_at: new Date().toISOString(),
      });

      // Start polling for job status
      pollJobStatus(result.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversion');
    } finally {
      setIsConverting(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/v1/pdf-converter/jobs/${jobId}/status`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const jobData = await response.json();
        setJob(jobData);

        if (jobData.status === 'PROCESSING') {
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
      const response = await fetch(getApiUrl(`/api/v1/pdf-converter/download/${job.job_id}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
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

      // Determine filename based on conversion type
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'converted';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+)/);
        if (match) filename = match[1].replace(/"/g, '');
      }

      a.download = filename;
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
    setSelectedFormats([]);
    setConversionType(null);
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

  if (!supportedFormats?.is_configured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                <Image src="/images/pandiver-logo.svg" alt="PandiVer" width={120} height={31} className="h-8 w-auto" />
              </Link>
              <Link href="/dashboard" className="px-4 py-2 text-[#086C67] font-medium border border-[#086C67] rounded-full hover:bg-[#086C67] hover:text-white transition-all duration-300">
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100 max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Not Configured</h2>
            <p className="text-gray-600 mb-6">
              The PDF Converter service is not configured. Please contact your administrator to set up Adobe PDF Services API credentials.
            </p>
            <Link href="/dashboard" className="inline-block px-6 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300">
              Return to Dashboard
            </Link>
          </div>
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
              <Image src="/images/pandiver-logo.svg" alt="PandiVer" width={120} height={31} className="h-8 w-auto" />
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
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              PDF ↔ Office Converter
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Convert PDFs to Word, Excel, PowerPoint, and images. Convert Office documents and images to PDF. Preserve layout and formatting with Adobe PDF Services.
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
                  <button onClick={() => setError('')} className="mt-3 text-red-600 hover:text-red-800 text-sm font-medium">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Choose Conversion Direction */}
          {!conversionType && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
                <div className="text-center mb-10">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Choose Conversion Direction</h2>
                  <p className="text-gray-600">Select the type of conversion you want to perform</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PDF to Office */}
                  <div
                    onClick={() => setConversionType('from_pdf')}
                    className="border-2 border-gray-200 rounded-2xl p-8 hover:border-[#00C7BE] hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">PDF → Office</h3>
                      <p className="text-sm text-gray-600">Convert PDF to Word, Excel, PowerPoint, or Images</p>
                    </div>
                  </div>

                  {/* Office to PDF */}
                  <div
                    onClick={() => setConversionType('to_pdf')}
                    className="border-2 border-gray-200 rounded-2xl p-8 hover:border-[#00C7BE] hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Office → PDF</h3>
                      <p className="text-sm text-gray-600">Convert Word, Excel, PowerPoint, or Images to PDF</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Upload */}
          {conversionType && !file && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
                <div className="flex items-center justify-center mb-6">
                  <button
                    onClick={() => {
                      setConversionType(null);
                      setFile(null);
                      setAnalysis(null);
                      setSelectedFormats([]);
                    }}
                    className="text-[#086C67] hover:text-[#00C7BE] font-medium flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Change Direction
                  </button>
                </div>

                <div className="text-center">
                  <div className="border-2 border-dashed border-[#00C7BE] rounded-2xl p-12 hover:border-[#086C67] transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={conversionType === 'from_pdf' ? '.pdf' : '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.html,.jpeg,.jpg,.png'}
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) handleFileSelect(selectedFile);
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">
                        Upload {conversionType === 'from_pdf' ? 'PDF' : 'Document'}
                      </h3>
                      <p className="text-gray-600 mb-6">
                        {conversionType === 'from_pdf'
                          ? 'Choose a PDF file to convert to other formats'
                          : 'Choose a document or image to convert to PDF'}
                      </p>
                      <div className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Choose File
                      </div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-6">
                    {conversionType === 'from_pdf'
                      ? 'Supported: PDF • Max: 20MB'
                      : 'Supported: DOCX, XLS, XLSX, PPT, PPTX, HTML, TXT, JPEG, PNG • Max: 20MB'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Ready to Convert */}
          {file && !analysis && !job && conversionType && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <div className="flex items-start mb-6">
                  <div className="flex-1">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Ready to Convert</h3>
                        <p className="text-sm text-gray-600">
                          {conversionType === 'from_pdf' ? 'PDF → Office Formats' : 'Office → PDF'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          onClick={resetForm}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center space-x-4 mt-6">
                  <button
                    onClick={analyzeFile}
                    disabled={isAnalyzing}
                    className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        {conversionType === 'from_pdf' ? 'Choose Output Formats' : 'Convert to PDF'}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setFile(null);
                      setAnalysis(null);
                      setSelectedFormats([]);
                    }}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                  >
                    Choose Different File
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Format Selection (FROM PDF) */}
          {analysis && conversionType === 'from_pdf' && !job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Convert PDF To</h3>
                <p className="text-gray-600">
                  Select one or more output formats for your PDF
                </p>
              </div>

              <div className="flex justify-center space-x-4 mb-8">
                <button
                  onClick={selectAllFormats}
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
                  {selectedFormats.length} format{selectedFormats.length === 1 ? '' : 's'} selected
                </span>
              </div>

              {/* Format Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 max-w-3xl mx-auto">
                {supportedFormats && Object.entries(supportedFormats.from_pdf)
                  .filter(([key]) => key !== 'doc' && key !== 'rtf' && key !== 'jpeg' && key !== 'png')
                  .map(([key, info]) => (
                  <div
                    key={key}
                    className={`relative border-2 rounded-2xl p-6 cursor-pointer transition-all duration-200 ${
                      selectedFormats.includes(key)
                        ? 'border-[#00C7BE] bg-[#00C7BE]/10 shadow-lg transform scale-105'
                        : 'border-gray-200 hover:border-[#00C7BE] hover:shadow-md'
                    }`}
                    onClick={() => toggleFormatSelection(key)}
                  >
                    {selectedFormats.includes(key) && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#00C7BE] rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 mb-1">
                        {key.toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-600">
                        {info.name}
                      </p>
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
                  onClick={startConversion}
                  disabled={selectedFormats.length === 0 || isConverting}
                  className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  {isConverting ? (
                    <span className="flex items-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Converting
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4" />
                      </svg>
                      Convert to {selectedFormats.length} Format{selectedFormats.length === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Convert (TO PDF) */}
          {analysis && conversionType === 'to_pdf' && !job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4 4m0 0l4-4m-4 4V4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Convert to PDF</h3>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                  Your {analysis.detected_format?.toUpperCase()} file will be converted to PDF format while preserving the original layout and formatting.
                </p>
              </div>

              <div className="flex justify-center space-x-6">
                <button
                  onClick={resetForm}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                >
                  Start Over
                </button>

                <button
                  onClick={startConversion}
                  disabled={isConverting}
                  className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  {isConverting ? (
                    <span className="flex items-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Converting
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4 4m0 0l4-4m-4 4V4" />
                      </svg>
                      Convert to PDF
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
                  {job.status === 'COMPLETED' ? 'Conversion Complete!' :
                   job.status === 'FAILED' ? 'Conversion Failed' : 'Converting Document'}
                </h3>

                <p className="text-gray-600 mb-6">
                  {job.status === 'COMPLETED' ? 'Your file has been converted successfully!' :
                   job.status === 'FAILED' ? 'There was an error converting your file.' :
                   'Please wait while we convert your file'}
                </p>

                <div className="bg-gray-50 rounded-2xl p-6 max-w-md mx-auto mb-8">
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between">
                      <span>File:</span>
                      <span className="font-medium">{job.original_filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Conversion:</span>
                      <span className="font-medium capitalize">{job.conversion_type === 'from_pdf' ? 'PDF → Office' : 'Office → PDF'}</span>
                    </div>
                    {job.successful_conversions !== undefined && (
                      <div className="flex justify-between">
                        <span>Successful:</span>
                        <span className="font-medium text-green-600">{job.successful_conversions}/{job.total_conversions}</span>
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
                    Convert Another File
                  </button>

                  {job.status === 'COMPLETED' && (
                    <button
                      onClick={downloadResult}
                      className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Result
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
