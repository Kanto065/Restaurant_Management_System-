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

// ASP.NET's validation responses look like:
// { title, status, errors: { fieldName: ["message", ...] } }
// `errors` mixes genuinely useful messages ("The Name field is required.") with raw
// deserialization exceptions ("The JSON value could not be converted to ... Path: $.spiceLevel
// | LineNumber: 0 | ...") that mean nothing to a restaurant owner. This turns that into a
// plain-English summary, dropping/rewriting the exception-shaped ones.
function humanizeFieldName(path: string): string {
  const key = path.replace(/^\$\.?/, '').split('.').pop() || path;
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function friendlyValidationMessage(field: string, message: string): string | null {
  if (/JSON value could not be converted/i.test(message)) {
    return `${humanizeFieldName(field)} has an invalid value.`;
  }
  if (field === 'request' && /required/i.test(message)) {
    // Only shown when nothing more specific was extracted - the whole body failed to parse.
    return null;
  }
  return message;
}

function extractErrorMessage(data: any, fallback: string): string {
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const messages = new Set<string>();
    for (const [field, fieldMessages] of Object.entries(errors)) {
      const list = Array.isArray(fieldMessages) ? fieldMessages : [String(fieldMessages)];
      for (const raw of list) {
        const friendly = friendlyValidationMessage(field, String(raw));
        if (friendly) messages.add(friendly);
      }
    }
    if (messages.size > 0) return Array.from(messages).join(' ');
    return 'Please check the highlighted fields and try again.';
  }
  return data?.message || data?.title || fallback;
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
      throw new ApiError(response.status, extractErrorMessage(data, 'Request failed'));
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
        throw new ApiError(response.status, extractErrorMessage(data, 'Upload failed'));
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to connect to server');
    }
  },
};

