import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Use process.cwd() for build (reliable when run from project root); fallback for dev
const projectRoot = process.cwd();
const clientRoot = path.join(projectRoot, "client");
const distClient = path.join(projectRoot, "dist", "client");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.join(projectRoot, "client", "src"),
      "@shared": path.join(projectRoot, "shared"),
      "@assets": path.join(projectRoot, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: clientRoot,
  build: {
    outDir: distClient,
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
