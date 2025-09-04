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
  const [translationMethod, setTranslationMethod] = useState<string>('text');
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
      formData.append('translation_method', translationMethod);

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
        translation_method: translationMethod,
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

      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PDF Translator</h1>
          <p className="text-gray-600">
            Translate PDF documents between languages using Azure AI Translator. 
            Maintain document structure while converting content.
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload PDF Document</h2>
            
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
                    Analyzing Document...
                  </div>
                ) : (
                  'Analyze Document'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Translation Configuration Section */}
        {analysis && !job && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Translation Settings</h2>
            
            {/* Document Analysis Results */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Document Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Filename:</p>
                  <p className="font-medium">{analysis.filename}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pages:</p>
                  <p className="font-medium">{analysis.total_pages}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Detected Language:</p>
                  <p className="font-medium">
                    {getLanguageName(analysis.detected_language)} 
                    {analysis.language_confidence > 0 && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({Math.round(analysis.language_confidence * 100)}% confidence)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Character Count:</p>
                  <p className="font-medium">{analysis.character_count.toLocaleString()}</p>
                </div>
              </div>
              
              {analysis.sample_text && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Sample Text:</p>
                  <p className="text-sm bg-white p-3 rounded border italic">
                    "{analysis.sample_text}"
                  </p>
                </div>
              )}
            </div>

            {analysis.translatable ? (
              <div className="space-y-6">
                {/* Language Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Source Language
                    </label>
                    <select
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:border-[#00C7BE]"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Language *
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:border-[#00C7BE]"
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

                {/* Translation Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Translation Method
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="translation_method"
                        value="text"
                        checked={translationMethod === 'text'}
                        onChange={(e) => setTranslationMethod(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        Text Translation (Faster, basic formatting)
                      </span>
                    </label>
                    <label className="flex items-center opacity-50 cursor-not-allowed">
                      <input
                        type="radio"
                        name="translation_method"
                        value="document"
                        disabled
                        className="mr-2"
                      />
                      <span className="text-sm">
                        Document Translation (Coming soon - preserves formatting)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Start Over
                  </button>
                  
                  <button
                    onClick={startTranslation}
                    disabled={!targetLanguage || isTranslating}
                    className="px-8 py-3 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTranslating ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Starting Translation...
                      </div>
                    ) : (
                      'Start Translation'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Document Not Translatable</h3>
                <p className="text-gray-600 mb-4">
                  This PDF doesn't contain enough extractable text for translation. 
                  The document might be image-based or have very little text content.
                </p>
                <button
                  onClick={resetForm}
                  className="px-6 py-3 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] transition-colors"
                >
                  Try Another Document
                </button>
              </div>
            )}
          </div>
        )}

        {/* Translation Status Section */}
        {job && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Translation Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {job.original_filename}
                  </p>
                  <p className="text-sm text-gray-600">
                    {getLanguageName(job.source_language)} → {getLanguageName(job.target_language)}
                  </p>
                  {job.translated_filename && (
                    <p className="text-sm text-gray-600">
                      Output: {job.translated_filename}
                    </p>
                  )}
                  {job.characters_translated > 0 && (
                    <p className="text-sm text-gray-600">
                      {job.characters_translated.toLocaleString()} characters translated
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
                  Translate Another Document
                </button>
                
                {job.status === 'COMPLETED' && (
                  <button
                    onClick={downloadResult}
                    className="px-8 py-3 bg-[#00C7BE] text-white rounded-lg font-medium hover:bg-[#086C67] transition-colors"
                  >
                    Download Translated PDF
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