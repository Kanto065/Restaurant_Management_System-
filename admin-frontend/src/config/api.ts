/**
 * API Configuration
 * Base URL comes from the environment (VITE_API_BASE_URL) so the same build
 * can point at local/staging/production backends without a code change.
 */

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
} as const;

export const API_BASE_URL = API_CONFIG.BASE_URL;

// GitHub's "latest release" alias always resolves to whatever release
// android-release.yml most recently published under this exact asset name -
// no code change needed here when a new POS build ships.
export const POS_APP_DOWNLOAD_URL =
  'https://github.com/Kanto065/Restaurant_Management_System-/releases/latest/download/porttennanttandoori-pos.apk';

export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${API_BASE_URL}/${cleanPath}`;
};
