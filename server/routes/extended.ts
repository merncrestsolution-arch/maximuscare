import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { schema } from "../db";
import { requireAuth } from "../auth";
import {
  requireAuditView,
  requireBranchesManage,
  requireReportsView,
  requireSettingsManage,
  requireTasksManage,
  requireSalaryManage,
  requireNotificationsManage,
  requireCriticalDelete,
  requireExpensesManage,
  requireStaffManage,
  requireReportsExport,
} from "../middleware/secureApi";
import { attachBranchContext, requireBranchContext, getBranchFilter, loadBranchContext } from "../middleware/branchContext";
import { branchStaffIdSet } from "../services/staffService";
import { assertOverviewAccess } from "../services/branchService";
import { computeOverviewKpis, computeMaximusComparison, computeNexusComparison, computeOverviewExpenseBreakdown } from "../services/overviewService";
import { successResponse, errorResponse } from "../response";
import { isManagementRole, isOperationalLead } from "../permissions";
import { normalizeBranchName } from "@shared/branches";
import { computePayrollReport, persistPayrollSnapshotRecords } from "../services/payrollService";
import { logAudit } from "../services/auditService";
import { handleCreateTask } from "./hrm";
import { normalizeStatus } from "../services/taskService";
import { computeDashboardKpis, computeBranchDashboardStats, assignPatientsToFirstVisitTherapist } from "../services/dashboardService";
import { broadcastToActiveStaff } from "../services/notificationService";
import {
  computeRevenueReport,
  computeIncentiveReport,
  computeAttendanceReport,
  computeExpenseReport,
  computeUnpaidReport,
  computeStaffReport,
  computeSessionReport,
} from "../services/reportService";

const {
  insertBranchSchema,
  updateBranchSchema,
  updateClinicSettingsSchema,
  insertNotificationSchema,
  insertTaskSchema,
  updateTaskSchema,
  insertPayrollSnapshotSchema,
} = schema;

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

async function editorName(staffId: string) {
  const s = await storage.getStaff(staffId);
  return s?.name ?? "";
}

