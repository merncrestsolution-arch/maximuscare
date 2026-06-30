import { ENTERPRISE_BRANCHES, normalizeBranchName, type BranchCode } from "./branches";

export type OverviewContext = "maximus-overview" | "nexus-overview";

export const MAXIMUS_BRANCH_CODES: BranchCode[] = ["DEHIWALA", "BANDARAGAMA", "NEURO"];
export const NEXUS_BRANCH_CODE: BranchCode = "NEXUS";

/**
 * This deployment has no `organizations` table — tenancy is expressed as the two
 * enterprise groupings (Maximus Care vs Nexus). We treat that grouping as the
 * "organization" the spec refers to, so patient lookups/history can be scoped
 * across the branches a patient legitimately belongs to without leaking data
 * across the org boundary.
 */
export type OrganizationId = "maximus" | "nexus";

/** Resolve the organization a branch (name, short-name, or code) belongs to. */
export function organizationForBranch(branch: string | null | undefined): OrganizationId {
  const normalized = normalizeBranchName(branch);
  const def = ENTERPRISE_BRANCHES.find((b) => b.shortName === normalized);
  return def?.code === NEXUS_BRANCH_CODE ? "nexus" : "maximus";
}

/** Branch codes that make up an organization. */
export function branchCodesForOrganization(org: OrganizationId): BranchCode[] {
  return org === "nexus" ? [NEXUS_BRANCH_CODE] : [...MAXIMUS_BRANCH_CODES];
}

/** Canonical short-names of the branches that make up an organization. */
export function organizationBranchNames(org: OrganizationId): string[] {
  const codes = branchCodesForOrganization(org);
  return ENTERPRISE_BRANCHES.filter((b) => codes.includes(b.code)).map((b) => b.shortName);
}

/** True when both branch values resolve to the same organization. */
export function sameOrganization(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return organizationForBranch(a) === organizationForBranch(b);
}

export const BRANCH_CHART_COLORS: Record<string, string> = {
  DEHIWALA: "#2563eb",
  BANDARAGAMA: "#16a34a",
  NEURO: "#9333ea",
  NEXUS: "#f59e0b",
};

export const BRANCH_SELECTION_CARDS = [
  { code: "DEHIWALA" as const, label: "Branch 01", subtitle: "Dehiwala Main Branch" },
  { code: "BANDARAGAMA" as const, label: "Branch 02", subtitle: "Bandaragama Branch" },
  { code: "NEURO" as const, label: "Branch 03", subtitle: "Neuro Rehabilitation Unit" },
  {
    code: "NEXUS" as const,
    label: "Branch 04",
    subtitle: "Nexus Physio & Rehab Center (Beruwala)",
  },
] as const;

export function isSuperAdmin(role: string): boolean {
  return role === "Admin";
}

export function isManagingDirector(role: string): boolean {
  return role === "MD";
}

export function isNexusManagingDirector(role: string): boolean {
  return role === "Nexus MD";
}

export function isBranchManager(role: string): boolean {
  return role === "Branch Manager";
}

export function isManager(role: string): boolean {
  return role === "Manager";
}

export { isOperationalLead } from "./roles";

export function hasFullBranchAccess(role: string): boolean {
  return isSuperAdmin(role) || isManagingDirector(role);
}

export function canAccessMaximusOverview(role: string): boolean {
  return hasFullBranchAccess(role);
}

export function canAccessNexusOverview(role: string): boolean {
  return hasFullBranchAccess(role) || isNexusManagingDirector(role);
}

export function getMaximusBranchNames(): string[] {
  return ENTERPRISE_BRANCHES.filter((b) => MAXIMUS_BRANCH_CODES.includes(b.code)).map(
    (b) => b.shortName
  );
}

export function getNexusBranchNames(): string[] {
  return ENTERPRISE_BRANCHES.filter((b) => b.code === NEXUS_BRANCH_CODE).map((b) => b.shortName);
}
