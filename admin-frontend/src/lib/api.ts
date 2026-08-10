import { API_BASE_URL } from '@/config/api';

interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('admin_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to connect to server');
  }
}

export const api = {
  get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'GET' });
  },

  post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  patch<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'DELETE',
      ...(body && { body: JSON.stringify(body) }),
    });
  },

  async upload<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const token = localStorage.getItem('admin_token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      // No Content-Type header here - the browser sets multipart/form-data with the
      // correct boundary itself; setting it manually breaks the upload.
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(response.status, data.message || 'Upload failed');
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to connect to server');
    }
  },
};

