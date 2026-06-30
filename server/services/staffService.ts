import type { IStorage } from "../storage";
import type { Staff, Branch } from "@shared/schema";
import { normalizeBranchName } from "@shared/branches";
import { isClinicalRole, isOperationalLead } from "@shared/roles";
import { clinicDateString } from "../clinicTime";
import { computePayrollReport } from "./payrollService";
import { summarizeAttendance, inDateRange, computeExtraHolidayCount } from "./calculationEngine";
import { loadPayrollSettings } from "./payrollService";

export interface StaffProfileStats {
  totalVisits: number;
  totalSessions: number;
  totalIncentiveCount: number;
  totalIncentiveEarnings: number;
  totalOtHours: number;
  totalHomeVisits: number;
  totalSalaryEarned: number;
  attendance: {
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    holidayDays: number;
    extraHolidays: number;
    attendancePercent: number;
  };
  taskCompletionPercent: number;
}

export interface LeaderboardEntry {
  staffId: string;
  staffName: string;
  employeeCode: string | null;
  branch: string | null;
  value: number;
  rank: number;
}

export async function ensureEmployeeCode(storage: IStorage, staff: Staff): Promise<string> {
  if (staff.employeeCode) return staff.employeeCode;
  const all = await storage.getAllStaff();
  const num = all.filter((s) => s.employeeCode).length + 1;
  const code = `EMP-${String(num).padStart(5, "0")}`;
  await storage.updateStaff(staff.id, { employeeCode: code } as any);
  return code;
}

export async function computeStaffProfileStats(
  storage: IStorage,
  staffId: string,
  startDate: string,
  endDate: string,
): Promise<StaffProfileStats> {
  const visits = await storage.getVisitsByStaffAndDateRange(staffId, startDate, endDate);
  const sessions = await storage.getInPatientSessionsByStaffAndDateRange(staffId, startDate, endDate);
  const attendance = (await storage.getAttendanceByStaff(staffId)).filter((a) =>
    inDateRange(a.date, startDate, endDate),
  );
  const attSummary = summarizeAttendance(attendance);
  const settings = await loadPayrollSettings(storage);
  const totalDays = attSummary.present + attSummary.absent + attSummary.leave + attSummary.holiday;
  const attendancePercent = totalDays > 0 ? Math.round((attSummary.present / totalDays) * 100) : 0;
  const extraHolidays = computeExtraHolidayCount(attSummary.absent, settings.freeAbsentDays);
  const homeVisits = visits.filter((v) => v.visitType === "Home");
  const payroll = await computePayrollReport(storage, startDate, endDate, [staffId]);
  const summary = payroll.summaries[0];
  const otHours = attendance.reduce((sum, a) => sum + Number(a.overtimeHours || 0), 0);

  const tasks = await storage.getTasksForStaff(staffId);
  const periodTasks = tasks.filter((t) => {
    if (!t.dueDate) return true;
    return inDateRange(t.dueDate, startDate, endDate);
  });
  const completed = periodTasks.filter(
    (t) => t.status === "Completed" || t.status === "completed",
  ).length;
  const taskCompletionPercent =
    periodTasks.length > 0 ? Math.round((completed / periodTasks.length) * 100) : 100;

  return {
    totalVisits: visits.length,
    totalSessions: sessions.length,
    totalIncentiveCount: summary?.incentiveCount ?? 0,
    totalIncentiveEarnings: Number(summary?.incentiveTotal ?? 0),
    totalOtHours: otHours,
    totalHomeVisits: homeVisits.length,
    totalSalaryEarned: Number(summary?.finalSalary ?? 0),
    attendance: {
      presentDays: attSummary.present,
      absentDays: attSummary.absent,
      leaveDays: attSummary.leave,
      holidayDays: attSummary.holiday,
      extraHolidays,
      attendancePercent,
    },
    taskCompletionPercent,
  };
}

export type LeaderboardMetric =
  | "incentives"
  | "visits"
  | "sessions"
  | "tasks"
  | "attendance";

