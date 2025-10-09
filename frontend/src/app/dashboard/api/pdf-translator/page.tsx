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

interface ApiUsage {
  id: number;
  endpoint: string;
  job_id: string;
  status: string;
  file_count: number;
  processing_time: number | null;
  created_at: string;
  completed_at: string | null;
}

interface ProcessingJob {
  job_id: string;
  status: string;
  original_filename: string;
  source_language: string;
  target_language: string;
  output_filename?: string;
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
  currentStage?: 'analyze' | 'translate' | 'monitor' | 'results';
  job_id?: string;
  api_key?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  error?: string;
  apiDetails?: {
    analyze?: ApiCallDetails;
    translate?: ApiCallDetails;
    status?: ApiCallDetails;
    download?: ApiCallDetails;
  };
  expanded?: boolean;
}

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface Language {
  code: string;
  name: string;
}

const PROCESSING_STATUS_INITIAL_LIMIT = 5;
const PROCESSING_STATUS_LOAD_MORE_INCREMENT = 5;

export default function PDFTranslatorAPIPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [apiUsage, setApiUsage] = useState<ApiUsage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState('test');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [languages, setLanguages] = useState<Language[]>([]);
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
      fetchApiUsage();
      fetchProcessingJobs();
      fetchLanguages();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApiKey) {
      fetchApiUsage();
      fetchLanguages();
    }
  }, [selectedApiKey]);

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

  const fetchApiUsage = async () => {
    if (!selectedApiKey) return;
    
    try {
      const response = await fetch(getApiUrl('/api/v1/pdf-translator-api/usage'), {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`
        }
      });
      if (response.ok) {
        const usage = await response.json();
        setApiUsage(usage);
      }
    } catch (error) {
      console.error('Failed to fetch API usage:', error);
    }
  };

  const fetchProcessingJobs = async () => {
    if (!selectedApiKey) return;
    
    try {
      const response = await fetch(getApiUrl('/api/v1/pdf-translator-api/jobs'), {
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

  const fetchLanguages = async () => {
    if (!selectedApiKey) return;
    
    try {
      const response = await fetch(getApiUrl('/api/v1/pdf-translator-api/languages'), {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`
        }
      });
      if (response.ok) {
        const languageData = await response.json();
        // Convert languages object to array
        const languagesArray = Object.entries(languageData.languages).map(([code, details]: [string, any]) => ({
          code,
          name: details.name
        }));
        setLanguages(languagesArray);
        // Don't auto-select any target language - let user choose
      }
    } catch (error) {
      console.error('Failed to fetch languages:', error);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      setNotification({type: 'error', message: 'Please enter a key name'});
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
        setNotification({type: 'success', message: 'API key created successfully'});
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({type: 'error', message: 'Failed to create API key'});
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      setNotification({type: 'error', message: 'Failed to create API key'});
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
        setNotification({type: 'success', message: 'API key deleted successfully'});
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      setNotification({type: 'error', message: 'Failed to delete API key'});
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length !== files.length) {
      setNotification({type: 'error', message: 'Only PDF files are allowed'});
      setTimeout(() => setNotification(null), 3000);
    }
    
    setSelectedFiles(pdfFiles);
  };

  // Helper function to generate cURL commands for API calls
  const generateCurlCommand = (url: string, method: string, headers: any, body?: any) => {
    let curlCommand = `curl -X ${method} "${url}"`;
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curlCommand += ` \\\n  -H "${key}: ${value}"`;
    });
    
    // Add body for POST requests
    if (body && method === 'POST') {
      if (body instanceof FormData) {
        // For FormData, we'll show a simplified representation
        curlCommand += ` \\\n  -F "file=@{filename}"`;
        if (sourceLanguage) {
          curlCommand += ` \\\n  -F "source_language=${sourceLanguage}"`;
        }
        if (targetLanguage) {
          curlCommand += ` \\\n  -F "target_language=${targetLanguage}"`;
        }
        curlCommand += ` \\\n  -F "translation_method=document"`;
      } else {
        curlCommand += ` \\\n  -d '${JSON.stringify(body)}'`;
      }
    }
    
    return curlCommand;
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) {
      setNotification({type: 'error', message: 'Please select files to process'});
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!selectedApiKey) {
      setNotification({type: 'error', message: 'Please select an API key'});
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!targetLanguage) {
      setNotification({type: 'error', message: 'Please select a target language'});
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // Initialize processing status for each file
    const initialFileStatuses: FileProcessingStatus[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      api_key: selectedApiKey,
      sourceLanguage,
      targetLanguage
    }));
    
    setFileProcessingStatus(initialFileStatuses);
    setIsProcessingMultiple(true);
    
    // Process files one by one
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Update status to processing with analyze stage
        setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
          index === i ? { ...fileStatus, status: 'processing', currentStage: 'analyze' } : fileStatus
        ));
        
        try {
          // Process individual file
          await processIndividualFile(file, i);
        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
          // Update status to failed
          setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
            index === i ? { ...fileStatus, status: 'failed', error: error.message } : fileStatus
          ));
        }
      }
      
      setNotification({type: 'success', message: 'All files processed successfully!'});
      setTimeout(() => setNotification(null), 3000);
      
    } catch (error) {
      console.error('File processing failed:', error);
      setNotification({type: 'error', message: 'File processing failed'});
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsProcessingMultiple(false);
      fetchProcessingJobs();
    }
  };

  const processIndividualFile = async (file: File, fileIndex: number) => {
    const headers = {
      'Authorization': `Bearer ${selectedApiKey}`
    };

    // Step 1: Analyze PDF
    const analyzeFormData = new FormData();
    analyzeFormData.append('file', file);

    const analyzeStartTime = Date.now();
    const analyzeUrl = getApiUrl('/api/v1/pdf-translator-api/analyze');
    
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { 
        ...fileStatus, 
        apiDetails: { 
          ...fileStatus.apiDetails, 
          analyze: {
            curlCommand: generateCurlCommand(analyzeUrl, 'POST', headers, analyzeFormData),
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
      body: analyzeFormData
    });

    const analyzeData = await analyzeResponse.json();
    const analyzeDuration = Date.now() - analyzeStartTime;

    if (!analyzeResponse.ok) {
      throw new Error(`Analyze failed: ${analyzeData.detail || 'Unknown error'}`);
    }

    // Update with analyze response
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { 
        ...fileStatus,
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

    // Update status to translate stage
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { ...fileStatus, currentStage: 'translate' } : fileStatus
    ));

    // Step 2: Start PDF translation
    const translateFormData = new FormData();
    translateFormData.append('file', file);
    translateFormData.append('source_language', sourceLanguage);
    translateFormData.append('target_language', targetLanguage);
    translateFormData.append('translation_method', 'document');
    
    const translateStartTime = Date.now();
    const translateUrl = getApiUrl('/api/v1/pdf-translator-api/translate');
    
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { 
        ...fileStatus, 
        apiDetails: { 
          ...fileStatus.apiDetails, 
          translate: {
            curlCommand: generateCurlCommand(translateUrl, 'POST', headers, translateFormData),
            request: `FormData with PDF file, source_language: ${sourceLanguage}, target_language: ${targetLanguage}`,
            response: null,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success'
          }
        }
      } : fileStatus
    ));

    const translateResponse = await fetch(translateUrl, {
      method: 'POST',
      headers,
      body: translateFormData
    });

    const translateData = await translateResponse.json();
    const translateDuration = Date.now() - translateStartTime;

    if (!translateResponse.ok) {
      throw new Error(`Translation failed: ${translateData.detail || 'Unknown error'}`);
    }

    // Update with translate response
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { 
        ...fileStatus,
        job_id: translateData.job_id,
        currentStage: 'monitor',
        apiDetails: { 
          ...fileStatus.apiDetails, 
          translate: {
            ...fileStatus.apiDetails?.translate,
            response: translateData,
            duration: translateDuration
          }
        }
      } : fileStatus
    ));

    // Step 3: Monitor job status
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // Longer for translation

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      attempts++;

      const statusUrl = getApiUrl(`/api/v1/pdf-translator-api/jobs/${translateData.job_id}/status`);
      const statusStartTime = Date.now();
      
      const statusResponse = await fetch(statusUrl, {
        headers
      });

      const statusData = await statusResponse.json();
      const statusDuration = Date.now() - statusStartTime;

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusData.detail || 'Unknown error'}`);
      }

      // Update status call details
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

      if (statusData.status === 'COMPLETED') {
        jobCompleted = true;
        
        // Update to results stage
        setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
          index === fileIndex ? { ...fileStatus, currentStage: 'results', status: 'completed' } : fileStatus
        ));
        
      } else if (statusData.status === 'FAILED') {
        throw new Error(statusData.error_message || 'Job failed');
      }
    }

    if (!jobCompleted) {
      throw new Error('Job timeout - translation took too long');
    }
  };

  // Status formatting functions
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

  const formatProcessingTime = (usage: ApiUsage) => {
    return usage.processing_time ? `${usage.processing_time}s` : 'N/A';
  };

  // Processing status pagination functions
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
      const response = await fetch(getApiUrl(`/api/v1/pdf-translator-api/download/${jobId}`), {
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
        setNotification({type: 'error', message: 'Failed to download file'});
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Download failed:', error);
      setNotification({type: 'error', message: 'Download failed'});
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotification({type: 'success', message: 'API key copied to clipboard'});
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setNotification({type: 'error', message: 'Failed to copy API key'});
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
          <div className={`mb-4 p-4 rounded-md ${
            notification.type === 'success' ? 'bg-green-100 text-green-700' :
            notification.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {notification.message}
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">PDF Translator API</h1>
          <p className="text-gray-600 mt-2">Translate PDF documents to different languages using our API</p>
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
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
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
                <div className="ml-4">
                  <h2 className="text-xl font-bold text-gray-900">API configuration</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure your API settings and upload files for processing</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Step 1: API Key Selection - Full Width */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                  <select
                    value={selectedApiKey}
                    onChange={(e) => setSelectedApiKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="">Select an API key</option>
                    {apiKeys.map((key) => (
                      <option key={key.id} value={key.real_key || key.api_key}>
                        {key.key_name} ({key.api_key})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: File Upload - Full Width, Compact */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF Files</label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <div
                    className="relative border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 border-gray-300 bg-gray-50 hover:border-[#00C7BE] hover:bg-teal-50 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex items-center justify-center space-x-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                        <svg 
                          className="w-5 h-5 text-gray-500" 
                          fill="none"
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">
                          {selectedFiles.length > 0 
                            ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected` 
                            : 'Click to upload or drag and drop'
                          }
                        </p>
                        <p className="text-xs text-gray-500">PDF files only</p>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="text-right">
                          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#00C7BE]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {selectedFiles.map(f => f.name).join(', ')}
                    </div>
                  )}
                </div>

                {/* Step 3: Translation Configuration - Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Source Language</label>
                    <select
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900 bg-white"
                    >
                      <option value="auto">Auto-detect</option>
                      {Array.isArray(languages) && languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Language</label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900 bg-white"
                    >
                      <option value="">Select target language</option>
                      {Array.isArray(languages) && languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 4: Process Files - Full Width Action Button */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                  <button
                    onClick={handleProcessFiles}
                    disabled={!selectedApiKey || selectedFiles.length === 0 || !targetLanguage}
                    className="w-full bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white px-4 py-2 rounded-lg hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4M4 16l4-4" />
                    </svg>
                    {isProcessingMultiple ? 'Processing...' : `Translate ${selectedFiles.length || 0} file${selectedFiles.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Enhanced Processing Status Section */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg p-2 mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h2 className="text-xl font-bold text-gray-900">Processing status</h2>
                  <p className="text-sm text-gray-600 mt-1">Monitor your file processing progress and download results</p>
                </div>
              </div>

              {/* Quick Stats - Tile Structure */}
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

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center">
                    <div className="bg-purple-500 p-2 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-2xl font-bold text-purple-700">{fileProcessingStatus.filter(f => f.status === 'pending').length}</p>
                      <p className="text-xs text-purple-600">Pending</p>
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
                                {fileStatus.sourceLanguage && fileStatus.targetLanguage && (
                                  <span> • {fileStatus.sourceLanguage} → {fileStatus.targetLanguage}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              formatStatus(fileStatus.status).color
                            }`}>
                              {formatStatus(fileStatus.status).text}
                            </span>
                            <svg 
                              className={`h-5 w-5 text-gray-400 transition-transform ${
                                fileStatus.expanded ? 'rotate-180' : ''
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
                                onClick={() => downloadResult(fileStatus.job_id!, `${fileStatus.file.name.replace('.pdf', '')}_translated.pdf`)}
                                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                              >
                                Download Translated PDF
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
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
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
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            key.is_active ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
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
            <h2 className="text-2xl font-bold text-gray-900 mb-8">PDF Translator API Documentation</h2>
            
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Authentication</h3>
              <p className="mb-4 text-gray-900">All API requests require authentication using Bearer token:</p>
              <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-6">
                <code>Authorization: Bearer YOUR_API_KEY</code>
              </div>

              <h3 className="text-lg font-semibold mb-4 text-gray-900">Base URL</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-6">
                <code>http://localhost:8000/api/v1/pdf-translator-api</code>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">1. Get Supported Languages</h3>
                  <p className="mb-4 text-gray-900">Get a list of all supported languages for translation.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET getApiUrl("/api/v1/pdf-translator-api/languages") \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                  <p className="text-gray-900"><strong>Note:</strong> Replace <code>YOUR_API_KEY</code> with your actual API key from the API Keys tab.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">2. Analyze PDF</h3>
                  <p className="mb-4 text-gray-900">Analyze a PDF to detect its language before translation.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X POST getApiUrl("/api/v1/pdf-translator-api/analyze") \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">3. Translate PDF</h3>
                  <p className="mb-4 text-gray-900">Start a PDF translation job.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X POST getApiUrl("/api/v1/pdf-translator-api/translate") \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  -F "source_language=en" \\
  -F "target_language=es" \\
  -F "translation_method=document"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">4. Check Job Status</h3>
                  <p className="mb-4 text-gray-900">Check the status of a translation job.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET getApiUrl("/api/v1/pdf-translator-api/jobs/{job_id}/status") \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">5. Download Result</h3>
                  <p className="mb-4 text-gray-900">Download the translated PDF file.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET getApiUrl("/api/v1/pdf-translator-api/download/{job_id}") \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -o "translated.pdf"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">6. List Jobs</h3>
                  <p className="mb-4 text-gray-900">List all your translation jobs.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET getApiUrl("/api/v1/pdf-translator-api/jobs") \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-4 text-gray-900">Language Options</h3>
              <ul className="list-disc list-inside space-y-2 mb-6 text-gray-900">
                <li><strong>Source language:</strong> Use "auto" for automatic detection or specify a language code</li>
                <li><strong>Target language:</strong> Must be a supported language code (e.g., "es", "fr", "de")</li>
                <li><strong>Translation method:</strong> Currently supports "document" method</li>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Endpoint</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Job ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Languages</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Duration</th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {job.status === 'COMPLETED' 
                            ? `/pdf-translator-api/download/${job.job_id}`
                            : `/pdf-translator-api/translate`
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {job.job_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            formatStatus(job.status).color
                          }`}>
                            {formatStatus(job.status).text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {job.source_language} → {job.target_language}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {job.completed_at && job.created_at ? 
                            `${((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000).toFixed(6)}s` : 
                            'N/A'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {job.status === 'COMPLETED' && (
                            <button
                              onClick={() => downloadResult(job.job_id, job.output_filename || `${job.original_filename}_translated.pdf`)}
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
                          className={`px-3 py-1 border rounded-md text-sm ${
                            historyPage === i
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