export type AppRole = "Admin" | "MD" | "Receptionist" | "Physiotherapist" | "Staff";

export function isManagementRole(role: string | undefined): boolean {
  return role === "Admin" || role === "MD";
}

export function isSessionRole(role: string | undefined): boolean {
  return role === "Physiotherapist" || role === "Staff";
}

export function canViewAllPatients(role: string | undefined): boolean {
  return isManagementRole(role) || role === "Receptionist";
}

export function canViewAllVisits(role: string | undefined): boolean {
  return isManagementRole(role) || role === "Receptionist";
}

export function canEditVisit(
  role: string | undefined,
  userStaffId: string,
  visit: { treatingStaffId: string; createdByStaffId: string }
): boolean {
  if (isManagementRole(role) || role === "Receptionist") return true;
  if (role === "Physiotherapist" || role === "Staff") {
    return visit.treatingStaffId === userStaffId || visit.createdByStaffId === userStaffId;
  }
  return false;
}

export function canDeleteCriticalData(role: string | undefined): boolean {
  return role === "Admin";
}
