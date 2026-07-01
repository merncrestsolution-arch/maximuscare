/**
 * Thin compatibility layer over the centralized RBAC matrix
 * (`server/rbac/permissions.ts`). Historically this file maintained its own
 * role lists, which drifted out of sync with the matrix (e.g. Physiotherapist
 * patient access, Manager visibility). All checks now delegate to the single
 * source of truth so routes and middleware agree.
 */
import { hasPermission } from "./rbac/permissions";

import type { MdRoleCapabilities } from "@shared/mdCapabilities";

export type AppRole = "Admin" | "MD" | "Receptionist" | "Physiotherapist" | "Staff";

export function isManagementRole(role: string | undefined): boolean {
  return role === "Admin" || role === "MD";
}

export function isAdminRole(role: string | undefined): boolean {
  return String(role ?? "").trim() === "Admin";
}

/** Admin always; MD / Manager / Branch Manager when enabled on their staff profile. */
export function canViewAttendanceLocation(
  role: string | undefined,
  mdCaps?: MdRoleCapabilities,
): boolean {
  if (isAdminRole(role)) return true;
  const r = String(role ?? "").trim();
  if (r === "MD" || r === "Manager" || r === "Branch Manager") {
    return mdCaps?.viewAttendanceLocation ?? false;
  }
  return false;
}

/** Admin always; MD / Manager / Branch Manager per staff profile flags. */
export function isAttendanceLocationExempt(
  role: string | undefined,
  mdCaps?: MdRoleCapabilities,
): boolean {
  if (isAdminRole(role)) return true;
  const r = String(role ?? "").trim();
  if (r === "MD") return mdCaps?.locationExempt ?? true;
  if (r === "Manager" || r === "Branch Manager") return mdCaps?.locationExempt ?? false;
  return false;
}

/** Admin, Nexus MD, MD (if enabled), and branch leads may view fines (API branch-scoped). */
export function canViewAllStaffFines(
  role: string | undefined,
  mdCaps?: MdRoleCapabilities,
): boolean {
  const r = String(role ?? "").trim();
  if (r === "Admin" || r === "Nexus MD") return true;
  if (r === "MD") return mdCaps?.viewAllStaffFines ?? true;
  if (canManageBranchFines(role)) return mdCaps?.viewAllStaffFines ?? true;
  return false;
}

/** Branch leads who may record fines for staff in their assigned branches. */
export function canManageBranchFines(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return r === "Manager" || r === "Branch Manager";
}

/** Admin always; MD only when admin enables fine management; branch leads for their branch. */
export function canManageStaffFines(
  role: string | undefined,
  mdCaps?: MdRoleCapabilities,
): boolean {
  if (isAdminRole(role)) return true;
  if (canManageBranchFines(role)) return mdCaps?.manageStaffFines ?? true;
  if (String(role ?? "").trim() === "MD") return mdCaps?.manageStaffFines ?? false;
  return false;
}

export function isSessionRole(role: string | undefined): boolean {
  return role === "Physiotherapist" || role === "Staff" || role === "Manager";
}

/**
 * Operational leads supervise a branch/organization without being full admins:
 * Manager, Branch Manager, and Nexus MD. They can view staff and all
 * patients/visits within their branch context.
 */
export { isOperationalLead } from "@shared/roles";

/** Re-admit a discharged in-patient (new admission episode). */
export function canReAdmitInPatient(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  if (r === "Admin" || r === "MD" || r === "Receptionist") return true;
  return hasPermission(r, "inpatients.manage");
}

/** Roles that can view the staff directory and other staff profiles (read access). */
export function canViewStaff(role: string | undefined): boolean {
  return hasPermission(role, "staff.view");
}

/** Roles allowed to see staff salary/financial fields (Managers are excluded). */
export function canViewStaffFinancials(role: string | undefined): boolean {
  return hasPermission(role, "salary.manage");
}

/**
 * Roles that can mark/edit/delete attendance for OTHER staff (not just their own).
 * Mirrors the `attendance.manage` permission so the API matches the UI, which
 * exposes the "Mark Staff Attendance" and edit/delete controls to operational
 * leads (Manager, Branch Manager, Nexus MD) as well as Admin/MD.
 */
export function canManageOthersAttendance(role: string | undefined): boolean {
  return hasPermission(role, "attendance.manage");
}

export function canViewAllPatients(role: string | undefined): boolean {
  return hasPermission(role, "patients.view_all");
}

export function canViewAllVisits(role: string | undefined): boolean {
  return hasPermission(role, "visits.view_all");
}

/**
 * Roles allowed to edit ANY visit/session within their branch scope.
 * Note: although "Staff" carries `visits.view_all` (so they can *see* the full
 * visit list), normal staff and physiotherapists may only EDIT their own visits
 * (Bug 13). Management + operational leads (Manager/Branch Manager/Nexus MD) may
 * edit all visits in their branch (Bug 11).
 */
const EDIT_ALL_VISITS_ROLES = new Set([
  "Admin",
  "MD",
  "Manager",
  "Branch Manager",
  "Nexus MD",
  "Receptionist",
]);

export function canEditAllVisits(role: string | undefined): boolean {
  return EDIT_ALL_VISITS_ROLES.has(String(role ?? "").trim());
}

export function canEditVisit(
  role: string | undefined,
  userStaffId: string,
  visit: { treatingStaffId: string; createdByStaffId: string }
): boolean {
  if (canEditAllVisits(role)) return true;
  if (hasPermission(role, "visits.manage")) {
    // Staff / Physiotherapist: own visits only.
    return visit.treatingStaffId === userStaffId || visit.createdByStaffId === userStaffId;
  }
  return false;
}

export function canDeleteCriticalData(role: string | undefined): boolean {
  return hasPermission(role, "critical.delete");
}
