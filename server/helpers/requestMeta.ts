import type { Request } from "express";

export function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? "";
  return req.socket.remoteAddress ?? "";
}

export function getUserAgent(req: Request): string {
  return String(req.headers["user-agent"] ?? "").slice(0, 512);
}
