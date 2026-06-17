import type { Response } from "express";
import type { PaginationMeta } from "./helpers/pagination";

export function successResponse<T>(res: Response, data: T, message = "Operation completed successfully", status = 200) {
  return res.status(status).json({ success: true, message: message || "Operation completed successfully", data });
}

export function errorResponse(
  res: Response,
  message: string,
  status = 400,
  errors: string[] = [],
) {
  return res.status(status).json({ success: false, message, errors });
}

export function paginatedResponse<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message = "Operation completed successfully",
) {
  return res.status(200).json({ success: true, message, data, pagination });
}

/** Unwrap `{ success, data }` or return raw payload for backward-compatible clients. */
export function unwrapApiData<T>(res: T | { success?: boolean; data?: T }): T {
  if (res && typeof res === "object" && "data" in (res as object)) {
    return (res as { data: T }).data;
  }
  return res as T;
}
