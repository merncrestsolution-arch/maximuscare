import crypto from "crypto";

/**
 * Signed attendance-location short-link tokens.
 *
 * A location short-link encodes a tamper-proof HMAC-signed payload — never a raw,
 * sequential attendance ID — so the link cannot be guessed or enumerated to reveal
 * another staff member's captured check-in location. Each token is strictly scoped
 * to ONE attendance record. The token only resolves which record to load; the
 * endpoint that consumes it still enforces RBAC (Admin/MD only) on its own, so a
 * valid token alone never bypasses authorization.
 *
 * Per product decision the links are indefinite (valid as long as the attendance
 * record exists), so no expiry is embedded. The HMAC signature is the sole
 * unguessability boundary.
 */
const LOCATION_LINK_SECRET =
  process.env.ATTENDANCE_LOCATION_TOKEN_SECRET ||
  process.env.QR_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  "maximus-dev-secret-change-in-production";

export interface AttendanceLocationTokenPayload {
  /** The attendance record this link reveals the location of. */
  attendanceId: string;
  iat: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return crypto.createHmac("sha256", LOCATION_LINK_SECRET).update(body).digest("base64url");
}

/** Produce a compact `<payload>.<sig>` token for a single attendance record's location. */
export function signAttendanceLocationToken(attendanceId: string): string {
  const payload: AttendanceLocationTokenPayload = {
    attendanceId,
    iat: Math.floor(Date.now() / 1000),
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export interface AttendanceLocationVerifyResult {
  ok: boolean;
  payload?: AttendanceLocationTokenPayload;
}

/** Verify a location short-link token: structural validity then signature. */
export function verifyAttendanceLocationToken(token: string): AttendanceLocationVerifyResult {
  const raw = String(token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false };
  }
  const [body, sig] = parts;
  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  // Constant-time comparison to avoid signature-timing oracles.
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false };
  }
  let payload: AttendanceLocationTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AttendanceLocationTokenPayload;
  } catch {
    return { ok: false };
  }
  if (!payload.attendanceId) {
    return { ok: false };
  }
  return { ok: true, payload };
}
