/**
 * Enterprise branch definitions — single source of truth for branch names and codes.
 */
export const ENTERPRISE_BRANCHES = [
  {
    code: "DEHIWALA",
    name: "Dehiwala Main Branch",
    shortName: "Dehiwala",
    homeVisitRateTier: "main" as const,
  },
  {
    code: "BANDARAGAMA",
    name: "Bandaragama Branch",
    shortName: "Bandaragama",
    homeVisitRateTier: "bandaragama" as const,
  },
  {
    code: "NEURO",
    name: "Neuro Rehabilitation Unit",
    shortName: "Neuro Rehabilitation",
    homeVisitRateTier: "main" as const,
  },
  {
    code: "NEXUS",
    name: "Nexus Physio & Rehab Center",
    shortName: "Nexus Physio",
    homeVisitRateTier: "bandaragama" as const,
  },
] as const;

export type BranchCode = (typeof ENTERPRISE_BRANCHES)[number]["code"];
export type HomeVisitRateTier = "main" | "bandaragama";

/** Legacy branch names mapped to current short names. */
export const LEGACY_BRANCH_ALIASES: Record<string, string> = {
  colombo: "Dehiwala",
  dehiwala: "Dehiwala",
  bandaragama: "Bandaragama",
  neuro: "Neuro Rehabilitation",
  "neuro rehabilitation": "Neuro Rehabilitation",
  beruwala: "Nexus Physio",
  nexus: "Nexus Physio",
  "nexus physio": "Nexus Physio",
  "nexus physio & rehab center": "Nexus Physio",
};

export function normalizeBranchName(branch: string | null | undefined): string {
  const raw = String(branch ?? "").trim();
  if (!raw) return "";
  const alias = LEGACY_BRANCH_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const match = ENTERPRISE_BRANCHES.find(
    (b) =>
      b.name.toLowerCase() === raw.toLowerCase() ||
      b.shortName.toLowerCase() === raw.toLowerCase() ||
      b.code.toLowerCase() === raw.toLowerCase()
  );
  return match?.shortName ?? raw;
}

export function getHomeVisitRateTier(branch: string | null | undefined): HomeVisitRateTier {
  const normalized = normalizeBranchName(branch);
  const def = ENTERPRISE_BRANCHES.find((b) => b.shortName === normalized);
  return def?.homeVisitRateTier ?? "main";
}

export function isIncentiveEligibleBranch(branch: string | null | undefined): boolean {
  const normalized = normalizeBranchName(branch);
  return normalized === "Dehiwala";
}

export type TransferBranchRow = {
  id: string;
  name?: string | null;
  branchName?: string | null;
  code?: string | null;
  isActive?: boolean | number | null;
};

/** Pick the four enterprise branches for transfer (by code, then short name, then full name). */
export function pickEnterpriseBranchesForTransfer<T extends TransferBranchRow>(branches: T[]): T[] {
  const usedIds = new Set<string>();
  const results: T[] = [];

  for (const enterprise of ENTERPRISE_BRANCHES) {
    const match =
      branches.find(
        (b) => !usedIds.has(b.id) && String(b.code ?? "").toUpperCase() === enterprise.code,
      ) ??
      branches.find((b) => {
        if (usedIds.has(b.id)) return false;
        return normalizeBranchName(b.branchName ?? b.name) === enterprise.shortName;
      }) ??
      branches.find((b) => {
        if (usedIds.has(b.id)) return false;
        return String(b.name ?? "").trim().toLowerCase() === enterprise.name.toLowerCase();
      });

    if (match) {
      usedIds.add(match.id);
      results.push(match);
    }
  }

  return results.length > 0 ? results : [...branches];
}
