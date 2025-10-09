'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';

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
  downloadUrls?: {
    tables?: { [key: string]: string };
    key_values?: { [key: string]: string };
  };
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
  currentStage?: 'analyze' | 'monitor' | 'results';
  job_id?: string;
  api_key?: string;
  downloadUrls?: {
    tables?: { [key: string]: string };
    key_values?: { [key: string]: string };
  };
  error?: string;
  apiDetails?: {
    analyze?: ApiCallDetails;
    status?: ApiCallDetails;
    results?: ApiCallDetails;
  };
  expanded?: boolean;
}

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ApiStep {
  id: string;
  title: string;
  endpoint: string;
  method: 'POST' | 'GET';
  status: 'pending' | 'loading' | 'success' | 'error';
  curlCommand?: string;
  response?: any;
  timestamp?: string;
  expanded?: boolean;
}

export default function APIPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [apiUsage, setApiUsage] = useState<ApiUsage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState('test');
  const [outputFormat, setOutputFormat] = useState('');
  const [tableMode, setTableMode] = useState('');
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [newKeyName, setNewKeyName] = useState<string>('');
  
  // New state for enhanced features
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // API Execution Timeline states
  const [apiSteps, setApiSteps] = useState<ApiStep[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string>('');

  // Compact Design Filter States
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Pagination states
  const [usageHistoryPage, setUsageHistoryPage] = useState(1);
  const USAGE_HISTORY_INITIAL_LIMIT = 10;
  const USAGE_HISTORY_LOAD_MORE_INCREMENT = 20;
  
  const [processingStatusPage, setProcessingStatusPage] = useState(1);
  const PROCESSING_STATUS_INITIAL_LIMIT = 3;
  const PROCESSING_STATUS_LOAD_MORE_INCREMENT = 10;

  useEffect(() => {
    const initializeData = async () => {
      // Wait a bit to ensure localStorage is ready
      const token = localStorage.getItem('accessToken');
      const userData = localStorage.getItem('user');
      
      if (!token || !userData) {
        console.log('No token or user data found, redirecting to login');
        return;
      }
      
      // Load data sequentially to avoid race conditions
      await loadUser();
      await loadApiKeys();
      await loadApiUsage();
    };
    
    initializeData();
  }, []);

  // Add effect to reload data when user becomes available
  useEffect(() => {
    if (user) {
      loadApiKeys();
      loadApiUsage();
    }
  }, [user]);

  // Add window focus event to reload data when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, refreshing data...');
      if (user) {
        loadApiKeys();
        loadApiUsage();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);


  const loadUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(getApiUrl('/auth/me'), {
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
      
      if (!token) {
        console.log('No access token available, skipping API keys load');
        return;
      }
      
      const response = await fetch(getApiUrl('/auth/api-keys'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('API keys response status:', response.status);
      
      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
        console.log('API keys loaded successfully:', keys.length, 'keys');
      } else if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        // Optionally clear invalid token
        // localStorage.removeItem('accessToken');
        // window.location.href = '/auth/login';
      } else {
        const errorText = await response.text();
        console.error('Failed to load API keys:', response.status, errorText);
        // Keep existing keys on failure to prevent data loss
      }
    } catch (error) {
      console.error('Network error loading API keys:', error);
      // Keep existing keys on network errors
    }
  };

  const loadApiUsage = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.log('No access token available, skipping usage history load');
        return;
      }
      
      const response = await fetch(getApiUrl('/auth/usage'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const usage = await response.json();
        setApiUsage(usage);
        console.log('Usage history loaded successfully:', usage.length, 'entries');
      } else if (response.status === 401) {
        console.error('Unauthorized - token may be invalid for usage data');
      } else {
        const errorText = await response.text();
        console.error('Failed to load API usage:', response.status, errorText);
        // Keep existing usage data on failure to prevent data loss
      }
    } catch (error) {
      console.error('Network error loading API usage:', error);
      // Keep existing usage data on network errors
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
      const response = await fetch(getApiUrl('/auth/api-keys'), {
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
      const response = await fetch(getApiUrl(`/auth/api-keys/${keyId}`), {
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

  // Drag and drop handlers
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(event.dataTransfer.files) as File[];
    // Filter for allowed file types
    const allowedTypes = ['.pdf'];
    const filteredFiles = droppedFiles.filter((file: File) => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return allowedTypes.includes(extension);
    });
    
    if (filteredFiles.length !== droppedFiles.length) {
      setNotification({
        type: 'error', 
        message: 'Some files were filtered out. Only PDF files are supported.'
      });
      setTimeout(() => setNotification(null), 3000);
    }
    
    setSelectedFiles(filteredFiles);
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

      const response = await fetch(getApiUrl(`/api/v1/intelligent-data/analyze`), {
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
            const statusResponse = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/status`), {
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

              const resultsResponse = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`), {
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
        curlCommand += ` \\\n  -F "files=@{filename}"`;
        curlCommand += ` \\\n  -F "output_format=${outputFormat}"`;
        curlCommand += ` \\\n  -F "table_mode=${tableMode}"`;
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

    if (!outputFormat) {
      setNotification({type: 'error', message: 'Please select an output format'});
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!tableMode) {
      setNotification({type: 'error', message: 'Please select a table mode'});
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
    }
  };

  const processIndividualFile = async (file: File, fileIndex: number) => {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('output_format', outputFormat);
    formData.append('table_mode', tableMode);

    try {
      // Step 1: Start Analysis
      const analyzeUrl = getApiUrl('/api/v1/intelligent-data/analyze');
      const analyzeHeaders = { 'Authorization': `Bearer ${selectedApiKey}` };
      const startTime = Date.now();
      
      const analyzeResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: analyzeHeaders,
        body: formData
      });

      const analyzeResult = await analyzeResponse.json();
      const analyzeDuration = Date.now() - startTime;
      
      // Store analyze API details
      const analyzeDetails: ApiCallDetails = {
        curlCommand: generateCurlCommand(analyzeUrl, 'POST', analyzeHeaders, formData),
        request: { 
          files: file.name,
          output_format: outputFormat,
          table_mode: tableMode 
        },
        response: analyzeResult,
        timestamp: new Date().toLocaleTimeString(),
        status: analyzeResponse.ok ? 'success' : 'error',
        duration: analyzeDuration
      };

      if (!analyzeResponse.ok) {
        throw new Error(`Analysis failed: ${analyzeResponse.statusText}`);
      }

      const jobId = analyzeResult.job_id;

      // Update file status with job ID and analyze details
      setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
        index === fileIndex ? { 
          ...fileStatus, 
          job_id: jobId,
          apiDetails: {
            ...fileStatus.apiDetails,
            analyze: analyzeDetails
          }
        } : fileStatus
      ));

      // Step 2: Monitor Progress
      setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
        index === fileIndex ? { ...fileStatus, currentStage: 'monitor' } : fileStatus
      ));
      await monitorProgress(jobId, fileIndex);

      // Step 3: Get Results
      setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
        index === fileIndex ? { ...fileStatus, currentStage: 'results' } : fileStatus
      ));
      await getResults(jobId, fileIndex);

    } catch (error) {
      console.error(`Processing failed for file ${file.name}:`, error);
      throw error;
    }
  };

  const monitorProgress = async (jobId: string, fileIndex: number) => {
    const maxAttempts = 60; // 5 minutes max wait time
    const pollInterval = 5000; // 5 seconds
    const statusUrl = getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/status`);
    const statusHeaders = { 'Authorization': `Bearer ${selectedApiKey}` };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const response = await fetch(statusUrl, {
          headers: statusHeaders
        });

        const result = await response.json();
        const statusDuration = Date.now() - startTime;

        // Store status API details (final response only)
        if (result.status === 'SUCCEEDED' || result.status === 'FAILED') {
          const statusDetails: ApiCallDetails = {
            curlCommand: generateCurlCommand(statusUrl, 'GET', statusHeaders),
            request: { job_id: jobId },
            response: result,
            timestamp: new Date().toLocaleTimeString(),
            status: response.ok && result.status === 'SUCCEEDED' ? 'success' : 'error',
            duration: statusDuration
          };

          setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
            index === fileIndex ? { 
              ...fileStatus,
              apiDetails: {
                ...fileStatus.apiDetails,
                status: statusDetails
              }
            } : fileStatus
          ));
        }

        if (!response.ok) {
          throw new Error(`Monitor failed: ${response.statusText}`);
        }
        
        if (result.status === 'SUCCEEDED') {
          return; // Processing complete
        } else if (result.status === 'FAILED') {
          throw new Error('Processing failed on server');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error(`Monitor attempt ${attempt + 1} failed:`, error);
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Processing timeout');
  };

  const getResults = async (jobId: string, fileIndex: number) => {
    try {
      const resultsUrl = getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`);
      const resultsHeaders = { 'Authorization': `Bearer ${selectedApiKey}` };
      const startTime = Date.now();

      const response = await fetch(resultsUrl, {
        headers: resultsHeaders
      });

      const result = await response.json();
      const resultsDuration = Date.now() - startTime;

      // Store results API details
      const resultsDetails: ApiCallDetails = {
        curlCommand: generateCurlCommand(resultsUrl, 'GET', resultsHeaders),
        request: { 
          job_id: jobId,
          format: outputFormat,
          mode: tableMode
        },
        response: result,
        timestamp: new Date().toLocaleTimeString(),
        status: response.ok ? 'success' : 'error',
        duration: resultsDuration
      };

      if (!response.ok) {
        throw new Error(`Get results failed: ${response.statusText}`);
      }
      
      // Update file status with download URLs and results details
      setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
        index === fileIndex ? { 
          ...fileStatus, 
          status: 'completed',
          downloadUrls: result.download_urls,
          apiDetails: {
            ...fileStatus.apiDetails,
            results: resultsDetails
          }
        } : fileStatus
      ));

    } catch (error) {
      console.error(`Get results failed:`, error);
      throw error;
    }
  };

  const executeApiFlow = async () => {
    try {
      // Step 1: Start Analysis
      await executeAnalyzeStep();
    } catch (error) {
      console.error('API execution flow failed:', error);
      setNotification({type: 'error', message: 'API execution failed'});
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const executeAnalyzeStep = async () => {
    const analyzeStep = apiSteps.find(s => s.id === 'analyze');
    if (!analyzeStep) return;
    
    // Update step to loading
    updateApiStep('analyze', { 
      status: 'loading', 
      curlCommand: generateCurlCommandForStep(analyzeStep),
      timestamp: new Date().toLocaleTimeString()
    });

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(getApiUrl(`/api/v1/intelligent-data/analyze`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const jobId = result.job_id;
        setCurrentJobId(jobId);
        
        // Update analyze step as success
        updateApiStep('analyze', { 
          status: 'success', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });

        // Start monitoring step
        await executeStatusMonitoring(jobId);
      } else {
        updateApiStep('analyze', { 
          status: 'error', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (error) {
      updateApiStep('analyze', { 
        status: 'error', 
        response: { error: String(error) },
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  const executeStatusMonitoring = async (jobId: string) => {
    const statusStep = apiSteps.find(s => s.id === 'status');
    if (!statusStep) return;
    
    // Update status step to loading and expand it
    updateApiStep('status', { 
      status: 'loading', 
      curlCommand: generateCurlCommandForStep(statusStep, jobId),
      expanded: true,
      timestamp: new Date().toLocaleTimeString()
    });

    const pollStatus = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/status`), {
          headers: {
            'Authorization': `Bearer ${selectedApiKey}`,
          },
        });

        const result = await response.json();
        
        // Update status step with latest response
        updateApiStep('status', { 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });

        if (result.status === 'SUCCEEDED') {
          updateApiStep('status', { status: 'success' });
          
          // Start results step
          await executeResultsStep(jobId);
        } else if (result.status === 'FAILED') {
          updateApiStep('status', { status: 'error' });
        } else {
          // Continue polling
          setTimeout(pollStatus, 3000);
        }
      } catch (error) {
        updateApiStep('status', { 
          status: 'error', 
          response: { error: String(error) },
          timestamp: new Date().toLocaleTimeString()
        });
      }
    };

    setTimeout(pollStatus, 1000);
  };

  const executeResultsStep = async (jobId: string) => {
    const resultsStep = apiSteps.find(s => s.id === 'results');
    if (!resultsStep) return;
    
    // Update results step to loading and expand it
    updateApiStep('results', { 
      status: 'loading', 
      curlCommand: generateCurlCommandForStep(resultsStep, jobId),
      expanded: true,
      timestamp: new Date().toLocaleTimeString()
    });

    try {
      const response = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`), {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        updateApiStep('results', { 
          status: 'success', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });

        setNotification({type: 'success', message: 'Processing completed successfully!'});
        setTimeout(() => setNotification(null), 3000);
      } else {
        updateApiStep('results', { 
          status: 'error', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (error) {
      updateApiStep('results', { 
        status: 'error', 
        response: { error: String(error) },
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  const processSingleFile = async (file: File) => {
    // Initialize processing status
    const initialStatus: FileProcessingStatus[] = [{
      file,
      status: 'processing',
      api_key: selectedApiKey
    }];
    setFileProcessingStatus(initialStatus);

    try {
      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch(getApiUrl(`/api/v1/intelligent-data/analyze`), {
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
      status: 'pending',
      api_key: selectedApiKey
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

        const response = await fetch(getApiUrl(`/api/v1/intelligent-data/analyze`), {
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
          const response = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/status`), {
            headers: {
              'Authorization': `Bearer ${selectedApiKey}`,
            },
          });

          if (response.ok) {
            const result = await response.json();
            
            if (result.status === 'SUCCEEDED') {
              // Get download URLs
              const resultsResponse = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`), {
                headers: {
                  'Authorization': `Bearer ${selectedApiKey}`,
                },
              });

              if (resultsResponse.ok) {
                const downloadUrls = {
                  tables: { [outputFormat]: getApiUrl(`/api/v1/intelligent-data/download/${jobId}/tables/${outputFormat}?mode=${tableMode}`) },
                  key_values: { [outputFormat]: getApiUrl(`/api/v1/intelligent-data/download/${jobId}/key-values/${outputFormat}`) }
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
      const response = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/status`), {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.status === 'SUCCEEDED') {
          // Get download URLs
          const resultsResponse = await fetch(getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`), {
            headers: {
              'Authorization': `Bearer ${selectedApiKey}`,
            },
          });

          if (resultsResponse.ok) {
            const downloadUrls = {
              tables: { [outputFormat]: getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/download/tables/${outputFormat}`) },
              key_values: { [outputFormat]: getApiUrl(`/api/v1/intelligent-data/jobs/${jobId}/download/key-values/${outputFormat}`) }
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

  // Helper function for authenticated downloads
  const downloadFileWithAuth = async (url: string, filename: string, apiKey: string) => {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  };

  const handleDownload = async (downloadUrl: string, jobId: string, type: string, format: string) => {
    try {
      // Find the API key used for this job
      const jobStatus = fileProcessingStatus.find(status => status.job_id === jobId);
      const apiKeyToUse = jobStatus?.api_key || selectedApiKey;
      
      console.log('🔧 DEBUG: Download attempt:', {
        downloadUrl,
        jobId,
        apiKeyToUse: apiKeyToUse ? `${apiKeyToUse.substring(0, 10)}...` : 'null',
        jobStatus: jobStatus ? 'found' : 'not found'
      });
      
      if (!apiKeyToUse) {
        setNotification({type: 'error', message: 'API key not found for download'});
        setTimeout(() => setNotification(null), 5000);
        return;
      }

      const filename = `${type}_${jobId}.${format}`;
      await downloadFileWithAuth(downloadUrl, filename, apiKeyToUse);
      
      setNotification({type: 'success', message: 'Download completed'});
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Download error:', error);
      setNotification({type: 'error', message: `Download failed: ${error}`});
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setNotification({type: 'success', message: 'API key copied to clipboard'});
    setTimeout(() => setNotification(null), 3000);
  };

  // API Steps Management Functions
  const initializeApiSteps = () => {
    const steps: ApiStep[] = [
      {
        id: 'analyze',
        title: 'Start Analysis',
        endpoint: '/api/v1/intelligent-data/analyze',
        method: 'POST',
        status: 'pending',
        expanded: true
      },
      {
        id: 'status',
        title: 'Monitor Progress',
        endpoint: '/api/v1/intelligent-data/jobs/{job_id}/status',
        method: 'GET',
        status: 'pending',
        expanded: false
      },
      {
        id: 'results',
        title: 'Get Results',
        endpoint: '/api/v1/intelligent-data/jobs/{job_id}/results',
        method: 'GET',
        status: 'pending',
        expanded: false
      }
    ];
    setApiSteps(steps);
  };

  const updateApiStep = (stepId: string, updates: Partial<ApiStep>) => {
    setApiSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const toggleStepExpansion = (stepId: string) => {
    setApiSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, expanded: !step.expanded } : step
    ));
  };

  const generateCurlCommandForStep = (step: ApiStep, jobId?: string) => {
    let endpoint = step.endpoint;
    if (jobId) {
      endpoint = endpoint.replace('{job_id}', jobId);
    }

    let curl = `curl -X ${step.method} "http://localhost:8000${endpoint}"`;
    curl += ` \\\n  -H "Authorization: Bearer ${selectedApiKey}"`;
    
    if (step.method === 'POST' && step.id === 'analyze') {
      selectedFiles.forEach((file, index) => {
        curl += ` \\\n  -F "files=@${file.name}"`;
      });
    }

    if (step.id === 'results') {
      curl += ` \\\n  -G -d "format=${outputFormat}" -d "mode=${tableMode}"`;
    }

    return curl;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotification({type: 'success', message: 'cURL command copied to clipboard!'});
      setTimeout(() => setNotification(null), 2000);
    } catch (error) {
      setNotification({type: 'error', message: 'Failed to copy to clipboard'});
      setTimeout(() => setNotification(null), 2000);
    }
  };


  const handleDownloadAllCompleted = async () => {
    const completedFiles = fileProcessingStatus.filter(f => f.status === 'completed' && f.downloadUrls);
    
    if (completedFiles.length === 0) {
      setNotification({type: 'info', message: 'No completed files to download'});
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setNotification({type: 'success', message: `Starting download of ${completedFiles.length} files...`});
    
    // Process downloads sequentially to avoid overwhelming the browser
    for (let i = 0; i < completedFiles.length; i++) {
      try {
        await handleFileDownload(completedFiles[i]);
        // Small delay between downloads
        if (i < completedFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to download file ${completedFiles[i].file.name}:`, error);
      }
    }
    
    setNotification({type: 'success', message: `Completed download of ${completedFiles.length} files`});
    setTimeout(() => setNotification(null), 3000);
  };

  // Compact Design Utility Functions
  const getFilteredFiles = () => {
    let filtered = fileProcessingStatus;

    // Filter by search term
    if (searchFilter.trim()) {
      filtered = filtered.filter(fileStatus => 
        fileStatus.file.name.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(fileStatus => fileStatus.status === statusFilter);
    }

    return filtered;
  };

  const getProcessingStats = () => {
    const total = fileProcessingStatus.length;
    const completed = fileProcessingStatus.filter(f => f.status === 'completed').length;
    const processing = fileProcessingStatus.filter(f => f.status === 'processing').length;
    const pending = fileProcessingStatus.filter(f => f.status === 'pending').length;
    const failed = fileProcessingStatus.filter(f => f.status === 'failed').length;
    const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, processing, pending, failed, progressPercentage };
  };

  const toggleApiDetails = (fileIndex: number) => {
    setFileProcessingStatus(prev => prev.map((fileStatus, index) => 
      index === fileIndex ? { ...fileStatus, expanded: !fileStatus.expanded } : fileStatus
    ));
  };

  const getEstimatedTimeRemaining = () => {
    const stats = getProcessingStats();
    if (stats.processing === 0 && stats.pending === 0) return null;
    
    // Simple estimation: assume each file takes 2 minutes on average
    const remainingFiles = stats.processing + stats.pending;
    const estimatedMinutes = remainingFiles * 2;
    
    if (estimatedMinutes < 60) {
      return `${estimatedMinutes}min`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const getFileProgressInfo = (fileStatus: FileProcessingStatus) => {
    if (fileStatus.status === 'completed') return { percentage: 100, stage: 'Completed', stageIndex: 3 };
    if (fileStatus.status === 'failed') return { percentage: 0, stage: 'Failed', stageIndex: 0 };
    if (fileStatus.status === 'pending') return { percentage: 0, stage: 'Pending', stageIndex: 0 };
    
    // Processing stage
    switch (fileStatus.currentStage) {
      case 'analyze': return { percentage: 33, stage: 'Analyzing', stageIndex: 1 };
      case 'monitor': return { percentage: 66, stage: 'Monitoring', stageIndex: 2 };
      case 'results': return { percentage: 90, stage: 'Getting Results', stageIndex: 3 };
      default: return { percentage: 10, stage: 'Processing', stageIndex: 1 };
    }
  };

  const handleFileDownload = async (fileStatus: FileProcessingStatus) => {
    if (!fileStatus.downloadUrls || !fileStatus.api_key) {
      setNotification({ type: 'error', message: 'No download URLs available for this file' });
      return;
    }

    const apiKeyToUse = fileStatus.api_key;
    const baseFileName = fileStatus.file.name.replace(/\.[^/.]+$/, '');

    try {
      if (tableMode === 'individual') {
        // Individual mode: Download tables.zip and key-values.zip
        if (fileStatus.downloadUrls.tables) {
          for (const [mode, url] of Object.entries(fileStatus.downloadUrls.tables)) {
            if (url && mode !== 'merged') {
              const filename = `${baseFileName}-tables.zip`;
              await downloadFileWithAuth(url, filename, apiKeyToUse);
            }
          }
        }
        // Download key-values as zip for individual mode
        if (fileStatus.downloadUrls.key_values) {
          for (const [mode, url] of Object.entries(fileStatus.downloadUrls.key_values)) {
            if (url) {
              const filename = `${baseFileName}-key_values.zip`;
              await downloadFileWithAuth(url, filename, apiKeyToUse);
            }
          }
        }
      } else if (tableMode === 'merged') {
        // Merged mode: Download merged file in selected format and key-values.zip
        if (fileStatus.downloadUrls.tables) {
          for (const [mode, url] of Object.entries(fileStatus.downloadUrls.tables)) {
            if (url && mode === 'merged') {
              const filename = `${baseFileName}-merged.${outputFormat}`;
              await downloadFileWithAuth(url, filename, apiKeyToUse);
            }
          }
        }
        // Download key-values as zip for merged mode
        if (fileStatus.downloadUrls.key_values) {
          for (const [mode, url] of Object.entries(fileStatus.downloadUrls.key_values)) {
            if (url) {
              const filename = `${baseFileName}-key_values.zip`;
              await downloadFileWithAuth(url, filename, apiKeyToUse);
            }
          }
        }
      }

      setNotification({ type: 'success', message: 'Files downloaded successfully' });
    } catch (error) {
      console.error('Download error:', error);
      setNotification({ type: 'error', message: 'Failed to download files' });
    }
  };

  // Usage history pagination functions
  const getVisibleUsageHistory = () => {
    const itemsToShow = USAGE_HISTORY_INITIAL_LIMIT + (usageHistoryPage - 1) * USAGE_HISTORY_LOAD_MORE_INCREMENT;
    return apiUsage.slice(0, itemsToShow);
  };

  const loadMoreUsageHistory = () => {
    setUsageHistoryPage(prev => prev + 1);
  };

  const getUsageHistoryStats = () => {
    const visibleCount = getVisibleUsageHistory().length;
    const totalCount = apiUsage.length;
    const hasMore = visibleCount < totalCount;
    return { visibleCount, totalCount, hasMore };
  };

  // Calculate processing time from created_at and updated_at
  const getProcessingTime = (usage: any) => {
    if (usage.completed_at && usage.created_at) {
      const created = new Date(usage.created_at);
      const completed = new Date(usage.completed_at);
      const diffInSeconds = Math.floor((completed.getTime() - created.getTime()) / 1000);
      return diffInSeconds > 0 ? `${diffInSeconds}s` : 'N/A';
    }
    return usage.processing_time ? `${usage.processing_time}s` : 'N/A';
  };

  // Processing status pagination functions
  const getVisibleProcessingFiles = () => {
    const filtered = getFilteredFiles();
    const itemsToShow = PROCESSING_STATUS_INITIAL_LIMIT + (processingStatusPage - 1) * PROCESSING_STATUS_LOAD_MORE_INCREMENT;
    return filtered.slice(0, itemsToShow);
  };

  const loadMoreProcessingFiles = () => {
    setProcessingStatusPage(prev => prev + 1);
  };

  const getProcessingStatusPaginationStats = () => {
    const filtered = getFilteredFiles();
    const visibleCount = getVisibleProcessingFiles().length;
    const totalCount = filtered.length;
    const hasMore = visibleCount < totalCount;
    return { visibleCount, totalCount, hasMore };
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
              'bg-teal-50 text-teal-700 border border-teal-200'
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
                    ? 'border-[#00C7BE] text-[#00C7BE]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                API Testing
              </button>
              <button
                onClick={() => setActiveTab('keys')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'keys'
                    ? 'border-[#00C7BE] text-[#00C7BE]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                API Keys ({apiKeys.length})
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'docs'
                    ? 'border-[#00C7BE] text-[#00C7BE]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documentation
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'usage'
                    ? 'border-[#00C7BE] text-[#00C7BE]'
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
              {/* Unified Horizontal Control Bar */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6 shadow-lg mb-6">
                <div className="flex items-center mb-6">
                  <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg p-2 mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">API Configuration</h2>
                    <p className="text-sm text-gray-600 mt-1">Configure your API settings and upload files for processing</p>
                  </div>
                </div>
                
                {/* Main Controls Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                    <select
                      value={selectedApiKey}
                      onChange={(e) => setSelectedApiKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900 text-sm"
                    >
                      <option value="">Choose API key...</option>
                      {apiKeys.map((key) => (
                        <option key={key.id} value={key.real_key || key.api_key}>
                          {key.key_name} ({key.api_key})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900 text-sm"
                    >
                      <option value="">Choose format...</option>
                      <option value="json">JSON</option>
                      <option value="csv">CSV</option>
                      <option value="xlsx">Excel</option>
                      <option value="txt">TXT</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Table Mode</label>
                    <select
                      value={tableMode}
                      onChange={(e) => setTableMode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900 text-sm"
                    >
                      <option value="">Choose mode...</option>
                      <option value="individual">Individual</option>
                      <option value="merged">Merged</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                    <button
                      onClick={handleProcessFiles}
                      disabled={!selectedApiKey || selectedFiles.length === 0 || !outputFormat || !tableMode}
                      className="w-full bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white px-4 py-2 rounded-full hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
                    >
                      Process File{selectedFiles.length > 1 ? 's' : ''}
                    </button>
                  </div>
                </div>

                {/* Modern Drag & Drop File Upload Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">File Upload</h3>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                      isDragOver
                        ? 'border-[#00C7BE] bg-teal-50'
                        : 'border-gray-300 bg-gray-50 hover:border-[#00C7BE] hover:bg-teal-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                        isDragOver ? 'bg-teal-100' : 'bg-gray-100'
                      }`}>
                        <svg 
                          className={`w-8 h-8 transition-colors ${isDragOver ? 'text-[#00C7BE]' : 'text-gray-500'}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={1.5} 
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className={`text-lg font-semibold transition-colors ${isDragOver ? 'text-teal-700' : 'text-gray-700'}`}>
                          {isDragOver ? 'Drop files here' : 'Drag & drop your files here'}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          or <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[#00C7BE] hover:text-teal-800 font-medium underline"
                          >
                            browse to choose files
                          </button>
                        </p>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Supported format: PDF</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
                          </svg>
                          <span>Max 10MB per file</span>
                        </div>
                      </div>
                    </div>
                    {isDragOver && (
                      <div className="absolute inset-0 bg-teal-100 bg-opacity-50 rounded-xl flex items-center justify-center">
                        <div className="text-teal-700 text-lg font-semibold">Release to upload</div>
                      </div>
                    )}
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">
                          Selected Files ({selectedFiles.length})
                        </h4>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border text-sm">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-gray-800 truncate font-medium">{file.name}</span>
                            </div>
                            <span className="text-gray-500 text-xs ml-2 flex-shrink-0">
                              {(file.size / 1024 / 1024).toFixed(1)}MB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Processing Status Section */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6 shadow-lg">
                <div className="flex items-center mb-6">
                  <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg p-2 mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 10h1m2 0h1m2 0h1" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Processing Status</h2>
                    <p className="text-sm text-gray-600 mt-1">Monitor your file processing progress and download results</p>
                  </div>
                </div>
                
                {fileProcessingStatus.length === 0 ? (
                  <div className="bg-gray-50 text-gray-600 p-6 rounded-lg text-center">
                    <div className="mb-4">
                      <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">Ready to Process</p>
                    <p className="text-xs text-gray-500 mt-1">Upload files and click &quot;Process&quot; to see the file processing status</p>
                  </div>
                  ) : (
                    <div>
                      {/* Status Bar with Counts */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-gray-700">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              {getProcessingStats().completed} Completed • {getProcessingStats().processing} Processing • {getProcessingStats().pending} Pending
                            </div>
                            {getProcessingStats().failed > 0 && ` • ${getProcessingStats().failed} Failed`}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            placeholder="Search files..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent"
                          />
                          <button 
                            onClick={handleDownloadAllCompleted}
                            className="px-3 py-1 text-sm bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full hover:scale-105 transition-transform duration-200 disabled:opacity-50"
                            disabled={getProcessingStats().completed === 0}
                          >
                            Download All ({getProcessingStats().completed})
                          </button>
                        </div>
                      </div>

                      {/* Inline Progress Bar */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            📈 Progress: {getProcessingStats().completed}/{getProcessingStats().total} ({getProcessingStats().progressPercentage}%)
                          </span>
                          {getEstimatedTimeRemaining() && (
                            <span className="text-sm text-gray-600">⏱ {getEstimatedTimeRemaining()}</span>
                          )}
                        </div>
                        <div className="w-full bg-gray-300 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] h-2 rounded-full transition-all duration-300"
                            style={{width: `${getProcessingStats().progressPercentage}%`}}
                          ></div>
                        </div>
                      </div>

                      {/* Filter Buttons */}
                      <div className="flex items-center space-x-2 mb-4">
                        <span className="text-sm font-medium text-gray-700">Filter:</span>
                        {['all', 'completed', 'processing', 'pending', 'failed'].map(status => (
                          <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1 text-xs rounded-full border ${
                              statusFilter === status 
                                ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white border-[#00C7BE]' 
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center space-x-1">
                              {status === 'all' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 00-2 2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2" />
                                </svg>
                              )}
                              {status === 'completed' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              {status === 'processing' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                              {status === 'pending' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              {status === 'failed' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              <span>
                                {status === 'all' ? 'All' : status === 'completed' ? 'Completed' : status === 'processing' ? 'Processing' : status === 'pending' ? 'Pending' : 'Failed'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Compact Table */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700 uppercase tracking-wider">
                            <div className="col-span-4">File Name</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Progress</div>
                            <div className="col-span-3">Downloads</div>
                            <div className="col-span-1">API Details</div>
                          </div>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {getVisibleProcessingFiles().map((fileStatus, index) => (
                            <div key={index}>
                              {/* Main Row */}
                              <div className="px-4 py-3 hover:bg-gray-50">
                                <div className="grid grid-cols-12 gap-4 items-center text-sm">
                                  <div className="col-span-4 flex items-center space-x-2">
                                    <span className="text-xs">📄</span>
                                    <span className="font-medium text-gray-900 truncate">{fileStatus.file.name}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                      fileStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      fileStatus.status === 'processing' ? 'bg-teal-100 text-teal-800' :
                                      fileStatus.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      <div className="flex items-center space-x-1">
                                        {fileStatus.status === 'completed' && (
                                          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                          </svg>
                                        )}
                                        {fileStatus.status === 'processing' && (
                                          <svg className="w-3 h-3 text-[#00C7BE] animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        )}
                                        {fileStatus.status === 'pending' && (
                                          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        )}
                                        {fileStatus.status === 'failed' && (
                                          <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
                                          </svg>
                                        )}
                                        <span>
                                          {fileStatus.status === 'completed' ? 'Completed' :
                                           fileStatus.status === 'processing' ? 'Processing' :
                                           fileStatus.status === 'pending' ? 'Pending' : 'Failed'}
                                        </span>
                                      </div>
                                    </span>
                                  </div>
                                  <div className="col-span-2">
                                    {(() => {
                                      const progressInfo = getFileProgressInfo(fileStatus);
                                      return (
                                        <div className="flex items-center space-x-2">
                                          {/* Rotating Spinner - Only show during processing */}
                                          {fileStatus.status === 'processing' && (
                                            <div className="relative w-6 h-6">
                                              <div className="w-6 h-6 border-2 border-teal-200 border-t-[#00C7BE] rounded-full animate-spin"></div>
                                            </div>
                                          )}
                                          {/* Progress Bar with Stage Info */}
                                          <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="text-xs text-gray-600">{progressInfo.stage}</span>
                                              <span className="text-xs text-gray-500">{progressInfo.percentage}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                              <div 
                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                  fileStatus.status === 'completed' ? 'bg-green-500' :
                                                  fileStatus.status === 'processing' ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67]' :
                                                  fileStatus.status === 'failed' ? 'bg-red-500' : 'bg-gray-300'
                                                }`}
                                                style={{width: `${progressInfo.percentage}%`}}
                                              ></div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="col-span-3">
                                    {fileStatus.status === 'completed' && fileStatus.downloadUrls ? (
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={() => handleFileDownload(fileStatus)}
                                          className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white px-2 py-1 rounded-full text-xs hover:scale-105 transition-transform duration-200"
                                          title="Download both tables and key-values"
                                        >
                                          Download Files
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-500">Pending</span>
                                    )}
                                  </div>
                                  <div className="col-span-1">
                                    {fileStatus.apiDetails && (
                                      <button 
                                        onClick={() => toggleApiDetails(index)}
                                        className={`text-xs px-2 py-1 rounded transition-colors ${
                                          fileStatus.expanded 
                                            ? 'bg-teal-100 text-teal-800 hover:bg-teal-200' 
                                            : 'text-[#00C7BE] hover:bg-teal-50'
                                        }`}
                                        title="View API call details"
                                      >
                                        {fileStatus.expanded ? '▼ Hide' : '📋 View'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Collapsible API Details */}
                              {fileStatus.expanded && fileStatus.apiDetails && (
                                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
                                  <div className="space-y-4">
                                    {fileStatus.apiDetails.analyze && (
                                      <div className="border border-gray-300 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                                            <span className={`w-2 h-2 rounded-full ${fileStatus.apiDetails.analyze.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span>1. Analysis API</span>
                                          </h4>
                                          <span className="text-xs text-gray-600">{fileStatus.apiDetails.analyze.timestamp}</span>
                                        </div>
                                        <div className="space-y-2">
                                          <div>
                                            <label className="text-xs font-medium text-gray-700">cURL Command:</label>
                                            <pre className="text-xs bg-black text-green-400 p-2 rounded mt-1 overflow-x-auto">{fileStatus.apiDetails.analyze.curlCommand}</pre>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <label className="text-xs font-medium text-gray-700">Request:</label>
                                              <pre className="text-xs bg-gray-100 text-gray-800 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(fileStatus.apiDetails.analyze.request, null, 2)}</pre>
                                            </div>
                                            <div>
                                              <label className="text-xs font-medium text-gray-700">Response:</label>
                                              <pre className="text-xs bg-gray-100 text-gray-800 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(fileStatus.apiDetails.analyze.response, null, 2)}</pre>
                                            </div>
                                          </div>
                                          {fileStatus.apiDetails.analyze.duration && (
                                            <div className="text-xs text-gray-600">Duration: {fileStatus.apiDetails.analyze.duration}ms</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {fileStatus.apiDetails.status && (
                                      <div className="border border-gray-300 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                                            <span className={`w-2 h-2 rounded-full ${fileStatus.apiDetails.status.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span>2. Status Monitor API</span>
                                          </h4>
                                          <span className="text-xs text-gray-600">{fileStatus.apiDetails.status.timestamp}</span>
                                        </div>
                                        <div className="space-y-2">
                                          <div>
                                            <label className="text-xs font-medium text-gray-700">cURL Command:</label>
                                            <pre className="text-xs bg-black text-green-400 p-2 rounded mt-1 overflow-x-auto">{fileStatus.apiDetails.status.curlCommand}</pre>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <label className="text-xs font-medium text-gray-700">Request:</label>
                                              <pre className="text-xs bg-gray-100 text-gray-800 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(fileStatus.apiDetails.status.request, null, 2)}</pre>
                                            </div>
                                            <div>
                                              <label className="text-xs font-medium text-gray-700">Response:</label>
                                              <pre className="text-xs bg-gray-100 text-gray-800 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(fileStatus.apiDetails.status.response, null, 2)}</pre>
                                            </div>
                                          </div>
                                          {fileStatus.apiDetails.status.duration && (
                                            <div className="text-xs text-gray-600">Duration: {fileStatus.apiDetails.status.duration}ms</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {fileStatus.apiDetails.results && (
                                      <div className="border border-gray-300 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                                            <span className={`w-2 h-2 rounded-full ${fileStatus.apiDetails.results.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span>3. Results API</span>
                                          </h4>
                                          <span className="text-xs text-gray-600">{fileStatus.apiDetails.results.timestamp}</span>
                                        </div>
                                        <div className="space-y-2">
                                          <div>
                                            <label className="text-xs font-medium text-gray-700">cURL Command:</label>
                                            <pre className="text-xs bg-black text-green-400 p-2 rounded mt-1 overflow-x-auto">{fileStatus.apiDetails.results.curlCommand}</pre>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <label className="text-xs font-medium text-gray-700">Request:</label>
                                              <pre className="text-xs bg-gray-100 text-gray-800 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(fileStatus.apiDetails.results.request, null, 2)}</pre>
                                            </div>
                                            <div>
                                              <label className="text-xs font-medium text-gray-700">Response:</label>
                                              <pre className="text-xs bg-gray-100 text-gray-800 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(fileStatus.apiDetails.results.response, null, 2)}</pre>
                                            </div>
                                          </div>
                                          {fileStatus.apiDetails.results.duration && (
                                            <div className="text-xs text-gray-600">Duration: {fileStatus.apiDetails.results.duration}ms</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {getFilteredFiles().length > 0 && (
                          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              Showing {Math.min(getVisibleProcessingFiles().length, getFilteredFiles().length)} of {getFilteredFiles().length} files
                            </div>
                            {getProcessingStatusPaginationStats().hasMore && (
                              <button
                                onClick={loadMoreProcessingFiles}
                                className="text-sm font-medium text-[#00C7BE] bg-white border border-teal-300 rounded-md px-3 py-1 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:ring-offset-2 transition-colors"
                              >
                                Load More...
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                              'bg-gradient-to-r from-[#00C7BE] to-[#086C67] animate-pulse'
                            }`}></div>
                            <span className="font-medium text-gray-900">{step.step}</span>
                          </div>
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            step.status === 'success' ? 'bg-green-100 text-green-800' :
                            step.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-teal-100 text-teal-800'
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
                            'bg-teal-100 text-teal-800'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        
                        {job.downloadUrls && (
                          <div className="flex space-x-2 mt-3">
                            <button
                              onClick={() => handleDownload(job.downloadUrls!.tables![outputFormat], job.job_id, 'tables', outputFormat)}
                              className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white px-3 py-1 rounded text-sm hover:scale-105 transition-transform duration-200"
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00C7BE] focus:border-transparent text-gray-900"
                  />
                  <button
                    onClick={createApiKey}
                    className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white px-6 py-2 rounded-lg hover:scale-105 transition-transform duration-200"
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
                                className="text-[#00C7BE] hover:text-teal-800 text-sm"
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
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Intelligent Data Parser API Documentation</h2>
              
              <div className="space-y-8">
                {/* Overview Section */}
                <div className="border-b pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Overview</h3>
                  <p className="text-gray-600 mb-4">
                    The Intelligent Data Parser API extracts structured data from PDF documents including tables and key-value pairs. 
                    It supports PDF format and provides results in various output formats.
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Base URL</h4>
                    <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded">http://localhost:8000/api/v1/intelligent-data</code>
                  </div>
                </div>

                {/* Authentication Section */}
                <div className="border-b pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Authentication</h3>
                  <p className="text-gray-600 mb-4">All API requests require authentication using a Bearer token with your API key.</p>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-green-400 text-sm font-mono">
                      <span className="text-gray-400"># Header</span><br/>
                      Authorization: Bearer YOUR_API_KEY
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    <strong>Note:</strong> Replace <code>YOUR_API_KEY</code> with your actual API key from the API Keys tab.
                  </div>
                </div>

                {/* Endpoints Section */}
                <div className="border-b pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">API Endpoints</h3>
                  
                  {/* Analyze Endpoint */}
                  <div className="border border-gray-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">POST</span>
                      <code className="text-lg font-mono text-gray-900">/analyze</code>
                    </div>
                    <p className="text-gray-600 mb-4">Start intelligent data analysis for uploaded files. Supports PDF format.</p>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Request Parameters</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr>
                                <td className="px-4 py-2 font-mono text-sm">files</td>
                                <td className="px-4 py-2 text-sm text-gray-600">File[]</td>
                                <td className="px-4 py-2 text-sm"><span className="text-red-600 font-medium">Yes</span></td>
                                <td className="px-4 py-2 text-sm text-gray-600">Array of files to process (multipart/form-data)</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Example Request</h5>
                        <div className="bg-gray-900 rounded-lg p-4">
                          <pre className="text-green-400 text-sm font-mono">
{`curl -X POST getApiUrl("/api/v1/intelligent-data/analyze") \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "files=@document1.pdf" \\
  -F "files=@document2.pdf"`}
                          </pre>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Response</h5>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="text-sm text-gray-800">
{`{
  "job_id": "uuid-string",
  "status": "PENDING",
  "message": "Analysis started successfully"
}`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Job Status Endpoint */}
                  <div className="border border-gray-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full">GET</span>
                      <code className="text-lg font-mono text-gray-900">/jobs/{'{job_id}'}/status</code>
                    </div>
                    <p className="text-gray-600 mb-4">Get the current status of a processing job.</p>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Path Parameters</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="px-4 py-2 font-mono text-sm">job_id</td>
                                <td className="px-4 py-2 text-sm text-gray-600">string</td>
                                <td className="px-4 py-2 text-sm text-gray-600">UUID of the processing job</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Response</h5>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="text-sm text-gray-800">
{`{
  "job_id": "uuid-string",
  "status": "SUCCEEDED|PENDING|RUNNING|FAILED",
  "progress": 100,
  "message": "Processing completed successfully"
}`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Job Results Endpoint */}
                  <div className="border border-gray-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full">GET</span>
                      <code className="text-lg font-mono text-gray-900">/jobs/{'{job_id}'}/results</code>
                    </div>
                    <p className="text-gray-600 mb-4">Get the results and download URLs for a completed job.</p>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Query Parameters</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr>
                                <td className="px-4 py-2 font-mono text-sm">format</td>
                                <td className="px-4 py-2 text-sm text-gray-600">string</td>
                                <td className="px-4 py-2 text-sm text-gray-600">json</td>
                                <td className="px-4 py-2 text-sm text-gray-600">Output format: csv, xlsx, json, txt</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-2 font-mono text-sm">mode</td>
                                <td className="px-4 py-2 text-sm text-gray-600">string</td>
                                <td className="px-4 py-2 text-sm text-gray-600">individual</td>
                                <td className="px-4 py-2 text-sm text-gray-600">Processing mode: individual, merged</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Example Request</h5>
                        <div className="bg-gray-900 rounded-lg p-4">
                          <pre className="text-green-400 text-sm font-mono">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  getApiUrl("/api/v1/intelligent-data/jobs/uuid-string/results?format=csv&mode=individual")`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Download Endpoints */}
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full">GET</span>
                      <code className="text-lg font-mono text-gray-900">/download/{'{job_id}'}/{'{type}'}/{'{format}'}</code>
                    </div>
                    <p className="text-gray-600 mb-4">Download processed data files directly.</p>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Path Parameters</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Values</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr>
                                <td className="px-4 py-2 font-mono text-sm">job_id</td>
                                <td className="px-4 py-2 text-sm text-gray-600">UUID string</td>
                                <td className="px-4 py-2 text-sm text-gray-600">The job identifier</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-2 font-mono text-sm">type</td>
                                <td className="px-4 py-2 text-sm text-gray-600">tables | key-values</td>
                                <td className="px-4 py-2 text-sm text-gray-600">Data type to download</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-2 font-mono text-sm">format</td>
                                <td className="px-4 py-2 text-sm text-gray-600">csv | xlsx | json | txt</td>
                                <td className="px-4 py-2 text-sm text-gray-600">File format</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Response Codes Section */}
                <div className="border-b pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">HTTP Status Codes</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="px-4 py-2 font-mono text-sm">200</td>
                          <td className="px-4 py-2 text-sm"><span className="text-green-600 font-medium">OK</span></td>
                          <td className="px-4 py-2 text-sm text-gray-600">Request successful</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 font-mono text-sm">401</td>
                          <td className="px-4 py-2 text-sm"><span className="text-red-600 font-medium">Unauthorized</span></td>
                          <td className="px-4 py-2 text-sm text-gray-600">Invalid or missing API key</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 font-mono text-sm">404</td>
                          <td className="px-4 py-2 text-sm"><span className="text-red-600 font-medium">Not Found</span></td>
                          <td className="px-4 py-2 text-sm text-gray-600">Job ID not found</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 font-mono text-sm">422</td>
                          <td className="px-4 py-2 text-sm"><span className="text-red-600 font-medium">Validation Error</span></td>
                          <td className="px-4 py-2 text-sm text-gray-600">Invalid request parameters</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 font-mono text-sm">500</td>
                          <td className="px-4 py-2 text-sm"><span className="text-red-600 font-medium">Server Error</span></td>
                          <td className="px-4 py-2 text-sm text-gray-600">Internal server error</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Supported Formats Section */}
                <div className="border-b pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Supported Formats</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Input Formats</h4>
                      <ul className="space-y-2">
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>PDF</strong> - Portable Document Format</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Output Formats</h4>
                      <ul className="space-y-2">
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>CSV</strong> - Comma-separated values</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>XLSX</strong> - Excel spreadsheet</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>JSON</strong> - JavaScript Object Notation</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>TXT</strong> - Plain text format</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Processing Modes Section */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Processing Modes</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Individual Mode</h4>
                      <p className="text-gray-600 text-sm mb-3">Process each uploaded file separately, generating individual output files for each input.</p>
                      <div className="bg-gray-50 rounded p-2 text-xs text-gray-700">
                        <strong>Use case:</strong> When you need separate results for each document
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Merged Mode</h4>
                      <p className="text-gray-600 text-sm mb-3">Combine data from all uploaded files into a single consolidated output file.</p>
                      <div className="bg-gray-50 rounded p-2 text-xs text-gray-700">
                        <strong>Use case:</strong> When you want to aggregate data from multiple documents
                      </div>
                    </div>
                  </div>
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
                <>
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
                          Processing Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Created At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getVisibleUsageHistory().map((usage) => (
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
                              'bg-teal-100 text-teal-800'
                            }`}>
                              {usage.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {getProcessingTime(usage)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h8l4 4v11a3 3 0 01-3 3h-4M8 7H6a2 2 0 00-2 2v11a3 3 0 003 3h2M8 7v8a2 2 0 002 2h2" />
                              </svg>
                              <div>
                                <div>{new Date(usage.created_at).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">{new Date(usage.created_at).toLocaleTimeString()}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {Math.min(getVisibleUsageHistory().length, apiUsage.length)} of {apiUsage.length} entries
                  </div>
                  {getUsageHistoryStats().hasMore && (
                    <button
                      onClick={loadMoreUsageHistory}
                      className="px-4 py-2 text-sm font-medium text-[#00C7BE] bg-white border border-teal-300 rounded-md hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-[#00C7BE] focus:ring-offset-2 transition-colors"
                    >
                      Load More...
                    </button>
                  )}
                </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}