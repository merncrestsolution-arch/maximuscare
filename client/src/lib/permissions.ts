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
  return isManagementRole(role);
}

export function canViewStaffList(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canManageStaff(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canManageSalary(role: string | undefined): boolean {
  return isManagementRole(role);
}

export function canViewSalary(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return isManagementRole(r) || r === "Physiotherapist" || r === "Staff";
}

/** Branch managers and Nexus MD should not see cross-branch overview nav items. */
export function canSeeOverviewNav(role: string | undefined): boolean {
  return canAccessMaximusOverview(role) || canAccessNexusOverview(role);
}
