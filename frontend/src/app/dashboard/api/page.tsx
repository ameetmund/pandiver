'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';

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
  downloadUrls?: {
    tables?: { [key: string]: string };
    key_values?: { [key: string]: string };
  };
}

interface FileProcessingStatus {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  job_id?: string;
  downloadUrls?: {
    tables?: { [key: string]: string };
    key_values?: { [key: string]: string };
  };
  error?: string;
}

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function APIPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [apiUsage, setApiUsage] = useState<ApiUsage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState('test');
  const [outputFormat, setOutputFormat] = useState('json');
  const [tableMode, setTableMode] = useState('individual');
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [newKeyName, setNewKeyName] = useState<string>('');
  
  // New state for enhanced features
  const [generatedCurl, setGeneratedCurl] = useState<string>('');
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [executionFlow, setExecutionFlow] = useState<Array<{
    step: string;
    endpoint: string;
    method: string;
    response?: any;
    status?: 'success' | 'error' | 'loading';
  }>>([]);
  const [curlExecutionResult, setCurlExecutionResult] = useState<any>(null);
  const [fileProcessingStatus, setFileProcessingStatus] = useState<FileProcessingStatus[]>([]);
  const [isProcessingMultiple, setIsProcessingMultiple] = useState(false);

  useEffect(() => {
    loadUser();
    loadApiKeys();
    loadApiUsage();
  }, []);

  useEffect(() => {
    if (selectedFiles.length > 0 && selectedApiKey) {
      generateCurlCommand(selectedFiles);
    }
  }, [selectedFiles, selectedApiKey, outputFormat, tableMode]);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('http://localhost:8000/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      console.log('Loading API keys with token:', token ? 'Token present' : 'No token');
      const response = await fetch('http://localhost:8000/auth/api-keys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('API keys response status:', response.status);
      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
        if (keys.length > 0 && !selectedApiKey) {
          setSelectedApiKey(keys[0].real_key || keys[0].api_key);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to load API keys:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const loadApiUsage = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:8000/auth/usage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const usage = await response.json();
        setApiUsage(usage);
      }
    } catch (error) {
      console.error('Failed to load API usage:', error);
    }
  };

  const createApiKey = async () => {
    console.log('🔧 DEBUG: createApiKey function started');
    if (!newKeyName.trim()) {
      setNotification({ type: 'error', message: 'Please enter a key name' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      console.log('Creating API key with token:', token ? `Token present (${token.substring(0, 20)}...)` : 'No token');
      console.log('Full token:', token);
      const response = await fetch('http://localhost:8000/auth/api-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key_name: newKeyName })
      });

      console.log('Create API key response status:', response.status);
      
      if (response.ok) {
        const newKey = await response.json();
        setApiKeys(prev => [...prev, { ...newKey, real_key: newKey.api_key }]);
        setNewKeyName('');
        setNotification({ type: 'success', message: 'API key created successfully!' });
        setTimeout(() => setNotification(null), 3000);
      } else {
        const errorText = await response.text();
        console.error('Failed to create API key:', response.status, errorText);
        try {
          const error = JSON.parse(errorText);
          setNotification({ type: 'error', message: error.detail || 'Failed to create API key' });
        } catch {
          setNotification({ type: 'error', message: `Failed to create API key: ${response.status}` });
        }
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (error) {
      console.error('Create API key error:', error);
      setNotification({ type: 'error', message: 'Failed to create API key' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const deleteApiKey = async (keyId: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:8000/auth/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const deletedKey = apiKeys.find(key => key.id === keyId);
        setApiKeys(prev => prev.filter(key => key.id !== keyId));
        
        if (deletedKey && (deletedKey.real_key === selectedApiKey || deletedKey.api_key === selectedApiKey)) {
          const remainingKeys = apiKeys.filter(key => key.id !== keyId);
          setSelectedApiKey(remainingKeys.length > 0 ? (remainingKeys[0].real_key || remainingKeys[0].api_key) : '');
        }
        
        setNotification({ type: 'success', message: 'API key deleted successfully!' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to delete API key' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  // Generate curl command based on current settings
  const generateCurlCommand = (files: File[]) => {
    if (!selectedApiKey || files.length === 0) {
      setGeneratedCurl('');
      return;
    }

    const fileParams = files.map(file => `-F "files=@${file.name}"`).join(' ');
    const curl = `curl -X POST "http://localhost:8000/api/v1/intelligent-data/analyze" \\
  -H "Authorization: Bearer ${selectedApiKey}" \\
  ${fileParams}`;

    setGeneratedCurl(curl);
  };

  // Execute curl command simulation with step-by-step tracking
  const executeCurlCommand = async () => {
    if (!selectedApiKey || selectedFiles.length === 0) {
      setNotification({type: 'error', message: 'Please select API key and files first'});
      return;
    }

    setShowExecutionPanel(true);
    setExecutionFlow([]);
    
    // Step 1: Upload files
    const uploadStep = {
      step: 'Upload & Analyze Files',
      endpoint: '/api/v1/intelligent-data/analyze',
      method: 'POST',
      status: 'loading' as const
    };
    setExecutionFlow([uploadStep]);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
        body: formData,
      });

      const result = await response.json();
      
      setExecutionFlow(prev => prev.map(step => 
        step.step === 'Upload & Analyze Files' 
          ? { ...step, status: 'success' as const, response: result }
          : step
      ));

      if (response.ok) {
        const jobId = result.job_id;
        
        // Step 2: Monitor status
        const statusStep = {
          step: 'Monitor Job Status',
          endpoint: `/api/v1/intelligent-data/jobs/${jobId}/status`,
          method: 'GET',
          status: 'loading' as const
        };
        setExecutionFlow(prev => [...prev, statusStep]);

        // Poll status
        const pollStatus = async () => {
          try {
            const statusResponse = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/status`, {
              headers: { 'Authorization': `Bearer ${selectedApiKey}` }
            });
            const statusResult = await statusResponse.json();

            setExecutionFlow(prev => prev.map(step => 
              step.step === 'Monitor Job Status' 
                ? { ...step, response: statusResult }
                : step
            ));

            if (statusResult.status === 'SUCCEEDED') {
              setExecutionFlow(prev => prev.map(step => 
                step.step === 'Monitor Job Status' 
                  ? { ...step, status: 'success' as const }
                  : step
              ));

              // Step 3: Get results
              const resultsStep = {
                step: 'Download Results',
                endpoint: `/api/v1/intelligent-data/jobs/${jobId}/results`,
                method: 'GET',
                status: 'loading' as const
              };
              setExecutionFlow(prev => [...prev, resultsStep]);

              const resultsResponse = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`, {
                headers: { 'Authorization': `Bearer ${selectedApiKey}` }
              });
              const resultsResult = await resultsResponse.json();

              setExecutionFlow(prev => prev.map(step => 
                step.step === 'Download Results' 
                  ? { ...step, status: 'success' as const, response: resultsResult }
                  : step
              ));

              setCurlExecutionResult(resultsResult);
            } else if (statusResult.status === 'FAILED') {
              setExecutionFlow(prev => prev.map(step => 
                step.step === 'Monitor Job Status' 
                  ? { ...step, status: 'error' as const }
                  : step
              ));
            } else {
              setTimeout(pollStatus, 2000);
            }
          } catch (error) {
            setExecutionFlow(prev => prev.map(step => 
              step.step === 'Monitor Job Status' 
                ? { ...step, status: 'error' as const, response: { error: String(error) } }
                : step
            ));
          }
        };

        setTimeout(pollStatus, 1000);
      }
    } catch (error) {
      setExecutionFlow(prev => prev.map(step => 
        step.step === 'Upload & Analyze Files' 
          ? { ...step, status: 'error' as const, response: { error: String(error) } }
          : step
      ));
    }
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) {
      setNotification({type: 'error', message: 'Please select files to process'});
      return;
    }

    if (!selectedApiKey) {
      setNotification({type: 'error', message: 'Please select an API key'});
      return;
    }

    if (selectedFiles.length === 1) {
      // Single file processing
      processSingleFile(selectedFiles[0]);
    } else {
      // Multiple file processing - sequential
      processMultipleFiles(selectedFiles);
    }
  };

  const processSingleFile = async (file: File) => {
    // Initialize processing status
    const initialStatus: FileProcessingStatus[] = [{
      file,
      status: 'processing'
    }];
    setFileProcessingStatus(initialStatus);

    try {
      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const jobId = result.job_id;
        
        // Update status with job ID
        setFileProcessingStatus(prev => prev.map(status => 
          ({ ...status, job_id: jobId })
        ));

        setNotification({type: 'info', message: 'Processing started...'});
        setTimeout(() => setNotification(null), 3000);
        
        // Wait for completion
        await waitForJobCompletion(jobId, 0);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFileProcessingStatus(prev => prev.map(status => 
          ({ ...status, status: 'failed', error: errorData.detail || 'Processing failed' })
        ));
        setNotification({type: 'error', message: errorData.detail || 'Failed to start processing'});
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setFileProcessingStatus(prev => prev.map(status => 
        ({ ...status, status: 'failed', error: String(error) })
      ));
      setNotification({type: 'error', message: 'Failed to process file'});
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const processMultipleFiles = async (files: File[]) => {
    setIsProcessingMultiple(true);
    
    // Initialize processing status for all files
    const initialStatus: FileProcessingStatus[] = files.map(file => ({
      file,
      status: 'pending'
    }));
    setFileProcessingStatus(initialStatus);

    setNotification({type: 'info', message: `Starting sequential processing of ${files.length} files...`});
    setTimeout(() => setNotification(null), 3000);

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update status to processing
      setFileProcessingStatus(prev => prev.map((status, index) => 
        index === i ? { ...status, status: 'processing' } : status
      ));

      try {
        const formData = new FormData();
        formData.append('files', file);

        const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/analyze`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${selectedApiKey}`,
          },
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          const jobId = result.job_id;
          
          // Update status with job ID
          setFileProcessingStatus(prev => prev.map((status, index) => 
            index === i ? { ...status, job_id: jobId } : status
          ));

          // Wait for completion
          await waitForJobCompletion(jobId, i);
        } else {
          const errorData = await response.json().catch(() => ({}));
          setFileProcessingStatus(prev => prev.map((status, index) => 
            index === i ? { ...status, status: 'failed', error: errorData.detail || 'Processing failed' } : status
          ));
        }
      } catch (error) {
        setFileProcessingStatus(prev => prev.map((status, index) => 
          index === i ? { ...status, status: 'failed', error: String(error) } : status
        ));
      }
    }

    setIsProcessingMultiple(false);
    loadApiUsage(); // Refresh usage data
    setNotification({type: 'success', message: 'All files processed!'});
    setTimeout(() => setNotification(null), 3000);
  };

  const waitForJobCompletion = async (jobId: string, fileIndex: number): Promise<void> => {
    return new Promise((resolve) => {
      const pollStatus = async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/status`, {
            headers: {
              'Authorization': `Bearer ${selectedApiKey}`,
            },
          });

          if (response.ok) {
            const result = await response.json();
            
            if (result.status === 'SUCCEEDED') {
              // Get download URLs
              const resultsResponse = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`, {
                headers: {
                  'Authorization': `Bearer ${selectedApiKey}`,
                },
              });

              if (resultsResponse.ok) {
                const downloadUrls = {
                  tables: { [outputFormat]: `http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/download/tables/${outputFormat}` },
                  key_values: { [outputFormat]: `http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/download/key-values/${outputFormat}` }
                };

                setFileProcessingStatus(prev => prev.map((status, index) => 
                  index === fileIndex ? { ...status, status: 'completed', downloadUrls } : status
                ));
              }
              resolve();
            } else if (result.status === 'FAILED') {
              setFileProcessingStatus(prev => prev.map((status, index) => 
                index === fileIndex ? { ...status, status: 'failed', error: 'Processing failed' } : status
              ));
              resolve();
            } else {
              setTimeout(pollStatus, 3000);
            }
          }
        } catch (error) {
          setFileProcessingStatus(prev => prev.map((status, index) => 
            index === fileIndex ? { ...status, status: 'failed', error: String(error) } : status
          ));
          resolve();
        }
      };

      setTimeout(pollStatus, 1000);
    });
  };

  const checkJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.status === 'SUCCEEDED') {
          // Get download URLs
          const resultsResponse = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`, {
            headers: {
              'Authorization': `Bearer ${selectedApiKey}`,
            },
          });

          if (resultsResponse.ok) {
            const downloadUrls = {
              tables: { [outputFormat]: `http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/download/tables/${outputFormat}` },
              key_values: { [outputFormat]: `http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/download/key-values/${outputFormat}` }
            };

            setProcessingJobs(prev => 
              prev.map(j => 
                j.job_id === jobId 
                  ? { ...j, status: 'SUCCEEDED', downloadUrls }
                  : j
              )
            );
            setNotification({type: 'success', message: 'Processing completed successfully!'});
            setTimeout(() => setNotification(null), 3000);
            loadApiUsage();
          }
        } else if (result.status === 'FAILED') {
          setProcessingJobs(prev => 
            prev.map(j => 
              j.job_id === jobId 
                ? { ...j, status: 'FAILED' }
                : j
            )
          );
          setNotification({type: 'error', message: 'Processing failed'});
          setTimeout(() => setNotification(null), 5000);
        } else {
          setTimeout(() => checkJobStatus(jobId), 5000);
        }
      }
    } catch (error) {
      console.error('Error checking job status:', error);
    }
  };

  const handleDownload = async (downloadUrl: string, jobId: string, type: string, format: string) => {
    try {
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${jobId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      setNotification({type: 'error', message: 'Download failed'});
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setNotification({type: 'success', message: 'API key copied to clipboard'});
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <DashboardLayout title="API Dashboard">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">API Dashboard</h1>
            <p className="text-gray-600">Intelligent Data Parser API - Extract tables and key-value pairs from documents</p>
          </div>

          {notification && (
            <div className={`mb-6 p-4 rounded-lg ${
              notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {notification.message}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('test')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'test'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                API Testing
              </button>
              <button
                onClick={() => setActiveTab('keys')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'keys'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                API Keys ({apiKeys.length})
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'docs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documentation
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'usage'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Usage History ({apiUsage.length})
              </button>
            </nav>
          </div>

          {/* API Testing Tab */}
          {activeTab === 'test' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - API Testing */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Test API</h2>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select API Key:
                    </label>
                    <select
                      value={selectedApiKey}
                      onChange={(e) => setSelectedApiKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    >
                      <option value="">Choose an API key...</option>
                      {apiKeys.map((key) => (
                        <option key={key.id} value={key.real_key || key.api_key}>
                          {key.key_name} ({key.api_key})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Output Format:
                      </label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="xlsx">Excel</option>
                        <option value="txt">TXT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Table Mode:
                      </label>
                      <select
                        value={tableMode}
                        onChange={(e) => setTableMode(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      >
                        <option value="individual">Individual</option>
                        <option value="merged">Merged</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Multiple Files:
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-medium text-gray-700">
                          Selected Files ({selectedFiles.length}):
                        </p>
                        <div className="max-h-32 overflow-y-auto">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                              <span className="text-gray-800">{file.name}</span>
                              <span className="text-gray-800 text-xs font-medium">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Generated cURL Command */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Generated cURL Command</h3>
                    {generatedCurl ? (
                      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                        <pre>{generatedCurl}</pre>
                      </div>
                    ) : (
                      <div className="bg-gray-100 text-gray-500 p-4 rounded-lg text-center text-sm">
                        Select an API key and upload files to generate cURL command
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={handleProcessFiles}
                      disabled={!selectedApiKey || selectedFiles.length === 0 || isProcessingMultiple}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isProcessingMultiple ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        `Process ${selectedFiles.length > 1 ? `${selectedFiles.length} Files` : 'File'}`
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Column - Processing Results */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Processing Results</h2>
                  
                  {fileProcessingStatus.length === 0 ? (
                    <div className="bg-gray-100 text-gray-500 p-4 rounded-lg text-center text-sm">
                      Upload and process files to see results here
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fileProcessingStatus.map((status, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 text-sm">{status.file.name}</h4>
                            <div className="flex items-center">
                              {status.status === 'processing' && (
                                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                              )}
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                status.status === 'completed' ? 'bg-green-100 text-green-800' :
                                status.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                status.status === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {status.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          
                          {status.status === 'failed' && status.error && (
                            <p className="text-red-600 text-sm mb-2">{status.error}</p>
                          )}
                          
                          {status.status === 'completed' && status.downloadUrls && (
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">Download Links:</p>
                              <div className="space-y-1">
                                {status.downloadUrls.tables && Object.entries(status.downloadUrls.tables).map(([format, url]) => (
                                  <a
                                    key={format}
                                    href={url}
                                    download
                                    className="inline-block text-blue-600 hover:text-blue-800 text-sm mr-4"
                                  >
                                    Tables ({format.toUpperCase()})
                                  </a>
                                ))}
                                {status.downloadUrls.key_values && Object.entries(status.downloadUrls.key_values).map(([format, url]) => (
                                  <a
                                    key={format}
                                    href={url}
                                    download
                                    className="inline-block text-blue-600 hover:text-blue-800 text-sm mr-4"
                                  >
                                    Key-Values ({format.toUpperCase()})
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Flow Panel */}
              {showExecutionPanel && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">API Execution Flow</h2>
                  
                  <div className="space-y-4">
                    {executionFlow.map((step, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${
                              step.status === 'success' ? 'bg-green-500' :
                              step.status === 'error' ? 'bg-red-500' :
                              'bg-blue-500 animate-pulse'
                            }`}></div>
                            <span className="font-medium text-gray-900">{step.step}</span>
                          </div>
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            step.status === 'success' ? 'bg-green-100 text-green-800' :
                            step.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {step.method} {step.endpoint}
                          </span>
                        </div>
                        
                        {step.response && (
                          <div className="mt-2 bg-gray-50 rounded p-2">
                            <pre className="text-xs text-gray-800 overflow-x-auto">
                              {JSON.stringify(step.response, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multiple File Processing Status */}
              {fileProcessingStatus.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Multiple File Processing Status
                    {isProcessingMultiple && (
                      <span className="ml-2 text-sm text-blue-600">(Processing...)</span>
                    )}
                  </h2>
                  
                  <div className="space-y-3">
                    {fileProcessingStatus.map((fileStatus, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              fileStatus.status === 'completed' ? 'bg-green-500' :
                              fileStatus.status === 'failed' ? 'bg-red-500' :
                              fileStatus.status === 'processing' ? 'bg-blue-500' :
                              'bg-gray-300'
                            }`}>
                              {fileStatus.status === 'completed' && (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {fileStatus.status === 'failed' && (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                              {fileStatus.status === 'processing' && (
                                <div className="animate-spin w-2.5 h-2.5 border border-white border-t-transparent rounded-full"></div>
                              )}
                            </div>
                            <span className="font-medium text-gray-900">{fileStatus.file.name}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            fileStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                            fileStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                            fileStatus.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {fileStatus.status.toUpperCase()}
                          </span>
                        </div>

                        {fileStatus.job_id && (
                          <div className="text-xs text-gray-700 font-medium mb-2">
                            Job ID: {fileStatus.job_id}
                          </div>
                        )}

                        {fileStatus.error && (
                          <div className="text-sm text-red-600 mb-2">
                            Error: {fileStatus.error}
                          </div>
                        )}
                        
                        {fileStatus.downloadUrls && (
                          <div className="flex space-x-2 mt-2">
                            <button
                              onClick={() => handleDownload(fileStatus.downloadUrls!.tables![outputFormat], fileStatus.job_id!, 'tables', outputFormat)}
                              className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                            >
                              Download Tables
                            </button>
                            <button
                              onClick={() => handleDownload(fileStatus.downloadUrls!.key_values![outputFormat], fileStatus.job_id!, 'key-values', outputFormat)}
                              className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                            >
                              Download Key-Values
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing Results */}
              {processingJobs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Processing Results</h2>
                  
                  <div className="space-y-4">
                    {processingJobs.map((job) => (
                      <div key={job.job_id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-900">{job.original_filename}</span>
                            <span className="text-sm text-gray-700 ml-2">({job.job_id})</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            job.status === 'SUCCEEDED' ? 'bg-green-100 text-green-800' :
                            job.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        
                        {job.downloadUrls && (
                          <div className="flex space-x-2 mt-3">
                            <button
                              onClick={() => handleDownload(job.downloadUrls!.tables![outputFormat], job.job_id, 'tables', outputFormat)}
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                            >
                              Download Tables
                            </button>
                            <button
                              onClick={() => handleDownload(job.downloadUrls!.key_values![outputFormat], job.job_id, 'key-values', outputFormat)}
                              className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                            >
                              Download Key-Values
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'keys' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Create New API Key</h2>
                
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Enter key name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                  <button
                    onClick={createApiKey}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Create Key
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Your API Keys</h2>
                
                {apiKeys.length === 0 ? (
                  <p className="text-gray-700 text-center py-8">No API keys created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{key.key_name}</h3>
                            <p className="text-sm text-gray-700 mt-1">
                              Created: {new Date(key.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-700">
                              Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-800">{key.api_key}</code>
                              <button
                                onClick={() => copyApiKey(key.real_key || key.api_key)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Copy Full Key
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {key.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={() => deleteApiKey(key.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documentation Tab */}
          {activeTab === 'docs' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">API Documentation</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Authentication</h3>
                  <p className="text-sm text-gray-400 mb-4">All API requests require authentication using a Bearer token with your API key.</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <code className="text-sm text-gray-800">Authorization: Bearer YOUR_API_KEY</code>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Endpoints</h3>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">POST</span>
                        <code className="text-sm font-mono">/api/v1/intelligent-data/analyze</code>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">Start intelligent data analysis for uploaded files.</p>
                      <div className="text-sm text-gray-400">
                        <strong>Parameters:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li><code>files</code> - Array of files to process (multipart/form-data)</li>
                        </ul>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">GET</span>
                        <code className="text-sm font-mono">/api/v1/intelligent-data/jobs/{'{job_id}'}/status</code>
                      </div>
                      <p className="text-sm text-gray-400">Get the status of a processing job.</p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">GET</span>
                        <code className="text-sm font-mono">/api/v1/intelligent-data/jobs/{'{job_id}'}/results</code>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">Get the results of a completed job with download URLs.</p>
                      <div className="text-sm text-gray-400">
                        <strong>Parameters:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li><code>format</code> - Output format (csv, xlsx, json, txt)</li>
                          <li><code>mode</code> - Processing mode (individual, merged)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Response Formats</h3>
                  <p className="text-sm text-gray-400 mb-4">The API supports multiple output formats:</p>
                  <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                    <li><strong>CSV</strong> - Comma-separated values</li>
                    <li><strong>XLSX</strong> - Excel spreadsheet</li>
                    <li><strong>JSON</strong> - JavaScript Object Notation</li>
                    <li><strong>TXT</strong> - Plain text format</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing Modes</h3>
                  <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                    <li><strong>Individual</strong> - Process each file separately</li>
                    <li><strong>Merged</strong> - Combine all files into a single output</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Usage History Tab */}
          {activeTab === 'usage' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">API Usage History</h2>
              
              {apiUsage.length === 0 ? (
                <p className="text-gray-700 text-center py-8">No API usage recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Endpoint
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Job ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Files
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Processing Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Created At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {apiUsage.map((usage) => (
                        <tr key={usage.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {usage.endpoint}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {usage.job_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              usage.status === 'SUCCEEDED' ? 'bg-green-100 text-green-800' :
                              usage.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {usage.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {usage.file_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {usage.processing_time ? `${usage.processing_time}s` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {new Date(usage.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}