/**
 * Single source of truth for role-name groupings used across the app.
 * Keep server-side filters and client-side dropdowns in sync by importing
 * from here instead of hard-coding role strings.
 */

/**
 * Roles that can be assigned as the treating/session clinician on a
 * visit, in-patient session, or appointment. In this clinic physiotherapists
 * are sometimes stored under the generic "Staff" role, so it is included.
 */
export const CLINICAL_ROLES = [
  "Physiotherapist",
  "Staff",
  "MD",
  "Nexus MD",
  "Manager",
  "Branch Manager",
] as const;

export type ClinicalRole = (typeof CLINICAL_ROLES)[number];

export function isClinicalRole(role: string | null | undefined): boolean {
  return CLINICAL_ROLES.includes(String(role ?? "") as ClinicalRole);
}

export function isOperationalLead(role: string): boolean {
  return ["Admin", "MD", "Nexus MD", "Manager", "Branch Manager"].includes(role);
}
