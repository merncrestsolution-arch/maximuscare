import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "maximus-dev-secret-change-in-production";
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 900); // 15 min
const REFRESH_TTL_MS = Number(process.env.JWT_REFRESH_TTL_MS || 7 * 24 * 60 * 60 * 1000);

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: string;
  email: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  type: "refresh";
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signSegment(data: object): string {
  return base64url(JSON.stringify(data));
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  const header = signSegment({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const body = signSegment({ ...payload, type: "access", iat: now, exp: now + ACCESS_TTL_SEC });
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") return null;
  return payload;
}

function verifyToken<T extends { exp?: number; type?: string }>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshExpiresAt(): Date {
  return new Date(Date.now() + REFRESH_TTL_MS);
}

export { ACCESS_TTL_SEC, REFRESH_TTL_MS };
