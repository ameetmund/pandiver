'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface PDFAnalysis {
  total_pages: number;
  filename: string;
  detected_language: string;
  language_confidence: number;
  character_count: number;
  sample_text: string;
  translatable: boolean;
}

interface Language {
  name: string;
  native_name: string;
  dir: string;
}

interface SupportedLanguages {
  languages: { [code: string]: Language };
  auto_detect_supported: boolean;
}

interface TranslationJob {
  job_id: string;
  status: string;
  original_filename: string;
  translated_filename?: string;
  source_language: string;
  target_language: string;
  detected_language?: string;
  translation_method: string;
  total_pages: number;
  characters_translated: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export default function PDFTranslatorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PDFAnalysis | null>(null);
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguages | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string>('auto');
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const [translationMethod] = useState<string>('document');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [job, setJob] = useState<TranslationJob | null>(null);
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

  useEffect(() => {
    if (isAuthenticated) {
      loadSupportedLanguages();
    }
  }, [isAuthenticated]);

  const loadSupportedLanguages = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:8000/api/v1/pdf-translator/languages', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const languages = await response.json();
        setSupportedLanguages(languages);
      }
    } catch (err) {
      console.error('Failed to load supported languages:', err);
    }
  };

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
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/v1/pdf-translator/analyze', {
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
      
      // Auto-set source language based on detection
      if (result.detected_language && result.language_confidence > 0.5) {
        setSourceLanguage(result.detected_language);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze PDF');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startTranslation = async () => {
    if (!file || !targetLanguage) return;

    setIsTranslating(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('source_language', sourceLanguage);
      formData.append('target_language', targetLanguage);
      formData.append('translation_method', 'document');

      const response = await fetch('http://localhost:8000/api/v1/pdf-translator/translate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start translation');
      }

      const result = await response.json();
      setJob({
        ...result,
        original_filename: file.name,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        detected_language: analysis?.detected_language,
        translation_method: 'document',
        total_pages: analysis?.total_pages || 0,
        characters_translated: 0,
        created_at: new Date().toISOString(),
      });

      // Start polling for job status
      pollJobStatus(result.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start translation');
    } finally {
      setIsTranslating(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/pdf-translator/jobs/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const jobData = await response.json();
        setJob(jobData);

        if (jobData.status === 'PROCESSING' || jobData.status === 'PENDING') {
          setTimeout(() => pollJobStatus(jobId), 3000);
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

      const response = await fetch(`http://localhost:8000/api/v1/pdf-translator/download/${job.job_id}`, {
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
      a.download = job.translated_filename || 'translated_document.pdf';
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
    setSourceLanguage('auto');
    setTargetLanguage('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getLanguageName = (code: string): string => {
    if (code === 'auto') return 'Auto-detect';
    return supportedLanguages?.languages[code]?.name || code.toUpperCase();
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

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              PDF Translator
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Professional document translation powered by advanced AI. Upload your PDF and translate it to any supported language while maintaining document structure.
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
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
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

          {/* Step 2: Analyze */}
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
                  Your PDF "<span className="font-medium">{file.name}</span>" is ready for analysis. We'll detect the document language and prepare it for translation.
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
                      Analyzing Document...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      Analyze Document
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

          {/* Step 3: Configure Translation */}
          {analysis && !job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Configure Translation</h3>
                <p className="text-gray-600">
                  Document: <span className="font-medium">{analysis.filename}</span> • <span className="font-medium">{analysis.total_pages}</span> pages
                </p>
              </div>

              {analysis.translatable ? (
                <div className="space-y-8">
                  {/* Document Analysis */}
                  <div className="bg-gradient-to-br from-[#00C7BE]/10 to-[#086C67]/10 rounded-2xl p-6 border border-[#00C7BE]/20">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Document Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Detected Language:</span>
                        <div className="font-medium text-[#086C67]">
                          {getLanguageName(analysis.detected_language)}
                          {analysis.language_confidence > 0 && (
                            <span className="text-xs bg-[#00C7BE]/20 text-[#086C67] px-2 py-1 rounded-full ml-2">
                              {Math.round(analysis.language_confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Character Count:</span>
                        <div className="font-medium text-[#086C67]">{analysis.character_count.toLocaleString()}</div>
                      </div>
                    </div>
                    
                  </div>

                  {/* Language Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Source Language
                      </label>
                      <select
                        value={sourceLanguage}
                        onChange={(e) => setSourceLanguage(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:border-[#00C7BE] bg-white text-gray-900"
                      >
                        <option value="auto">Auto-detect</option>
                        {supportedLanguages && Object.entries(supportedLanguages.languages).map(([code, lang]) => (
                          <option key={code} value={code}>
                            {lang.name} ({lang.native_name})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Target Language *
                      </label>
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086C67] focus:border-[#086C67] bg-white text-gray-900"
                      >
                        <option value="">Select target language</option>
                        {supportedLanguages && Object.entries(supportedLanguages.languages).map(([code, lang]) => (
                          <option key={code} value={code}>
                            {lang.name} ({lang.native_name})
                          </option>
                        ))}
                      </select>
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
                      onClick={startTranslation}
                      disabled={!targetLanguage || isTranslating}
                      className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {isTranslating ? (
                        <span className="flex items-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Starting Translation...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          Start Translation
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Document Not Translatable</h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    This PDF doesn't contain enough extractable text for translation. The document might be image-based or have very little text content.
                  </p>
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    Try Another Document
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Processing & Download */}
          {job && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
              <div className="mb-8">
                {job.status === 'COMPLETED' ? (
                  <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
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
                  {job.status === 'COMPLETED' ? 'Translation Complete!' : 
                   job.status === 'FAILED' ? 'Translation Failed' : 'Processing Translation'}
                </h3>
                
                <p className="text-gray-600 mb-6">
                  {job.status === 'COMPLETED' ? 'Your document has been translated successfully!' : 
                   job.status === 'FAILED' ? 'There was an error translating your document.' :
                   'Please wait while we translate your document...'}
                </p>
                
                <div className="bg-gray-50 rounded-2xl p-6 max-w-md mx-auto mb-8">
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between">
                      <span>File:</span>
                      <span className="font-medium">{job.original_filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Translation:</span>
                      <span className="font-medium text-[#086C67]">
                        {getLanguageName(job.source_language)} → {getLanguageName(job.target_language)}
                      </span>
                    </div>
                    {job.translated_filename && (
                      <div className="flex justify-between">
                        <span>Output:</span>
                        <span className="font-medium">{job.translated_filename}</span>
                      </div>
                    )}
                    {job.characters_translated > 0 && (
                      <div className="flex justify-between">
                        <span>Progress:</span>
                        <span className="font-medium text-[#086C67]">
                          {job.characters_translated.toLocaleString()} characters
                        </span>
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
                    Translate Another Document
                  </button>
                  
                  {job.status === 'COMPLETED' && (
                    <button
                      onClick={downloadResult}
                      className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Translated PDF
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