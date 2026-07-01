// Serverless entry for Vercel. Bundled by script/build-vercel.ts into a single
// self-contained CommonJS file (dist/vercel-server.cjs) that api/index.js loads.
//
// vercelEnv MUST be imported first so the database URL is normalized before db.ts
// is evaluated.
import "./vercelEnv";

import type { IncomingMessage, ServerResponse } from "http";
import { createBaseApp, setupApiRoutes } from "./createApp";
import {
  ensureSqliteSchemaCompatibility,
  ensurePostgresSchemaCompatibility,
} from "./db";
import { seedDefaultUsers } from "./seed";
import { storage } from "./storage";

type ExpressApp = (req: IncomingMessage, res: ServerResponse) => void;

let appPromise: Promise<ExpressApp> | null = null;

async function getApp(): Promise<ExpressApp> {
  if (!appPromise) {
    appPromise = (async () => {
      // Idempotent: safe to re-run on every cold start.
      const { ensurePostgresBootColumns } = await import("./pgBootstrap");
      await ensurePostgresBootColumns();
      await ensureSqliteSchemaCompatibility();
      await ensurePostgresSchemaCompatibility();
      await seedDefaultUsers();
      await storage.seedEnterpriseBranches();

      // One-time "What's New" broadcast for the current release. Must be awaited
      // here: Vercel freezes the function once a response is sent, so a
      // fire-and-forget task is not guaranteed to finish. It's idempotent and
      // only sends once per release version, so awaiting on cold start is safe.
      try {
        const { announceAppUpdateIfNeeded } = await import(
          "./services/appUpdateService"
        );
        await announceAppUpdateIfNeeded(storage);
      } catch (err) {
        console.error("[appUpdate] serverless announcement failed:", err);
      }

      const { app, httpServer } = createBaseApp();
      await setupApiRoutes(app, httpServer);
      return app as unknown as ExpressApp;
    })().catch((err) => {
      // Reset so the next request retries init instead of caching a broken state.
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app(req, res);
  } catch (err) {
    console.error("[api] Failed to initialize serverless backend:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        message:
          "Backend initialization failed. Check that the database (DATABASE_URL / POSTGRES_URL) is set and reachable.",
      })
    );
  }
}
