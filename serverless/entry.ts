import "dotenv/config";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { registerRoutes } from "../server/routes";
import {
  ensureSqliteSchemaCompatibility,
  ensurePostgresSchemaCompatibility,
} from "../server/db";
import { storage } from "../server/storage";
import { seedDefaultUsers } from "../server/seed";
import { purgeExpiredSessions } from "../server/auth";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// On Vercel the API runs as a serverless function: no listen(), no background
// timers, no WebSockets. The Express app is built once per warm container and
// reused across invocations.
let appPromise: Promise<Express> | null = null;

async function buildApp(): Promise<Express> {
  const app = express();
  const httpServer = createServer(app);

  // Vercel sits behind a proxy; trust it so client IPs / secure cookies work.
  app.set("trust proxy", 1);

  const isProduction = process.env.NODE_ENV === "production";
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              connectSrc: ["'self'", "https:"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const jsonLimit = process.env.JSON_BODY_LIMIT || "1mb";
  app.use(
    express.json({
      limit: jsonLimit,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 10 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
  });
  app.use("/api/auth/login", authLimiter);

  // One-time database preparation (idempotent: safe to re-run on each cold start).
  await ensureSqliteSchemaCompatibility();
  await ensurePostgresSchemaCompatibility();
  await seedDefaultUsers();
  await storage.seedEnterpriseBranches();
  await purgeExpiredSessions();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  return app;
}

function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = buildApp().catch((err) => {
      // Reset so the next request can retry after a failed cold start.
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
  } catch (err) {
    console.error("[serverless] Failed to initialize app:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        message:
          "Server failed to start. Check that DATABASE_URL (Postgres) and JWT_SECRET are set in the Vercel project.",
      }),
    );
  }
}
