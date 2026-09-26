import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Star Spice's own storefront. Data layer (API client, queries, basket store, types) is shared
// with the Port Tennant storefront via the @shared alias, so both stay in step with the backend;
// only the look is Star Spice's. `dedupe` makes those shared files resolve react/react-query/
// zustand from THIS app's node_modules (one React, one QueryClient context).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(import.meta.dirname, '../storefront/src') },
    dedupe: ['react', 'react-dom', '@tanstack/react-query', 'zustand', 'dompurify'],
  },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://localhost:5029', changeOrigin: false },
      '/uploads': { target: 'http://localhost:5029', changeOrigin: false },
    },
  },
})
