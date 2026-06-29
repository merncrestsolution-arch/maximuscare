import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db, schema } from "./db";
import bcrypt from "bcryptjs";
import { eq, desc } from "drizzle-orm";
import Decimal from "decimal.js";
import { isAutoFineSessionRole, syncAutoFineForStaffDate } from "./autoFineSync";
import { createSession, destroySession, requireAuth } from "./auth";
import { setAuthCookies, clearAuthCookies, getRefreshTokenFromRequest } from "./helpers/authCookies";
import { attachBranchContext, requireBranchContext, resolveBranchFilter, getBranchFilter, getSelectedBranchId } from "./middleware/branchContext";
import {
  requireCriticalDelete,
  requirePatientsManage,
  requireAppointmentsManage,
  requireStaffManage,
  requireVisitsManage,
  requireAttendanceManage,
  requireSettingsManage,
  requireInpatientsManage,
  requireExpensesManage,
  requireReportsView,
  requireSalaryManage,
} from "./middleware/secureApi";
import { filterByBranchName, resolveBranchIdByName } from "./services/branchService";
import { normalizeBranchName } from "@shared/branches";
import { hasFullBranchAccess } from "@shared/branchAccess";
import { registerAutoFineJobs, startScheduledJobs } from "./jobs/scheduler";
import { clinicDateString, clinicYesterdayString, clinicDateOffset } from "./clinicTime";
import { registerHrmRoutes } from "./routes/hrm";
import { ensureEmployeeCode } from "./services/staffService";
import {
  validateBranch,
  validatePaymentStatus,
  validateAttendanceStatus,
  computeNextSessionNumber,
} from "./services/calculationEngine";
import {
  canViewAllPatients,
  canViewAllVisits,
  canEditVisit,
  canEditAllVisits,
  canViewStaff,
  canViewStaffFinancials,
} from "./permissions";
import { hasPermission } from "./rbac/permissions";
import { registerExtendedRoutes } from "./routes/extended";
import { registerSalaryRoutes } from "./routes/salary";
import { registerPatientRoutes } from "./routes/patients";
import { generateUniquePatientCode, generatePatientCode, assertNoDuplicatePatient } from "./services/patientService";
import { syncHomeVisitFromVisit, detectHomeVisitType } from "./services/homeVisitService";
import { logAudit } from "./services/auditService";

async function auditActor(req: Request) {
  const user = (req as any).user;
  const editor = user?.staffId ? await storage.getStaff(user.staffId) : undefined;
  const fwd = req.headers["x-forwarded-for"];
  const ipAddress =
    typeof fwd === "string" ? fwd.split(",")[0]?.trim() : req.socket.remoteAddress ?? "";
  return { userId: user?.staffId ?? "", userName: editor?.name ?? "", ipAddress };
}

function requestIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return typeof fwd === "string" ? fwd.split(",")[0]?.trim() ?? "" : req.socket.remoteAddress ?? "";
}

function requestDevice(req: Request): string {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : "";
}

const {
  staff: staffTable,
  insertStaffSchema,
  updateStaffSchema,
  insertPatientSchema,
  updatePatientSchema,
  insertVisitSchema,
  updateVisitSchema,
  insertAttendanceSchema,
  updateAttendanceSchema,
  insertInPatientAdmissionSchema,
  updateInPatientAdmissionSchema,
  insertInPatientSessionSchema,
  updateInPatientSessionSchema,
  insertInPatientDischargeSchema,
  insertInPatientPaymentSchema,
  updateInPatientDischargeSchema,
  insertExpenseSchema,
  updateExpenseSchema,
  insertInPatientExtraExpenseSchema,
  updateInPatientExtraExpenseSchema,
  insertAppointmentSchema,
  updateAppointmentSchema,
  insertStaffFineSchema,
  updateStaffFineSchema,
} = schema;
import { z } from "zod";

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Bug 9: validate an admit date — must be a real date, not in the future, and not more
 * than one year in the past. Returns the normalized YYYY-MM-DD string when valid.
 */
function validateAdmitDate(input: unknown): { ok: true; date: string } | { ok: false; message: string } {
  const raw = String(input ?? "").trim().split("T")[0];
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, message: "Admit date must be a valid date (YYYY-MM-DD)." };
  }
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, message: "Admit date is not a valid calendar date." };
  }
  const today = clinicDateString();
  if (raw > today) {
    return { ok: false, message: "Admit date cannot be in the future." };
  }
  const oneYearAgo = clinicDateOffset(-365);
  if (raw < oneYearAgo) {
    return { ok: false, message: "Admit date cannot be more than one year in the past." };
  }
  return { ok: true, date: raw };
}

function normalizeAttachmentInput(value: unknown): string[] | string | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === "string" ? item : item == null ? "" : String(item)))
      .filter((item) => item.trim().length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map((item) => (typeof item === "string" ? item : item == null ? "" : String(item)))
            .filter((item) => item.trim().length > 0);
          return cleaned.length > 0 ? cleaned : undefined;
        }
      } catch {
        return undefined;
      }
    }
    return value;
  }
  return undefined;
}

function normalizeInPatientAdmissionBody(body: Record<string, unknown>) {
  const normalized = {
    ...body,
    reportsAttachments: normalizeAttachmentInput(body.reportsAttachments),
    idCopyAttachments: normalizeAttachmentInput(body.idCopyAttachments),
  };
  if (normalized.reportsAttachments === undefined) delete (normalized as any).reportsAttachments;
  if (normalized.idCopyAttachments === undefined) delete (normalized as any).idCopyAttachments;
  return normalized;
}