export async function computeStaffLeaderboard(
  storage: IStorage,
  metric: LeaderboardMetric,
  startDate: string,
  endDate: string,
): Promise<LeaderboardEntry[]> {
  const staffList = (await storage.getActiveStaff()).filter((s) =>
    ["Physiotherapist", "Staff", "Receptionist"].includes(s.role),
  );
  const rows: { staffId: string; staffName: string; employeeCode: string | null; branch: string | null; value: number }[] = [];

  for (const s of staffList) {
    let value = 0;
    if (metric === "incentives") {
      const payroll = await computePayrollReport(storage, startDate, endDate, [s.id]);
      value = Number(payroll.summaries[0]?.incentiveTotal ?? 0);
    } else if (metric === "visits") {
      const visits = await storage.getVisitsByStaffAndDateRange(s.id, startDate, endDate);
      value = visits.length;
    } else if (metric === "sessions") {
      const sessions = await storage.getInPatientSessionsByStaffAndDateRange(s.id, startDate, endDate);
      value = sessions.length;
    } else if (metric === "tasks") {
      const tasks = await storage.getTasksForStaff(s.id);
      const periodTasks = tasks.filter((t) => !t.dueDate || inDateRange(t.dueDate, startDate, endDate));
      const done = periodTasks.filter((t) => t.status === "Completed" || t.status === "completed").length;
      value = periodTasks.length > 0 ? Math.round((done / periodTasks.length) * 100) : 0;
    } else if (metric === "attendance") {
      const att = (await storage.getAttendanceByStaff(s.id)).filter((a) =>
        inDateRange(a.date, startDate, endDate),
      );
      const attSum = summarizeAttendance(att);
      const td = attSum.present + attSum.absent + attSum.leave + attSum.holiday;
      value = td > 0 ? Math.round((attSum.present / td) * 100) : 0;
    }
    rows.push({
      staffId: s.id,
      staffName: s.name,
      employeeCode: s.employeeCode ?? null,
      branch: s.branch ?? null,
      value,
    });
  }

  rows.sort((a, b) => b.value - a.value);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function validateStaffPhoto(dataUri: string): { ok: true } | { ok: false; message: string } {
  const match = dataUri.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!match) {
    return { ok: false, message: "Photo must be JPG, JPEG, PNG, or WEBP (base64 data URI)" };
  }
  const bytes = Buffer.byteLength(match[2], "base64");
  if (bytes > 5 * 1024 * 1024) {
    return { ok: false, message: "Photo must be 5 MB or smaller" };
  }
  return { ok: true };
}

export async function deactivateStaffMember(
  storage: IStorage,
  staffId: string,
  deactivatedBy: string,
): Promise<Staff | undefined> {
  return storage.updateStaff(staffId, {
    isActive: false,
    deactivatedAt: new Date(),
    deactivatedBy,
  } as any);
}

export async function activateStaffMember(
  storage: IStorage,
  staffId: string,
): Promise<Staff | undefined> {
  return storage.updateStaff(staffId, {
    isActive: true,
    deactivatedAt: null,
    deactivatedBy: null,
  } as any);
}

export function staffMatchesBranch(staff: Staff, branchName: string | null | undefined): boolean {
  if (!branchName) return true;
  const target = normalizeBranchName(branchName).toLowerCase();
  const assigned = normalizeBranchName(staff.branch).toLowerCase();
  if (assigned === target) return true;
  if (String(staff.branch ?? "").toLowerCase() === "both") {
    return target === "dehiwala" || target === "neuro rehabilitation";
  }
  return false;
}

/**
 * Branch-aware staff filter that also honours explicit multi-branch assignments
 * (stored in userBranchPermissions). The legacy `staff.branch` column collapses
 * multi-branch staff to "Both", which only maps to Dehiwala/Neuro — so without
 * this, a staff assigned to e.g. Bandaragama + Dehiwala would never appear under
 * the Bandaragama filter. We union the column heuristic with the permission rows.
 */
