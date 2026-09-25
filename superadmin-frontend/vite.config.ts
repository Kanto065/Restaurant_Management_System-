import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// The panel calls /api same-origin (Caddy proxies it in prod); in dev, proxy to the local API.
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8090,
    proxy: {
      "/api": { target: "http://localhost:5029", changeOrigin: false },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
