/**
 * API Configuration
 * Change the base URL here to update it across the entire application
 */

export const API_CONFIG = {
  // BASE_URL: 'http://localhost:7878', // local
  BASE_URL: 'https://apitakeout.memobook.shop',
} as const;

export const API_BASE_URL = API_CONFIG.BASE_URL;

export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${API_BASE_URL}/${cleanPath}`;
};
