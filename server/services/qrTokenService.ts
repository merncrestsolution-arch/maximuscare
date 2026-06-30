import crypto from "crypto";
import type { OrganizationId } from "@shared/branchAccess";

/**
 * Signed patient QR tokens.
 *
 * A patient QR encodes a tamper-proof HMAC-signed payload — never the raw patient
 * ID — so a scanned code cannot be forged to pull another patient (or another
 * organization's patient) record. The payload carries the patient's organization
 * and home branch so the scan endpoint can reject cross-org/cross-branch scans.
 */
const QR_SECRET =
  process.env.QR_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  "maximus-dev-secret-change-in-production";

/** QR tokens are long-lived (physical cards) but still expire to bound tampering risk. */
const QR_TTL_SEC = Number(process.env.QR_TOKEN_TTL_SEC || 365 * 24 * 60 * 60); // 1 year

export interface QrTokenPayload {
  patientId: string;
  organizationId: OrganizationId;
  branchId: string | null;
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return crypto.createHmac("sha256", QR_SECRET).update(body).digest("base64url");
}

export interface SignQrInput {
  patientId: string;
  organizationId: OrganizationId;
  branchId: string | null;
}

/** Produce a compact `<payload>.<sig>` token to encode in the patient QR code. */
export function signPatientQrToken(input: SignQrInput): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: QrTokenPayload = {
    patientId: input.patientId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    iat: now,
    exp: now + QR_TTL_SEC,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export type QrVerifyError = "invalid" | "expired";

export interface QrVerifyResult {
  ok: boolean;
  payload?: QrTokenPayload;
  error?: QrVerifyError;
}

/** Verify a scanned token: structural validity, signature, then expiry. */
export function verifyPatientQrToken(token: string): QrVerifyResult {
  const raw = String(token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "invalid" };
  }
  const [body, sig] = parts;
  const expected = sign(body);
  // Constant-time comparison to avoid signature-timing oracles.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, error: "invalid" };
  }
  let payload: QrTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QrTokenPayload;
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!payload.patientId || !payload.organizationId) {
    return { ok: false, error: "invalid" };
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: "expired" };
  }
  return { ok: true, payload };
}
