/**
 * Part 8 — centralized RBAC permission matrix.
 * Maps coarse actions to roles. Extend here instead of scattering checks.
 */
export type RbacRole =
  | "Admin"
  | "MD"
  | "Receptionist"
  | "Physiotherapist"
  | "Staff"
  | "Branch Manager"
  | "Manager"
  | "Nexus MD";

export type Permission =
  | "staff.manage"
  | "staff.view"
  | "staff.deactivate"
  | "patients.manage"
  | "patients.view_all"
  | "visits.manage"
  | "visits.view_all"
  | "attendance.manage"
  | "attendance.mark_own"
  | "tasks.manage"
  | "tasks.complete_own"
  | "salary.manage"
  | "salary.approve"
  | "salary.view_own"
  | "reports.view"
  | "reports.export"
  | "branches.manage"
  | "settings.manage"
  | "notifications.manage"
  | "notifications.view_own"
  | "audit.view"
  | "critical.delete"
  | "appointments.manage"
  | "appointments.view"
  | "expenses.manage"
  | "inpatients.manage";

const ROLE_PERMISSIONS: Record<RbacRole, Permission[]> = {
  Admin: [
    "staff.manage",
    "staff.view",
    "staff.deactivate",
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "visits.view_all",
    "attendance.manage",
    "attendance.mark_own",
    "tasks.manage",
    "tasks.complete_own",
    "salary.manage",
    "salary.approve",
    "salary.view_own",
    "reports.view",
    "reports.export",
    "branches.manage",
    "settings.manage",
    "notifications.manage",
    "notifications.view_own",
    "audit.view",
    "critical.delete",
    "appointments.manage",
    "appointments.view",
    "expenses.manage",
    "inpatients.manage",
  ],
  MD: [
    "staff.manage",
    "staff.view",
    "staff.deactivate",
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "visits.view_all",
    "attendance.manage",
    "attendance.mark_own",
    "tasks.manage",
    "tasks.complete_own",
    "salary.manage",
    "salary.approve",
    "salary.view_own",
    "reports.view",
    "reports.export",
    "notifications.manage",
    "notifications.view_own",
    "audit.view",
    "appointments.manage",
    "appointments.view",
    "expenses.manage",
    "inpatients.manage",
  ],
  Receptionist: [
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "visits.view_all",
    "attendance.mark_own",
    "tasks.complete_own",
    "notifications.view_own",
    "appointments.manage",
    "appointments.view",
  ],
  Physiotherapist: [
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "attendance.mark_own",
    "tasks.complete_own",
    "salary.view_own",
    "reports.view",
    "notifications.view_own",
    "appointments.view",
  ],
  Staff: [
    "staff.view",
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "visits.view_all",
    "attendance.manage",
    "attendance.mark_own",
    "tasks.manage",
    "tasks.complete_own",
    "appointments.manage",
    "appointments.view",
    "expenses.manage",
    "notifications.view_own",
    "salary.view_own",
    "inpatients.manage",
  ],
  "Branch Manager": [
    "staff.view",
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "visits.view_all",
    "attendance.manage",
    "attendance.mark_own",
    "tasks.manage",
    "tasks.complete_own",
    "reports.view",
    "reports.export",
    "appointments.manage",
    "appointments.view",
    "expenses.manage",
    "notifications.view_own",
    "salary.view_own",
    "inpatients.manage",
  ],
  Manager: [
    "staff.view",
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "visits.view_all",
    "attendance.manage",
    "attendance.mark_own",
    "tasks.manage",
    "tasks.complete_own",
    "appointments.manage",
    "appointments.view",
    "expenses.manage",
    "notifications.view_own",
    "salary.view_own",
    "inpatients.manage",
  ],
  "Nexus MD": [
    "staff.manage",
    "staff.view",
    "patients.manage",
    "patients.view_all",
    "visits.manage",
    "visits.view_all",
    "attendance.manage",
    "attendance.mark_own",
    "tasks.manage",
    "tasks.complete_own",
    "salary.manage",
    "salary.approve",
    "salary.view_own",
    "reports.view",
    "reports.export",
    "notifications.manage",
    "notifications.view_own",
    "appointments.manage",
    "appointments.view",
    "expenses.manage",
    "inpatients.manage",
  ],
};

export function normalizeRole(role: string | undefined): RbacRole | null {
  const r = String(role ?? "").trim();
  if (r === "Physio") return "Physiotherapist";
  if (r === "Branch Manager") return "Branch Manager";
  if (r === "Manager") return "Manager";
  if (r === "Nexus MD") return "Nexus MD";
  if (r in ROLE_PERMISSIONS) return r as RbacRole;
  return null;
}

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return ROLE_PERMISSIONS[normalized].includes(permission);
}

export function requirePermission(role: string | undefined, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
