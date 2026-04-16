import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Client build output: dist/client (from vite build). When server runs from dist/index.cjs, __dirname is dist/
  const distPath = path.resolve(__dirname, "client");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to run 'npm run build:client' first`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback - serve index.html for non-API routes
  // Express 5 + path-to-regexp v8 require named wildcards: use /{*splat} instead of *
  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
