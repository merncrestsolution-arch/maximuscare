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

export function canEditVisit(
  role: string | undefined,
  userStaffId: string,
  visit: { treatingStaffId: string; createdByStaffId: string }
): boolean {
  if (hasPermission(role, "visits.view_all")) return true;
  if (hasPermission(role, "visits.manage")) {
    return visit.treatingStaffId === userStaffId || visit.createdByStaffId === userStaffId;
  }
  return false;
}

export function canDeleteCriticalData(role: string | undefined): boolean {
  return hasPermission(role, "critical.delete");
}
