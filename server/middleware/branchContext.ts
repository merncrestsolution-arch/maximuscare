import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import {
  resolveBranchAccessContext,
  assertBranchAccess,
  type BranchAccessContext,
} from "../services/branchService";
import { organizationForBranch, type OrganizationId } from "@shared/branchAccess";

export interface AuthenticatedRequest extends Request {
  user?: {
    staffId: string;
    email: string;
    role: string;
    branchId?: string | null;
    branchName?: string | null;
    organizationId?: OrganizationId | null;
  };
  sessionId?: string;
  branchContext?: BranchAccessContext;
}

export async function loadBranchContext(req: AuthenticatedRequest): Promise<BranchAccessContext | null> {
  const user = req.user;
  const sessionId = req.sessionId;
  if (!user || !sessionId) return null;

  const session = await storage.getAuthSession(sessionId);
  const ctx = await resolveBranchAccessContext(
    storage,
    user.staffId,
    user.role,
    session
  );
  req.branchContext = ctx;
  if (req.user) {
    req.user.branchId = ctx.selectedBranchId ?? null;
    req.user.branchName = ctx.selectedBranchName ?? null;
    if (ctx.selectedBranchName) {
      req.user.organizationId = organizationForBranch(ctx.selectedBranchName);
    } else if (ctx.selectedContext === "nexus-overview") {
      req.user.organizationId = "nexus";
    } else if (ctx.selectedContext === "maximus-overview") {
      req.user.organizationId = "maximus";
    } else {
      req.user.organizationId = null;
    }
  }
  return ctx;
}

/** Attach branch context without requiring selection (for branch picker). */
export function attachBranchContext() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await loadBranchContext(req);
      next();
    } catch {
      res.status(500).json({ message: "Failed to load branch context" });
    }
  };
}

/** Require a selected branch for branch-isolated routes. */
export function requireBranchContext() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ctx = await loadBranchContext(req);
      if (!ctx?.selectedBranchId) {
        return res.status(403).json({
          message: "Branch selection required",
          code: "BRANCH_REQUIRED",
          allowedBranches: ctx?.allowedBranches ?? [],
        });
      }
      assertBranchAccess(ctx.selectedBranchId, ctx.allowedBranchIds);
      next();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Branch access denied";
      res.status(403).json({ message: msg, code: "BRANCH_FORBIDDEN" });
    }
  };
}

export function getSelectedBranchName(req: AuthenticatedRequest): string | null {
  return req.branchContext?.selectedBranchName ?? null;
}

export function getSelectedBranchId(req: AuthenticatedRequest): string | null {
  return req.branchContext?.selectedBranchId ?? null;
}

/** Branch name for filtering list/report endpoints (null = no filter for management overview). */
export function getBranchFilter(req: AuthenticatedRequest): string | null {
  return req.branchContext?.selectedBranchName ?? null;
}

/** Resolve branch name filter for list endpoints — always scoped to selected branch. */
export async function resolveBranchFilter(
  req: AuthenticatedRequest,
  explicitBranch?: string | null
): Promise<string | undefined> {
  if (explicitBranch) {
    const ctx = req.branchContext ?? (await loadBranchContext(req));
    const normalized = explicitBranch.trim().toLowerCase();
    const allowed = ctx?.allowedBranches.find(
      (b) =>
        b.name.toLowerCase() === normalized ||
        String(b.branchName ?? "").toLowerCase() === normalized ||
        String(b.code ?? "").toLowerCase() === normalized
    );
    if (!allowed) {
      throw new Error("Unauthorized Branch Access");
    }
    return allowed.branchName ?? allowed.name;
  }
  const ctx = req.branchContext ?? (await loadBranchContext(req));
  if (!ctx?.selectedBranchName) {
    throw new Error("Branch selection required");
  }
  return ctx.selectedBranchName;
}
