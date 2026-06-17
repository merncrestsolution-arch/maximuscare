import express, { type Express, type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";

export function createBaseApp(): { app: Express; httpServer: Server } {
  const app = express();
  const httpServer = createServer(app);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const jsonLimit = process.env.JSON_BODY_LIMIT || "1mb";
  app.use(
    express.json({
      limit: jsonLimit,
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: unknown }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  if (process.env.NODE_ENV !== "test") {
    const globalLimiter = rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again later." },
    });
    app.use("/api", globalLimiter);
  }

  app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    if (res.headersSent) return next(err);
    return res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  return { app, httpServer };
}

export async function setupApiRoutes(app: Express, httpServer: Server): Promise<void> {
  await registerRoutes(httpServer, app);
}
