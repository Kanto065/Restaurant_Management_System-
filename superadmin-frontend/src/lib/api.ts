// Same-origin: Caddy proxies /api on superadmin.porttennanttandoori.co.uk (vite proxies it in dev).

const TOKEN_KEY = 'platform_token';
const EXPIRES_KEY = 'platform_token_expires';

export interface ApiResponse<T> {
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

export function getToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expires = localStorage.getItem(EXPIRES_KEY);
    if (!token || !expires || new Date(expires) <= new Date()) return null;
    return token;
  } catch {
    return null;
  }
}

export function setToken(token: string, expiresAt: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, expiresAt);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && token) {
    clearToken();
    window.location.assign('/login');
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const errors = json?.errors && typeof json.errors === 'object'
      ? Object.values(json.errors).flat().join(' ')
      : null;
    throw new ApiError(response.status, errors || json?.message || json?.title || `Request failed (${response.status})`);
  }
  return (json as ApiResponse<T>).data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// ---- Types mirroring backend-dotnet Controllers/PlatformAdmin DTOs ----

export type DomainKind = 'Storefront' | 'Admin';
export type StaffRole = 'Owner' | 'Manager' | 'Staff' | 'KitchenDisplay';

export interface TenantDomain {
  id: string;
  host: string;
  kind: DomainKind;
  isPrimary: boolean;
}

export interface TenantStaff {
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
}

export interface TenantSummary {
  restaurantId: string;
  organizationId: string;
  name: string;
  slug: string;
  city: string;
  isActive: boolean;
  domains: TenantDomain[];
  orderCount: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface TenantDetail {
  restaurantId: string;
  organizationId: string;
  name: string;
  slug: string;
  isActive: boolean;
  addressLine1: string;
  city: string;
  postcode: string;
  phone: string | null;
  email: string | null;
  domains: TenantDomain[];
  staff: TenantStaff[];
  orderCount: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  email: string;
  fullName: string;
}

export interface PaymentSettings {
  isEnabled: boolean;
  useConfigAccount: boolean;
  publishableKey: string | null;
  secretKeyLast4: string | null;
  hasWebhookSecret: boolean;
  mode: 'test' | 'live' | 'unreadable' | null;
  activeAccount: 'Restaurant' | 'Config' | 'None';
  webhookUrl: string;
  encryptionConfigured: boolean;
  configAccountAvailable: boolean;
}
