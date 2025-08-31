'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  api_key?: string;
  downloadUrls?: {
    tables?: { [key: string]: string };
    key_values?: { [key: string]: string };
  };
  error?: string;
}

interface IndividualFileProgress {
  file: File;
  fileIndex: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  job_id?: string;
  apiSteps: ApiStep[];
  downloadUrls?: {
    tables?: { [mode: string]: string };
    key_values?: { [mode: string]: string };
  };
  error?: string;
  completedAt?: string;
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
  
  // API Execution Timeline states
  const [apiSteps, setApiSteps] = useState<ApiStep[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string>('');
  
  // Sequential file processing states
  const [individualFileProgress, setIndividualFileProgress] = useState<IndividualFileProgress[]>([]);
  const [isSequentialProcessing, setIsSequentialProcessing] = useState(false);

  useEffect(() => {
    loadUser();
    loadApiKeys();
    loadApiUsage();
  }, []);


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
        // Remove auto-selection - let user choose
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

    if (selectedFiles.length === 1) {
      // Single file processing - use original timeline
      initializeApiSteps();
      await executeApiFlow();
    } else {
      // Multiple file processing - use sequential processing
      initializeSequentialFileProcessing();
      await processFilesSequentially();
    }
  };

  // Sequential File Processing Functions
  const initializeSequentialFileProcessing = () => {
    const initialProgress: IndividualFileProgress[] = selectedFiles.map((file, index) => ({
      file,
      fileIndex: index,
      status: 'pending',
      apiSteps: [
        {
          id: 'analyze',
          title: 'Start Analysis',
          endpoint: '/api/v1/intelligent-data/analyze',
          method: 'POST',
          status: 'pending',
          expanded: false
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
      ]
    }));
    
    setIndividualFileProgress(initialProgress);
    setIsSequentialProcessing(true);
  };

  const processFilesSequentially = async () => {
    setNotification({type: 'info', message: `Starting sequential processing of ${selectedFiles.length} files...`});
    setTimeout(() => setNotification(null), 3000);

    for (let i = 0; i < selectedFiles.length; i++) {
      // Update file status to processing
      updateIndividualFileProgress(i, { status: 'processing' });
      
      try {
        await processIndividualFile(i);
        
        // Mark file as completed
        updateIndividualFileProgress(i, { 
          status: 'completed',
          completedAt: new Date().toLocaleTimeString()
        });

        // Batch notification every 2 files
        if ((i + 1) % 2 === 0 && i + 1 < selectedFiles.length) {
          setNotification({type: 'info', message: `${i + 1} files completed. Continuing with remaining files...`});
          setTimeout(() => setNotification(null), 3000);
        }
        
      } catch (error) {
        updateIndividualFileProgress(i, { 
          status: 'failed',
          error: String(error)
        });
      }
    }

    setIsSequentialProcessing(false);
    loadApiUsage(); // Refresh usage data
    setNotification({type: 'success', message: 'All files processed successfully!'});
    setTimeout(() => setNotification(null), 3000);
  };

  const processIndividualFile = async (fileIndex: number): Promise<void> => {
    const file = selectedFiles[fileIndex];
    
    // Step 1: Start Analysis
    await executeIndividualAnalyzeStep(fileIndex, file);
  };

  const executeIndividualAnalyzeStep = async (fileIndex: number, file: File) => {
    updateIndividualFileApiStep(fileIndex, 'analyze', { 
      status: 'loading', 
      curlCommand: generateIndividualCurlCommand(fileIndex, 'analyze'),
      timestamp: new Date().toLocaleTimeString(),
      expanded: true
    });

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
        
        // Update file progress with job ID
        updateIndividualFileProgress(fileIndex, { job_id: jobId });
        
        // Update analyze step as success
        updateIndividualFileApiStep(fileIndex, 'analyze', { 
          status: 'success', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });

        // Start monitoring step
        await executeIndividualStatusMonitoring(fileIndex, jobId);
      } else {
        updateIndividualFileApiStep(fileIndex, 'analyze', { 
          status: 'error', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });
        throw new Error('Analysis failed');
      }
    } catch (error) {
      updateIndividualFileApiStep(fileIndex, 'analyze', { 
        status: 'error', 
        response: { error: String(error) },
        timestamp: new Date().toLocaleTimeString()
      });
      throw error;
    }
  };

  const executeIndividualStatusMonitoring = async (fileIndex: number, jobId: string) => {
    updateIndividualFileApiStep(fileIndex, 'status', { 
      status: 'loading', 
      curlCommand: generateIndividualCurlCommand(fileIndex, 'status', jobId),
      expanded: true,
      timestamp: new Date().toLocaleTimeString()
    });

    const pollStatus = async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/status`, {
              headers: {
                'Authorization': `Bearer ${selectedApiKey}`,
              },
            });

            const result = await response.json();
            
            // Update status step with latest response
            updateIndividualFileApiStep(fileIndex, 'status', { 
              response: result,
              timestamp: new Date().toLocaleTimeString()
            });

            if (result.status === 'SUCCEEDED') {
              updateIndividualFileApiStep(fileIndex, 'status', { status: 'success' });
              
              // Start results step
              await executeIndividualResultsStep(fileIndex, jobId);
              resolve();
            } else if (result.status === 'FAILED') {
              updateIndividualFileApiStep(fileIndex, 'status', { status: 'error' });
              reject(new Error('Processing failed'));
            } else {
              // Continue polling
              setTimeout(poll, 3000);
            }
          } catch (error) {
            updateIndividualFileApiStep(fileIndex, 'status', { 
              status: 'error', 
              response: { error: String(error) },
              timestamp: new Date().toLocaleTimeString()
            });
            reject(error);
          }
        };

        setTimeout(poll, 1000);
      });
    };

    await pollStatus();
  };

  const executeIndividualResultsStep = async (fileIndex: number, jobId: string) => {
    updateIndividualFileApiStep(fileIndex, 'results', { 
      status: 'loading', 
      curlCommand: generateIndividualCurlCommand(fileIndex, 'results', jobId),
      expanded: true,
      timestamp: new Date().toLocaleTimeString()
    });

    try {
      const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`, {
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        updateIndividualFileApiStep(fileIndex, 'results', { 
          status: 'success', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });

        // Update download URLs
        const downloadUrls = {
          tables: { [tableMode]: `http://localhost:8000/api/v1/intelligent-data/download/${jobId}/tables/${outputFormat}?mode=${tableMode}` },
          key_values: { [tableMode]: `http://localhost:8000/api/v1/intelligent-data/download/${jobId}/key-values/${outputFormat}` }
        };

        updateIndividualFileProgress(fileIndex, { downloadUrls });
        
      } else {
        updateIndividualFileApiStep(fileIndex, 'results', { 
          status: 'error', 
          response: result,
          timestamp: new Date().toLocaleTimeString()
        });
        throw new Error('Results retrieval failed');
      }
    } catch (error) {
      updateIndividualFileApiStep(fileIndex, 'results', { 
        status: 'error', 
        response: { error: String(error) },
        timestamp: new Date().toLocaleTimeString()
      });
      throw error;
    }
  };

  const updateIndividualFileProgress = (fileIndex: number, updates: Partial<IndividualFileProgress>) => {
    setIndividualFileProgress(prev => prev.map((fileProgress, index) => 
      index === fileIndex ? { ...fileProgress, ...updates } : fileProgress
    ));
  };

  const updateIndividualFileApiStep = (fileIndex: number, stepId: string, updates: Partial<ApiStep>) => {
    setIndividualFileProgress(prev => prev.map((fileProgress, index) => 
      index === fileIndex ? {
        ...fileProgress,
        apiSteps: fileProgress.apiSteps.map(step => 
          step.id === stepId ? { ...step, ...updates } : step
        )
      } : fileProgress
    ));
  };

  const toggleIndividualStepExpansion = (fileIndex: number, stepId: string) => {
    updateIndividualFileApiStep(fileIndex, stepId, { 
      expanded: !individualFileProgress[fileIndex]?.apiSteps.find(s => s.id === stepId)?.expanded 
    });
  };

  const generateIndividualCurlCommand = (fileIndex: number, stepType: string, jobId?: string) => {
    const file = selectedFiles[fileIndex];
    let endpoint = '';
    let method = 'GET';
    
    if (stepType === 'analyze') {
      endpoint = '/api/v1/intelligent-data/analyze';
      method = 'POST';
    } else if (stepType === 'status' && jobId) {
      endpoint = `/api/v1/intelligent-data/jobs/${jobId}/status`;
    } else if (stepType === 'results' && jobId) {
      endpoint = `/api/v1/intelligent-data/jobs/${jobId}/results`;
    }

    let curl = `curl -X ${method} "http://localhost:8000${endpoint}"`;
    curl += ` \\\n  -H "Authorization: Bearer ${selectedApiKey}"`;
    
    if (method === 'POST' && stepType === 'analyze') {
      curl += ` \\\n  -F "files=@${file.name}"`;
    }

    if (stepType === 'results') {
      curl += ` \\\n  -G -d "format=${outputFormat}" -d "mode=${tableMode}"`;
    }

    return curl;
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
      curlCommand: generateCurlCommand(analyzeStep),
      timestamp: new Date().toLocaleTimeString()
    });

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
      curlCommand: generateCurlCommand(statusStep, jobId),
      expanded: true,
      timestamp: new Date().toLocaleTimeString()
    });

    const pollStatus = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/status`, {
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
      curlCommand: generateCurlCommand(resultsStep, jobId),
      expanded: true,
      timestamp: new Date().toLocaleTimeString()
    });

    try {
      const response = await fetch(`http://localhost:8000/api/v1/intelligent-data/jobs/${jobId}/results?format=${outputFormat}&mode=${tableMode}`, {
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
                  tables: { [outputFormat]: `http://localhost:8000/api/v1/intelligent-data/download/${jobId}/tables/${outputFormat}?mode=${tableMode}` },
                  key_values: { [outputFormat]: `http://localhost:8000/api/v1/intelligent-data/download/${jobId}/key-values/${outputFormat}` }
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

  const handleDownload = async (downloadUrl: string, jobId: string, type: string, mode: string) => {
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
      
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${apiKeyToUse}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Generate proper filename based on uploaded file name and requirements
        let filename = '';
        
        // Find the file associated with this job
        const associatedFile = fileProcessingStatus.find(status => status.job_id === jobId);
        let baseFileName = jobId; // fallback to job ID
        
        if (associatedFile) {
          // Remove extension from original filename
          baseFileName = associatedFile.file.name.replace(/\.[^/.]+$/, '');
        } else if (selectedFiles.length === 1) {
          // Single file processing
          baseFileName = selectedFiles[0].name.replace(/\.[^/.]+$/, '');
        }
        
        // Set filename based on type and mode
        if (type === 'tables') {
          if (mode === 'individual') {
            filename = `${baseFileName}_tables_individual.zip`;
          } else { // merged
            filename = `${baseFileName}_tables_merged.${outputFormat}`;
          }
        } else if (type === 'key-values') {
          filename = `${baseFileName}_key-values.zip`;
        } else {
          // Fallback for any other types
          filename = `${baseFileName}_${type}.${outputFormat}`;
        }
        
        a.download = filename;
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

  const generateCurlCommand = (step: ApiStep, jobId?: string) => {
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
                        <option value="">Choose output format...</option>
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
                        <option value="">Choose table mode...</option>
                        <option value="individual">Individual</option>
                        <option value="merged">Merged</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Files:
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="hidden"
                      ref={fileInputRef}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg py-8 px-4 transition-colors duration-200 flex flex-col items-center justify-center text-gray-600 hover:text-blue-600"
                    >
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="font-medium">Upload Single or Multiple Files</span>
                      <span className="text-sm text-gray-500 mt-1">PDF, PNG, JPG, JPEG files supported</span>
                    </button>
                    {selectedFiles.length > 0 && (
                      <div className="mt-4 space-y-1">
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


                  <div className="flex space-x-4">
                    <button
                      onClick={handleProcessFiles}
                      disabled={!selectedApiKey || selectedFiles.length === 0 || isProcessingMultiple || isSequentialProcessing}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isProcessingMultiple || isSequentialProcessing ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          {selectedFiles.length > 1 ? 'Processing Sequentially...' : 'Processing...'}
                        </>
                      ) : (
                        `Process ${selectedFiles.length > 1 ? `${selectedFiles.length} Files Sequentially` : 'File'}`
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Column - API Execution Timeline */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    {selectedFiles.length > 1 && individualFileProgress.length > 0 ? 'Sequential File Processing' : 'API Execution Timeline'}
                  </h2>
                  
                  {selectedFiles.length > 1 && individualFileProgress.length > 0 ? (
                    /* Sequential File Processing UI */
                    <div className="space-y-6">
                      {individualFileProgress.map((fileProgress, fileIndex) => (
                        <div key={fileIndex} className={`border rounded-lg ${
                          fileProgress.status === 'completed' ? 'border-green-200 bg-green-50' :
                          fileProgress.status === 'failed' ? 'border-red-200 bg-red-50' :
                          fileProgress.status === 'processing' ? 'border-blue-200 bg-blue-50' :
                          'border-gray-200 bg-gray-50'
                        }`}>
                          {/* File Header */}
                          <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                                  fileProgress.status === 'completed' ? 'bg-green-100 border-green-500 text-green-700' :
                                  fileProgress.status === 'failed' ? 'bg-red-100 border-red-500 text-red-700' :
                                  fileProgress.status === 'processing' ? 'bg-blue-100 border-blue-500 text-blue-700' :
                                  'bg-gray-100 border-gray-300 text-gray-500'
                                }`}>
                                  {fileProgress.status === 'processing' ? (
                                    <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full"></div>
                                  ) : fileProgress.status === 'completed' ? (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  ) : fileProgress.status === 'failed' ? (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    fileIndex + 1
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900">{fileProgress.file.name}</h3>
                                  <p className="text-sm text-gray-500">
                                    File {fileIndex + 1} of {selectedFiles.length}
                                    {fileProgress.job_id && ` • Job ID: ${fileProgress.job_id}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  fileProgress.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  fileProgress.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  fileProgress.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {fileProgress.status.toUpperCase()}
                                </span>
                                {fileProgress.completedAt && (
                                  <span className="text-xs text-gray-500">{fileProgress.completedAt}</span>
                                )}
                              </div>
                            </div>
                            
                            {fileProgress.error && (
                              <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                Error: {fileProgress.error}
                              </div>
                            )}
                          </div>

                          {/* API Steps for this file */}
                          <div className="p-4">
                            <div className="space-y-3">
                              {fileProgress.apiSteps.map((step, stepIndex) => (
                                <div key={step.id} className="relative">
                                  {/* Timeline Line */}
                                  {stepIndex !== fileProgress.apiSteps.length - 1 && (
                                    <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200"></div>
                                  )}
                                  
                                  {/* Step Container */}
                                  <div className="relative flex items-start space-x-4">
                                    {/* Step Number & Status */}
                                    <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                                      step.status === 'success' ? 'bg-green-100 border-green-500 text-green-700' :
                                      step.status === 'error' ? 'bg-red-100 border-red-500 text-red-700' :
                                      step.status === 'loading' ? 'bg-blue-100 border-blue-500 text-blue-700' :
                                      'bg-gray-100 border-gray-300 text-gray-500'
                                    }`}>
                                      {step.status === 'loading' ? (
                                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                                      ) : step.status === 'success' ? (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      ) : step.status === 'error' ? (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        stepIndex + 1
                                      )}
                                    </div>

                                    {/* Step Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="bg-white rounded-lg border border-gray-200">
                                        {/* Step Header */}
                                        <button
                                          onClick={() => toggleIndividualStepExpansion(fileIndex, step.id)}
                                          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 rounded-t-lg transition-colors"
                                        >
                                          <div className="flex items-center space-x-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                              step.method === 'POST' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                              {step.method}
                                            </span>
                                            <div>
                                              <h4 className="font-medium text-gray-900">{step.title}</h4>
                                              <p className="text-xs text-gray-500 font-mono">
                                                {step.endpoint.replace('{job_id}', fileProgress.job_id || '{job_id}')}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            {step.timestamp && (
                                              <span className="text-xs text-gray-500">{step.timestamp}</span>
                                            )}
                                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${
                                              step.expanded ? 'transform rotate-180' : ''
                                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </div>
                                        </button>

                                        {/* Expandable Content */}
                                        {step.expanded && (
                                          <div className="px-4 pb-4 border-t border-gray-200">
                                            {/* cURL Command */}
                                            {step.curlCommand && (
                                              <div className="mt-3">
                                                <div className="flex items-center justify-between mb-2">
                                                  <h5 className="text-sm font-medium text-gray-700">cURL Command</h5>
                                                  <button
                                                    onClick={() => copyToClipboard(step.curlCommand!)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>Copy</span>
                                                  </button>
                                                </div>
                                                <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                                                  <pre>{step.curlCommand}</pre>
                                                </div>
                                              </div>
                                            )}

                                            {/* Response */}
                                            {step.response && (
                                              <div className="mt-3">
                                                <h5 className="text-sm font-medium text-gray-700 mb-2">Response</h5>
                                                <div className="bg-gray-100 p-3 rounded-lg">
                                                  <pre className="text-xs text-gray-800 overflow-x-auto">
                                                    {JSON.stringify(step.response, null, 2)}
                                                  </pre>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Download Section for completed files */}
                            {fileProgress.status === 'completed' && fileProgress.downloadUrls && (
                              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <h5 className="text-sm font-medium text-blue-900 mb-2">Download Files for {fileProgress.file.name}</h5>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleDownload(fileProgress.downloadUrls!.tables![tableMode], fileProgress.job_id!, 'tables', tableMode)}
                                    className="inline-flex items-center space-x-2 text-blue-700 hover:text-blue-900 text-sm bg-white px-2 py-1 rounded border hover:bg-blue-50"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Tables ({tableMode === 'individual' ? 'ZIP' : outputFormat.toUpperCase()})</span>
                                  </button>
                                  <button
                                    onClick={() => handleDownload(fileProgress.downloadUrls!.key_values![tableMode], fileProgress.job_id!, 'key-values', tableMode)}
                                    className="inline-flex items-center space-x-2 text-blue-700 hover:text-blue-900 text-sm bg-white px-2 py-1 rounded border hover:bg-blue-50"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Key-Values (ZIP)</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : apiSteps.length === 0 ? (
                    <div className="bg-gray-50 text-gray-600 p-6 rounded-lg text-center">
                      <div className="mb-4">
                        <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium">Ready to Process</p>
                      <p className="text-xs text-gray-500 mt-1">Upload files and click &quot;Process&quot; to see the API execution flow</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {apiSteps.map((step, index) => (
                        <div key={step.id} className="relative">
                          {/* Timeline Line */}
                          {index !== apiSteps.length - 1 && (
                            <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200"></div>
                          )}
                          
                          {/* Step Container */}
                          <div className="relative flex items-start space-x-4">
                            {/* Step Number & Status */}
                            <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                              step.status === 'success' ? 'bg-green-100 border-green-500 text-green-700' :
                              step.status === 'error' ? 'bg-red-100 border-red-500 text-red-700' :
                              step.status === 'loading' ? 'bg-blue-100 border-blue-500 text-blue-700' :
                              'bg-gray-100 border-gray-300 text-gray-500'
                            }`}>
                              {step.status === 'loading' ? (
                                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                              ) : step.status === 'success' ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : step.status === 'error' ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                index + 1
                              )}
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 min-w-0">
                              <div className="bg-gray-50 rounded-lg border border-gray-200">
                                {/* Step Header */}
                                <button
                                  onClick={() => toggleStepExpansion(step.id)}
                                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-100 rounded-t-lg transition-colors"
                                >
                                  <div className="flex items-center space-x-3">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      step.method === 'POST' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {step.method}
                                    </span>
                                    <div>
                                      <h3 className="font-medium text-gray-900">{step.title}</h3>
                                      <p className="text-xs text-gray-500 font-mono">
                                        {step.endpoint.replace('{job_id}', currentJobId || '{job_id}')}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {step.timestamp && (
                                      <span className="text-xs text-gray-500">{step.timestamp}</span>
                                    )}
                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${
                                      step.expanded ? 'transform rotate-180' : ''
                                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </button>

                                {/* Expandable Content */}
                                {step.expanded && (
                                  <div className="px-4 pb-4 border-t border-gray-200">
                                    {/* cURL Command */}
                                    {step.curlCommand && (
                                      <div className="mt-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-medium text-gray-700">cURL Command</h4>
                                          <button
                                            onClick={() => copyToClipboard(step.curlCommand!)}
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            <span>Copy</span>
                                          </button>
                                        </div>
                                        <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                                          <pre>{step.curlCommand}</pre>
                                        </div>
                                      </div>
                                    )}

                                    {/* Response */}
                                    {step.response && (
                                      <div className="mt-3">
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Response</h4>
                                        <div className="bg-gray-100 p-3 rounded-lg">
                                          <pre className="text-xs text-gray-800 overflow-x-auto">
                                            {JSON.stringify(step.response, null, 2)}
                                          </pre>
                                        </div>
                                        
                                        {/* Download Links for final step */}
                                        {step.id === 'results' && step.status === 'success' && step.response.download_urls && (
                                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <h5 className="text-sm font-medium text-blue-900 mb-2">Download Files</h5>
                                            <div className="space-y-2">
                                              {step.response.download_urls.tables && Object.entries(step.response.download_urls.tables).map(([format, url]: [string, any]) => (
                                                <button
                                                  key={format}
                                                  onClick={() => handleDownload(url, currentJobId, 'tables', tableMode)}
                                                  className="inline-flex items-center space-x-2 text-blue-700 hover:text-blue-900 text-sm mr-4"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                  </svg>
                                                  <span>Tables ({format.toUpperCase()})</span>
                                                </button>
                                              ))}
                                              {step.response.download_urls.key_values && Object.entries(step.response.download_urls.key_values).map(([format, url]: [string, any]) => (
                                                <button
                                                  key={format}
                                                  onClick={() => handleDownload(url, currentJobId, 'key-values', tableMode)}
                                                  className="inline-flex items-center space-x-2 text-blue-700 hover:text-blue-900 text-sm mr-4"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                  </svg>
                                                  <span>Key-Values ({format.toUpperCase()})</span>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
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
                              onClick={() => handleDownload(fileStatus.downloadUrls!.tables![outputFormat], fileStatus.job_id!, 'tables', tableMode)}
                              className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                            >
                              Download Tables
                            </button>
                            <button
                              onClick={() => handleDownload(fileStatus.downloadUrls!.key_values![outputFormat], fileStatus.job_id!, 'key-values', tableMode)}
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
                              onClick={() => handleDownload(job.downloadUrls!.tables![outputFormat], job.job_id, 'tables', tableMode)}
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                            >
                              Download Tables
                            </button>
                            <button
                              onClick={() => handleDownload(job.downloadUrls!.key_values![outputFormat], job.job_id, 'key-values', tableMode)}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Intelligent Data Parser API Documentation</h2>
              
              <div className="space-y-8">
                {/* Overview Section */}
                <div className="border-b pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Overview</h3>
                  <p className="text-gray-600 mb-4">
                    The Intelligent Data Parser API extracts structured data from documents including tables and key-value pairs. 
                    It supports multiple file formats and provides results in various output formats.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Base URL</h4>
                    <code className="text-blue-800 bg-blue-100 px-2 py-1 rounded">http://localhost:8000/api/v1/intelligent-data</code>
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
                    <p className="text-gray-600 mb-4">Start intelligent data analysis for uploaded files. Supports PDF, PNG, JPG, and JPEG formats.</p>
                    
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
{`curl -X POST "http://localhost:8000/api/v1/intelligent-data/analyze" \\
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
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">GET</span>
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
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">GET</span>
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
  "http://localhost:8000/api/v1/intelligent-data/jobs/uuid-string/results?format=csv&mode=individual"`}
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
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>PNG</strong> - Portable Network Graphics</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>JPG/JPEG</strong> - Joint Photographic Experts Group</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Output Formats</h4>
                      <ul className="space-y-2">
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>CSV</strong> - Comma-separated values</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>XLSX</strong> - Excel spreadsheet</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
                          <span className="text-gray-700"><strong>JSON</strong> - JavaScript Object Notation</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
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