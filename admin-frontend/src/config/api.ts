/**
 * API Configuration
 * Deployed builds call the API same-origin ('' -> /api/..., proxied by Caddy on each admin
 * host), so one build serves every restaurant's admin domain and the backend resolves the
 * restaurant from the Host header. VITE_API_BASE_URL is only set for local dev.
 */

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
} as const;

export const API_BASE_URL = API_CONFIG.BASE_URL;

// Self-hosted instead of GitHub's "latest release" alias - that stops being publicly
// downloadable once this repo goes private, and needs no auth token this way. Same-origin
// relative path: Caddy proxies /download/pos straight to the MinIO object android-release.yml
// re-publishes on every POS build (see deploy/caddy/Caddyfile).
export const POS_APP_DOWNLOAD_URL = '/download/pos';

export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${API_BASE_URL}/${cleanPath}`;
};
