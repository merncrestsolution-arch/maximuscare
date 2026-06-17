import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "../storage";
import { createSession, destroySession, getSession } from "../auth";
import { validatePasswordForContext } from "../validators/passwordPolicy";
import { sanitizeEmail } from "../helpers/sanitize";
import { logAuthAttempt } from "./loggerService";
import { AppError } from "../middleware/errors";

const REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function loginUser(params: {
  email: string;
  password: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
}) {
  const email = sanitizeEmail(params.email);
  if (!email || !params.password) {
    throw AppError.validation("Email and password required");
  }

  const staff = await storage.getStaffByEmail(email);
  if (!staff?.password) {
    logAuthAttempt({ email, success: false, ipAddress: params.ipAddress, reason: "unknown user" });
    throw AppError.unauthorized("Invalid credentials");
  }
  if (staff.isActive === false || (staff.isActive as unknown) === 0) {
    logAuthAttempt({ email, success: false, ipAddress: params.ipAddress, reason: "deactivated" });
    throw new AppError("Staff account is deactivated. Contact Admin/MD.", 403);
  }

  const valid = await bcrypt.compare(params.password, staff.password);
  if (!valid) {
    logAuthAttempt({ email, success: false, ipAddress: params.ipAddress, reason: "bad password" });
    throw AppError.unauthorized("Invalid credentials");
  }

  const sessionId = await createSession(staff.id, staff.email, staff.role, {
    rememberMe: params.rememberMe,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  logAuthAttempt({ email, success: true, ipAddress: params.ipAddress });
  const { password: _, ...user } = staff;
  return { user, sessionId };
}

export async function logoutUser(sessionId: string) {
  await destroySession(sessionId);
}

export async function logoutAllDevices(staffId: string) {
  await storage.deleteAllAuthSessionsForStaff(staffId);
}

export async function requestPasswordReset(email: string): Promise<{ token?: string; message: string }> {
  const staff = await storage.getStaffByEmail(sanitizeEmail(email));
  if (!staff) {
    return { message: "If the email exists, a reset link will be sent." };
  }
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await storage.createPasswordResetToken({
    staffId: staff.id,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  // Email integration optional — return token in dev only
  if (process.env.NODE_ENV !== "production") {
    return { message: "Reset token created (dev only)", token: rawToken };
  }
  return { message: "If the email exists, a reset link will be sent." };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const check = validatePasswordForContext(newPassword);
  if (!check.valid) throw AppError.validation("Password policy failed", check.errors);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await storage.getValidPasswordResetToken(tokenHash);
  if (!row) throw AppError.validation("Invalid or expired reset token");

  const hashed = await bcrypt.hash(newPassword, 10);
  await storage.updateStaff(row.staffId, { password: hashed } as any);
  await storage.markPasswordResetTokenUsed(row.id);
  await storage.deleteAllAuthSessionsForStaff(row.staffId);
}

export async function changePassword(
  staffId: string,
  currentPassword: string,
  newPassword: string,
  opts?: { skipCurrentCheck?: boolean },
) {
  const check = validatePasswordForContext(newPassword);
  if (!check.valid) throw AppError.validation("Password policy failed", check.errors);

  const staff = await storage.getStaff(staffId);
  if (!staff) throw AppError.notFound("Staff not found");

  if (!opts?.skipCurrentCheck) {
    const valid = await bcrypt.compare(currentPassword, staff.password);
    if (!valid) throw AppError.unauthorized("Current password is incorrect");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await storage.updateStaff(staffId, { password: hashed } as any);
}

export async function getCurrentUser(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return null;
  const staff = await storage.getStaff(session.staffId);
  if (!staff) return null;
  const { password: _, ...user } = staff;
  return user;
}
