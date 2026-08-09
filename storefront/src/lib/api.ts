// Same-origin by default (relative paths) so the backend's tenant-resolution
// middleware sees the storefront's real Host header, not a shared platform API host.
// Dev proxies /api and /hubs to the local backend (see vite.config.ts).
const CUSTOMER_TOKEN_KEY = 'customer_token';

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

interface Envelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(endpoint, { ...options, headers });
  const body: Envelope<T> = await response.json();

  if (!response.ok || !body.success) {
    throw new ApiError(response.status, body.message || 'Request failed');
  }

  return body.data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};

export const customerAuth = {
  getToken: () => localStorage.getItem(CUSTOMER_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, accessToken);
    localStorage.setItem('customer_refresh_token', refreshToken);
  },
  clear: () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem('customer_refresh_token');
  },
  isLoggedIn: () => !!localStorage.getItem(CUSTOMER_TOKEN_KEY),
};
