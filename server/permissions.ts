/**
 * Thin compatibility layer over the centralized RBAC matrix
 * (`server/rbac/permissions.ts`). Historically this file maintained its own
 * role lists, which drifted out of sync with the matrix (e.g. Physiotherapist
 * patient access, Manager visibility). All checks now delegate to the single
 * source of truth so routes and middleware agree.
 */
import { hasPermission } from "./rbac/permissions";

export type AppRole = "Admin" | "MD" | "Receptionist" | "Physiotherapist" | "Staff";

export function isManagementRole(role: string | undefined): boolean {
  return role === "Admin" || role === "MD";
}

export function isAdminRole(role: string | undefined): boolean {
  return String(role ?? "").trim() === "Admin";
}

/** Admin, MD, and Nexus MD may view fines for all staff (branch-scoped on the API). */
export function canViewAllStaffFines(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return r === "Admin" || r === "MD" || r === "Nexus MD";
}

/** Only Admin may create, edit, or delete fines. */
export function canManageStaffFines(role: string | undefined): boolean {
  return isAdminRole(role);
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
