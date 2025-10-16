'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../../components/DashboardLayout';

import { apiClient, getApiUrl } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface ApiKey {
  id: number;
  key_name: string;
  api_key: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  real_key?: string;
}

interface ProcessingJob {
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

interface ApiCallDetails {
  curlCommand: string;
  request: any;
  response: any;
  timestamp: string;
  status: 'success' | 'error';
  duration?: number;
}

interface FileProcessingStatus {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStage?: 'analyze' | 'compress' | 'monitor' | 'results';
  job_id?: string;
  api_key?: string;
  compressionLevel?: string;
  originalSize?: number;
  compressedSize?: number;
  savingsPercentage?: number;
  error?: string;
  apiDetails?: {
    analyze?: ApiCallDetails;
    compress?: ApiCallDetails;
    status?: ApiCallDetails;
    download?: ApiCallDetails;
  };
  expanded?: boolean;
}

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

const PROCESSING_STATUS_INITIAL_LIMIT = 5;
const PROCESSING_STATUS_LOAD_MORE_INCREMENT = 5;

export default function PDFCompressorAPIPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState('test');
  const [compressionLevel, setCompressionLevel] = useState('moderate');
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileProcessingStatus, setFileProcessingStatus] = useState<FileProcessingStatus[]>([]);
  const [isProcessingMultiple, setIsProcessingMultiple] = useState(false);
  const [processingStatusPage, setProcessingStatusPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchApiKeys();
      fetchProcessingJobs();
    }
  }, [user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    try {
      const response = await fetch(getApiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('accessToken');
        window.location.href = '/auth/login';
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('accessToken');
      window.location.href = '/auth/login';
    }
  };

  const fetchApiKeys = async () => {
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(getApiUrl('/auth/api-keys'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
        if (keys.length > 0 && !selectedApiKey) {
          setSelectedApiKey(keys[0].api_key);
        }
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const fetchProcessingJobs = async () => {
    if (!selectedApiKey) return;

    try {
      const response = await fetch(getApiUrl('/api/v1/pdf-compressor-api/jobs'), {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`
        }
      });
      if (response.ok) {
        const jobs = await response.json();
        setProcessingJobs(jobs);
      }
    } catch (error) {
      console.error('Failed to fetch processing jobs:', error);
    }
  };

  useEffect(() => {
    if (selectedApiKey) {
      fetchProcessingJobs();
    }
  }, [selectedApiKey]);

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      setNotification({ type: 'error', message: 'Please enter a key name' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(getApiUrl('/auth/api-keys'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key_name: newKeyName
        })
      });

      if (response.ok) {
        setNewKeyName('');
        fetchApiKeys();
        setNotification({ type: 'success', message: 'API key created successfully' });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({ type: 'error', message: 'Failed to create API key' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      setNotification({ type: 'error', message: 'Failed to create API key' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const deleteApiKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(getApiUrl(`/auth/api-keys/${keyId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchApiKeys();
        setNotification({ type: 'success', message: 'API key deleted successfully' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      setNotification({ type: 'error', message: 'Failed to delete API key' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length !== files.length) {
      setNotification({ type: 'error', message: 'Only PDF files are allowed' });
      setTimeout(() => setNotification(null), 3000);
    }

    setSelectedFiles(pdfFiles);
  };

  const generateCurlCommand = (url: string, method: string, headers: any, body?: any) => {
    let curlCommand = `curl -X ${method} "${url}"`;

    Object.entries(headers).forEach(([key, value]) => {
      curlCommand += ` \\\n  -H "${key}: ${value}"`;
    });

    if (body && method === 'POST') {
      if (body instanceof FormData) {
        curlCommand += ` \\\n  -F "file=@{filename}"`;
        curlCommand += ` \\\n  -F "compression_level=${compressionLevel}"`;
      } else {
        curlCommand += ` \\\n  -d '${JSON.stringify(body)}'`;
      }
    }

    return curlCommand;
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) {
      setNotification({ type: 'error', message: 'Please select files to process' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!selectedApiKey) {
      setNotification({ type: 'error', message: 'Please select an API key' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const initialFileStatuses: FileProcessingStatus[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      api_key: selectedApiKey,
      compressionLevel: compressionLevel
    }));

    setFileProcessingStatus(initialFileStatuses);
    setIsProcessingMultiple(true);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
          index === i ? { ...fileStatus, status: 'processing', currentStage: 'analyze' } : fileStatus
        ));

        try {
          await processIndividualFile(file, i);
        } catch (error: any) {
          console.error(`Failed to process file ${file.name}:`, error);
          setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
            index === i ? { ...fileStatus, status: 'failed', error: error.message } : fileStatus
          ));
        }
      }

      setNotification({ type: 'success', message: 'All files processed successfully!' });
      setTimeout(() => setNotification(null), 3000);

    } catch (error) {
      console.error('File processing failed:', error);
      setNotification({ type: 'error', message: 'File processing failed' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsProcessingMultiple(false);
      fetchProcessingJobs();
    }
  };

  const processIndividualFile = async (file: File, fileIndex: number) => {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {
      'Authorization': `Bearer ${selectedApiKey}`
    };

    // Step 1: Analyze PDF
    const analyzeStartTime = Date.now();
    const analyzeUrl = getApiUrl('/api/v1/pdf-compressor-api/analyze');

    setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
      index === fileIndex ? {
        ...fileStatus,
        apiDetails: {
          ...fileStatus.apiDetails,
          analyze: {
            curlCommand: generateCurlCommand(analyzeUrl, 'POST', headers, formData),
            request: 'FormData with PDF file',
            response: null,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success'
          }
        }
      } : fileStatus
    ));

    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers,
      body: formData
    });

    const analyzeData = await analyzeResponse.json();
    const analyzeDuration = Date.now() - analyzeStartTime;

    if (!analyzeResponse.ok) {
      throw new Error(`Analyze failed: ${analyzeData.detail || 'Unknown error'}`);
    }

    setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
      index === fileIndex ? {
        ...fileStatus,
        originalSize: analyzeData.file_size_bytes,
        apiDetails: {
          ...fileStatus.apiDetails,
          analyze: {
            ...fileStatus.apiDetails?.analyze,
            response: analyzeData,
            duration: analyzeDuration
          }
        }
      } : fileStatus
    ));

    // Step 2: Compress PDF
    setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
      index === fileIndex ? { ...fileStatus, currentStage: 'compress' } : fileStatus
    ));

    const compressFormData = new FormData();
    compressFormData.append('file', file);
    compressFormData.append('compression_level', compressionLevel);

    const compressStartTime = Date.now();
    const compressUrl = getApiUrl('/api/v1/pdf-compressor-api/compress');

    setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
      index === fileIndex ? {
        ...fileStatus,
        apiDetails: {
          ...fileStatus.apiDetails,
          compress: {
            curlCommand: generateCurlCommand(compressUrl, 'POST', headers, compressFormData),
            request: `FormData with PDF file and compression_level: ${compressionLevel}`,
            response: null,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success'
          }
        }
      } : fileStatus
    ));

    const compressResponse = await fetch(compressUrl, {
      method: 'POST',
      headers,
      body: compressFormData
    });

    const compressData = await compressResponse.json();
    const compressDuration = Date.now() - compressStartTime;

    if (!compressResponse.ok) {
      throw new Error(`Compression failed: ${compressData.detail || 'Unknown error'}`);
    }

    setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
      index === fileIndex ? {
        ...fileStatus,
        job_id: compressData.job_id,
        currentStage: 'monitor',
        apiDetails: {
          ...fileStatus.apiDetails,
          compress: {
            ...fileStatus.apiDetails?.compress,
            response: compressData,
            duration: compressDuration
          }
        }
      } : fileStatus
    ));

    // Step 3: Monitor job status
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 90; // 90 attempts x 2 seconds = 3 minutes timeout for large PDFs

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusUrl = getApiUrl(`/api/v1/pdf-compressor-api/jobs/${compressData.job_id}/status`);
      const statusStartTime = Date.now();

      const statusResponse = await fetch(statusUrl, {
        headers
      });

      const statusData = await statusResponse.json();
      const statusDuration = Date.now() - statusStartTime;

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusData.detail || 'Unknown error'}`);
      }

      setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
        index === fileIndex ? {
          ...fileStatus,
          apiDetails: {
            ...fileStatus.apiDetails,
            status: {
              curlCommand: generateCurlCommand(statusUrl, 'GET', headers),
              request: 'GET request',
              response: statusData,
              timestamp: new Date().toLocaleTimeString(),
              status: 'success',
              duration: statusDuration
            }
          }
        } : fileStatus
      ));

      if (statusData.status === 'COMPLETED' || statusData.status === 'SUCCEEDED') {
        jobCompleted = true;

        setFileProcessingStatus(prev => prev.map((fileStatus, index) =>
          index === fileIndex ? {
            ...fileStatus,
            currentStage: 'results',
            status: 'completed',
            compressedSize: statusData.compressed_size,
            savingsPercentage: statusData.size_reduction_percentage
          } : fileStatus
        ));

      } else if (statusData.status === 'FAILED') {
        throw new Error(statusData.error_message || 'Job failed');
      }
    }

    if (!jobCompleted) {
      throw new Error('Job timeout - processing took too long');
    }
  };

  const formatStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'succeeded':
        return { text: 'Completed', color: 'text-green-600 bg-green-100' };
      case 'failed':
        return { text: 'Failed', color: 'text-red-600 bg-red-100' };
      case 'processing':
      case 'in_progress':
        return { text: 'Processing', color: 'text-blue-600 bg-blue-100' };
      case 'pending':
        return { text: 'Pending', color: 'text-yellow-600 bg-yellow-100' };
      default:
        return { text: status, color: 'text-gray-600 bg-gray-100' };
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getVisibleProcessingFiles = () => {
    const itemsToShow = PROCESSING_STATUS_INITIAL_LIMIT + (processingStatusPage - 1) * PROCESSING_STATUS_LOAD_MORE_INCREMENT;
    return fileProcessingStatus.slice(0, itemsToShow);
  };

  const hasMoreProcessingFiles = () => {
    const itemsToShow = PROCESSING_STATUS_INITIAL_LIMIT + (processingStatusPage - 1) * PROCESSING_STATUS_LOAD_MORE_INCREMENT;
    return fileProcessingStatus.length > itemsToShow;
  };

  const loadMoreProcessingFiles = () => {
    setProcessingStatusPage(prev => prev + 1);
  };

  const downloadResult = async (jobId: string, filename: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/v1/pdf-compressor-api/download/${jobId}`), {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setNotification({ type: 'error', message: 'Failed to download file' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Download failed:', error);
      setNotification({ type: 'error', message: 'Download failed' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotification({ type: 'success', message: 'API key copied to clipboard' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setNotification({ type: 'error', message: 'Failed to copy API key' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {notification && (
          <div className={`mb-4 p-4 rounded-md ${notification.type === 'success' ? 'bg-green-100 text-green-700' :
              notification.type === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
            }`}>
            {notification.message}
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">PDF Compressor & Optimizer API</h1>
          <p className="text-gray-600 mt-2">Compress and optimize PDF documents using our API with multiple compression levels</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'test', label: 'API Testing' },
              { id: 'keys', label: `API Keys (${apiKeys.length})` },
              { id: 'docs', label: 'Documentation' },
              { id: 'usage', label: 'History & Download' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-900 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* API Testing Tab */}
        {activeTab === 'test' && (
          <div className="space-y-8">
            {/* API Configuration Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl border border-blue-200 p-6 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg p-2 mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">API Configuration</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure your API settings and upload files for compression</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* API Key Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                  <select
                    value={selectedApiKey}
                    onChange={(e) => setSelectedApiKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="">Select an API key</option>
                    {apiKeys.map((key) => (
                      <option key={key.id} value={key.api_key}>
                        {key.key_name} - {key.api_key.substring(0, 10)}...
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF Files</label>
                  <div className="relative border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 border-gray-300 bg-gray-50 hover:border-[#00C7BE] hover:bg-teal-50">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center space-x-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-700">
                          Drag & drop files or
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[#00C7BE] hover:text-teal-800 font-medium ml-1"
                          >
                            browse
                          </button>
                        </p>
                        <p className="text-xs text-gray-500">PDF files only, max 10MB each</p>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}</p>
                          <button
                            onClick={() => {
                              setSelectedFiles([]);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-2 max-h-20 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border text-xs">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-gray-800 truncate font-medium">{file.name}</span>
                            </div>
                            <span className="text-gray-500 flex-shrink-0 ml-2">
                              {(file.size / 1024 / 1024).toFixed(1)}MB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Compression Level Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Compression Level</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center p-3 border border-gray-300 rounded-lg hover:border-[#00C7BE] transition-colors">
                      <input
                        type="radio"
                        name="compressionLevel"
                        value="light"
                        checked={compressionLevel === 'light'}
                        onChange={(e) => setCompressionLevel(e.target.value)}
                        className="h-4 w-4 text-[#00C7BE] focus:ring-[#00C7BE] border-gray-300"
                      />
                      <label className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                        Light (90% quality)
                      </label>
                    </div>

                    <div className="flex items-center p-3 border border-gray-300 rounded-lg hover:border-[#00C7BE] transition-colors">
                      <input
                        type="radio"
                        name="compressionLevel"
                        value="moderate"
                        checked={compressionLevel === 'moderate'}
                        onChange={(e) => setCompressionLevel(e.target.value)}
                        className="h-4 w-4 text-[#00C7BE] focus:ring-[#00C7BE] border-gray-300"
                      />
                      <label className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                        Moderate (70% quality)
                      </label>
                    </div>

                    <div className="flex items-center p-3 border border-gray-300 rounded-lg hover:border-[#00C7BE] transition-colors">
                      <input
                        type="radio"
                        name="compressionLevel"
                        value="aggressive"
                        checked={compressionLevel === 'aggressive'}
                        onChange={(e) => setCompressionLevel(e.target.value)}
                        className="h-4 w-4 text-[#00C7BE] focus:ring-[#00C7BE] border-gray-300"
                      />
                      <label className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                        Aggressive (50% quality)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Process Button */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                  <button
                    onClick={handleProcessFiles}
                    disabled={isProcessingMultiple || selectedFiles.length === 0 || !selectedApiKey}
                    className="w-full bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white px-4 py-3 rounded-lg hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {isProcessingMultiple ? 'Processing...' : `Compress ${selectedFiles.length || 0} File${selectedFiles.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Processing Status Section */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg p-2 mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Processing Status</h2>
                  <p className="text-sm text-gray-600 mt-1">Monitor your file processing progress and download results</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center">
                    <div className="bg-blue-500 p-2 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-2xl font-bold text-blue-700">{selectedFiles.length}</p>
                      <p className="text-xs text-blue-600">Total Files</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center">
                    <div className="bg-green-500 p-2 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-2xl font-bold text-green-700">{fileProcessingStatus.filter(f => f.status === 'completed').length}</p>
                      <p className="text-xs text-green-600">Completed</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center">
                    <div className="bg-yellow-500 p-2 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-2xl font-bold text-yellow-700">{fileProcessingStatus.filter(f => f.status === 'processing').length}</p>
                      <p className="text-xs text-yellow-600">Processing</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center">
                    <div className="bg-gray-500 p-2 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-2xl font-bold text-gray-700">{fileProcessingStatus.filter(f => f.status === 'pending').length}</p>
                      <p className="text-xs text-gray-600">Pending</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Processing Status */}
              {fileProcessingStatus.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Current Session</h3>
                  <div className="space-y-4">
                    {getVisibleProcessingFiles().map((fileStatus, index) => (
                      <div
                        key={index}
                        className="bg-white border rounded-lg p-4 shadow-sm"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setFileProcessingStatus(prev => prev.map((fs, i) =>
                            i === index ? { ...fs, expanded: !fs.expanded } : fs
                          ))}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {fileStatus.status === 'processing' && (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              )}
                              {fileStatus.status === 'completed' && (
                                <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center">
                                  <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              {fileStatus.status === 'failed' && (
                                <div className="h-6 w-6 bg-red-100 rounded-full flex items-center justify-center">
                                  <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              {fileStatus.status === 'pending' && (
                                <div className="h-6 w-6 bg-yellow-100 rounded-full flex items-center justify-center">
                                  <svg className="h-4 w-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{fileStatus.file.name}</div>
                              <div className="text-sm text-gray-900">
                                {fileStatus.currentStage && (
                                  <span className="capitalize">{fileStatus.currentStage}</span>
                                )}
                                {fileStatus.compressionLevel && (
                                  <span> • Level: {fileStatus.compressionLevel}</span>
                                )}
                                {fileStatus.savingsPercentage && (
                                  <span className="text-green-600"> • Saved: {fileStatus.savingsPercentage.toFixed(1)}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${formatStatus(fileStatus.status).color
                              }`}>
                              {formatStatus(fileStatus.status).text}
                            </span>
                            <svg
                              className={`h-5 w-5 text-gray-400 transition-transform ${fileStatus.expanded ? 'rotate-180' : ''
                                }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>

                        {fileStatus.error && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="text-sm text-red-800">
                              <strong>Error:</strong> {fileStatus.error}
                            </div>
                          </div>
                        )}

                        {fileStatus.expanded && fileStatus.apiDetails && (
                          <div className="mt-4 space-y-4">
                            {/* API Call Details */}
                            {Object.entries(fileStatus.apiDetails).map(([step, details]) => (
                              details && (
                                <div key={step} className="border rounded-md p-3 bg-gray-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-gray-900 capitalize">{step} API Call</h4>
                                    <div className="flex items-center space-x-2">
                                      {details.duration && (
                                        <span className="text-xs text-gray-900">{details.duration}ms</span>
                                      )}
                                      <span className="text-xs text-gray-900">{details.timestamp}</span>
                                    </div>
                                  </div>

                                  {details.curlCommand && (
                                    <div className="mb-3">
                                      <div className="text-xs font-medium text-gray-700 mb-1">cURL Command:</div>
                                      <div className="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono overflow-x-auto">
                                        <pre>{details.curlCommand}</pre>
                                      </div>
                                    </div>
                                  )}

                                  {details.response && (
                                    <div>
                                      <div className="text-xs font-medium text-gray-700 mb-1">Response:</div>
                                      <div className="bg-white border rounded p-2 text-xs">
                                        <pre className="whitespace-pre-wrap text-gray-900">{JSON.stringify(details.response, null, 2)}</pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            ))}

                            {/* Download Button for Completed Files */}
                            {fileStatus.status === 'completed' && fileStatus.job_id && (
                              <button
                                onClick={() => downloadResult(fileStatus.job_id!, `${fileStatus.file.name.replace('.pdf', '')}_compressed.pdf`)}
                                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                              >
                                Download Compressed PDF
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {hasMoreProcessingFiles() && (
                      <button
                        onClick={loadMoreProcessingFiles}
                        className="w-full py-2 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Show More Files
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Your API Keys</h2>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    placeholder="Key name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                  />
                  <button
                    onClick={createApiKey}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Create Key
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Key</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {apiKeys.map((key) => (
                      <tr key={key.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {key.key_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          <div className="flex items-center space-x-2">
                            <span className="break-all">{key.api_key}</span>
                            <button
                              onClick={() => copyToClipboard(key.api_key)}
                              className="ml-2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(key.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${key.is_active ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                            }`}>
                            {key.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => deleteApiKey(key.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Documentation Tab */}
        {activeTab === 'docs' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">PDF Compressor & Optimizer API Documentation</h2>

            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Authentication</h3>
              <p className="mb-4 text-gray-900">All API requests require authentication using Bearer token:</p>
              <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-6">
                <code>Authorization: Bearer YOUR_API_KEY</code>
              </div>

              <h3 className="text-lg font-semibold mb-4 text-gray-900">Base URL</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-6">
                <code>http://localhost:8000/api/v1/pdf-compressor-api</code>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">1. Get Compression Levels</h3>
                  <p className="mb-4 text-gray-900">Get available compression levels and their descriptions.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET "${getApiUrl("/api/v1/pdf-compressor-api/compression-levels")}" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">2. Analyze PDF</h3>
                  <p className="mb-4 text-gray-900">Analyze a PDF to get file information and estimated savings.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X POST "${getApiUrl("/api/v1/pdf-compressor-api/analyze")}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">3. Compress PDF</h3>
                  <p className="mb-4 text-gray-900">Compress a PDF with the specified compression level.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X POST "${getApiUrl("/api/v1/pdf-compressor-api/compress")}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  -F "compression_level=moderate"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">4. Check Job Status</h3>
                  <p className="mb-4 text-gray-900">Check the status of a compression job.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET "${getApiUrl("/api/v1/pdf-compressor-api/jobs/{job_id}/status")}" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">5. Download Result</h3>
                  <p className="mb-4 text-gray-900">Download the compressed PDF file.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET "${getApiUrl("/api/v1/pdf-compressor-api/download/{job_id}")}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -o "compressed.pdf"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">6. List Jobs</h3>
                  <p className="mb-4 text-gray-900">List all your compression jobs.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET "${getApiUrl("/api/v1/pdf-compressor-api/jobs")}" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-4 text-gray-900">Compression Levels</h3>
              <ul className="list-disc list-inside space-y-2 mb-6 text-gray-900">
                <li><strong>light:</strong> 90% quality, 150 DPI - Minimal compression, best quality</li>
                <li><strong>moderate:</strong> 70% quality, 120 DPI - Balanced compression (recommended)</li>
                <li><strong>aggressive:</strong> 50% quality, 96 DPI - Maximum compression, smaller file</li>
              </ul>

              <h3 className="text-lg font-semibold mb-4 text-gray-900">Response Format</h3>
              <p className="mb-4 text-gray-900">All API responses are in JSON format. Successful responses return relevant data, while errors return details about what went wrong.</p>
            </div>
          </div>
        )}

        {/* History & Download Tab */}
        {activeTab === 'usage' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">History & Download</h2>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                📝 The maximum number of historical jobs that can be viewed is limited to 100.
              </p>
            </div>

            {/* Page Size Selector */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label htmlFor="pageSize" className="text-sm font-medium text-gray-900">Show:</label>
                <select
                  id="pageSize"
                  value={historyPageSize}
                  onChange={(e) => {
                    setHistoryPageSize(Number(e.target.value));
                    setHistoryPage(1);
                  }}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-900">entries</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Job ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Savings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const limitedJobs = processingJobs.slice(0, 100);
                    const startIndex = (historyPage - 1) * historyPageSize;
                    const endIndex = startIndex + historyPageSize;
                    const paginatedJobs = limitedJobs.slice(startIndex, endIndex);

                    return paginatedJobs.map((job) => (
                      <tr key={job.job_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(job.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(job.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {job.original_filename}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {job.compression_level}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {job.job_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${formatStatus(job.status).color
                            }`}>
                            {formatStatus(job.status).text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {job.size_reduction_percentage !== undefined ? (
                            <span className="text-green-600 font-semibold">
                              {job.size_reduction_percentage.toFixed(1)}%
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(job.status === 'COMPLETED' || job.status === 'SUCCEEDED') && (
                            <button
                              onClick={() => downloadResult(job.job_id, job.output_filename || `${job.original_filename}_compressed.pdf`)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Download
                            </button>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>

              {processingJobs.length === 0 && (
                <div className="text-center py-8 text-gray-900">
                  No history available
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {processingJobs.length > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-900">
                  Showing {Math.min((historyPage - 1) * historyPageSize + 1, Math.min(processingJobs.length, 100))} to{' '}
                  {Math.min(historyPage * historyPageSize, Math.min(processingJobs.length, 100))} of{' '}
                  {Math.min(processingJobs.length, 100)} entries
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                    disabled={historyPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  {(() => {
                    const totalPages = Math.ceil(Math.min(processingJobs.length, 100) / historyPageSize);
                    const pages = [];
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setHistoryPage(i)}
                          className={`px-3 py-1 border rounded-md text-sm ${historyPage === i
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pages;
                  })()}
                  <button
                    onClick={() => setHistoryPage(Math.min(Math.ceil(Math.min(processingJobs.length, 100) / historyPageSize), historyPage + 1))}
                    disabled={historyPage >= Math.ceil(Math.min(processingJobs.length, 100) / historyPageSize)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
