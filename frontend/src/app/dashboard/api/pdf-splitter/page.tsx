'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../../components/DashboardLayout';

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
  pages_extracted: number;
  processing_time: number | null;
  created_at: string;
  completed_at: string | null;
}

interface ProcessingJob {
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
  currentStage?: 'analyze' | 'split' | 'monitor' | 'results';
  job_id?: string;
  api_key?: string;
  selectedPages?: number[];
  totalPages?: number;
  error?: string;
  apiDetails?: {
    analyze?: ApiCallDetails;
    split?: ApiCallDetails;
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

export default function PDFSplitterAPIPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [apiUsage, setApiUsage] = useState<ApiUsage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState('test');
  const [pageSelection, setPageSelection] = useState('specific');
  const [specificPages, setSpecificPages] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileProcessingStatus, setFileProcessingStatus] = useState<FileProcessingStatus[]>([]);
  const [isProcessingMultiple, setIsProcessingMultiple] = useState(false);
  const [processingStatusPage, setProcessingStatusPage] = useState(1);
  const [analyzeResponse, setAnalyzeResponse] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchApiKeys();
      fetchApiUsage();
      fetchProcessingJobs();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApiKey) {
      fetchApiUsage();
    }
  }, [selectedApiKey]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('token');
        window.location.href = '/auth/login';
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
  };

  const fetchApiKeys = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:8000/auth/api-keys', {
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
      const response = await fetch('http://localhost:8000/api/v1/pdf-splitter-api/usage', {
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
      const response = await fetch('http://localhost:8000/api/v1/pdf-splitter-api/jobs', {
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

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      setNotification({type: 'error', message: 'Please enter a key name'});
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:8000/auth/api-keys', {
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

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:8000/auth/api-keys/${keyId}`, {
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

  const generatePageList = (totalPages: number): number[] => {
    if (pageSelection === 'all') {
      return Array.from({length: totalPages}, (_, i) => i + 1);
    } else if (pageSelection === 'specific') {
      if (!specificPages.trim()) return [];
      return specificPages.split(',')
        .map(p => parseInt(p.trim()))
        .filter(p => p >= 1 && p <= totalPages);
    } else if (pageSelection === 'range') {
      const start = parseInt(rangeStart);
      const end = parseInt(rangeEnd);
      if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > totalPages) return [];
      return Array.from({length: end - start + 1}, (_, i) => start + i);
    }
    return [];
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
        if (pageSelection) {
          curlCommand += ` \\\n  -F "selected_pages=${JSON.stringify(generatePageList(analyzeResponse?.total_pages || 10))}"`;
        }
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

    // Initialize processing status for each file
    const initialFileStatuses: FileProcessingStatus[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      api_key: selectedApiKey
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
    const formData = new FormData();
    formData.append('file', file);

    const headers = {
      'Authorization': `Bearer ${selectedApiKey}`
    };

    // Step 1: Analyze PDF
    const analyzeStartTime = Date.now();
    const analyzeUrl = 'http://localhost:8000/api/v1/pdf-splitter-api/analyze';
    
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

    // Update with analyze response
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { 
        ...fileStatus,
        totalPages: analyzeData.total_pages,
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

    // Generate pages to extract
    const pagesToExtract = generatePageList(analyzeData.total_pages);
    if (pagesToExtract.length === 0) {
      throw new Error('No valid pages selected for extraction');
    }

    // Update status to split stage
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { ...fileStatus, currentStage: 'split', selectedPages: pagesToExtract } : fileStatus
    ));

    // Step 2: Start PDF splitting
    const splitFormData = new FormData();
    splitFormData.append('file', file);
    splitFormData.append('selected_pages', JSON.stringify(pagesToExtract));
    
    const splitStartTime = Date.now();
    const splitUrl = 'http://localhost:8000/api/v1/pdf-splitter-api/split';
    
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { 
        ...fileStatus, 
        apiDetails: { 
          ...fileStatus.apiDetails, 
          split: {
            curlCommand: generateCurlCommand(splitUrl, 'POST', headers, splitFormData),
            request: `FormData with PDF file and selected_pages: ${JSON.stringify(pagesToExtract)}`,
            response: null,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success'
          }
        }
      } : fileStatus
    ));

    const splitResponse = await fetch(splitUrl, {
      method: 'POST',
      headers,
      body: splitFormData
    });

    const splitData = await splitResponse.json();
    const splitDuration = Date.now() - splitStartTime;

    if (!splitResponse.ok) {
      throw new Error(`Split failed: ${splitData.detail || 'Unknown error'}`);
    }

    // Update with split response
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { 
        ...fileStatus,
        job_id: splitData.job_id,
        currentStage: 'monitor',
        apiDetails: { 
          ...fileStatus.apiDetails, 
          split: {
            ...fileStatus.apiDetails?.split,
            response: splitData,
            duration: splitDuration
          }
        }
      } : fileStatus
    ));

    // Step 3: Monitor job status
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;

      const statusUrl = `http://localhost:8000/api/v1/pdf-splitter-api/jobs/${splitData.job_id}/status`;
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
      throw new Error('Job timeout - processing took too long');
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
      const response = await fetch(`http://localhost:8000/api/v1/pdf-splitter-api/download/${jobId}`, {
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
          <h1 className="text-3xl font-bold text-gray-900">PDF Page Splitter API</h1>
          <p className="text-gray-600 mt-2">Extract specific pages from PDF documents using our API</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'test', label: 'API Testing' },
              { id: 'keys', label: `API Keys (${apiKeys.length})` },
              { id: 'docs', label: 'Documentation' },
              { id: 'usage', label: `Usage History (${apiUsage.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h2 className="text-xl font-bold text-gray-900">API configuration</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure your API settings and upload files for processing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Configuration */}
                <div className="space-y-6">
                  {/* API Key Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                    <select
                      value={selectedApiKey}
                      onChange={(e) => setSelectedApiKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload PDF Files
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:border-blue-500"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        Selected: {selectedFiles.map(f => f.name).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Page Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Page Selection</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pageSelection"
                          value="all"
                          checked={pageSelection === 'all'}
                          onChange={(e) => setPageSelection(e.target.value)}
                          className="mr-2"
                        />
                        Extract all pages
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pageSelection"
                          value="specific"
                          checked={pageSelection === 'specific'}
                          onChange={(e) => setPageSelection(e.target.value)}
                          className="mr-2"
                        />
                        Specific pages (e.g., 1,3,5)
                      </label>
                      {pageSelection === 'specific' && (
                        <input
                          type="text"
                          placeholder="1,3,5"
                          value={specificPages}
                          onChange={(e) => setSpecificPages(e.target.value)}
                          className="ml-6 px-3 py-1 border border-gray-300 rounded text-sm w-32"
                        />
                      )}
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pageSelection"
                          value="range"
                          checked={pageSelection === 'range'}
                          onChange={(e) => setPageSelection(e.target.value)}
                          className="mr-2"
                        />
                        Page range
                      </label>
                      {pageSelection === 'range' && (
                        <div className="ml-6 flex items-center space-x-2">
                          <input
                            type="number"
                            placeholder="Start"
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded text-sm w-20"
                            min="1"
                          />
                          <span>to</span>
                          <input
                            type="number"
                            placeholder="End"
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded text-sm w-20"
                            min="1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Actions */}
                <div className="space-y-6">
                  <div className="bg-white p-4 rounded-lg border">
                    <h3 className="font-medium text-gray-900 mb-3">Processing Actions</h3>
                    <div className="space-y-3">
                      <button
                        onClick={handleProcessFiles}
                        disabled={isProcessingMultiple || selectedFiles.length === 0 || !selectedApiKey}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isProcessingMultiple ? 'Processing...' : 'Process Files'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h3 className="font-medium text-gray-900 mb-3">Quick Stats</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Files selected:</span>
                        <span className="font-medium">{selectedFiles.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing jobs:</span>
                        <span className="font-medium">{processingJobs.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Processing Status Section */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gray-600 text-white">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h2 className="text-xl font-bold text-gray-900">Processing status</h2>
                  <p className="text-sm text-gray-600 mt-1">Monitor your file processing progress and download results</p>
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
                              <div className="text-sm text-gray-500">
                                {fileStatus.currentStage && (
                                  <span className="capitalize">{fileStatus.currentStage}</span>
                                )}
                                {fileStatus.selectedPages && (
                                  <span> • Pages: {fileStatus.selectedPages.length} selected</span>
                                )}
                                {fileStatus.totalPages && (
                                  <span> • Total: {fileStatus.totalPages} pages</span>
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
                                        <span className="text-xs text-gray-500">{details.duration}ms</span>
                                      )}
                                      <span className="text-xs text-gray-500">{details.timestamp}</span>
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
                                        <pre className="whitespace-pre-wrap">{JSON.stringify(details.response, null, 2)}</pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            ))}

                            {/* Download Button for Completed Files */}
                            {fileStatus.status === 'completed' && fileStatus.job_id && (
                              <button
                                onClick={() => downloadResult(fileStatus.job_id!, `${fileStatus.file.name.replace('.pdf', '')}_split.pdf`)}
                                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                              >
                                Download Split PDF
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

              {/* Previous Processing Jobs */}
              {processingJobs.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Previous Jobs</h3>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {processingJobs.slice(0, 10).map((job) => (
                          <tr key={job.job_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {job.original_filename}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.selected_pages.length} of {job.total_pages}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                formatStatus(job.status).color
                              }`}>
                                {formatStatus(job.status).text}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(job.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.status === 'COMPLETED' && (
                                <button
                                  onClick={() => downloadResult(job.job_id, job.output_filename || `${job.original_filename}_split.pdf`)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Download
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {apiKeys.map((key) => (
                      <tr key={key.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {key.key_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {key.api_key.substring(0, 20)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(key.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            key.is_active ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                          }`}>
                            {key.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
            <h2 className="text-2xl font-bold text-gray-900 mb-8">PDF Page Splitter API Documentation</h2>
            
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-4">Authentication</h3>
              <p className="mb-4">All API requests require authentication using Bearer token:</p>
              <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-6">
                <code>Authorization: Bearer YOUR_API_KEY</code>
              </div>

              <h3 className="text-lg font-semibold mb-4">Base URL</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-6">
                <code>http://localhost:8000/api/v1/pdf-splitter-api</code>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">1. Analyze PDF</h3>
                  <p className="mb-4">Analyze a PDF to get page information before splitting.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X POST "http://localhost:8000/api/v1/pdf-splitter-api/analyze" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf"`}</pre>
                  </div>
                  <p><strong>Note:</strong> Replace <code>YOUR_API_KEY</code> with your actual API key from the API Keys tab.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">2. Split PDF</h3>
                  <p className="mb-4">Split a PDF by extracting specific pages.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X POST "http://localhost:8000/api/v1/pdf-splitter-api/split" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  -F "selected_pages=[1,3,5]"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">3. Check Job Status</h3>
                  <p className="mb-4">Check the status of a splitting job.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET "http://localhost:8000/api/v1/pdf-splitter-api/jobs/{job_id}/status" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">4. Download Result</h3>
                  <p className="mb-4">Download the split PDF file.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET "http://localhost:8000/api/v1/pdf-splitter-api/download/{job_id}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -o "result.pdf"`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">5. List Jobs</h3>
                  <p className="mb-4">List all your splitting jobs.</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md mb-4">
                    <pre>{`curl -X GET "http://localhost:8000/api/v1/pdf-splitter-api/jobs" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-4">Page Selection Options</h3>
              <ul className="list-disc list-inside space-y-2 mb-6">
                <li><strong>All pages:</strong> Leave selected_pages empty or pass all page numbers</li>
                <li><strong>Specific pages:</strong> Pass an array like <code>[1,3,5,7]</code></li>
                <li><strong>Page range:</strong> Pass consecutive pages like <code>[2,3,4,5]</code></li>
              </ul>

              <h3 className="text-lg font-semibold mb-4">Response Format</h3>
              <p className="mb-4">All API responses are in JSON format. Successful responses return relevant data, while errors return details about what went wrong.</p>
            </div>
          </div>
        )}

        {/* Usage History Tab */}
        {activeTab === 'usage' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">API Usage History</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Files</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pages</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {apiUsage.map((usage) => (
                    <tr key={usage.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {usage.endpoint}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {usage.job_id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          formatStatus(usage.status).color
                        }`}>
                          {formatStatus(usage.status).text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {usage.file_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {usage.pages_extracted}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatProcessingTime(usage)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(usage.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {apiUsage.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No usage history available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}