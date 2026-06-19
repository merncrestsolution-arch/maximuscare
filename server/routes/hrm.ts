import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { requireStaffManage, requireStaffView, requireStaffDeactivate, requireNotificationsManage } from "../middleware/secureApi";
import { successResponse, errorResponse } from "../response";
import { canViewStaff } from "../permissions";
import { logAudit } from "../services/auditService";
import { clinicDateString } from "../clinicTime";
import {
  computeStaffProfileStats,
  computeStaffLeaderboard,
  ensureEmployeeCode,
  validateStaffPhoto,
  deactivateStaffMember,
  activateStaffMember,
  staffDirectoryRow,
  filterStaffByBranchAccess,
} from "../services/staffService";
import { computeAttendanceDashboard } from "../services/attendanceService";
import {
  computeTaskDashboard,
  createTaskWithAssignments,
  normalizePriority,
  normalizeStatus,
} from "../services/taskService";
import { sendNotification } from "../services/notificationService";

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? "";
  return req.socket.remoteAddress ?? "";
}

async function editorName(staffId: string) {
  const s = await storage.getStaff(staffId);
  return s?.name ?? "";
}

export function registerHrmRoutes(app: Express) {
  // Staff directory (management + operational leads)
  app.get("/api/staff/directory", requireAuth, requireStaffView, async (req, res) => {
    try {
      const { loadBranchContext, getSelectedBranchName } = await import("../middleware/branchContext");
      await loadBranchContext(req as any);
      const sessionBranch = getSelectedBranchName(req as any);

      const includeInactive = req.query.includeInactive === "true";
      const branch = (req.query.branch as string | undefined) || sessionBranch || undefined;
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const search = String(req.query.search || "").toLowerCase();

      let list = includeInactive ? await storage.getAllStaff() : await storage.getActiveStaff();
      if (branch) {
        list = await filterStaffByBranchAccess(storage, list, branch);
      }
      if (role) list = list.filter((s) => s.role === role);
      if (status === "Active") list = list.filter((s) => s.isActive !== false && (s.isActive as unknown) !== 0);
      if (status === "Inactive") list = list.filter((s) => s.isActive === false || (s.isActive as unknown) === 0);
      if (search) {
        list = list.filter(
          (s) =>
            s.name.toLowerCase().includes(search) ||
            (s.employeeCode ?? "").toLowerCase().includes(search) ||
            (s.phone ?? "").includes(search) ||
            s.role.toLowerCase().includes(search),
        );
      }

      const today = clinicDateString();
      const todayAttendance = await storage.getAttendanceByDateRange(today, today);
      const attByStaff = new Map(todayAttendance.map((a) => [a.staffId, a.status]));

      const rows = await Promise.all(
        list.map(async (s) => {
          if (!s.employeeCode) await ensureEmployeeCode(storage, s);
          const fresh = (await storage.getStaff(s.id)) ?? s;
          return staffDirectoryRow(fresh, attByStaff.get(s.id) ?? null);
        }),
      );

      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/staff/:id/stats", requireAuth, async (req, res) => {
    try {
      const id = param(req, "id");
      const user = (req as any).user;
      if (!canViewStaff(user.role) && user.staffId !== id) {
        return errorResponse(res, "Forbidden", 403);
      }
      const today = clinicDateString();
      const startDate = (req.query.startDate as string) || `${today.slice(0, 7)}-01`;
      const endDate = (req.query.endDate as string) || today;
      const stats = await computeStaffProfileStats(storage, id, startDate, endDate);
      return successResponse(res, stats);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/staff/leaderboard", requireAuth, requireStaffManage, async (req, res) => {
    try {
      const metric = (req.query.metric as any) || "incentives";
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return errorResponse(res, "startDate and endDate required", 400);
      const board = await computeStaffLeaderboard(storage, metric, startDate, endDate);
      return successResponse(res, board);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/staff/:id/photo", requireAuth, requireStaffManage, async (req, res) => {
    try {
      const id = param(req, "id");
      const { photoUri } = req.body;
      if (!photoUri) return errorResponse(res, "photoUri required", 400);
      const check = validateStaffPhoto(photoUri);
      if (!check.ok) return errorResponse(res, check.message, 400);
      const before = await storage.getStaff(id);
      const staff = await storage.updateStaff(id, { photoUri, profilePhoto: photoUri } as any);
      if (!staff) return errorResponse(res, "Staff not found", 404);
      const user = (req as any).user;
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "staff",
        action: "photo_update",
        recordId: id,
        oldValue: before,
        newValue: staff,
        ipAddress: clientIp(req),
      });
      const { password: _, ...safe } = staff;
      return successResponse(res, safe, "Photo updated");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/staff/:id/photo", requireAuth, requireStaffManage, async (req, res) => {
    try {
      const id = param(req, "id");
      const before = await storage.getStaff(id);
      const staff = await storage.updateStaff(id, { photoUri: null, profilePhoto: null } as any);
      if (!staff) return errorResponse(res, "Staff not found", 404);
      const user = (req as any).user;
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "staff",
        action: "photo_remove",
        recordId: id,
        oldValue: before,
        newValue: staff,
        ipAddress: clientIp(req),
      });
      const { password: _, ...safe } = staff;
      return successResponse(res, safe, "Photo removed");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.patch("/api/staff/:id/deactivate", requireAuth, requireStaffDeactivate, async (req, res) => {
    try {
      const id = param(req, "id");
      const user = (req as any).user;
      const before = await storage.getStaff(id);
      const staff = await deactivateStaffMember(storage, id, user.staffId);
      if (!staff) return errorResponse(res, "Staff not found", 404);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "staff",
        action: "deactivate",
        recordId: id,
        oldValue: before,
        newValue: staff,
        ipAddress: clientIp(req),
      });
      const { password: _, ...safe } = staff;
      return successResponse(res, safe, "Staff deactivated");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.patch("/api/staff/:id/activate", requireAuth, requireStaffDeactivate, async (req, res) => {
    try {
      const id = param(req, "id");
      const user = (req as any).user;
      const before = await storage.getStaff(id);
      const staff = await activateStaffMember(storage, id);
      if (!staff) return errorResponse(res, "Staff not found", 404);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "staff",
        action: "activate",
        recordId: id,
        oldValue: before,
        newValue: staff,
        ipAddress: clientIp(req),
      });
      const { password: _, ...safe } = staff;
      return successResponse(res, safe, "Staff activated");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // Attendance dashboard
  app.get("/api/attendance/dashboard", requireAuth, async (req, res) => {
    try {
      const date = (req.query.date as string) || clinicDateString();
      const dash = await computeAttendanceDashboard(storage, date);
      return successResponse(res, dash);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // Task dashboard
  app.get("/api/tasks/dashboard", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const staffId = canViewStaff(user.role) && req.query.all === "true" ? undefined : user.staffId;
      const dash = await computeTaskDashboard(storage, staffId);
      return successResponse(res, dash);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // Notification archive / delete
  app.patch("/api/notifications/:id/archive", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const n = await storage.archiveNotification(param(req, "id"), user.staffId);
      if (!n) return errorResponse(res, "Notification not found", 404);
      return successResponse(res, n);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const ok = await storage.softDeleteNotification(param(req, "id"), user.staffId);
      if (!ok) return errorResponse(res, "Notification not found", 404);
      return successResponse(res, null, "Notification deleted");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/notifications/history", requireAuth, requireNotificationsManage, async (req, res) => {
    try {
      const staffId = req.query.staffId as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const allStaff = staffId ? [await storage.getStaff(staffId)].filter(Boolean) : await storage.getAllStaff();
      const history: any[] = [];
      for (const s of allStaff as any[]) {
        const notes = await storage.getNotificationsByStaff(s.id, { includeDeleted: true });
        history.push(...notes.map((n) => ({ ...n, recipientName: s.name })));
      }
      history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return successResponse(res, history.slice(0, limit));
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });
}

/** Enhanced task create — used from extended routes patch */
export async function handleCreateTask(req: Request, res: Response) {
  const user = (req as any).user;
  const body = req.body;
  const taskType = body.taskType === "Common" ? "Common" : "Individual";
  const priority = normalizePriority(body.priority ?? "Medium");
  const status = normalizeStatus(body.status ?? "Pending");

  const created = await createTaskWithAssignments(
    storage,
    {
      title: body.title,
      description: body.description,
      priority,
      status,
      dueDate: body.dueDate,
      taskType,
      remarks: body.remarks,
      assignedToStaffId: body.assignedToStaffId,
      assignedStaffIds: body.assignedStaffIds,
    } as any,
    { staffId: user.staffId, name: await editorName(user.staffId) },
  );

  for (const task of created) {
    await logAudit(storage, {
      userId: user.staffId,
      userName: await editorName(user.staffId),
      module: "task",
      action: "create",
      recordId: task.id,
      newValue: task,
      ipAddress: clientIp(req),
    });
  }
  return successResponse(res, created.length === 1 ? created[0] : created, "Task created", 201);
}