function parseJoinDateInput(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const normalized = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function joinDateString(value: unknown): string | null {
  const parsed = parseJoinDateInput(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function coerceBooleanField(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return Boolean(value);
}

/** Strip UI-only fields and coerce types before staff schema validation. */
function normalizeStaffBody(body: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...body };
  delete normalized.avatar;
  delete normalized.confirmPassword;
  delete normalized.id;
  delete normalized.joinDate;
  delete normalized.branchIds;
  if (normalized.isActive !== undefined) {
    normalized.isActive = coerceBooleanField(normalized.isActive);
  }
  if (normalized.basicSalary === "") {
    normalized.basicSalary = "0";
  }
  if (normalized.otherAdjustments === "") {
    normalized.otherAdjustments = "0";
  }
  if (normalized.salaryDate === "") {
    delete normalized.salaryDate;
  }
  return normalized;
}

function extractBranchIds(body: Record<string, unknown>): string[] | undefined {
  const raw = body.branchIds;
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

async function resolvePrimaryBranchLabel(branchIds: string[]): Promise<string | undefined> {
  if (branchIds.length === 0) return undefined;
  const all = await storage.getAllBranches();
  const selected = all.filter((b) => branchIds.includes(b.id));
  if (selected.length === 0) return undefined;
  if (selected.length === 1) {
    return selected[0].branchName ?? selected[0].name;
  }
  return "Both";
}

async function autoMarkMissingAttendanceForPreviousDay() {
  const date = clinicYesterdayString();
  const allStaff = await storage.getActiveStaff();
  const targetStaff = allStaff.filter((s) => !["Admin", "MD"].includes(s.role));

  for (const staff of targetStaff) {
    const existing = await storage.getAttendanceByStaffAndDate(staff.id, date);
    if (existing) continue;
    await storage.createAttendance({
      staffId: staff.id,
      staffName: staff.name,
      role: staff.role as any,
      date,
      status: "Absent",
    } as any);
  }
}

/** Reconcile auto fines for recent days (present + no session before noon). Runs on boot and daily. */
async function runAutoFineSweepForRecentDays() {
  const allStaff = await storage.getAllStaff();
  const sessionStaff = allStaff.filter((s) => isAutoFineSessionRole(s.role));
  const dates: string[] = [];
  for (let i = 0; i < 14; i++) {
    dates.push(clinicDateOffset(-i));
  }
  for (const s of sessionStaff) {
    for (const fineDate of dates) {
      await syncAutoFineForStaffDate(storage, s.id, fineDate);
    }
  }
}

/** Run auto-fine sweep for today only — scheduled at 12:00 PM clinic time. */
async function runAutoFineSweepForToday() {
  const today = clinicDateString();
  const allStaff = await storage.getAllStaff();
  const sessionStaff = allStaff.filter((s) => isAutoFineSessionRole(s.role));
  for (const s of sessionStaff) {
    await syncAutoFineForStaffDate(storage, s.id, today);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // WebSockets require a persistent server process. Vercel's serverless functions
  // don't keep one alive, so skip the WS hub there (realtime updates degrade to polling).
  const isServerless = !!process.env.VERCEL;
  if (!isServerless) {
    const { initWebSocketServer } = await import("./realtime/wsHub");
    initWebSocketServer(httpServer);
  }

  // Health check (for Render, Railway, etc.)
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      app: "Maximus Care",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    })
  );

  // ========== Authentication Routes ==========
  
  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const staff = await storage.getStaffByEmail(email);
      
      if (!staff || !staff.password) {
        await logAudit(storage, {
          userId: "",
          userName: email,
          module: "auth",
          action: "login_failed",
          ipAddress: requestIp(req),
          newValue: { email, reason: "unknown_account", device: requestDevice(req) },
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if ((staff as any).isActive === 0 || (staff as any).isActive === false) {
        await logAudit(storage, {
          userId: staff.id,
          userName: staff.name,
          module: "auth",
          action: "login_failed",
          recordId: staff.id,
          ipAddress: requestIp(req),
          newValue: { email, reason: "deactivated", device: requestDevice(req) },
        });
        return res.status(403).json({ message: "Staff account is deactivated. Contact Admin/MD." });
      }

      const isValidPassword = await bcrypt.compare(password, staff.password);
      
      if (!isValidPassword) {
        await logAudit(storage, {
          userId: staff.id,
          userName: staff.name,
          module: "auth",
          action: "login_failed",
          recordId: staff.id,
          ipAddress: requestIp(req),
          newValue: { email, reason: "bad_password", device: requestDevice(req) },
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const { issueAuthTokens } = await import("./auth");
      const tokens = await issueAuthTokens(staff.id, staff.email, staff.role);
      const { getAllowedBranchesForStaff } = await import("./services/branchService");
      const allowedBranches = await getAllowedBranchesForStaff(storage, staff.id, staff.role);

      await logAudit(storage, {
        userId: staff.id,
        userName: staff.name,
        module: "auth",
        action: "login",
        recordId: staff.id,
        ipAddress: requestIp(req),
        newValue: { email: staff.email, role: staff.role, device: requestDevice(req) },
      });

      const { password: _, ...userWithoutPassword } = staff;
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.json({
        user: userWithoutPassword,
        sessionId: tokens.sessionId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        allowedBranches: allowedBranches.map((b) => ({
          id: b.id,
          name: b.name,
          branchName: b.branchName,
          code: (b as { code?: string }).code,
        })),
        requiresBranchSelection: true,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get current user + branch context
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const sessionId = (req as any).sessionId;
      const staff = await storage.getStaff(user.staffId);
      if (!staff) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = staff;
      const { resolveBranchAccessContext, hasCompletedBranchSelection } = await import("./services/branchService");
      const session = sessionId ? await storage.getAuthSession(sessionId) : undefined;
      const branchContext = await resolveBranchAccessContext(
        storage,
        user.staffId,
        user.role,
        session
      );
      return res.json({
        ...userWithoutPassword,
        selectedBranchId: branchContext.selectedBranchId,
        selectedBranchName: branchContext.selectedBranchName,
        selectedContext: branchContext.selectedContext,
        allowedBranchIds: branchContext.allowedBranchIds,
        allowedBranches: branchContext.allowedBranches.map((b) => ({
          id: b.id,
          name: b.name,
          branchName: b.branchName,
          code: (b as { code?: string }).code,
        })),
        canAccessMaximusOverview: branchContext.canAccessMaximusOverview,
        canAccessNexusOverview: branchContext.canAccessNexusOverview,
        requiresBranchSelection: !hasCompletedBranchSelection(branchContext),
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // List allowed branches for current user
  app.get("/api/auth/branches", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { getAllowedBranchesForStaff } = await import("./services/branchService");
      const branches = await getAllowedBranchesForStaff(storage, user.staffId, user.role);
      return res.json(branches);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Select active branch after login
  app.post("/api/auth/select-branch", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const sessionId = (req as any).sessionId;
      const { branchId } = req.body;
      if (!branchId) {
        return res.status(400).json({ message: "branchId is required" });
      }
      const { getAllowedBranchesForStaff, assertBranchAccess } = await import("./services/branchService");
      const allowed = await getAllowedBranchesForStaff(storage, user.staffId, user.role);
      assertBranchAccess(branchId, allowed.map((b) => b.id));
      if (sessionId) {
        await storage.updateAuthSessionBranch(sessionId, branchId);
      }
      await storage.setUserDefaultBranch(user.staffId, branchId);
      const selected = allowed.find((b) => b.id === branchId);
      const { cacheDeletePrefix } = await import("./services/cacheService");
      await cacheDeletePrefix("dashboard:");
      return res.json({
        selectedBranchId: branchId,
        selectedBranchName: selected?.branchName ?? selected?.name ?? null,
        selectedContext: null,
        allowedBranches: allowed.map((b) => ({
          id: b.id,
          name: b.name,
          branchName: b.branchName,
          code: (b as { code?: string }).code,
        })),
        userRole: user.role,
      });
    } catch (error: any) {
      return res.status(403).json({ message: error.message || "Unauthorized Branch Access" });
    }
  });

  // Clear branch/overview selection (return to workspace picker)
  app.post("/api/auth/clear-workspace", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = (req as any).sessionId;
      if (sessionId) {
        await storage.clearAuthSessionSelection(sessionId);
      }
      return res.json({ requiresBranchSelection: true });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Select overview context (Maximus / Nexus) after login
  app.post("/api/auth/select-context", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const sessionId = (req as any).sessionId;
      const { context } = req.body;
      if (context !== "maximus-overview" && context !== "nexus-overview") {
        return res.status(400).json({ message: "Invalid overview context" });
      }
      const { assertOverviewAccess, getAllowedBranchesForStaff } = await import("./services/branchService");
      assertOverviewAccess(context, user.role);
      if (sessionId) {
        await storage.updateAuthSessionContext(sessionId, context);
      }
      const allowed = await getAllowedBranchesForStaff(storage, user.staffId, user.role);
      const { cacheDeletePrefix } = await import("./services/cacheService");
      await cacheDeletePrefix("dashboard:");
      return res.json({
        selectedBranchId: null,
        selectedBranchName: null,
        selectedContext: context,
        allowedBranches: allowed.map((b) => ({
          id: b.id,
          name: b.name,
          branchName: b.branchName,
          code: (b as { code?: string }).code,
        })),
        userRole: user.role,
      });
    } catch (error: any) {
      return res.status(403).json({ message: error.message });
    }
  });

  // Refresh JWT access token
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      if (!refreshToken) {
        return res.status(400).json({ message: "refreshToken is required" });
      }
      const { refreshAuthTokens } = await import("./auth");
      const tokens = await refreshAuthTokens(refreshToken);
      if (!tokens) {
        clearAuthCookies(res);
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, async (req: Request, res: Response) => {
    const sessionId = (req as any).sessionId;
    const actor = await auditActor(req);
    if (actor.userId) {
      await logAudit(storage, {
        ...actor,
        module: "auth",
        action: "logout",
        recordId: actor.userId,
        newValue: { device: requestDevice(req) },
      });
    }
    if (sessionId) {
      await destroySession(sessionId);
    }
    clearAuthCookies(res);
    return res.json({ message: "Logged out successfully" });
  });

  // ========== Staff Routes ==========
  registerHrmRoutes(app);

  // Get all staff. Management, operational leads, and receptionists get a
  // branch-scoped list (used for treating-staff/task dropdowns); other roles
  // only see themselves. Salary fields are stripped for non-financial roles.
  app.get("/api/staff", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const canSeeAll = canViewStaff(currentUser.role) || currentUser.role === "Receptionist";
      const { loadBranchContext, getSelectedBranchName } = await import("./middleware/branchContext");
      await loadBranchContext(req as any);
      const branchFilter = getSelectedBranchName(req as any);

      const sanitize = (staff: any) => {
        const { password, ...rest } = staff;
        if (!canViewStaffFinancials(currentUser.role)) {
          delete (rest as any).basicSalary;
          delete (rest as any).otherAdjustments;
          delete (rest as any).salaryDate;
        }
        return rest;
      };

      if (canSeeAll) {
        const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "true";
        const allStaff = await storage.getAllStaff();
        let filtered = includeInactive
          ? allStaff
          : allStaff.filter((s: any) => !(s.isActive === 0 || s.isActive === false));
        if (branchFilter) {
          const { filterStaffByBranchAccess } = await import("./services/staffService");
          filtered = await filterStaffByBranchAccess(storage, filtered, branchFilter);
        }

        // Scope Managers/Branch Managers/Receptionists to their allowed branches (Bug 6)
        const { hasFullBranchAccess } = await import("./shared/branchAccess");
        if (!hasFullBranchAccess(currentUser.role)) {
          const { getAllowedBranchesForStaff } = await import("./services/branchService");
          const allowed = await getAllowedBranchesForStaff(storage, currentUser.staffId, currentUser.role);
          const allowedNames = allowed.map((b) => b.branchName ?? b.name).filter(Boolean);
          const allowedIds = new Set(allowed.map((b) => b.id));
          const { staffMatchesBranch } = await import("./services/staffService");

          const scoped: any[] = [];
          for (const s of filtered) {
            const matchesByName = allowedNames.some((name) => staffMatchesBranch(s, name));
            if (matchesByName) {
              scoped.push(s);
              continue;
            }
            const targetPermissions = await storage.getUserBranchPermissions(s.id);
            const intersects = targetPermissions.some((p) => allowedIds.has(p.branchId));
            if (intersects) {
              scoped.push(s);
            }
          }
          filtered = scoped;
        }

        return res.json(filtered.map(sanitize));
      } else {
        const selfStaff = await storage.getStaff(currentUser.staffId);
        if (!selfStaff) {
          return res.json([]);
        }
        return res.json([sanitize(selfStaff)]);
      }
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Branch/organization-scoped clinical staff for treating-staff dropdowns
  // (Add Visit, Add Session, Appointment). Available to any authenticated user
  // who records visits/sessions — not just staff-directory viewers — because
  // every clinician needs to pick the treating staff for their branch.
  app.get("/api/staff/treating-options", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const { loadBranchContext } = await import("./middleware/branchContext");
      const ctx = await loadBranchContext(req as any);
      const { getTreatingStaffOptions } = await import("./services/staffService");
      const options = await getTreatingStaffOptions(storage, {
        selectedBranchName: ctx?.selectedBranchName ?? null,
        allowedBranches: ctx?.allowedBranches ?? [],
      });
      return res.json(options);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single staff (own profile or Admin/MD)
  app.get("/api/staff/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const currentUser = (req as any).user;

      // Allow user to view own profile, or staff-viewers (management/leads) to view any profile
      if (currentUser.staffId !== id && !canViewStaff(currentUser.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const staff = await storage.getStaff(id);
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }
      const branchPermissions = await storage.getUserBranchPermissions(id);

      // Bug 6: branch-scope non-management viewers (Manager/Branch Manager). They may only
      // view staff within their allowed branch(es); other-branch profiles return 403.
      if (currentUser.staffId !== id && !hasFullBranchAccess(currentUser.role)) {
        const { getAllowedBranchesForStaff } = await import("./services/branchService");
        const allowed = await getAllowedBranchesForStaff(storage, currentUser.staffId, currentUser.role);
        const allowedIds = new Set(allowed.map((b) => b.id));
        const targetBranchIds = branchPermissions.map((p) => p.branchId);
        const intersectsByPermission = targetBranchIds.some((t) => allowedIds.has(t));
        const { staffMatchesBranch } = await import("./services/staffService");
        const matchesByName = allowed.some((b) => staffMatchesBranch(staff, b.branchName ?? b.name));
        if (!intersectsByPermission && !matchesByName) {
          return res.status(403).json({ message: "You don't have access to this staff profile." });
        }
      }

      const { password: _, ...staffWithoutPassword } = staff;
      return res.json({
        ...staffWithoutPassword,
        branchIds: branchPermissions.map((p) => p.branchId),
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create staff (Admin and MD)
  app.post("/api/staff", requireAuth, requireStaffManage, async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const branchIds = extractBranchIds(body);
      const joiningDate = joinDateString((body as any)?.joinDate);
      const validatedData = insertStaffSchema.parse(normalizeStaffBody(body));
      
      // Check if email already exists
      const existingStaff = await storage.getStaffByEmail(validatedData.email);
      if (existingStaff) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const primaryBranch = branchIds?.length
        ? await resolvePrimaryBranchLabel(branchIds)
        : validatedData.branch;

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      const staff = await storage.createStaff({
        ...validatedData,
        password: hashedPassword,
        ...(primaryBranch ? { branch: primaryBranch } : {}),
        ...(joiningDate ? { joiningDate } : {}),
      } as any);

      const latest = await storage.getStaff(staff.id);
      const staffForResponse = latest || staff;
      await ensureEmployeeCode(storage, staffForResponse);

      if (branchIds && branchIds.length > 0) {
        await storage.syncStaffBranchAccess(staffForResponse.id, branchIds);
      }

      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "staff",
        action: "create",
        recordId: staffForResponse.id,
        newValue: staffForResponse,
      });

      const permissions = await storage.getUserBranchPermissions(staffForResponse.id);
      const { password: _, ...staffWithoutPassword } = staffForResponse;
      return res.status(201).json({
        ...staffWithoutPassword,
        branchIds: permissions.map((p) => p.branchId),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update staff (own profile or Admin)
  app.patch("/api/staff/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const currentUser = (req as any).user;
      const body = req.body as Record<string, unknown>;
      const branchIds = extractBranchIds(body);
      const joiningDate = joinDateString((body as any)?.joinDate);
      
      // Allow user to update own profile, or Admin/MD to update any profile
      if (currentUser.staffId !== id && !["Admin", "MD"].includes(currentUser.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const validatedData = updateStaffSchema.parse(normalizeStaffBody(body));
      const canManageOthers = ["Admin", "MD"].includes(currentUser.role);
      if (!canManageOthers) {
        delete (validatedData as any).isActive;
        delete (validatedData as any).basicSalary;
        delete (validatedData as any).salaryDate;
        delete (validatedData as any).otherAdjustments;
        delete (validatedData as any).photoUri;
        delete (validatedData as any).role;
        delete (validatedData as any).email;
        delete (validatedData as any).branch;
      }
      const beforeStaff = await storage.getStaff(id);
      const patch: Record<string, unknown> = { ...validatedData };
      if (joiningDate) patch.joiningDate = joiningDate;
      if (canManageOthers && branchIds && branchIds.length > 0) {
        const primaryBranch = await resolvePrimaryBranchLabel(branchIds);
        if (primaryBranch) patch.branch = primaryBranch;
      }
      if (canManageOthers && (validatedData as any).isActive !== undefined) {
        const nextActive = (validatedData as any).isActive === true || (validatedData as any).isActive === 1;
        if (!nextActive) {
          patch.deactivatedAt = new Date();
          patch.deactivatedBy = currentUser.staffId;
        } else {
          patch.deactivatedAt = null;
          patch.deactivatedBy = null;
        }
      }
      const staff = await storage.updateStaff(id, patch as any);
      
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }

      if (canManageOthers && branchIds && branchIds.length > 0) {
        await storage.syncStaffBranchAccess(id, branchIds);
      }

      if (beforeStaff && canManageOthers) {
        const actor = await auditActor(req);
        const action =
          (validatedData as any).isActive !== undefined &&
          beforeStaff.isActive !== staff.isActive
            ? staff.isActive ? "activate" : "deactivate"
            : "update";
        await logAudit(storage, {
          ...actor,
          module: "staff",
          action,
          recordId: id,
          oldValue: beforeStaff,
          newValue: staff,
        });
      }

      const permissions = await storage.getUserBranchPermissions(id);
      const { password: _, ...staffWithoutPassword } = staff;
      return res.json({
        ...staffWithoutPassword,
        branchIds: permissions.map((p) => p.branchId),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update staff password (Admin/MD only, or own password)
  app.patch("/api/staff/:id/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const { password, email } = req.body;
      const currentUser = (req as any).user;
      
      // Allow Admin/MD to update any password, or user to update own
      if (currentUser.staffId !== id && !["Admin", "MD"].includes(currentUser.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!password || password.length < 4) {
        return res.status(400).json({ message: "Password must be at least 4 characters" });
      }

      // Check if email is being changed and validate uniqueness
      if (email && ["Admin", "MD"].includes(currentUser.role)) {
        const existingStaff = await storage.getStaff(id);
        if (existingStaff && email !== existingStaff.email) {
          const emailExists = await storage.getStaffByEmail(email);
          if (emailExists) {
            return res.status(400).json({ message: "Email already in use" });
          }
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Build update data
      const updateData: any = { password: hashedPassword };
      if (email && ["Admin", "MD"].includes(currentUser.role)) {
        updateData.email = email;
      }

      const result = await db
        .update(staffTable)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(staffTable.id, id))
        .returning();

      if (!result.length) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const { password: _, ...staffWithoutPassword } = result[0];
      return res.json(staffWithoutPassword);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete staff (Admin only)
  app.delete("/api/staff/:id", requireAuth, requireStaffManage, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const beforeStaff = await storage.getStaff(id);
      const deleted = await storage.deleteStaff(id, (req as any).user?.staffId);
      if (!deleted) {
        return res.status(404).json({ message: "Staff not found" });
      }
      if (beforeStaff) {
        const actor = await auditActor(req);
        await logAudit(storage, {
          ...actor,
          module: "staff",
          action: "delete",
          recordId: id,
          oldValue: beforeStaff,
        });
      }
      return res.json({ message: "Staff deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Patient Routes ==========
  
  // Get all patients (optional pagination: ?page=1&limit=20&search=&status=&branch=)
  app.get("/api/patients", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const branchParam = req.query.branch as string | undefined;
      // `branch=all` lets pickers (e.g. Book Appointment) list patients across
      // every branch the user is allowed to see, instead of just the selected one.
      const allBranches =
        typeof branchParam === "string" && branchParam.trim().toLowerCase() === "all";
      const branch = allBranches
        ? undefined
        : await resolveBranchFilter(req as any, branchParam);
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const staffPatientIds = canViewAllPatients(currentUser.role)
        ? undefined
        : await storage.getPatientIdsForStaff(currentUser.staffId);

      if (page && limit) {
        const { parsePagination } = await import("./helpers/pagination");
        const { page: p, limit: l } = parsePagination({ page, limit });
        const result = await storage.getPatientsPaginated({
          branch,
          search,
          status,
          patientIds: staffPatientIds,
          page: p,
          limit: l,
        });
        return res.json({
          data: result.data,
          pagination: {
            page: p,
            limit: l,
            total: result.total,
            totalPages: Math.max(1, Math.ceil(result.total / l)),
          },
        });
      }

      let patientList;
      if (canViewAllPatients(currentUser.role)) {
        patientList = branch
          ? await storage.getPatientsByBranch(branch)
          : await storage.getAllPatients();
      } else {
        const all = await storage.getAllPatients();
        patientList = all.filter((p) => staffPatientIds!.includes(p.id));
        if (branch) {
          const target = normalizeBranchName(branch).toLowerCase();
          patientList = patientList.filter((p) => normalizeBranchName(p.branch).toLowerCase() === target);
        }
      }
      return res.json(patientList);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Preview next patient ID for a branch (must be registered before /api/patients/:id)
  app.get("/api/patients/next-id", requireAuth, requirePatientsManage, async (req: Request, res: Response) => {
    try {
      const registeredDate = String(req.query.date ?? "").trim() || undefined;
      const branch = String(req.query.branch ?? "").trim() || undefined;
      const patientCode = await generatePatientCode(storage, branch, registeredDate);
      return res.json({ patientCode });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  registerPatientRoutes(app);

  // Next out-patient session number for a patient. Computed as max+1 over ALL of
  // the patient's (non-deleted) visits so the New Visit form shows the same value
  // the server will store — independent of the requesting staff member's scope.
  app.get("/api/patients/:id/next-session-number", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getVisitsByPatient(param(req, "id"));
      const nextSessionNumber = computeNextSessionNumber(existing.map((v) => v.sessionNumber));
      return res.json({ nextSessionNumber });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single patient
  app.get("/api/patients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const id = param(req, "id");
      const patient = await storage.getPatient(id);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      if (!canViewAllPatients(currentUser.role)) {
        const ids = await storage.getPatientIdsForStaff(currentUser.staffId);
        if (!ids.includes(id)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      return res.json(patient);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create patient (Receptionist, Physiotherapist, Admin, MD)
  app.post("/api/patients", requireAuth, requirePatientsManage, async (req: Request, res: Response) => {
    try {
      const validatedData = insertPatientSchema.parse(req.body);
      if (typeof validatedData.phone === "string" && validatedData.phone.trim() === "") {
        validatedData.phone = null as any;
      }
      // Bug 7: appointment booking may reuse an existing phone number; the client passes
      // skipPhoneCheck so duplicate phones don't block a booking (NIC/Passport still checked).
      const skipPhoneCheck = (req.body as any)?.skipPhoneCheck === true;
      await assertNoDuplicatePatient(
        storage,
        validatedData.phone,
        (validatedData as any).nicOrPassport,
        undefined,
        { skipPhoneCheck }
      );
      const patientCode = await generateUniquePatientCode(storage, validatedData.branch, validatedData.registeredDate);
      const patient = await storage.createPatient({ ...validatedData, patientCode, fullName: validatedData.name } as any);
      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "patient",
        action: "create",
        recordId: patient.id,
        newValue: patient,
      });
      return res.status(201).json(patient);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update patient
  app.patch("/api/patients/:id", requireAuth, requirePatientsManage, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const beforePatient = await storage.getPatient(id);
      const validatedData = updatePatientSchema.parse(req.body);
      if (typeof validatedData.phone === "string" && validatedData.phone.trim() === "") {
        validatedData.phone = null as any;
      }
      if (validatedData.phone) {
        await assertNoDuplicatePatient(storage, validatedData.phone, (validatedData as any).nicOrPassport, id);
      }
      const patient = await storage.updatePatient(id, validatedData);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      if (beforePatient) {
        const actor = await auditActor(req);
        await logAudit(storage, {
          ...actor,
          module: "patient",
          action: "update",
          recordId: id,
          oldValue: beforePatient,
          newValue: patient,
        });
      }
      return res.json(patient);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete patient (Admin, MD) — cascades visits and appointments in storage to satisfy FK constraints
  app.delete("/api/patients/:id", requireAuth, requireCriticalDelete, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const beforePatient = await storage.getPatient(id);
      const deleted = await storage.deletePatient(id, (req as any).user?.staffId);
      if (!deleted) {
        return res.status(404).json({ message: "Patient not found" });
      }
      if (beforePatient) {
        const actor = await auditActor(req);
        await logAudit(storage, {
          ...actor,
          module: "patient",
          action: "delete",
          recordId: id,
          oldValue: beforePatient,
        });
      }
      return res.json({ message: "Patient deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to delete patient" });
    }
  });

  // ========== Visit Routes ==========
  
  // Unpaid visits — always visible until paid (ignores month filters)
  app.get("/api/visits/unpaid", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const staffId = canViewAllVisits(currentUser.role) ? undefined : currentUser.staffId;
      let unpaid = await storage.getUnpaidVisits(staffId);
      const branchFilter = getBranchFilter(req as any);
      if (branchFilter) unpaid = filterByBranchName(unpaid, branchFilter);
      return res.json(unpaid);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get all visits (optional ?page=&limit=&branch=)
  app.get("/api/visits", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const patientId = req.query.patientId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const branch = await resolveBranchFilter(req as any, req.query.branch as string | undefined);
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (page && limit) {
        const { parsePagination } = await import("./helpers/pagination");
        const { page: p, limit: l } = parsePagination({ page, limit });
        const staffId = canViewAllVisits(currentUser.role) ? undefined : currentUser.staffId;
        const result = await storage.getVisitsPaginated({
          patientId,
          startDate,
          endDate,
          branch,
          staffId,
          page: p,
          limit: l,
        });
        return res.json({
          data: result.data,
          pagination: {
            page: p,
            limit: l,
            total: result.total,
            totalPages: Math.max(1, Math.ceil(result.total / l)),
          },
        });
      }

      let visitList;
      if (canViewAllVisits(currentUser.role)) {
        if (patientId) {
          visitList = await storage.getVisitsByPatient(patientId);
        } else if (startDate && endDate) {
          visitList = await storage.getVisitsByDateRange(startDate, endDate);
        } else {
          visitList = await storage.getAllVisits();
        }
      } else {
        // Patient profile: all staff see the full visit history for that patient.
        if (patientId) {
          visitList = await storage.getVisitsByPatient(patientId);
          if (startDate && endDate) {
            visitList = visitList.filter((v) => v.visitDate >= startDate && v.visitDate <= endDate);
          }
        } else {
          visitList = await storage.getVisitsForStaffMember(currentUser.staffId);
          if (startDate && endDate) {
            visitList = visitList.filter((v) => v.visitDate >= startDate && v.visitDate <= endDate);
          }
        }
      }
      if (branch && !patientId) {
        visitList = visitList.filter(
          (v) => normalizeBranchName(v.branch).toLowerCase() === normalizeBranchName(branch).toLowerCase()
        );
      }

      return res.json(visitList);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single visit
  app.get("/api/visits/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const visit = await storage.getVisit(id);
      if (!visit) {
        return res.status(404).json({ message: "Visit not found" });
      }
      return res.json(visit);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create visit
  app.post("/api/visits", requireAuth, requireBranchContext(), requireVisitsManage, async (req: Request, res: Response) => {
    try {
      const incoming = { ...req.body } as Record<string, unknown>;
      const branchCheck = validateBranch(incoming.branch);
      if (!branchCheck.ok) {
        return res.status(400).json({ message: branchCheck.message });
      }
      incoming.branch = branchCheck.branch;
      const receivedPaymentAmount = incoming.paymentAmount;
      if (!incoming.paymentAmount) {
        incoming.paymentAmount = "0";
      } else {
        const amt = new Decimal(String(incoming.paymentAmount));
        if (amt.isNegative()) {
          incoming.paymentAmount = "0";
        } else {
          incoming.paymentAmount = amt.toString();
        }
      }
      const statusCheck = validatePaymentStatus(incoming.paymentStatus ?? "Unpaid");
      if (!statusCheck.ok) {
        return res.status(400).json({ message: statusCheck.message });
      }
      incoming.paymentStatus = statusCheck.status;
      if (!incoming.treatingStaffId) {
        return res.status(400).json({ message: "Staff assignment is required." });
      }
      // Bug 3: "Treatment provided" is mandatory for every visit (clinic and home).
      if (!incoming.treatment || String(incoming.treatment).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Treatment provided is required",
          field: "treatment",
        });
      }
      if (incoming.patientId) {
        const existing = await storage.getVisitsByPatient(String(incoming.patientId));
        incoming.sessionNumber = computeNextSessionNumber(existing.map((v) => v.sessionNumber));
      }
      if (!incoming.visitStatus) incoming.visitStatus = "Completed";
      if (!incoming.amountPaid) incoming.amountPaid = "0";
      const validatedData = insertVisitSchema.parse(incoming);
      const visit = await storage.createVisit(validatedData);
      
      if (receivedPaymentAmount !== undefined && String(receivedPaymentAmount) !== String(visit.paymentAmount)) {
        console.warn(`[WARNING] Payment amount mutated during save! Received: ${receivedPaymentAmount}, Stored: ${visit.paymentAmount}`);
      }
      if (visit.visitType === "Home") {
        const hvType = await detectHomeVisitType(
          storage,
          visit.treatingStaffId,
          visit.visitDate,
          visit.branch,
          (incoming.homeVisitType as string) || undefined
        );
        await storage.updateVisit(visit.id, { homeVisitType: hvType } as any);
        await syncHomeVisitFromVisit(storage, { ...visit, homeVisitType: hvType } as any, hvType);
      }
      const patient = await storage.getPatient(visit.patientId);
      if (patient && !patient.therapistFirstVisitId) {
        await storage.updatePatient(visit.patientId, {
          therapistFirstVisitId: visit.treatingStaffId,
          firstVisitDate: visit.visitDate,
        } as any);
      }
      await syncAutoFineForStaffDate(storage, visit.treatingStaffId, visit.visitDate);
      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "visit",
        action: "create",
        recordId: visit.id,
        newValue: visit,
      });
      const { invalidateOperationalCaches } = await import("./services/cacheService");
      await invalidateOperationalCaches();
      return res.status(201).json(visit);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update visit
  app.patch("/api/visits/:id", requireAuth, requireBranchContext(), requireVisitsManage, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const user = (req as any).user;
      const before = await storage.getVisit(id);
      if (!before) {
        return res.status(404).json({ message: "Visit not found" });
      }
      const canEdit = canEditVisit(user.role, user.staffId, before);
      if (!canEdit) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }
      const incoming = { ...req.body } as Record<string, unknown>;
      delete incoming.sessionNumber;

      // Bug 11/13: server-side field protection. Only Admin/MD may move a visit across
      // branches; non-management roles can never re-scope branch/organization. Staff /
      // physiotherapists (who can only reach their own visits) may not reassign the
      // treating clinician either.
      const isVisitManagement = ["Admin", "MD"].includes(user.role);
      if (!isVisitManagement) {
        delete incoming.branch;
        delete (incoming as any).branchId;
        delete (incoming as any).organizationId;
      }
      if (!canEditAllVisits(user.role)) {
        delete (incoming as any).treatingStaffId;
        delete (incoming as any).treatingStaffName;
        delete (incoming as any).createdByStaffId;
      }

      // Bug 3: when the treatment field is being updated it may not be blanked out.
      if (incoming.treatment !== undefined && String(incoming.treatment).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Treatment provided is required",
          field: "treatment",
        });
      }

      const receivedPaymentAmount = incoming.paymentAmount;
      if (incoming.paymentAmount !== undefined) {
        const amt = new Decimal(String(incoming.paymentAmount));
        if (amt.isNegative()) {
          incoming.paymentAmount = "0";
        } else {
          incoming.paymentAmount = amt.toString();
        }
      }

      if (incoming.branch !== undefined) {
        const branchCheck = validateBranch(incoming.branch);
        if (!branchCheck.ok) {
          return res.status(400).json({ message: branchCheck.message });
        }
        incoming.branch = branchCheck.branch;
      }
      if (incoming.paymentStatus !== undefined) {
        const statusCheck = validatePaymentStatus(incoming.paymentStatus);
        if (!statusCheck.ok) {
          return res.status(400).json({ message: statusCheck.message });
        }
        incoming.paymentStatus = statusCheck.status;
      }
      const validatedData = updateVisitSchema.parse(incoming);
      const {
        lastUpdatedByStaffId: _luSid,
        lastUpdatedByName: _luNm,
        ...restPatch
      } = validatedData as Record<string, unknown>;
      const editor = await storage.getStaff(user.staffId);
      const visit = await storage.updateVisit(id, {
        ...restPatch,
        lastUpdatedByStaffId: user.staffId,
        lastUpdatedByName: editor?.name ?? "",
      } as any);

      if (!visit) {
        return res.status(404).json({ message: "Visit not found" });
      }
      
      if (receivedPaymentAmount !== undefined && String(receivedPaymentAmount) !== String(visit.paymentAmount)) {
        console.warn(`[WARNING] Payment amount mutated during update! Received: ${receivedPaymentAmount}, Stored: ${visit.paymentAmount}`);
      }
      await syncAutoFineForStaffDate(storage, before.treatingStaffId, before.visitDate);
      await syncAutoFineForStaffDate(storage, visit.treatingStaffId, visit.visitDate);
      if (visit.visitType === "Home" || before.visitType === "Home") {
        const hvType = await detectHomeVisitType(
          storage,
          visit.treatingStaffId,
          visit.visitDate,
          visit.branch,
          (visit as { homeVisitType?: string }).homeVisitType
        );
        if (visit.visitType === "Home") {
          await storage.updateVisit(visit.id, { homeVisitType: hvType } as any);
          await syncHomeVisitFromVisit(storage, { ...visit, homeVisitType: hvType } as any, hvType);
        }
      }
      const actor = await auditActor(req);
      const financialFields = ["paymentAmount", "amountPaid", "paymentStatus"] as const;
      const financialChanges: Record<string, { from: unknown; to: unknown }> = {};
      for (const field of financialFields) {
        const oldVal = (before as Record<string, unknown>)[field];
        const newVal = (visit as Record<string, unknown>)[field];
        if (newVal !== undefined && String(oldVal ?? "") !== String(newVal ?? "")) {
          financialChanges[field] = { from: oldVal, to: newVal };
        }
      }
      if (Object.keys(financialChanges).length > 0) {
        await logAudit(storage, {
          ...actor,
          module: "visit_financial",
          action: "amount_change",
          recordId: id,
          oldValue: financialChanges,
          newValue: { updatedBy: editor?.name ?? user.staffId, changes: financialChanges },
        });
      }
      await logAudit(storage, {
        ...actor,
        module: "visit",
        action: "update",
        recordId: id,
        oldValue: before,
        newValue: visit,
      });
      const { invalidateOperationalCaches } = await import("./services/cacheService");
      await invalidateOperationalCaches();
      return res.json(visit);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete visit (Admin / MD only)
  app.delete("/api/visits/:id", requireAuth, requireCriticalDelete, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const before = await storage.getVisit(id);
      const deleted = await storage.deleteVisit(id, (req as any).user?.staffId);
      if (!deleted) {
        return res.status(404).json({ message: "Visit not found" });
      }
      if (before) {
        await syncAutoFineForStaffDate(storage, before.treatingStaffId, before.visitDate);
        const actor = await auditActor(req);
        await logAudit(storage, {
          ...actor,
          module: "visit",
          action: "delete",
          recordId: id,
          oldValue: before,
        });
      }
      return res.json({ message: "Visit deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Attendance Routes ==========
  
  // Get attendance records
  app.get("/api/attendance", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      await autoMarkMissingAttendanceForPreviousDay();
      const staffId = req.query.staffId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const month = req.query.month as string | undefined;
      const branch = (req.query.branch as string | undefined) ?? getBranchFilter(req as any) ?? undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const currentUser = (req as any).user;
      // Management and operational leads (Manager/Branch Manager/Nexus MD) may view team attendance.
      const isAdmin = canViewStaff(currentUser.role);

      // Attendance records historically were created without a branch, so we scope
      // by the *staff member's* branch (the reliable source) rather than the
      // attendance.branch column. Build the set of staff IDs in the active branch.
      let branchStaffIds: Set<string> | null = null;
      if (branch && isAdmin) {
        const { filterStaffByBranchAccess } = await import("./services/staffService");
        const allStaff = await storage.getAllStaff();
        const filteredStaff = await filterStaffByBranchAccess(storage, allStaff, branch);
        branchStaffIds = new Set(filteredStaff.map((s: any) => s.id));
        // Always include the requesting user's own records, even if their staff
        // branch is unset or differs from the selected branch — otherwise a
        // manager's own attendance (and check-out / OT) silently disappears from
        // history despite being marked.
        if (currentUser.staffId) branchStaffIds.add(currentUser.staffId);
      }

      if (page && limit) {
        const { parsePagination } = await import("./helpers/pagination");
        const { page: p, limit: l } = parsePagination({ page, limit });
        const effectiveStaffId =
          staffId && (isAdmin || currentUser.staffId === staffId) ? staffId : isAdmin ? staffId : currentUser.staffId;
        const result = await storage.getAttendancePaginated({
          staffId: effectiveStaffId,
          staffIds: branchStaffIds && !effectiveStaffId ? Array.from(branchStaffIds) : undefined,
          startDate,
          endDate,
          month,
          page: p,
          limit: l,
        });
        return res.json({
          data: result.data,
          pagination: {
            page: p,
            limit: l,
            total: result.total,
            totalPages: Math.max(1, Math.ceil(result.total / l)),
          },
        });
      }

      let attendance;

      if (month && staffId) {
        if (currentUser.staffId !== staffId && !isAdmin) {
          return res.status(403).json({ message: "Forbidden" });
        }
        attendance = await storage.getAttendanceByStaffAndMonth(staffId, month);
      } else if (staffId) {
        if (currentUser.staffId !== staffId && !isAdmin) {
          return res.status(403).json({ message: "Forbidden" });
        }
        attendance = await storage.getAttendanceByStaff(staffId);
      } else if (startDate && endDate) {
        if (isAdmin) {
          attendance = await storage.getAttendanceByDateRange(startDate, endDate);
        } else {
          attendance = await storage.getAttendanceByStaff(currentUser.staffId);
          attendance = attendance.filter((a: any) => {
            const d = a.date;
            return d >= startDate && d <= endDate;
          });
        }
      } else if (month) {
        if (isAdmin) {
          attendance = await storage.getAllAttendance();
        } else {
          attendance = await storage.getAttendanceByStaffAndMonth(currentUser.staffId, month);
        }
      } else {
        if (isAdmin) {
          attendance = await storage.getAllAttendance();
        } else {
          attendance = await storage.getAttendanceByStaff(currentUser.staffId);
        }
      }

      // Strictly scope admin/management cross-staff results to the active branch.
      if (branchStaffIds) {
        attendance = attendance.filter((a: any) => branchStaffIds!.has(a.staffId));
      }

      return res.json(attendance);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create attendance record
  app.post("/api/attendance", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const body = req.body;
      const todayStr = clinicDateString();

      const statusCheck = validateAttendanceStatus(body.status);
      if (!statusCheck.ok) {
        return res.status(400).json({ message: statusCheck.message });
      }
      const status = statusCheck.status;

      // Admin, MD and operational leads (Manager/Branch Manager/Nexus MD) may mark
      // attendance for other staff — mirrors the `attendance.manage` permission and
      // the UI, which exposes "Mark Staff Attendance" to those roles.
      const canManageOthers = hasPermission(currentUser.role, "attendance.manage");

      let targetStaffId: string;
      let targetStaffName: string;
      let targetRole: string;
      let targetBranch: string | null;
      let attendanceDate: string;

      if (canManageOthers && body.staffId && body.staffId !== currentUser.staffId) {
        const targetStaff = await storage.getStaff(body.staffId);
        if (!targetStaff) {
          return res.status(400).json({ message: "Target staff not found" });
        }
        targetStaffId = targetStaff.id;
        targetStaffName = targetStaff.name;
        targetRole = targetStaff.role;
        targetBranch = targetStaff.branch ?? null;
        attendanceDate = body.date ? String(body.date).split('T')[0] : todayStr;
      } else {
        const currentStaff = await storage.getStaff(currentUser.staffId);
        if (!currentStaff) {
          return res.status(400).json({ message: "Staff not found" });
        }
        if (currentStaff.isActive === false || (currentStaff.isActive as unknown) === 0) {
          return res.status(403).json({ message: "Deactivated staff cannot mark attendance" });
        }
        targetStaffId = currentStaff.id;
        targetStaffName = currentStaff.name;
        targetRole = currentStaff.role;
        targetBranch = currentStaff.branch ?? null;

        if (!canManageOthers) {
          attendanceDate = todayStr;
        } else {
          attendanceDate = body.date ? String(body.date).split('T')[0] : todayStr;
        }
      }

      const checkInTime = body.checkInTime ? new Date(body.checkInTime) : (status === 'Present' ? new Date() : undefined);

      // Bug 6: capture the real GPS location sent from the device at check-in.
      const hasGeo =
        body.latitude !== undefined && body.latitude !== null && body.latitude !== "" &&
        body.longitude !== undefined && body.longitude !== null && body.longitude !== "";
      const latitude = hasGeo ? String(body.latitude) : null;
      const longitude = hasGeo ? String(body.longitude) : null;
      const locationLabel = body.locationLabel ? String(body.locationLabel) : null;

      console.log(`[ATTENDANCE] staffId=${targetStaffId}, date=${attendanceDate}, status=${status}`);

      const existing = await storage.getAttendanceByStaffAndDate(targetStaffId, attendanceDate);
      if (existing) {
        if (!canManageOthers) {
          return res.status(409).json({ message: "Attendance already marked for today. Contact Admin/MD to edit." });
        }
        const updateData: Record<string, any> = { status, updatedAt: new Date() };
        if (checkInTime) updateData.checkInTime = checkInTime;
        if (hasGeo) {
          updateData.latitude = latitude;
          updateData.longitude = longitude;
          updateData.locationLabel = locationLabel;
        }
        const updated = await storage.updateAttendance(existing.id, updateData);
        await syncAutoFineForStaffDate(storage, targetStaffId, attendanceDate);
        return res.json(updated);
      }

      const attendanceData: any = {
        staffId: targetStaffId,
        staffName: targetStaffName,
        role: targetRole,
        branch: targetBranch ? normalizeBranchName(targetBranch) : null,
        date: attendanceDate,
        status,
        checkInTime: checkInTime || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        locationLabel: locationLabel || undefined,
      };

      const result = await storage.createAttendance(attendanceData);
      await syncAutoFineForStaffDate(storage, targetStaffId, attendanceDate);
      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "attendance",
        action: "create",
        recordId: result.id,
        newValue: result,
      });
      const { invalidateOperationalCaches } = await import("./services/cacheService");
      await invalidateOperationalCaches();
      return res.status(201).json(result);
    } catch (error: any) {
      console.error(`[ATTENDANCE ERROR]`, error.message || error);
      if (error.code === '23505' || (error.message && error.message.includes('duplicate'))) {
        return res.status(409).json({ message: "Attendance already marked for today. Contact Admin/MD to edit." });
      }
      return res.status(500).json({ message: error.message || "Failed to mark attendance" });
    }
  });

  // Update attendance record
  app.patch("/api/attendance/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const currentUser = (req as any).user;
      const raw = req.body as Record<string, unknown>;
      const body = { ...raw };
      const clearCheckIn = body.checkInTime === null || body.checkInTime === "";
      const clearCheckOut = body.checkOutTime === null || body.checkOutTime === "";
      if (clearCheckIn) delete (body as any).checkInTime;
      if (clearCheckOut) delete (body as any).checkOutTime;
      if (body.checkOutTime && typeof body.checkOutTime === 'string') {
        body.checkOutTime = new Date(body.checkOutTime);
      }
      if (body.checkInTime && typeof body.checkInTime === 'string') {
        body.checkInTime = new Date(body.checkInTime);
      }
      if (body.overtimeHours !== undefined && body.overtimeHours !== null) {
        body.overtimeHours = String(Number(body.overtimeHours));
      }
      const validatedData = updateAttendanceSchema.parse(body);
      if (validatedData.status !== undefined) {
        const statusCheck = validateAttendanceStatus(validatedData.status);
        if (!statusCheck.ok) {
          return res.status(400).json({ message: statusCheck.message });
        }
        validatedData.status = statusCheck.status;
      }

      // First get the existing attendance record to check ownership
      const existingAttendance = await storage.getAttendance(id);
      if (!existingAttendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      
      // Admin, MD and operational leads (with attendance.manage) can update
      // attendance for anyone on any date. All other staff can only update their
      // own attendance for today only.
      const canManageOthers = hasPermission(currentUser.role, "attendance.manage");
      
      if (!canManageOthers) {
        if (existingAttendance.staffId !== currentUser.staffId) {
          return res.status(403).json({ message: "You can only update your own attendance" });
        }
        const today = clinicDateString();
        if (existingAttendance.date !== today) {
          return res.status(403).json({ message: "You can only update today's attendance" });
        }
        delete validatedData.staffId;
        delete validatedData.staffName;
        delete validatedData.role;
        delete validatedData.date;
        delete validatedData.status;
      }
      
      const patch: Record<string, unknown> = { ...validatedData };
      if (canManageOthers) {
        if (clearCheckIn) patch.checkInTime = null;
        if (clearCheckOut) patch.checkOutTime = null;
        if (validatedData.status === "Absent") {
          patch.checkInTime = null;
          patch.checkOutTime = null;
          patch.overtimeHours = "0";
        }
      }
      
      const attendance = await storage.updateAttendance(id, {
        ...patch,
        ...(canManageOthers
          ? { editedBy: currentUser.staffId, editedAt: new Date(), editReason: (raw.editReason as string) || null }
          : {}),
      } as any);
      if (attendance) {
        await syncAutoFineForStaffDate(storage, attendance.staffId, attendance.date as string);
        if (canManageOthers) {
          const editor = await storage.getStaff(currentUser.staffId);
          await logAudit(storage, {
            userId: currentUser.staffId,
            userName: editor?.name ?? "",
            module: "attendance",
            action: "update",
            recordId: id,
            oldValue: existingAttendance,
            newValue: attendance,
          });
        }
      }
      return res.json(attendance);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete attendance record (Admin/MD only)
  app.delete("/api/attendance/:id", requireAuth, requireAttendanceManage, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const existing = await storage.getAttendance(id);
      if (!existing) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      await storage.deleteAttendance(id, (req as any).user?.staffId);
      await syncAutoFineForStaffDate(storage, existing.staffId, existing.date as string);
      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "attendance",
        action: "delete",
        recordId: id,
        oldValue: existing,
      });
      return res.json({ message: "Attendance record deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Incentive Settings Routes ==========

  app.get("/api/incentive-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getIncentiveSettings();
      if (!settings) {
        return res.json({
          incentiveEnabled: "true",
          minPatientsForIncentive: 5,
          incentivePerPatient: 100,
          clinicLocationScope: "Colombo",
        });
      }
      return res.json(settings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/incentive-settings", requireAuth, requireSettingsManage, async (req: Request, res: Response) => {
    try {
      const { incentiveEnabled, minPatientsForIncentive, incentivePerPatient, clinicLocationScope } = req.body;
      const data: any = {};
      if (incentiveEnabled !== undefined) data.incentiveEnabled = String(incentiveEnabled);
      if (minPatientsForIncentive !== undefined) data.minPatientsForIncentive = Number(minPatientsForIncentive);
      if (incentivePerPatient !== undefined) data.incentivePerPatient = Number(incentivePerPatient);
      if (clinicLocationScope !== undefined) data.clinicLocationScope = clinicLocationScope;

      const settings = await storage.updateIncentiveSettings(data);
      return res.json(settings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Reports/Statistics Routes ==========
  
  // Legacy visit-stats — delegates to centralized calculation engine
  app.get("/api/reports/visit-stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const staffId = req.query.staffId as string | undefined;
      const currentUser = (req as any).user;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const { computeIncentiveReport } = await import("./services/reportService");
      const { computePayrollReport } = await import("./services/payrollService");

      let targetStaffId = staffId;
      if (currentUser.role === "Physiotherapist" || currentUser.role === "Staff") {
        targetStaffId = currentUser.staffId;
      }

      let visits;
      if (targetStaffId) {
        visits = await storage.getVisitsByStaffAndDateRange(targetStaffId, startDate, endDate);
      } else {
        visits = await storage.getVisitsByDateRange(startDate, endDate);
      }

      const stats = {
        colomboClinic: visits.filter((v) => v.branch === "Colombo" && v.visitType === "Clinic").length,
        colomboHome: visits.filter((v) => v.branch === "Colombo" && v.visitType === "Home").length,
        bandaragamaClinic: visits.filter((v) => v.branch === "Bandaragama" && v.visitType === "Clinic").length,
        bandaragamaHome: visits.filter((v) => v.branch === "Bandaragama" && v.visitType === "Home").length,
      };

      const incentiveRows = await computeIncentiveReport(storage, startDate, endDate, targetStaffId);
      const { summaries } = await computePayrollReport(
        storage,
        startDate,
        endDate,
        targetStaffId ? [targetStaffId] : undefined
      );
      const incentives = summaries.map((s) => ({
        staffName: s.name,
        totalIncentive: s.incentiveTotal,
        breakdown: s.incentiveDays.map((d) => ({ date: d.date, count: d.count, incentive: d.incentive })),
      }));

      return res.json({ stats, incentives, incentiveRows, visits });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Admission Routes ==========

  // Get all in-patient admissions
  app.get("/api/inpatients", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const branchId = getSelectedBranchId(req as any);
      let admissions;
      if (status && typeof status === 'string') {
        admissions = await storage.getInPatientAdmissionsByStatus(status, branchId);
      } else {
        admissions = await storage.getAllInPatientAdmissions(branchId);
      }
      return res.json(admissions);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // All in-patient sessions in range (reports / dashboard — operational roles with
  // visits.view_all or inpatients.manage). Optional ?branch= scopes to one branch.
  app.get("/api/inpatients/sessions/all", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!hasPermission(user.role, "inpatients.manage") && !hasPermission(user.role, "visits.view_all")) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({ message: "startDate and endDate are required (YYYY-MM-DD)" });
      }

      const startQuery = startDateStr;
      const endQuery = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59.999Z`;

      let sessions = await storage.getAllInPatientSessionsInDateRange(
        startQuery, 
        endQuery
      );

      let branchParam: string | null = null;
      try {
        branchParam = (await resolveBranchFilter(req as any, req.query.branch as string)) || null;
      } catch (err: any) {
        const { isManagementRole } = await import("./permissions");
        if (err.message === "Branch selection required" && isManagementRole(user.role)) {
          branchParam = null;
        } else {
          throw err;
        }
      }

      if (branchParam) {
        const target = normalizeBranchName(branchParam).toLowerCase();
        const branches = await storage.getAllBranches();
        const branchIdToShort = new Map<string, string>();
        for (const b of branches) {
          const short = normalizeBranchName((b as any).branchName ?? b.name).toLowerCase();
          if (short) branchIdToShort.set(b.id, short);
        }
        // Resolve each session's branch from its branch text, branchId, or
        // (legacy fallback) the treating staff member's branch.
        const staffList = await storage.getAllStaff();
        const staffBranchById = new Map(
          staffList.map((s) => [s.id, normalizeBranchName(s.branch).toLowerCase()])
        );
        
        const admissions = await storage.getAllInPatientAdmissions();
        const admMap = new Map(admissions.map((a) => [a.id, a]));

        sessions = sessions.filter((s) => {
          const adm = admMap.get(s.admissionId);
          const fromAdm = adm?.branchId ? branchIdToShort.get(adm.branchId) ?? "" : "";
          
          const fromText = normalizeBranchName((s as any).branch).toLowerCase();
          const fromId = (s as any).branchId ? branchIdToShort.get((s as any).branchId) ?? "" : "";
          const fromStaff = staffBranchById.get(s.treatingStaffId) ?? "";
          
          const short = fromText || fromId || fromAdm || fromStaff;
          return short === target;
        });
      }

      const allAdmissions = await storage.getAllInPatientAdmissions();
      const allAdmMap = new Map(allAdmissions.map((a) => [a.id, a]));

      return res.json(
        sessions.map((s) => ({
          ...s,
          patientName: allAdmMap.get(s.admissionId)?.patientName || s.patientName || "Unknown",
        }))
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // In-patient sessions for a staff member in a date range (dashboard / staff profile). Admin/MD may pass staffId.
  app.get("/api/inpatients/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;
      const queryStaffId = req.query.staffId as string | undefined;
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({ message: "startDate and endDate are required (YYYY-MM-DD)" });
      }

      const startQuery = startDateStr;
      const endQuery = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59.999Z`;

      let targetStaffId = user.staffId;
      if (["Admin", "MD"].includes(user.role) && queryStaffId) {
        targetStaffId = queryStaffId;
      }
      const sessions = await storage.getInPatientSessionsByStaffAndDateRange(
        targetStaffId, 
        startQuery, 
        endQuery
      );
      const admissions = await storage.getAllInPatientAdmissions();
      const admMap = new Map(admissions.map((a) => [a.id, a]));
      return res.json(
        sessions.map((s) => ({
          ...s,
          admission: admMap.get(s.admissionId) ? { id: (admMap.get(s.admissionId) as any).id, patientName: (admMap.get(s.admissionId) as any).patientName } : null,
        }))
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single in-patient admission
  app.get("/api/inpatients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const admission = await storage.getInPatientAdmission(param(req, "id"));
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      return res.json(admission);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create in-patient admission (Admin, MD, Receptionist, Physiotherapist)
  app.post("/api/inpatients", requireAuth, requireBranchContext(), requirePatientsManage, async (req: Request, res: Response) => {
    try {
      const branchContext = (req as any).branchContext;
      const branchId = branchContext?.selectedBranchId ?? null;

      const normalizedBody = normalizeInPatientAdmissionBody(req.body as Record<string, unknown>);
      const parsed = insertInPatientAdmissionSchema.safeParse(normalizedBody);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const d = parsed.data;
      const admission = await storage.createInPatientAdmission({
        ...d,
        branchId: d.branchId || branchId,
        reportsAttachments: (d as any).reportsAttachments ?? null,
        idCopyAttachments: (d as any).idCopyAttachments ?? null,
      } as any);
      return res.status(201).json(admission);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update in-patient admission (Admin, MD)
  app.put("/api/inpatients/:id", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const normalizedBody = normalizeInPatientAdmissionBody(req.body as Record<string, unknown>);
      const parsed = updateInPatientAdmissionSchema.safeParse(normalizedBody);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const admission = await storage.updateInPatientAdmission(param(req, "id"), parsed.data);
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      return res.json(admission);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete in-patient admission (Admin, MD only)
  app.delete("/api/inpatients/:id", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteInPatientAdmission(param(req, "id"));
      if (!success) {
        return res.status(404).json({ message: "Admission not found" });
      }
      return res.json({ message: "Admission deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Session Routes ==========

  // Get all sessions for an admission
  app.get("/api/inpatients/:admissionId/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getInPatientSessionsByAdmission(param(req, "admissionId"));
      return res.json(sessions);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get next session number for a date
  app.get("/api/inpatients/:admissionId/sessions/next-number", requireAuth, async (req: Request, res: Response) => {
    try {
      // Session number is cumulative across the whole admission (not reset per
      // day), so it reflects the patient's overall treatment progress.
      const count = await storage.getSessionCountForAdmission(param(req, "admissionId"));
      return res.json({ nextSessionNumber: count + 1 });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create in-patient session (All authenticated staff can add sessions)
  app.post("/api/inpatients/:admissionId/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const admission = await storage.getInPatientAdmission(param(req, "admissionId"));
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      if (admission.status === 'Discharged') {
        return res.status(400).json({ message: "Cannot add session to discharged patient" });
      }

      // Auto-calculate session number — cumulative across the admission so it
      // reflects the patient's overall treatment progress rather than resetting
      // to 1 each calendar day.
      const existingCount = await storage.getSessionCountForAdmission(param(req, "admissionId"));
      const sessionNumber = existingCount + 1;

      const data = {
        ...req.body,
        admissionId: param(req, "admissionId"),
        patientName: admission.patientName,
        sessionNumber,
      };

      const parsed = insertInPatientSessionSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      const sd = parsed.data;
      // Bug 3: "Treatment provided" is mandatory for every in-patient session.
      if (!sd.treatmentProvided || String(sd.treatmentProvided).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Treatment provided is required",
          field: "treatmentProvided",
        });
      }
      const treatingStaff = await storage.getStaff(sd.treatingStaffId);
      // Persist branch attribution so the session can be scoped/filtered by
      // organisation & branch. Admissions carry no branch, so the reliable
      // source is the treating staff member's branch (falling back to any
      // branchId explicitly supplied by the client).
      const resolvedBranchId =
        ((sd as any).branchId as string | undefined) ??
        (await resolveBranchIdByName(storage, treatingStaff?.branch)) ??
        null;
      const session = await storage.createInPatientSession({
        ...sd,
        treatingStaffName: treatingStaff?.name ?? sd.treatingStaffName,
        sessionNumber,
        branchId: resolvedBranchId,
        attachments: (sd as any).attachments ?? null,
      } as any);
      await syncAutoFineForStaffDate(storage, session.treatingStaffId, session.sessionDate);
      const sessionActor = await auditActor(req);
      await logAudit(storage, {
        ...sessionActor,
        module: "session",
        action: "create",
        recordId: session.id,
        newValue: session,
      });
      const { invalidateOperationalCaches } = await import("./services/cacheService");
      await invalidateOperationalCaches();
      return res.status(201).json(session);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update in-patient session (Admin, MD, Physiotherapist, Staff, Receptionist)
  app.put("/api/inpatients/sessions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const existingSession = await storage.getInPatientSession(param(req, "id"));
      if (!existingSession) {
        return res.status(404).json({ message: "Session not found" });
      }

      const hasManage =
        hasPermission(user.role, "inpatients.manage") ||
        hasPermission(user.role, "visits.manage");
      if (!hasManage) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }
      // Bug 11/13: management + operational leads may edit any session; normal staff /
      // physiotherapists may only edit sessions they treated.
      if (!canEditAllVisits(user.role) && existingSession.treatingStaffId !== user.staffId) {
        return res.status(403).json({ message: "You can only edit your own sessions." });
      }

      const parsed = updateInPatientSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      let patch: Record<string, unknown> = { ...parsed.data };
      // Bug 3: when treatment is being updated it may not be blanked out.
      if (patch.treatmentProvided !== undefined && String(patch.treatmentProvided).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Treatment provided is required",
          field: "treatmentProvided",
        });
      }
      // Never allow re-scoping a session across branch via raw body (RBAC server-side only).
      delete (patch as any).branchId;
      // Staff cannot reassign sessions to other clinicians.
      if (!canEditAllVisits(user.role)) {
        delete (patch as any).treatingStaffId;
        delete (patch as any).treatingStaffName;
      }
      if (patch.treatingStaffId && typeof patch.treatingStaffId === "string") {
        const st = await storage.getStaff(patch.treatingStaffId as string);
        if (st) patch = { ...patch, treatingStaffName: st.name };
      }
      const session = await storage.updateInPatientSession(param(req, "id"), patch as any);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      await syncAutoFineForStaffDate(storage, existingSession.treatingStaffId, existingSession.sessionDate);
      await syncAutoFineForStaffDate(storage, session.treatingStaffId, session.sessionDate);
      const { invalidateOperationalCaches } = await import("./services/cacheService");
      await invalidateOperationalCaches();
      return res.json(session);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete in-patient session (Admin, MD only)
  app.delete("/api/inpatients/sessions/:id", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getInPatientSession(param(req, "id"));
      if (!existing) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const { getSelectedBranchName } = await import("./middleware/branchContext");
      const activeBranch = getSelectedBranchName(req as any);
      if (activeBranch && existing.branchId !== activeBranch) {
        return res.status(403).json({ message: "Cross-branch deletion is not allowed." });
      }
      
      const success = await storage.deleteInPatientSession(param(req, "id"));
      if (!success) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (existing) {
        await syncAutoFineForStaffDate(storage, existing.treatingStaffId, existing.sessionDate);
      }
      return res.json({ message: "Session deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Discharge Routes ==========

  // Get discharge info for an admission
  app.get("/api/inpatients/:admissionId/discharge", requireAuth, async (req: Request, res: Response) => {
    try {
      const discharge = await storage.getInPatientDischargeByAdmission(param(req, "admissionId"));
      if (!discharge) {
        return res.status(404).json({ message: "Discharge record not found" });
      }
      return res.json(discharge);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create discharge (Admin, MD only)
  app.post("/api/inpatients/:admissionId/discharge", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const admission = await storage.getInPatientAdmission(param(req, "admissionId"));
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      if (admission.status === 'Discharged') {
        return res.status(400).json({ message: "Patient already discharged" });
      }

      const data = {
        ...req.body,
        admissionId: param(req, "admissionId"),
        patientName: admission.patientName,
      };

      const parsed = insertInPatientDischargeSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      // Create discharge record
      const discharge = await storage.createInPatientDischarge(parsed.data);

      // Update admission status to Discharged
      await storage.updateInPatientAdmission(param(req, "admissionId"), { status: 'Discharged' });

      return res.status(201).json(discharge);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Re-admit a discharged patient (Admin, MD only). Sets the admission back to
  // "Admitted" and removes the prior discharge record so sessions can resume and
  // a fresh discharge can be recorded later.
  app.post("/api/inpatients/:admissionId/readmit", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const admissionId = param(req, "admissionId");
      const admission = await storage.getInPatientAdmission(admissionId);
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      if (admission.status !== 'Discharged') {
        return res.status(400).json({ message: "Only discharged patients can be re-admitted" });
      }

      // Bug 9: allow re-admission with a past (or today's) admit date; future dates rejected.
      const requestedAdmit = (req.body as any)?.admitDate ? String((req.body as any).admitDate).split('T')[0] : clinicDateString();
      const admitValidation = validateAdmitDate(requestedAdmit);
      if (!admitValidation.ok) {
        return res.status(400).json({ message: admitValidation.message });
      }

      const newAdmissionData = {
        patientName: admission.patientName,
        age: admission.age,
        condition: admission.condition,
        careTakerName: admission.careTakerName,
        careTakerRelationship: admission.careTakerRelationship,
        phone: admission.phone,
        address: admission.address,
        patientIdNo: admission.patientIdNo,
        careTakerIdNo: admission.careTakerIdNo,
        packageType: admission.packageType,
        amountPerDay: admission.amountPerDay,
        branchId: admission.branchId,
        admitDate: requestedAdmit,
        status: 'Admitted'
      };

      const newAdmission = await storage.createInPatientAdmission(newAdmissionData as any);

      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "inpatient",
        action: "create",
        recordId: newAdmission.id,
        newValue: { ...newAdmission, readmittedFromId: admissionId },
      });

      return res.status(201).json(newAdmission);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Bug 9: edit an admission's admit date (Admin & MD only). Validated and audit-logged.
  app.patch("/api/inpatients/:id/admit-date", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["Admin", "MD"].includes(user.role)) {
        return res.status(403).json({ message: "Only Admin or MD can edit the admit date." });
      }
      const id = param(req, "id");
      const admission = await storage.getInPatientAdmission(id);
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      const validation = validateAdmitDate((req.body as any)?.admitDate);
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message });
      }
      const oldDate = admission.admitDate;
      const updated = await storage.updateInPatientAdmission(id, { admitDate: validation.date } as any);
      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "inpatient",
        action: "update",
        recordId: id,
        oldValue: { admitDate: oldDate },
        newValue: { admitDate: validation.date },
      });
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Bug 4: transfer an in-patient to another branch. Historical sessions/bills keep their
  // original branch; only the admission's current branch changes and a transfer log is written.
  app.post("/api/inpatients/:id/transfer", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      // Bug 4 (final spec): branch transfers are restricted to Admin/MD only.
      if (!["Admin", "MD"].includes(user.role)) {
        return res.status(403).json({ message: "You do not have permission to transfer patients." });
      }
      const id = param(req, "id");
      const admission = await storage.getInPatientAdmission(id);
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      const { targetBranchId, transferNote } = (req.body as any) ?? {};
      if (!targetBranchId || typeof targetBranchId !== "string") {
        return res.status(400).json({ message: "targetBranchId is required." });
      }
      const branches = await storage.getAllBranches();
      const targetBranch = branches.find((b: any) => b.id === targetBranchId);
      if (!targetBranch) {
        return res.status(400).json({ message: "Target branch not found in this organization." });
      }
      if (targetBranchId === admission.branchId) {
        return res.status(400).json({ message: "Patient is already in the selected branch." });
      }
      const rawDate = (req.body as any)?.transferDate ? String((req.body as any).transferDate).split("T")[0] : clinicDateString();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || rawDate > clinicDateString()) {
        return res.status(400).json({ message: "Transfer date must be a valid date no later than today." });
      }

      const fromBranchId = admission.branchId ?? null;
      const updated = await storage.updateInPatientAdmission(id, { status: "Transferred" } as any);

      const { id: _, branchId: __, status: ___, createdAt: ____, updatedAt: _____, admitDate: ______, ...rest } = admission;
      await storage.createInPatientAdmission({
        ...rest,
        admitDate: rawDate,
        branchId: targetBranchId,
        status: "Admitted",
        reportsAttachments: admission.reportsAttachments ? JSON.stringify(admission.reportsAttachments) : null,
        idCopyAttachments: admission.idCopyAttachments ? JSON.stringify(admission.idCopyAttachments) : null,
      } as any);

      const editor = await storage.getStaff(user.staffId);
      await db.insert((schema as any).patientTransferLogs).values({
        admissionId: id,
        patientName: admission.patientName,
        fromBranchId,
        toBranchId: targetBranchId,
        transferDate: rawDate,
        transferNote: transferNote ? String(transferNote) : null,
        transferredByStaffId: user.staffId,
        transferredByName: editor?.name ?? user.name ?? "",
      });

      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "inpatient",
        action: "transfer",
        recordId: id,
        oldValue: { branchId: fromBranchId },
        newValue: { branchId: targetBranchId, transferDate: rawDate, transferNote: transferNote ?? null },
      });

      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Bug 4: list branch-transfer history for an admission (with resolved branch names).
  app.get("/api/inpatients/:id/transfers", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const logs = await db
        .select()
        .from((schema as any).patientTransferLogs)
        .where(eq((schema as any).patientTransferLogs.admissionId, id))
        .orderBy(desc((schema as any).patientTransferLogs.createdAt));
      const branches = await storage.getAllBranches();
      const branchName = (bid: string | null | undefined) =>
        bid ? (branches.find((b: any) => b.id === bid)?.name ?? bid) : null;
      const enriched = (logs as any[]).map((l) => ({
        ...l,
        fromBranchName: branchName(l.fromBranchId),
        toBranchName: branchName(l.toBranchId),
      }));
      return res.json(enriched);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Export inpatient full history PDF
  app.get("/api/inpatients/:admissionId/export-pdf", requireAuth, async (req: Request, res: Response) => {
    try {
      const admissionId = param(req, "admissionId");
      const admission = await storage.getInPatientAdmission(admissionId);
      if (!admission) return res.status(404).json({ message: "Admission not found" });

      const sessions = await storage.getInPatientSessionsByAdmission(admissionId);
      const exportSvc = await import("./services/exportService");

      const title = `Inpatient History - ${admission.patientName} (${admission.status})`;
      // Bug 2: include session time + Improvements, and drop the Notes column.
      const columns = [
        { label: "Date", key: "date" },
        { label: "Time", key: "time" },
        { label: "Session #", key: "sessionNumber" },
        { label: "Treatment", key: "treatment" },
        { label: "Therapist", key: "therapist" },
        { label: "Improvements", key: "improvements" },
      ];

      const rows = sessions.map((s: any) => ({
        date: s.sessionDate,
        time: [s.startTime, s.endTime].filter(Boolean).join(" - ") || "-",
        sessionNumber: String(s.sessionNumber),
        treatment: s.treatmentProvided,
        therapist: s.treatingStaffName,
        improvements: s.improvements || "-",
      }));

      const pdf = await exportSvc.rowsToPdfBuffer(title, columns, rows);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="inpatient-history-${admission.id.substring(0, 8)}.pdf"`
      );
      return res.send(pdf);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update discharge (Admin, MD only)
  app.put("/api/inpatients/discharge/:id", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const parsed = updateInPatientDischargeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const discharge = await storage.updateInPatientDischarge(param(req, "id"), parsed.data);
      if (!discharge) {
        return res.status(404).json({ message: "Discharge record not found" });
      }
      return res.json(discharge);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== IN-PATIENT PAYMENTS ==========

  // Get payments for an admission (Admin, MD, Receptionist)
  app.get("/api/inpatients/:admissionId/payments", requireAuth, requirePatientsManage, async (req: Request, res: Response) => {
    try {
      const payments = await storage.getInPatientPaymentsByAdmission(param(req, "admissionId"));
      return res.json(payments);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get payment total for an admission (Admin, MD, Receptionist)
  app.get("/api/inpatients/:admissionId/payments/total", requireAuth, requirePatientsManage, async (req: Request, res: Response) => {
    try {
      const total = await storage.getPaymentTotalByAdmission(param(req, "admissionId"));
      return res.json({ total });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create payment (Admin, MD, Receptionist)
  app.post("/api/inpatients/:admissionId/payments", requireAuth, requirePatientsManage, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staffInfo = await storage.getStaff(user.staffId);

      const body = { ...req.body };
      if (body.notes === '' || body.notes === undefined) body.notes = null;
      if (body.amount !== undefined) body.amount = String(body.amount);

      const data = {
        ...body,
        admissionId: param(req, "admissionId"),
        createdByStaffId: user.staffId,
        createdByName: staffInfo?.name || 'Unknown',
      };

      const parsed = insertInPatientPaymentSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten(), received: req.body });
      }

      const payment = await storage.createInPatientPayment(parsed.data);
      return res.status(201).json(payment);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Extra Expense Routes ==========

  app.get("/api/inpatients/:admissionId/extra-expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const expenses = await storage.getInPatientExtraExpensesByAdmission(param(req, "admissionId"));
      return res.json(expenses);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inpatients/:admissionId/extra-expenses/total", requireAuth, async (req: Request, res: Response) => {
    try {
      const total = await storage.getExtraExpenseTotalByAdmission(param(req, "admissionId"));
      return res.json({ total });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inpatients/:admissionId/extra-expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staffInfo = await storage.getStaff(user.staffId);

      const body = { ...req.body };
      if (body.description === '' || body.description === undefined) body.description = null;
      if (body.amount !== undefined) body.amount = String(body.amount);

      const data = {
        ...body,
        admissionId: param(req, "admissionId"),
        createdByStaffId: user.staffId,
        createdByStaffName: staffInfo?.name || 'Unknown',
      };

      const parsed = insertInPatientExtraExpenseSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const expense = await storage.createInPatientExtraExpense(parsed.data);
      return res.status(201).json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/inpatients/extra-expenses/:id", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      if (body.description === '') body.description = null;
      if (body.amount !== undefined) body.amount = String(body.amount);

      const parsed = updateInPatientExtraExpenseSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const expense = await storage.updateInPatientExtraExpense(param(req, "id"), parsed.data);
      if (!expense) {
        return res.status(404).json({ message: "Extra expense not found" });
      }
      return res.json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/inpatients/extra-expenses/:id", requireAuth, requireInpatientsManage, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteInPatientExtraExpense(param(req, "id"));
      if (!deleted) {
        return res.status(404).json({ message: "Extra expense not found" });
      }
      return res.json({ message: "Extra expense deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Expense Routes (MD/Admin only) ==========

  // Get all expenses
  app.get("/api/expenses", requireAuth, requireBranchContext(), requireExpensesManage, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const branchFilter = getBranchFilter(req as any);
      let expensesList;
      
      if (startDate && endDate) {
        expensesList = await storage.getExpensesByDateRange(startDate as string, endDate as string);
      } else {
        expensesList = await storage.getAllExpenses();
      }

      if (branchFilter) {
        expensesList = filterByBranchName(expensesList, branchFilter);
      } else {
        const ctx = (req as any).branchContext;
        if (ctx?.allowedBranches) {
          const allowedNorms = new Set(ctx.allowedBranches.map((b: any) => normalizeBranchName(b.branchName ?? b.name).toLowerCase()));
          expensesList = expensesList.filter((e: any) => allowedNorms.has(normalizeBranchName(e.branch).toLowerCase()));
        }
      }
      
      return res.json(expensesList);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get my expenses (for staff to view their own expenses only) - must be before :id route
  app.get("/api/expenses/my", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const expensesList = await storage.getExpensesByStaffId(user.staffId);
      return res.json(expensesList);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single expense
  app.get("/api/expenses/:id", requireAuth, requireBranchContext(), requireExpensesManage, async (req: Request, res: Response) => {
    try {
      const expense = await storage.getExpense(param(req, "id"));
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      return res.json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create expense (all authenticated users can add expenses)
  app.post("/api/expenses", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staffInfo = await storage.getStaff(user.staffId);
      const branchName = getBranchFilter(req as any);
      
      const body = { ...req.body };
      if (body.description === '' || body.description === undefined) body.description = null;
      
      const data = {
        ...body,
        branch: body.branch ?? branchName ?? staffInfo?.branch ?? null,
        createdByStaffId: user.staffId,
        createdByName: staffInfo?.name || 'Unknown',
      };
      
      const parsed = insertExpenseSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      
      const expense = await storage.createExpense(parsed.data);
      const actor = await auditActor(req);
      await logAudit(storage, {
        ...actor,
        module: "expense",
        action: "create",
        recordId: expense.id,
        newValue: expense,
      });
      return res.status(201).json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update expense
  app.patch("/api/expenses/:id", requireAuth, requireBranchContext(), requireExpensesManage, async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      if (body.description === '') body.description = null;
      const parsed = updateExpenseSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      
      const expenseId = param(req, "id");
      const beforeExpense = await storage.getExpense(expenseId);
      const expense = await storage.updateExpense(expenseId, parsed.data);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      if (beforeExpense) {
        const actor = await auditActor(req);
        await logAudit(storage, {
          ...actor,
          module: "expense",
          action: "update",
          recordId: expenseId,
          oldValue: beforeExpense,
          newValue: expense,
        });
      }
      return res.json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete expense
  app.delete("/api/expenses/:id", requireAuth, requireBranchContext(), requireExpensesManage, async (req: Request, res: Response) => {
    try {
      const expenseId = param(req, "id");
      const beforeExpense = await storage.getExpense(expenseId);
      const deleted = await storage.deleteExpense(expenseId, (req as any).user?.staffId);
      if (!deleted) {
        return res.status(404).json({ message: "Expense not found" });
      }
      if (beforeExpense) {
        const actor = await auditActor(req);
        await logAudit(storage, {
          ...actor,
          module: "expense",
          action: "delete",
          recordId: expenseId,
          oldValue: beforeExpense,
        });
      }
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Revenue Summary Routes (MD/Admin only) ==========

  // Get revenue summary
  app.get("/api/revenue-summary", requireAuth, requireBranchContext(), requireReportsView, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const ctx = (req as any).branchContext;
      const explicitFilter = getBranchFilter(req as any);
      const branchFilter = explicitFilter || (ctx?.allowedBranches ? ctx.allowedBranches.map((b: any) => b.branchName ?? b.name) : null);

      let totalIncome: number;
      let totalExpenses: number;

      if (startDate && endDate) {
        totalIncome = await storage.getTotalIncome(startDate as string, endDate as string, branchFilter);
        totalExpenses = await storage.getExpenseTotal(startDate as string, endDate as string, branchFilter);
      } else {
        totalIncome = await storage.getTotalIncome(undefined, undefined, branchFilter);
        totalExpenses = await storage.getExpenseTotal(undefined, undefined, branchFilter);
      }
      
      const netRevenue = totalIncome - totalExpenses;
      
      return res.json({
        totalIncome,
        totalExpenses,
        netRevenue,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Initialize database with a default admin user if none exists
  app.post("/api/init", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_INIT !== "true") {
      return res.status(403).json({ message: "Init disabled in production" });
    }
    try {
      const allStaff = await storage.getAllStaff();
      if (allStaff.length === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await storage.createStaff({
          name: "Admin User",
          email: "admin@maximuscare.com",
          password: hashedPassword,
          role: "Admin",
          branch: "Both",
        });
        return res.json({ message: "Admin user created successfully" });
      }
      return res.json({ message: "Database already initialized" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Appointment Routes ==========

  app.get("/api/appointments", requireAuth, requireBranchContext(), async (req: Request, res: Response) => {
    try {
      const branchFilter = getBranchFilter(req as any);
      const { date } = req.query;
      let appts = date
        ? await storage.getAppointmentsByDate(date as string)
        : await storage.getAllAppointments();
      if (branchFilter) appts = filterByBranchName(appts, branchFilter);
      return res.json(appts);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const appt = await storage.getAppointment(param(req, "id"));
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      return res.json(appt);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/appointments", requireAuth, requireBranchContext(), requireAppointmentsManage, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const branchName = getBranchFilter(req as any);
      const body = { ...req.body };
      if (body.notes === '' || body.notes === undefined) body.notes = null;

      const resolvedBranch = normalizeBranchName(body.branch ?? branchName ?? "") || branchName;
      const branchId =
        (body.branchId as string | undefined) ??
        (await resolveBranchIdByName(storage, resolvedBranch ?? undefined)) ??
        null;

      if (body.patientId && !body.patientName) {
        const patient = await storage.getPatient(body.patientId);
        if (patient) body.patientName = patient.name;
      }
      if (body.treatingStaffId && !body.treatingStaffName) {
        const staffMem = await storage.getStaff(body.treatingStaffId);
        if (staffMem) body.treatingStaffName = staffMem.name;
      }

      const data = {
        ...body,
        branch: resolvedBranch ?? null,
        branchId,
        createdByStaffId: user.staffId,
      };

      const parsed = insertAppointmentSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const appt = await storage.createAppointment(parsed.data as any);
      const apptActor = await auditActor(req);
      await logAudit(storage, {
        ...apptActor,
        module: "appointment",
        action: "create",
        recordId: appt.id,
        newValue: appt,
      });
      const { sendNotification } = await import("./services/notificationService");
      void sendNotification(storage, {
        staffId: appt.treatingStaffId,
        title: "New Appointment",
        message: `${appt.patientName} on ${appt.appointmentDate} at ${appt.appointmentTime}`,
        type: "appointment_reminder",
      }).catch(() => {});
      return res.status(201).json(appt);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/appointments/:id", requireAuth, requireBranchContext(), requireAppointmentsManage, async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      if (body.notes === '') body.notes = null;

      if (body.patientId && !body.patientName) {
        const patient = await storage.getPatient(body.patientId);
        if (patient) body.patientName = patient.name;
      }
      if (body.treatingStaffId && !body.treatingStaffName) {
        const staffMem = await storage.getStaff(body.treatingStaffId);
        if (staffMem) body.treatingStaffName = staffMem.name;
      }

      const parsed = updateAppointmentSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const beforeAppt = await storage.getAppointment(param(req, "id"));
      if (!beforeAppt) return res.status(404).json({ message: "Appointment not found" });

      const ctx = (req as any).branchContext;
      if (beforeAppt.branchId && !ctx?.allowedBranchIds?.includes(beforeAppt.branchId)) {
        return res.status(403).json({ message: "Unauthorized branch access" });
      }

      const appt = await storage.updateAppointment(param(req, "id"), parsed.data as any);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      const apptUpdActor = await auditActor(req);
      await logAudit(storage, {
        ...apptUpdActor,
        module: "appointment",
        action: parsed.data.status === "Cancelled" ? "cancel" : "update",
        recordId: appt.id,
        oldValue: beforeAppt,
        newValue: appt,
      });
      return res.json(appt);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, requireBranchContext(), requireAppointmentsManage, async (req: Request, res: Response) => {
    try {
      const beforeAppt = await storage.getAppointment(param(req, "id"));
      if (!beforeAppt) return res.status(404).json({ message: "Appointment not found" });

      const ctx = (req as any).branchContext;
      if (beforeAppt.branchId && !ctx?.allowedBranchIds?.includes(beforeAppt.branchId)) {
        return res.status(403).json({ message: "Unauthorized branch access" });
      }

      const deleted = await storage.deleteAppointment(param(req, "id"));
      if (!deleted) return res.status(404).json({ message: "Appointment not found" });
      const apptDelActor = await auditActor(req);
      await logAudit(storage, {
        ...apptDelActor,
        module: "appointment",
        action: "delete",
        recordId: param(req, "id"),
        oldValue: beforeAppt,
      });
      return res.json({ message: "Appointment deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Staff fines (manual + automatic) ==========

  app.get("/api/staff-fines", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const queryStaffId = req.query.staffId as string | undefined;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required (YYYY-MM-DD)" });
      }
      if (["Admin", "MD", "Manager", "Branch Manager", "Nexus MD"].includes(user.role)) {
        if (queryStaffId) {
          const rows = await storage.getStaffFinesByStaffAndDateRange(queryStaffId, startDate, endDate);
          return res.json(rows);
        }
        const rows = await storage.getStaffFinesByDateRange(startDate, endDate);
        return res.json(rows);
      }
      const rows = await storage.getStaffFinesByStaffAndDateRange(user.staffId, startDate, endDate);
      return res.json(rows);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staff-fines", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { isManagementRole, isOperationalLead } = await import("./permissions");
      if (!isManagementRole(user.role) && !isOperationalLead(user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const editor = await storage.getStaff(user.staffId);
      const body = { ...req.body, source: "manual" };
      if (!body.staffId || !String(body.staffId).trim()) {
        return res.status(400).json({ message: "Staff is required" });
      }
      
      // Auto-inject branchId
      const targetStaff = await storage.getStaff(body.staffId);
      if (targetStaff && targetStaff.branch) {
        body.branchId = targetStaff.branch;
      }

      if (!body.fineDate || !String(body.fineDate).trim()) {
        return res.status(400).json({ message: "Fine date is required" });
      }
      if (!body.reason || !String(body.reason).trim()) {
        return res.status(400).json({ message: "Reason is required" });
      }
      const parsed = insertStaffFineSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }
      const fine = await storage.createStaffFine({
        ...(parsed.data as any),
        createdByStaffId: user.staffId,
        createdByName: editor?.name ?? "",
      } as any);
      await logAudit(storage, {
        userId: user.staffId,
        userName: editor?.name ?? "",
        module: "fine",
        action: "create",
        recordId: fine.id,
        newValue: fine,
      });
      const { invalidateOperationalCaches } = await import("./services/cacheService");
      await invalidateOperationalCaches();
      return res.status(201).json(fine);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/staff-fines/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { isManagementRole, isOperationalLead } = await import("./permissions");
      if (!isManagementRole(user.role) && !isOperationalLead(user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const existingFine = await storage.getStaffFine(param(req, "id"));
      if (!existingFine) return res.status(404).json({ message: "Fine not found" });
      const body = { ...req.body } as Record<string, unknown>;
      if (existingFine.source === "auto_no_session") {
        delete body.source;
      }
      const parsed = updateStaffFineSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }
      const fineId = param(req, "id");
      const fine = await storage.updateStaffFine(fineId, {
        ...parsed.data,
        updatedByStaffId: (req as any).user?.staffId,
      } as any);
      if (!fine) return res.status(404).json({ message: "Fine not found" });
      const editor = await storage.getStaff(user.staffId);
      await logAudit(storage, {
        userId: user.staffId,
        userName: editor?.name ?? "",
        module: "fine",
        action: "update",
        recordId: fineId,
        oldValue: existingFine,
        newValue: fine,
      });
      return res.json(fine);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/staff-fines/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { isManagementRole, isOperationalLead } = await import("./permissions");
      if (!isManagementRole(user.role) && !isOperationalLead(user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const fineId = param(req, "id");
      const existingFine = await storage.getStaffFine(fineId);
      const deleted = await storage.deleteStaffFine(fineId, (req as any).user?.staffId);
      if (!deleted) return res.status(404).json({ message: "Fine not found" });
      if (existingFine) {
        const actor = await auditActor(req);
        await logAudit(storage, {
          ...actor,
          module: "fine",
          action: "delete",
          recordId: fineId,
          oldValue: existingFine,
        });
      }
      return res.json({ message: "Fine deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  registerSalaryRoutes(app);
  registerExtendedRoutes(app);

  registerAutoFineJobs(runAutoFineSweepForToday, runAutoFineSweepForRecentDays);
  // setInterval/cron timers and the startup sweep need a persistent process.
  // They never fire reliably on serverless (Vercel) and would slow cold starts, so skip them.
  if (process.env.NODE_ENV !== "test" && !isServerless) {
    void runAutoFineSweepForRecentDays().catch((e) =>
      console.error("[auto-fine] initial sweep failed:", e)
    );
    startScheduledJobs();
  }

  return httpServer;
}
