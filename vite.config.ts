import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Use process.cwd() for build (reliable when run from project root); fallback for dev
const projectRoot = process.cwd();
const clientRoot = path.join(projectRoot, "client");
const distClient = path.join(projectRoot, "dist", "client");

// Unique identifier for this build. Prefer the Vercel commit SHA so each
// deployment produces a new value; fall back to a timestamp for local builds.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString();

// Emits a `version.json` into the build output so the running client can poll
// it and detect when a newer deployment is live.
function appVersionPlugin(): Plugin {
  return {
    name: "app-version-json",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: buildId }),
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildId),
  },
  plugins: [react(), tailwindcss(), appVersionPlugin()],
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
      "/ws": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5000",
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
