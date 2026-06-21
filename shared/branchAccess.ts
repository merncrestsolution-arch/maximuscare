import { ENTERPRISE_BRANCHES, type BranchCode } from "./branches";

export type OverviewContext = "maximus-overview" | "nexus-overview";

export const MAXIMUS_BRANCH_CODES: BranchCode[] = ["DEHIWALA", "BANDARAGAMA", "NEURO"];
export const NEXUS_BRANCH_CODE: BranchCode = "NEXUS";

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
