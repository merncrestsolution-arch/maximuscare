/** Admin and Medical Director — full record management (edit/delete across modules). */
export function isManagementRole(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return r === "Admin" || r === "MD";
}

export function isAdminRole(role: string | undefined): boolean {
  return String(role ?? "").trim() === "Admin";
}

export function isNexusManagingDirector(role: string | undefined): boolean {
  return String(role ?? "").trim() === "Nexus MD";
}

export function isBranchManager(role: string | undefined): boolean {
  return String(role ?? "").trim() === "Branch Manager";
}

export function isManager(role: string | undefined): boolean {
  return String(role ?? "").trim() === "Manager";
}

/** Admin, MD, and Nexus MD — income, revenue, and org-wide financial summaries. */
export function canViewFinancialSummary(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return r === "Admin" || r === "MD" || r === "Nexus MD";
}

/** Branch-level operational leads (Manager / Branch Manager) without full financial access. */
export function isOperationalLead(role: string | undefined): boolean {
  return isManagementRole(role) || isBranchManager(role) || isManager(role);
}

export function canAccessMaximusOverview(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canAccessNexusOverview(role: string | undefined): boolean {
  return isManagementRole(role) || isNexusManagingDirector(role);
}

export function canViewReports(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return r !== "Receptionist" && r !== "Staff";
}

export function canExportPatients(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return r === "Admin" || r === "MD" || r === "Receptionist";
}

export function canViewManagementReports(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canManageSettings(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canManageTasks(role: string | undefined): boolean {
  return isManagementRole(role) || isOperationalLead(role);
}

/**
 * Create / edit / delete appointments. Mirrors the server RBAC `appointments.manage`
 * permission (Admin, MD, Nexus MD, Manager, Branch Manager, Receptionist) so the UI
 * doesn't hide actions the API actually allows.
 */
export function canManageAppointments(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return isOperationalLead(r) || isNexusManagingDirector(r) || r === "Receptionist";
}

/** Read access to the staff directory, profiles, and attendance history. */
export function canViewStaffList(role: string | undefined): boolean {
  return isManagementRole(role) || isOperationalLead(role);
}

/** Create / edit / delete staff accounts (sensitive: logins, salary). */
export function canManageStaff(role: string | undefined): boolean {
  return isManagementRole(role);
}

/** View team attendance and mark attendance for other staff. */
export function canManageAttendance(role: string | undefined): boolean {
  return isManagementRole(role) || isOperationalLead(role);
}

/** View the system-wide activity / audit log dashboard (Admin & MD only). */
export function canViewAuditLogs(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canManageSalary(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canViewSalary(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return isManagementRole(r) || r === "Physiotherapist" || r === "Staff";
}

/**
 * Salary & incentive reports contain financial figures. Visible to financial
 * roles (Admin/MD/Nexus MD) and to physiotherapists/staff for their own
 * earnings. Managers/Branch Managers are intentionally excluded.
 */
export function canViewSalaryReports(role: string | undefined): boolean {
  return canViewFinancialSummary(role) || canViewSalary(role);
}

/** Branch managers and Nexus MD should not see cross-branch overview nav items. */
export function canSeeOverviewNav(role: string | undefined): boolean {
  return canAccessMaximusOverview(role) || canAccessNexusOverview(role);
}
