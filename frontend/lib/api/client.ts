/**
 * Allesinda Marketplace API Client
 * Connects to FastAPI backend
 */

import { logger } from '@/lib/logger';

// Get API base URL from environment
// In production, NEXT_PUBLIC_API_URL must be set
// Export the API base URL getter for use in other files that need direct fetch calls
function resolveConfiguredApiUrl(): string | undefined {
  if (typeof window === 'undefined') {
    // Match api-proxy: public URL first (broken internal Docker hostnames are common in Coolify).
    return process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  }
  return process.env.NEXT_PUBLIC_API_URL;
}

function getServerApiProxyBaseUrl(): string {
  const port = process.env.PORT || '3000';
  return `http://127.0.0.1:${port}/api-proxy`;
}

export function getApiBaseUrl(): string {
  const apiUrl = resolveConfiguredApiUrl();

  // Browser: same-origin proxy (dev + production) — avoids CORS and cross-domain redirect issues.
  if (typeof window !== 'undefined' && (process.env.NODE_ENV === 'development' || apiUrl)) {
    return '/api-proxy';
  }

  // Server-side in dev: talk to backend on loopback (LAN IP often times out locally).
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
    return 'http://127.0.0.1:8000';
  }

  // Server-side production: use the same /api-proxy handler as the browser (URL candidates + TLS).
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    return getServerApiProxyBaseUrl();
  }
  
  if (!apiUrl) {
    // In production, fail if API URL is not set
    if (process.env.NODE_ENV === 'production') {
      // Log a helpful error message
      const errorMsg = 
        'NEXT_PUBLIC_API_URL environment variable is required in production. ' +
        'Please set it to your backend API URL (e.g., https://api.yourdomain.com). ' +
        'Note: NEXT_PUBLIC_* variables must be set at build time, not just runtime.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    // In development, default to localhost
    return 'http://localhost:8000';
  }
  
  // Ensure the URL doesn't end with a slash
  return apiUrl.replace(/\/$/, '');
}

const API_TIMEOUT = 10000; // 10 seconds

export interface ApiError {
  detail: string | Array<{ field?: string; message: string }>;
  status_code: number;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: ApiError['detail']
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Get authentication token from storage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Set authentication token in storage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

/**
 * Remove authentication token from storage
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

/**
 * Make API request with authentication and error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      let errorDetail: ApiError['detail'] = 'Unknown error';
      
      if (isJson) {
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorData.message || errorDetail;
        } catch {
          // Failed to parse error JSON
        }
      } else {
        errorDetail = await response.text() || errorDetail;
      }

      // Handle 401 Unauthorized - clear token but don't redirect
      // Let individual components/pages handle 401 errors appropriately
      if (response.status === 401) {
        removeAuthToken();
        // For 401 errors, throw with a specific message that can be checked
        throw new ApiClientError(
          'Not authenticated',
          response.status,
          errorDetail
        );
      }

      let errorMessage = 'Request failed';
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (errorDetail && typeof errorDetail === 'object' && !Array.isArray(errorDetail)) {
        const record = errorDetail as Record<string, unknown>;
        if (typeof record.message === 'string') {
          errorMessage = record.message;
        }
      }

      throw new ApiClientError(errorMessage, response.status, errorDetail);
    }

    // Handle empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    if (!isJson) {
      const text = await response.text();
      return text as unknown as T;
    }

    const jsonData = await response.json();
    
    return jsonData;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      const baseUrl = getApiBaseUrl();
      logger.error(`Request timeout - API unreachable at ${baseUrl}${endpoint}`);
      throw new ApiClientError(
        `Request timeout - Unable to reach API at ${baseUrl}. Please ensure the backend is running.`,
        408
      );
    }

    // Handle network errors (Failed to fetch)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const baseUrl = getApiBaseUrl();
      logger.error(`Network error - API unreachable at ${baseUrl}${endpoint}:`, error);
      throw new ApiClientError(
        `Unable to connect to server at ${baseUrl}. Please check:
1. Is the backend server running?
2. Is it running on the correct port?
3. Check the browser console for CORS errors.`,
        0 // Use 0 for network errors
      );
    }

    logger.error('API request error:', error);
    throw new ApiClientError(
      error instanceof Error ? error.message : 'Network error',
      500
    );
  }
}

/**
 * GET request
 */
export async function apiGet<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
  let fullUrl = endpoint;
  
  // Add query parameters if provided
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (endpoint.includes('?') ? '&' : '?') + queryString;
    }
  }
  
  return apiRequest<T>(fullUrl);
}

/**
 * POST request
 */
export async function apiPost<T>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request
 */
export async function apiPatch<T>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export async function apiPut<T>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'DELETE',
  });
}

// PaginatedResponse is exported from './types'
export type { PaginatedResponse } from './types';

