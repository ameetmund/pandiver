/**
 * Centralized API Configuration for Pandiver Frontend
 *
 * This module provides a single source of truth for API configuration
 * and standardized HTTP methods for making API calls.
 *
 * Environment Variables:
 * - NEXT_PUBLIC_API_URL: Base URL for the backend API (default: http://localhost:8000)
 *
 * Usage:
 * import { apiClient } from '@/lib/api';
 *
 * const response = await apiClient.post('/auth/login', { email, password });
 */

// Get API base URL from environment variable with fallback
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * API Configuration
 */
export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Get authorization header with token from localStorage
 */
function getAuthHeader(): HeadersInit {
  if (typeof window === 'undefined') return {};

  const token = localStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Build full URL from endpoint
 */
function buildURL(endpoint: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}

/**
 * Handle API response and errors
 */
async function handleResponse<T = any>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  // Check if response has content
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response as any;
}

/**
 * Centralized API Client
 */
export const apiClient = {
  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(buildURL(endpoint), {
      method: 'GET',
      headers: {
        ...apiConfig.headers,
        ...getAuthHeader(),
        ...options?.headers,
      },
      ...options,
    });

    return handleResponse<T>(response);
  },

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const response = await fetch(buildURL(endpoint), {
      method: 'POST',
      headers: {
        ...apiConfig.headers,
        ...getAuthHeader(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    return handleResponse<T>(response);
  },

  /**
   * POST request with FormData (for file uploads)
   */
  async postFormData<T = any>(endpoint: string, formData: FormData, options?: RequestInit): Promise<T> {
    const response = await fetch(buildURL(endpoint), {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData - browser will set it with boundary
        ...getAuthHeader(),
        ...options?.headers,
      },
      body: formData,
      ...options,
    });

    return handleResponse<T>(response);
  },

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const response = await fetch(buildURL(endpoint), {
      method: 'PUT',
      headers: {
        ...apiConfig.headers,
        ...getAuthHeader(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    return handleResponse<T>(response);
  },

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(buildURL(endpoint), {
      method: 'DELETE',
      headers: {
        ...apiConfig.headers,
        ...getAuthHeader(),
        ...options?.headers,
      },
      ...options,
    });

    return handleResponse<T>(response);
  },

  /**
   * Download file (returns blob)
   */
  async download(endpoint: string, filename?: string, options?: RequestInit): Promise<void> {
    const response = await fetch(buildURL(endpoint), {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

/**
 * API Endpoints (for type safety and consistency)
 */
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: '/auth/login',
    signup: '/auth/signup',
    me: '/auth/me',
  },

  // PDF Processing
  pdf: {
    upload: '/upload-pdf/',
    exportData: '/export-data/',
  },

  // Bank Statement
  bankStatement: {
    upload: '/upload-bank-statement/',
    extractColumns: '/extract-bank-columns/',
    exportTable: '/export-table-data/',
  },

  // Manual Parser
  manual: {
    detectPages: '/manual/detect-transaction-pages',
    generatePattern: '/manual/generate-pattern-rule',
    applyPattern: '/manual/apply-pattern-rule',
    savePattern: '/manual/save-pattern-rule',
    listPatterns: '/manual/list-saved-patterns',
  },

  // User Controlled Parser
  userControlled: {
    uploadStatement: '/user-controlled/upload-statement',
    extractTransactions: '/user-controlled/extract-transactions',
  },

  // AWS Textract
  textract: {
    parseStatement: '/textract/parse-statement',
  },

  // Azure Document Intelligence
  azureDI: {
    analyzeTables: '/azure-di/analyze-tables',
    analyzeKeyValues: '/azure-di/analyze-key-values',
  },

  // API v1
  api: {
    analyzeDocument: '/api/v1/analyze',
    checkStatus: '/api/v1/jobs',
    downloadResults: '/api/v1/results',
    createApiKey: '/api/v1/api-keys',
    listApiKeys: '/api/v1/api-keys',
    listUsage: '/api/v1/usage',
  },

  // PDF Splitter
  pdfSplitter: {
    split: '/split-pdf',
    splitByPages: '/split-pdf-by-pages',
    apiSplit: '/api/pdf-splitter/split',
  },

  // PDF Translator
  pdfTranslator: {
    translate: '/translate-pdf',
    listLanguages: '/list-languages',
    apiTranslate: '/api/pdf-translator/translate',
  },

  // Intelligent Data Parser
  intelligentData: {
    parse: '/parse-intelligent-data',
  },
};

/**
 * Helper function to build API URL (for components that need the full URL)
 */
export function getApiUrl(endpoint: string): string {
  return buildURL(endpoint);
}

/**
 * Helper to check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('accessToken');
}

/**
 * Helper to get current user from localStorage
 */
export function getCurrentUser(): any | null {
  if (typeof window === 'undefined') return null;

  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Helper to logout (clear auth data)
 */
export function logout(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}

export default apiClient;