export function registerExtendedRoutes(app: Express) {
  // ========== Payroll ==========
  app.get("/api/payroll/report", requireAuth, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const staffId = req.query.staffId as string | undefined;
      const user = (req as any).user;
      const ctx = await loadBranchContext(req as any);

      if (!startDate || !endDate) {
        return errorResponse(res, "startDate and endDate are required", 400);
      }

      let staffIds: string[] | undefined;
      const isManagement = isManagementRole(user.role);
      const isMultiStaffAllowed = user.role === "Admin" || user.role === "MD" || user.role === "Nexus MD";

      if (isMultiStaffAllowed) {
        if (staffId) {
          const target = await storage.getStaff(staffId);
          if (!target) return errorResponse(res, "Staff not found", 404);
          
          if (!isManagement) {
            const allowedNames = new Set((ctx?.allowedBranches ?? []).map((b: any) => normalizeBranchName(b.branchName ?? b.name).toLowerCase()));
            const targetBranch = normalizeBranchName(target.branch).toLowerCase();
            const matchesAllowed = targetBranch === "both"
              ? (allowedNames.has("dehiwala") || allowedNames.has("neuro rehabilitation"))
              : allowedNames.has(targetBranch);
            if (!matchesAllowed) {
              return errorResponse(res, "Access denied to staff in this branch", 403);
            }
          }
          staffIds = [staffId];
        } else {
          const ids = await branchStaffIdSet(storage, ctx?.selectedBranchName ?? null);
          
          if (!isManagement || ids === null) {
            const allowedNames = new Set((ctx?.allowedBranches ?? []).map((b: any) => normalizeBranchName(b.branchName ?? b.name).toLowerCase()));
            const allStaff = await storage.getAllStaff();
            const filteredStaff = allStaff.filter((s) => {
              const staffBranch = normalizeBranchName(s.branch).toLowerCase();
              if (staffBranch === "both") {
                return allowedNames.has("dehiwala") || allowedNames.has("neuro rehabilitation");
              }
              return allowedNames.has(staffBranch);
            });
            const allowedIds = filteredStaff.map((s) => s.id);
            
            if (ids !== null) {
              staffIds = allowedIds.filter((id) => ids.has(id));
            } else {
              staffIds = allowedIds;
            }
          } else {
            staffIds = Array.from(ids);
          }
        }
      } else if (user.staffId) {
        staffIds = [user.staffId];
      } else {
        return errorResponse(res, "Forbidden", 403);
      }

      if (staffIds && ctx?.selectedContext) {
        const { filterStaffByOrganization } = await import("../services/staffService");
        const orgId = ctx.selectedContext === "nexus-overview" ? "nexus" : "maximus";
        const allStaff = await storage.getAllStaff();
        const scoped = await filterStaffByOrganization(storage, allStaff, orgId);
        const scopedIds = new Set(scoped.map((s) => s.id));
        staffIds = staffIds.filter((id) => scopedIds.has(id));
      }

      const report = await computePayrollReport(storage, startDate, endDate, staffIds);
      return successResponse(res, report);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to compute payroll", 500);
    }
  });

  app.post("/api/payroll/snapshots", requireAuth, requireSalaryManage, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { staffId, periodStart, periodEnd } = req.body;
      if (!staffId || !periodStart || !periodEnd) {
        return errorResponse(res, "staffId, periodStart, periodEnd required", 400);
      }

      const isManagement = isManagementRole(user.role);
      if (!isManagement) {
        const target = await storage.getStaff(staffId);
        if (!target) return errorResponse(res, "Staff not found", 404);
        const ctx = await loadBranchContext(req as any);
        const allowedNames = new Set((ctx?.allowedBranches ?? []).map((b: any) => normalizeBranchName(b.branchName ?? b.name).toLowerCase()));
        const targetBranch = normalizeBranchName(target.branch).toLowerCase();
        const matchesAllowed = targetBranch === "both"
          ? (allowedNames.has("dehiwala") || allowedNames.has("neuro rehabilitation"))
          : allowedNames.has(targetBranch);
        if (!matchesAllowed) {
          return errorResponse(res, "Access denied to staff in this branch", 403);
        }
      }

      const { summaries } = await computePayrollReport(storage, periodStart, periodEnd, [staffId]);
      const summary = summaries[0];
      if (!summary) return errorResponse(res, "Staff not found or not eligible", 404);

      const staff = await storage.getStaff(staffId);
      const snapshot = await storage.createPayrollSnapshot(
        insertPayrollSnapshotSchema.parse({
          staffId,
          staffName: staff?.name ?? summary.name,
          periodStart,
          periodEnd,
          breakdown: JSON.stringify(summary),
          finalSalary: String(summary.finalSalary),
          createdByStaffId: user.staffId,
          createdByName: await editorName(user.staffId),
        })
      );
      await persistPayrollSnapshotRecords(storage, summary, periodStart);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "create",
        recordId: snapshot.id,
        newValue: summary,
      });
      return successResponse(res, snapshot, "Payroll snapshot saved", 201);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to save snapshot", 500);
    }
  });

  app.get("/api/payroll/snapshots", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staffId = (req.query.staffId as string) || user.staffId;
      const isManagement = isManagementRole(user.role);
      const isLead = isOperationalLead(user.role);

      if (!isManagement && !isLead && staffId !== user.staffId) {
        return errorResponse(res, "Forbidden", 403);
      }

      if (isLead && staffId) {
        const target = await storage.getStaff(staffId);
        if (!target) return errorResponse(res, "Staff not found", 404);
        const ctx = await loadBranchContext(req as any);
        const allowedNames = new Set((ctx?.allowedBranches ?? []).map((b: any) => normalizeBranchName(b.branchName ?? b.name).toLowerCase()));
        const targetBranch = normalizeBranchName(target.branch).toLowerCase();
        const matchesAllowed = targetBranch === "both"
          ? (allowedNames.has("dehiwala") || allowedNames.has("neuro rehabilitation"))
          : allowedNames.has(targetBranch);
        if (!matchesAllowed) {
          return errorResponse(res, "Access denied to staff in this branch", 403);
        }
      }

      const snapshots = await storage.getPayrollSnapshotsByStaff(staffId);
      return successResponse(res, snapshots);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Clinic Settings ==========
  app.get("/api/clinic-settings", requireAuth, requireSettingsManage, async (_req, res) => {
    try {
      const settings = await storage.getClinicSettings();
      return successResponse(res, settings ?? {
        autoFineAmount: "500",
        homeRateColombo: "1000",
        homeRateBandaragama: "500",
        otRatePerHour: "250",
        extraHolidayDeduction: "1500",
        freeAbsentDays: 4,
      });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.put("/api/clinic-settings", requireAuth, requireSettingsManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = updateClinicSettingsSchema.parse(req.body);
      const settings = await storage.updateClinicSettings(data);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "update",
        recordId: settings.id,
        newValue: data,
      });
      return successResponse(res, settings, "Settings saved");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return errorResponse(res, "Validation error", 400, error.errors.map((e) => e.message));
      }
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Branches ==========
  app.get("/api/branches", requireAuth, async (_req, res) => {
    try {
      const list = await storage.getAllBranches();
      return successResponse(res, list);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/branches", requireAuth, requireBranchesManage, async (req, res) => {
    try {
      const data = insertBranchSchema.parse(req.body);
      const branch = await storage.createBranch(data as any);
      return successResponse(res, branch, "Branch created", 201);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return errorResponse(res, "Validation error", 400);
      }
      return errorResponse(res, error.message, 500);
    }
  });

  app.patch("/api/branches/:id", requireAuth, requireBranchesManage, async (req, res) => {
    try {
      const data = updateBranchSchema.parse(req.body);
      const branch = await storage.updateBranch(param(req, "id"), data as any);
      if (!branch) return errorResponse(res, "Branch not found", 404);
      return successResponse(res, branch);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/branches/:id", requireAuth, requireCriticalDelete, async (req, res) => {
    try {
      const deleted = await storage.deleteBranch(param(req, "id"));
      if (!deleted) return errorResponse(res, "Branch not found", 404);
      return successResponse(res, null, "Branch deleted");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Notifications ==========
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const unreadOnly = req.query.unreadOnly === "true";
      const archived =
        req.query.archived === "true" ? true : req.query.archived === "false" ? false : undefined;
      const list = await storage.getNotificationsByStaff(user.staffId, {
        unreadOnly,
        archived,
      });
      return successResponse(res, list);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const count = await storage.getUnreadNotificationCount(user.staffId);
      return successResponse(res, { count });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/notifications", requireAuth, requireNotificationsManage, async (req, res) => {
    try {
      const data = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(data as any);
      return successResponse(res, notification, "Notification sent", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/notifications/broadcast", requireAuth, requireNotificationsManage, async (req, res) => {
    try {
      const { title, message, type, branch } = req.body ?? {};
      if (!title || !message) {
        return errorResponse(res, "Title and message are required", 400);
      }
      let allowed: Set<string> | undefined;
      if (branch && branch !== "all") {
        const active = await storage.getActiveStaff();
        allowed = new Set(active.filter((s) => s.branch === branch).map((s) => s.id));
      }
      const count = await broadcastToActiveStaff(
        storage,
        { title: String(title), message: String(message), type: type || "announcement" } as any,
        allowed ? (id: string) => allowed!.has(id) : undefined,
      );
      return successResponse(res, { count }, "Notification sent", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // Manually (re)send the current release's "What's New" notification to all
  // active staff. Useful if the automatic post-deploy broadcast didn't reach
  // everyone. Pass { force: true } to re-send even if already announced.
  app.post(
    "/api/notifications/announce-update",
    requireAuth,
    requireNotificationsManage,
    async (req, res) => {
      try {
        const force = req.body?.force === true || req.query.force === "true";
        const { announceAppUpdateIfNeeded } = await import(
          "../services/appUpdateService"
        );
        const count = await announceAppUpdateIfNeeded(storage, { force });
        return successResponse(
          res,
          { count },
          count > 0
            ? `Update notification sent to ${count} staff`
            : "Already announced for this release (use force to re-send)",
          201,
        );
      } catch (error: any) {
        return errorResponse(res, error.message, 500);
      }
    },
  );

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const n = await storage.markNotificationRead(param(req, "id"), user.staffId);
      if (!n) return errorResponse(res, "Notification not found", 404);
      return successResponse(res, n);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      await storage.markAllNotificationsRead(user.staffId);
      return successResponse(res, null, "All marked read");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Tasks ==========
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const status = req.query.status as string | undefined;
      let list;
      if ((isManagementRole(user.role) || isOperationalLead(user.role)) && req.query.all === "true") {
        list = await storage.getAllTasks(status);
      } else {
        list = await storage.getTasksForStaff(user.staffId, status);
      }
      return successResponse(res, list);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/tasks", requireAuth, requireTasksManage, async (req, res) => {
    try {
      if (!req.body.title) return errorResponse(res, "title required", 400);
      if (req.body.taskType !== "Common" && !req.body.assignedToStaffId && !req.body.assignedStaffIds?.length) {
        return errorResponse(res, "Assignee required for individual tasks", 400);
      }
      return await handleCreateTask(req, res);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const existing = await storage.getTask(param(req, "id"));
      if (!existing) return errorResponse(res, "Task not found", 404);
      // A user may act on a task when they are management, the directly-assigned
      // owner, OR a recipient of a "Common" task via task_assignments. Common tasks
      // store the primary assignee in assignedToStaffId, so other recipients would
      // otherwise be wrongly rejected (Bug: "Mark Complete" throws an error).
      const assignment = await storage.getTaskAssignmentForStaff(existing.id, user.staffId);
      const canEdit =
        isManagementRole(user.role) ||
        existing.assignedToStaffId === user.staffId ||
        !!assignment;
      if (!canEdit) return errorResponse(res, "Forbidden", 403);
      const raw = req.body as Record<string, unknown>;
      const data = updateTaskSchema.parse({
        ...raw,
        status: raw.status ? normalizeStatus(String(raw.status)) : undefined,
      });
      const isCompleting = !!data.status && normalizeStatus(String(data.status)) === "Completed";
      if (isCompleting) {
        (data as any).completionNotes = raw.completionNotes ?? existing.completionNotes;
        if (raw.completionFiles) {
          (data as any).completionFiles = JSON.stringify(raw.completionFiles);
        }
      }

      // Common tasks track completion per recipient. When a non-management recipient
      // completes their copy, flip their assignment row and only mark the shared task
      // Completed once every recipient is done — so one staff member completing does
      // not close the task for everyone else.
      if (existing.taskType === "Common" && assignment && !isManagementRole(user.role)) {
        await storage.updateTaskAssignmentStatus(
          existing.id,
          user.staffId,
          isCompleting ? "Completed" : normalizeStatus(String(data.status ?? assignment.status)),
        );
        if (isCompleting && !(await storage.areAllTaskAssignmentsComplete(existing.id))) {
          delete (data as any).status;
        }
      }

      const task = await storage.updateTask(existing.id, data);
      const action =
        data.status && normalizeStatus(data.status) === "Completed" ? "complete" : "update";
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "task",
        action,
        recordId: existing.id,
        oldValue: existing,
        newValue: task,
      });
      return successResponse(res, task);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/tasks/:id", requireAuth, requireTasksManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const existing = await storage.getTask(param(req, "id"));
      if (!existing) return errorResponse(res, "Task not found", 404);
      const deleted = await storage.deleteTask(existing.id, user.staffId);
      if (!deleted) return errorResponse(res, "Task not found", 404);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "task",
        action: "delete",
        recordId: existing.id,
        oldValue: existing,
      });
      return successResponse(res, null, "Task deleted");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Audit Logs ==========
  app.get("/api/audit-logs", requireAuth, requireAuditView, async (req, res) => {
    try {
      const entityType = req.query.entityType as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const logs = await storage.getAuditLogs({ entityType, limit });
      return successResponse(res, logs);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Dashboard aggregation (centralized calculation engine) ==========
  app.get("/api/reports/dashboard-kpis", requireAuth, requireBranchContext(), async (req, res) => {
    try {
      const user = (req as any).user;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return errorResponse(res, "startDate and endDate required", 400);
      }
      // Managers/branch managers (operational leads) see branch-wide KPIs, not
      // just their own records — scoping to the selected branch handles isolation.
      const staffFilter =
        isManagementRole(user.role) || isOperationalLead(user.role) ? undefined : [user.staffId];
      const { cacheGetOrSet } = await import("../services/cacheService");
      const ctx = (req as any).branchContext;
      const explicitFilter = ctx?.selectedBranchName;
      const branchFilter = explicitFilter || (ctx?.allowedBranches ? ctx.allowedBranches.map((b: any) => b.branchName ?? b.name) : null);
      const cacheKey = `dashboard:v3:${startDate}:${endDate}:${user.staffId}:${explicitFilter ?? "none"}`;
      // Bug 8 diagnostics: trace who is calling, the resolved date range, and the
      // branch scope so an empty Revenue Trend can be pinpointed. Remove once verified.
      console.log("[RevenueTrend] dashboard-kpis called by:", {
        userId: user?.staffId,
        role: user?.role,
        startDate,
        endDate,
        branchFilter,
      });
      const kpis = await cacheGetOrSet(cacheKey, 120, () =>
        computeDashboardKpis(storage, startDate, endDate, staffFilter, branchFilter)
      );
      console.log("[RevenueTrend] points:", kpis?.charts?.revenueTrend?.length ?? 0,
        "non-zero:", (kpis?.charts?.revenueTrend ?? []).filter((d: any) => Number(d.revenue) > 0).length,
        "sample:", (kpis?.charts?.revenueTrend ?? []).slice(0, 3));
      return successResponse(res, kpis);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/maximus-overview", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const sessionId = (req as any).sessionId;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      assertOverviewAccess("maximus-overview", user.role);
      const session = sessionId ? await storage.getAuthSession(sessionId) : undefined;
      if (session?.selectedContext !== "maximus-overview") {
        return errorResponse(res, "Maximus Overview context required", 403);
      }
      const kpis = await computeOverviewKpis(storage, startDate, endDate, "maximus");
      const comparison = await computeMaximusComparison(storage, startDate, endDate);
      const expenseBreakdown = await computeOverviewExpenseBreakdown(storage, startDate, endDate, "maximus");
      return successResponse(res, { startDate, endDate, kpis, comparison, expenseBreakdown });
    } catch (error: any) {
      return errorResponse(res, error.message, error.message?.includes("Unauthorized") ? 403 : 500);
    }
  });

  app.get("/api/reports/nexus-overview", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const sessionId = (req as any).sessionId;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      assertOverviewAccess("nexus-overview", user.role);
      const session = sessionId ? await storage.getAuthSession(sessionId) : undefined;
      if (session?.selectedContext !== "nexus-overview") {
        return errorResponse(res, "Nexus Overview context required", 403);
      }
      const kpis = await computeOverviewKpis(storage, startDate, endDate, "nexus");
      const comparison = await computeNexusComparison(storage, startDate, endDate);
      const expenseBreakdown = await computeOverviewExpenseBreakdown(storage, startDate, endDate, "nexus");
      return successResponse(res, { startDate, endDate, kpis, comparison, expenseBreakdown });
    } catch (error: any) {
      return errorResponse(res, error.message, error.message?.includes("Unauthorized") ? 403 : 500);
    }
  });

  app.get("/api/reports/branch-stats", requireAuth, requireReportsView, async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return errorResponse(res, "startDate and endDate required", 400);
      }
      const stats = await computeBranchDashboardStats(storage, startDate, endDate);
      return successResponse(res, { startDate, endDate, stats });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/therapist-patients", requireAuth, async (_req, res) => {
    try {
      const visits = await storage.getAllVisits();
      const patients = await storage.getAllPatients();
      const staff = await storage.getAllStaff();
      const result = assignPatientsToFirstVisitTherapist(visits, patients, staff);
      return successResponse(res, result);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Part 4 report endpoints (calculation engine only) ==========
  app.get("/api/reports/revenue", requireAuth, requireBranchContext(), requireReportsView, async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      const branchFilter = getBranchFilter(req as any);
      const { cacheGetOrSet } = await import("../services/cacheService");
      const cacheKey = `report:revenue:${startDate}:${endDate}:${branchFilter ?? "all"}`;
      const report = await cacheGetOrSet(cacheKey, 180, () =>
        computeRevenueReport(storage, startDate, endDate, branchFilter)
      );
      return successResponse(res, report);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/incentive", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      const staffId = isManagementRole(user.role) ? (req.query.staffId as string | undefined) : user.staffId;
      let rows = await computeIncentiveReport(storage, startDate, endDate, staffId);
      // Branch-scope the management-wide incentive report to the selected branch.
      if (isManagementRole(user.role) && !staffId) {
        const ctx = await loadBranchContext(req as any);
        const ids = await branchStaffIdSet(storage, ctx?.selectedBranchName ?? null);
        if (ids) rows = rows.filter((r: any) => ids.has(r.staffId));
      }
      return successResponse(res, { startDate, endDate, rows });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/attendance", requireAuth, requireBranchContext(), async (req, res) => {
    try {
      const user = (req as any).user;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      const staffId = isManagementRole(user.role) ? (req.query.staffId as string | undefined) : user.staffId;
      const branchFilter = getBranchFilter(req as any);
      const report = await computeAttendanceReport(storage, startDate, endDate, staffId, branchFilter);
      console.log("[AttendanceReport]", { startDate, endDate, staffId, branchFilter, records: report.records?.length ?? 0 });
      return successResponse(res, report);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/expenses", requireAuth, requireBranchContext(), requireExpensesManage, async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      const branchFilter = getBranchFilter(req as any);
      const report = await computeExpenseReport(storage, startDate, endDate, branchFilter);
      return successResponse(res, report);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/unpaid", requireAuth, requireBranchContext(), async (req, res) => {
    try {
      const user = (req as any).user;
      const staffId = isManagementRole(user.role) ? undefined : user.staffId;
      const branchFilter = getBranchFilter(req as any);
      const rows = await computeUnpaidReport(storage, staffId, branchFilter);
      const totalAmount = rows.reduce((a, r) => a + (r.outstandingBalance ?? r.amount), 0);
      return successResponse(res, { rows, totalAmount, patientCount: new Set(rows.map((r) => r.patientId)).size });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/sessions", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      const staffId = isManagementRole(user.role) ? (req.query.staffId as string | undefined) : user.staffId;
      const report = await computeSessionReport(storage, startDate, endDate, staffId);
      return successResponse(res, report);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/reports/staff/:staffId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const staffId = param(req, "staffId");
      if (!isManagementRole(user.role) && user.staffId !== staffId) {
        return errorResponse(res, "Forbidden", 403);
      }
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      const report = await computeStaffReport(storage, staffId, startDate, endDate);
      if (!report) return errorResponse(res, "Staff not found", 404);
      return successResponse(res, report);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ========== Server-side report export (CSV / XLSX / PDF) ==========
  app.get("/api/reports/export/:reportType", requireAuth, requireBranchContext(), requireReportsExport, async (req, res) => {
    try {
      const reportType = param(req, "reportType");
      const format = String(req.query.format ?? "csv").toLowerCase() as "csv" | "xlsx" | "pdf";
      if (!["csv", "xlsx", "pdf"].includes(format)) {
        return errorResponse(res, "format must be csv, xlsx, or pdf", 400);
      }
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);

      const branchFilter = getBranchFilter(req as any);
      const exportSvc = await import("../services/exportService");

      let columns: { key: string; label: string }[] = [];
      let rows: Record<string, unknown>[] = [];
      let title = "Report";

      if (reportType === "revenue") {
        const report = await computeRevenueReport(storage, startDate, endDate, branchFilter);
        title = "Revenue Report";
        columns = [
          { key: "date", label: "Date" },
          { key: "revenue", label: "Revenue (LKR)" },
        ];
        rows = report.dailyTrend.map((d) => ({ date: d.date, revenue: d.revenue }));
      } else if (reportType === "attendance") {
        const report = await computeAttendanceReport(storage, startDate, endDate, undefined, branchFilter);
        title = "Attendance Report";
        columns = [
          { key: "staffName", label: "Staff" },
          { key: "present", label: "Present" },
          { key: "absent", label: "Absent" },
          { key: "leave", label: "Leave" },
          { key: "holiday", label: "Holiday" },
        ];
        rows = report.byStaff.map((s) => ({ ...s }));
      } else if (reportType === "incentive") {
        const report = await computeIncentiveReport(storage, startDate, endDate);
        title = "Incentive Report";
        columns = [
          { key: "staffName", label: "Staff" },
          { key: "clinicVisits", label: "Clinic Visits" },
          { key: "sessions", label: "IP Sessions" },
          { key: "incentiveCount", label: "Incentive Count" },
          { key: "incentiveAmount", label: "Amount (LKR)" },
        ];
        rows = report.map((r) => ({ ...r }));
      } else if (reportType === "unpaid") {
        const report = await computeUnpaidReport(storage, undefined, branchFilter);
        title = "Unpaid Visits";
        columns = [
          { key: "patientName", label: "Patient" },
          { key: "visitDate", label: "Visit Date" },
          { key: "outstandingBalance", label: "Outstanding (LKR)" },
          { key: "branch", label: "Branch" },
        ];
        rows = report.map((r) => ({
          patientName: r.patientName,
          visitDate: r.visitDate,
          outstandingBalance: r.outstandingBalance ?? r.amount,
          branch: r.branch,
        }));
      } else if (reportType === "expenses") {
        const report = await computeExpenseReport(storage, startDate, endDate, branchFilter);
        title = "Expense Report";
        columns = [
          { key: "expenseDate", label: "Date" },
          { key: "category", label: "Category" },
          { key: "amount", label: "Amount (LKR)" },
          { key: "description", label: "Description" },
        ];
        rows = report.items.map((e) => ({
          expenseDate: e.expenseDate,
          category: e.category,
          amount: e.amount,
          description: e.description ?? "",
        }));
      } else {
        return errorResponse(res, "Unknown report type", 400);
      }

      const filename = `${reportType}-${startDate}-${endDate}.${exportSvc.exportFileExtension(format)}`;
      res.setHeader("Content-Type", exportSvc.exportContentType(format));
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      if (format === "csv") {
        return res.send(exportSvc.rowsToCsv(columns, rows));
      }
      if (format === "xlsx") {
        const buf = await exportSvc.rowsToExcelBuffer(columns, rows, title);
        return res.send(buf);
      }
      const pdf = await exportSvc.rowsToPdfBuffer(title, columns, rows);
      return res.send(pdf);
    } catch (error: any) {
      console.error("Export Error:", error);
      return errorResponse(res, error.message, 500);
    }
  });
}
