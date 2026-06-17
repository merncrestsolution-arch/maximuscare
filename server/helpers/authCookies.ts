import type { Request, Response } from "express";

const ACCESS_COOKIE = "maximus_access";
const REFRESH_COOKIE = "maximus_refresh";
const isProduction = process.env.NODE_ENV === "production";

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}

export function getAccessTokenFromRequest(req: Request): string | undefined {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (bearer) return bearer;
  return parseCookies(req)[ACCESS_COOKIE];
}

export function getRefreshTokenFromRequest(req: Request): string | undefined {
  const body = (req.body as { refreshToken?: string })?.refreshToken;
  if (body) return body;
  return parseCookies(req)[REFRESH_COOKIE];
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const base = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
  res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response): void {
  const base = { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/" };
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}
