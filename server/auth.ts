import type { Request, Response, NextFunction } from "express";
import type { OrganizationId } from "@shared/branchAccess";
import { storage } from "./storage";
import { hasPermission, type Permission } from "./rbac/permissions";
import { getAccessTokenFromRequest } from "./helpers/authCookies";
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshExpiresAt,
} from "./services/jwtService";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStaffActive(staff: { isActive?: boolean | number | null }): boolean {
  return staff.isActive !== false && staff.isActive !== 0;
}

export interface SessionUser {
  staffId: string;
  email: string;
  role: string;
  selectedBranchId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  organizationId?: OrganizationId | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export async function createSession(staffId: string, email: string, role: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await storage.createAuthSession({ id: sessionId, staffId, email, role, expiresAt });
  return sessionId;
}

export async function issueAuthTokens(staffId: string, email: string, role: string): Promise<AuthTokens> {
  const sessionId = await createSession(staffId, email, role);
  const accessToken = signAccessToken({ sub: staffId, sid: sessionId, role, email });
  const refreshToken = generateRefreshToken();
  await storage.createRefreshToken({
    staffId,
    sessionId,
    tokenHash: hashToken(refreshToken),
    expiresAt: getRefreshExpiresAt(),
  });
  return { accessToken, refreshToken, sessionId };
}

export async function refreshAuthTokens(refreshToken: string): Promise<AuthTokens | null> {
  const row = await storage.getValidRefreshToken(hashToken(refreshToken));
  if (!row) return null;
  const staff = await storage.getStaff(row.staffId);
  if (!staff || !isStaffActive(staff)) {
    await storage.revokeRefreshToken(row.id);
    return null;
  }

  const previousSession = row.sessionId
    ? await storage.getAuthSession(row.sessionId)
    : undefined;

  await storage.revokeRefreshToken(row.id);
  const tokens = await issueAuthTokens(staff.id, staff.email, staff.role);

  if (previousSession?.selectedBranchId) {
    await storage.updateAuthSessionBranch(tokens.sessionId, previousSession.selectedBranchId);
  } else if (previousSession?.selectedContext) {
    await storage.updateAuthSessionContext(tokens.sessionId, previousSession.selectedContext);
  }

  if (row.sessionId && row.sessionId !== tokens.sessionId) {
    await storage.deleteAuthSession(row.sessionId);
  }

  return tokens;
}

async function resolveUserFromSessionId(sessionId: string): Promise<SessionUser | null> {
  const row = await storage.getAuthSession(sessionId);
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await storage.deleteAuthSession(sessionId);
    return null;
  }
  const staff = await storage.getStaff(row.staffId);
  if (!staff || !isStaffActive(staff)) {
    await storage.deleteAuthSession(sessionId);
    return null;
  }
  return {
    staffId: row.staffId,
    email: staff.email,
    role: staff.role,
    selectedBranchId: (row as { selectedBranchId?: string | null }).selectedBranchId ?? null,
    branchId: (row as { selectedBranchId?: string | null }).selectedBranchId ?? null,
  };
}

export async function getSession(sessionId: string): Promise<SessionUser | null> {
  return resolveUserFromSessionId(sessionId);
}

async function resolveBearerToken(token: string): Promise<{ user: SessionUser; sessionId: string } | null> {
  if (token.includes(".")) {
    const payload = verifyAccessToken(token);
    if (!payload) return null;
    const user = await resolveUserFromSessionId(payload.sid);
    if (!user || user.staffId !== payload.sub) return null;
    return { user, sessionId: payload.sid };
  }
  const user = await resolveUserFromSessionId(token);
  if (!user) return null;
  return { user, sessionId: token };
}

export async function destroySession(sessionId: string): Promise<void> {
  await storage.deleteAuthSession(sessionId);
  await storage.revokeRefreshTokensForSession(sessionId);
}

export async function purgeExpiredSessions(): Promise<void> {
  await storage.deleteExpiredAuthSessions();
  await storage.purgeExpiredRefreshTokens();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: "Login expired. Please re-login." });
  }
  resolveBearerToken(token)
    .then((result) => {
      if (!result) {
        return res.status(401).json({ message: "Login expired. Please re-login." });
      }
      (req as any).user = result.user;
      (req as any).sessionId = result.sessionId;
      next();
    })
    .catch(() => res.status(500).json({ message: "Authentication error" }));
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as SessionUser | undefined;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as SessionUser | undefined;
    if (!user) {
      return res.status(401).json({ message: "Login expired. Please re-login." });
    }
    const allowed = permissions.some((p) => hasPermission(user.role, p));
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}
