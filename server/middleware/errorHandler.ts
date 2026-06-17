import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { errorResponse } from "../response";
import { AppError } from "./errors";
import { logSystemError } from "../services/loggerService";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    if (err.status >= 500) {
      void logSystemError({
        message: err.message,
        category: "api",
        userId: (req as any).user?.staffId,
        ipAddress: req.ip,
        stackTrace: err.stack,
      });
    }
    return errorResponse(res, err.message, err.status, err.errors);
  }

  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return errorResponse(res, "Validation failed", 400, errors);
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  void logSystemError({
    message,
    category: "api",
    userId: (req as any).user?.staffId,
    ipAddress: req.ip,
    stackTrace: err instanceof Error ? err.stack : undefined,
  });

  console.error("[ERROR]", err);
  return errorResponse(res, process.env.NODE_ENV === "production" ? "Internal Server Error" : message, 500);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
