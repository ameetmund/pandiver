'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

import { getApiUrl } from '@/lib/api';

interface CompressionLevel {
  name: string;
  image_quality: number;
  image_dpi: number;
  description: string;
}

interface CompressionLevels {
  light: CompressionLevel;
  moderate: CompressionLevel;
  aggressive: CompressionLevel;
}

interface PDFAnalysis {
  filename: string;
  file_size_bytes: number;
  file_size_mb: number;
  total_pages: number;
  has_images: boolean;
  image_count: number;
  estimated_savings: {
    light: { bytes: number; percentage: number };
    moderate: { bytes: number; percentage: number };
    aggressive: { bytes: number; percentage: number };
  };
}

interface Job {
  job_id: string;
  status: string;
  original_filename: string;
  compression_level: string;
  output_filename?: string;
  original_size?: number;
  compressed_size?: number;
  size_reduction_percentage?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export default function PDFCompressorOptimizerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PDFAnalysis | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('moderate');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [compressionLevels, setCompressionLevels] = useState<CompressionLevels>({
    light: {
      name: "Light Compression",
      image_quality: 90,
      image_dpi: 150,
      description: "Minimal compression, best quality (90% quality, 150 DPI)"
    },
    moderate: {
      name: "Moderate Compression",
      image_quality: 70,
      image_dpi: 120,
      description: "Balanced compression (70% quality, 120 DPI)"
    },
    aggressive: {
      name: "Aggressive Compression",
      image_quality: 50,
      image_dpi: 96,
      description: "Maximum compression, smaller file (50% quality, 96 DPI)"
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const loadCompressionLevels = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(getApiUrl('/api/v1/pdf-compressor/compression-levels'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCompressionLevels(data.levels);
      } else {
        console.error('Failed to load compression levels:', response.status, response.statusText);
        // Set default compression levels as fallback
        setCompressionLevels({
          light: {
            name: "Light Compression",
            image_quality: 90,
            image_dpi: 150,
            description: "Minimal compression, best quality (90% quality, 150 DPI)"
          },
          moderate: {
            name: "Moderate Compression",
            image_quality: 70,
            image_dpi: 120,
            description: "Balanced compression (70% quality, 120 DPI)"
          },
          aggressive: {
            name: "Aggressive Compression",
            image_quality: 50,
            image_dpi: 96,
            description: "Maximum compression, smaller file (50% quality, 96 DPI)"
          }
        });
      }
    } catch (err) {
      console.error('Failed to load compression levels:', err);
      // Set default compression levels as fallback
      setCompressionLevels({
        light: {
          name: "Light Compression",
          image_quality: 90,
          image_dpi: 150,
          description: "Minimal compression, best quality (90% quality, 150 DPI)"
        },
        moderate: {
          name: "Moderate Compression",
          image_quality: 70,
          image_dpi: 120,
          description: "Balanced compression (70% quality, 120 DPI)"
        },
        aggressive: {
          name: "Aggressive Compression",
          image_quality: 50,
          image_dpi: 96,
          description: "Maximum compression, smaller file (50% quality, 96 DPI)"
        }
      });
    }
  };

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
        await loadCompressionLevels();
      } catch {
        localStorage.removeItem('accessToken');
        router.push('/auth/login');
      }
    };
    checkAuth();
  }, [router]);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.includes('pdf')) {
      setError('Please select a PDF file');
      return;
    }

    setFile(selectedFile);
    setAnalysis(null);
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

      const response = await fetch(getApiUrl('/api/v1/pdf-compressor/analyze'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
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

  const compressPDF = async () => {
    if (!file) return;

    setIsCompressing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('compression_level', selectedLevel);

      const response = await fetch(getApiUrl('/api/v1/pdf-compressor/compress'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to compress PDF');
      }

      const result = await response.json();
      setJob({
        ...result,
        original_filename: file.name,
        compression_level: selectedLevel,
        created_at: new Date().toISOString(),
      });

      pollJobStatus(result.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compress PDF');
    } finally {
      setIsCompressing(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/v1/pdf-compressor/jobs/${jobId}/status`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
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
      const response = await fetch(getApiUrl(`/api/v1/pdf-compressor/download/${job.job_id}`), {
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
      a.download = job.output_filename || 'compressed.pdf';
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
    setJob(null);
    setError('');
    setSelectedLevel('moderate');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'light': return 'from-green-500 to-green-600';
      case 'moderate': return 'from-blue-500 to-blue-600';
      case 'aggressive': return 'from-orange-500 to-orange-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  const getLevelBorderColor = (level: string) => {
    switch (level) {
      case 'light': return 'border-green-500';
      case 'moderate': return 'border-blue-500';
      case 'aggressive': return 'border-orange-500';
      default: return 'border-blue-500';
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
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              PDF Compressor & Optimizer
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Reduce PDF file sizes while maintaining quality. Choose from multiple compression levels to balance file size and visual quality.
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
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
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

          {/* Step 2: Analyze & Select Level */}
          {file && !job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Compress Your PDF</h3>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                  Your PDF "<span className="font-medium">{file.name}</span>" ({formatFileSize(file.size)}) is ready. {analysis ? 'Choose a compression level below.' : 'Analyze it first to see estimated savings.'}
                </p>
              </div>

              {!analysis ? (
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
              ) : (
                <div>
                  {/* Analysis Results */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 mb-8 max-w-3xl mx-auto">
                    <h4 className="font-semibold text-gray-900 mb-4 text-center">Document Analysis</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{analysis.total_pages}</p>
                        <p className="text-sm text-gray-600">Pages</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{analysis.image_count}</p>
                        <p className="text-sm text-gray-600">Images</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{analysis.file_size_mb} MB</p>
                        <p className="text-sm text-gray-600">File Size</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{analysis.has_images ? 'Yes' : 'No'}</p>
                        <p className="text-sm text-gray-600">Has Images</p>
                      </div>
                    </div>
                  </div>

                  {/* Compression Level Selection */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-gray-900 mb-4 text-center">Choose Compression Level</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                      {Object.entries(compressionLevels).map(([key, level]) => (
                        <div
                          key={key}
                          onClick={() => setSelectedLevel(key)}
                          className={`relative border-2 rounded-2xl p-6 cursor-pointer transition-all duration-200 ${
                            selectedLevel === key
                              ? `${getLevelBorderColor(key)} bg-gradient-to-r ${getLevelColor(key)}/10 shadow-lg transform scale-105`
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          {selectedLevel === key && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center shadow-lg">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          <h5 className="font-bold text-gray-900 mb-2">{level.name}</h5>
                          <p className="text-sm text-gray-600 mb-4">{level.description}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Quality:</span>
                              <span className="font-medium text-gray-900">{level.image_quality}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">DPI:</span>
                              <span className="font-medium text-gray-900">{level.image_dpi}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Est. Savings:</span>
                              <span className="font-bold text-green-600">
                                ~{analysis?.estimated_savings?.[key as keyof typeof analysis.estimated_savings]?.percentage ?? 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
                      onClick={compressPDF}
                      disabled={isCompressing}
                      className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {isCompressing ? (
                        <span className="flex items-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Compressing
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Compress PDF
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Processing & Download */}
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
                  {job.status === 'COMPLETED' ? 'Compression Complete!' :
                   job.status === 'FAILED' ? 'Compression Failed' : 'Compressing Document'}
                </h3>

                <p className="text-gray-600 mb-6">
                  {job.status === 'COMPLETED' ? 'Your PDF has been compressed successfully!' :
                   job.status === 'FAILED' ? 'There was an error compressing your PDF.' :
                   'Please wait while we compress your PDF'}
                </p>

                {job.status === 'COMPLETED' && job.original_size && job.compressed_size && (
                  <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-2xl p-6 max-w-md mx-auto mb-8 border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-4">Compression Results</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-700">Original Size:</span>
                        <span className="font-medium text-green-900">{formatFileSize(job.original_size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Compressed Size:</span>
                        <span className="font-medium text-green-900">{formatFileSize(job.compressed_size)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-green-300">
                        <span className="text-green-700 font-semibold">Space Saved:</span>
                        <span className="font-bold text-green-600">
                          {formatFileSize(job.original_size - job.compressed_size)} ({job.size_reduction_percentage?.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-2xl p-6 max-w-md mx-auto mb-8">
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between">
                      <span>File:</span>
                      <span className="font-medium">{job.original_filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compression Level:</span>
                      <span className="font-medium capitalize">{job.compression_level}</span>
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
                    Compress Another PDF
                  </button>

                  {job.status === 'COMPLETED' && (
                    <button
                      onClick={downloadResult}
                      className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Compressed PDF
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
