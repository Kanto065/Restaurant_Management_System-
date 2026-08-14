// Same-origin by default (relative paths) so the backend's tenant-resolution
// middleware sees the storefront's real Host header, not a shared platform API host.
// Dev proxies /api and /hubs to the local backend (see vite.config.ts).
const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_REFRESH_TOKEN_KEY = 'customer_refresh_token';

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

// Access tokens expire after 30 minutes (see JwtOptions.AccessTokenMinutes) - this
// dedupes concurrent 401s into a single /api/auth/refresh call and retries them once
// the new access token lands. If refresh itself fails, all callers fall through to logout.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(CUSTOMER_REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const body: Envelope<{ accessToken: string; refreshToken: string }> = await response.json();
        if (!response.ok || !body.success || !body.data) return null;

        localStorage.setItem(CUSTOMER_TOKEN_KEY, body.data.accessToken);
        localStorage.setItem(CUSTOMER_REFRESH_TOKEN_KEY, body.data.refreshToken);
        return body.data.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

async function request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(endpoint, { ...options, headers });

  if (response.status === 401 && !isRetry && localStorage.getItem(CUSTOMER_REFRESH_TOKEN_KEY)) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) return request<T>(endpoint, options, true);
    customerAuth.clear();
  }

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
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
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
