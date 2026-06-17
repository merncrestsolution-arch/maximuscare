import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { errorResponse } from "../response";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      return errorResponse(res, "Validation failed", 400, errors);
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      return errorResponse(res, "Validation failed", 400, errors);
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}
