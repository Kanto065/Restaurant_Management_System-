/**
 * API Configuration
 * Base URL comes from the environment (VITE_API_BASE_URL) so the same build
 * can point at local/staging/production backends without a code change.
 */

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
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