export async function filterStaffByBranchAccess(
  storage: IStorage,
  list: Staff[],
  branchName: string | null | undefined,
): Promise<Staff[]> {
  if (!branchName) return list;
  let permittedIds = new Set<string>();
  try {
    const branches = await storage.getAllBranches();
    const targetNorm = normalizeBranchName(branchName).toLowerCase();
    const target = branches.find(
      (b: any) => normalizeBranchName(b.branchName ?? b.name).toLowerCase() === targetNorm,
    );
    if (target) {
      permittedIds = new Set(await storage.getStaffIdsWithBranchPermission(target.id));
    }
  } catch {
    // fall back to column heuristic only
  }
  return list.filter((s) =>
    staffMatchesBranch(s, branchName) ||
    permittedIds.has(s.id)
  );
}

/**
 * The set of all staff IDs belonging to a branch (honouring multi-branch / "Both"
 * assignments). Used to branch-scope salary/payroll/fines listings so a branch only
 * ever sees its own staff. Returns null when no branch is given (e.g. a management
 * overview context), meaning "do not branch-scope".
 */
export async function branchStaffIdSet(
  storage: IStorage,
  branchName: string | null | undefined,
): Promise<Set<string> | null> {
  if (!branchName) return null;
  const allStaff = await storage.getAllStaff();
  const scoped = await filterStaffByBranchAccess(storage, allStaff, branchName);
  return new Set(scoped.map((s) => s.id));
}

export interface TreatingStaffOption {
  id: string;
  name: string;
  role: string;
  branch: string | null;
  isActive: boolean | number;
}

function toTreatingStaffOption(s: Staff): TreatingStaffOption {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    branch: s.branch ?? null,
    isActive: s.isActive,
  };
}

/**
 * Branch/organization-scoped list of clinical staff for the "Treating Staff" /
 * "Treating Physiotherapist" dropdowns used by Add Visit, Add Session and
 * Appointment forms.
 *
 * Scope rules:
 *  - If a specific branch is selected, return clinical staff for that branch.
 *  - Otherwise return clinical staff across every branch the user is allowed to
 *    access (so a Nexus user only sees Nexus staff, a Maximus user only sees
 *    Maximus staff, and Admin/MD — whose allowed set is every branch — see all).
 *
 * Accessible to any authenticated user who can record a visit/session, not just
 * staff-directory viewers, because every clinician needs to pick the treating
 * staff regardless of their own role.
 */
export async function getTreatingStaffOptions(
  storage: IStorage,
  ctx: { selectedBranchName: string | null; allowedBranches: Branch[] },
): Promise<TreatingStaffOption[]> {
  const active = await storage.getActiveStaff();
  const clinical = active.filter((s) => isClinicalRole(s.role));

  if (ctx.selectedBranchName) {
    const scoped = await filterStaffByBranchAccess(storage, clinical, ctx.selectedBranchName);
    return scoped.map(toTreatingStaffOption).sort((a, b) => a.name.localeCompare(b.name));
  }

  if (ctx.allowedBranches.length > 0) {
    const seen = new Set<string>();
    const result: Staff[] = [];
    for (const branch of ctx.allowedBranches) {
      const branchName = branch.branchName ?? branch.name;
      const scoped = await filterStaffByBranchAccess(storage, clinical, branchName);
      for (const s of scoped) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          result.push(s);
        }
      }
    }
    return result.map(toTreatingStaffOption).sort((a, b) => a.name.localeCompare(b.name));
  }

  return clinical.map(toTreatingStaffOption).sort((a, b) => a.name.localeCompare(b.name));
}

export function staffDirectoryRow(
  staff: Staff,
  todayAttendanceStatus: string | null,
) {
  return {
    id: staff.id,
    employeeCode: staff.employeeCode,
    photoUri: staff.photoUri || staff.profilePhoto,
    name: staff.name,
    designation: staff.designation || staff.role,
    branch: staff.branch,
    joiningDate: staff.joiningDate,
    status: staff.isActive === false || (staff.isActive as unknown) === 0 ? "Inactive" : "Active",
    attendanceStatus: todayAttendanceStatus,
    role: staff.role,
    phone: staff.phone,
    email: staff.email,
    isActive: staff.isActive,
  };
}
