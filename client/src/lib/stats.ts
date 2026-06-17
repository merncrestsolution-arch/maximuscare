import { normalizeBranchName } from "@shared/branches";
import type { Visit } from "./types";

/** @deprecated Legacy shape used by payroll / physio summary APIs */
export interface VisitStats {
  colomboHome: number;
  colomboClinic: number;
  bandaragamaHome: number;
  bandaragamaClinic: number;
}

export interface BranchVisitStats {
  branch: string;
  home: number;
  clinic: number;
}

export function calculateVisitStatsByBranch(visits: Visit[]): Map<string, BranchVisitStats> {
  const map = new Map<string, BranchVisitStats>();
  for (const visit of visits) {
    const branch = normalizeBranchName(visit.branch);
    if (!branch) continue;
    const isHome = (visit.visitType || "").trim().toLowerCase() === "home";
    const current = map.get(branch) ?? { branch, home: 0, clinic: 0 };
    if (isHome) current.home++;
    else current.clinic++;
    map.set(branch, current);
  }
  return map;
}

export function calculateVisitStats(visits: Visit[]): VisitStats {
  const byBranch = calculateVisitStatsByBranch(visits);
  const dehiwala = byBranch.get("Dehiwala") ?? { home: 0, clinic: 0 };
  const bandaragama = byBranch.get("Bandaragama") ?? { home: 0, clinic: 0 };
  return {
    colomboHome: dehiwala.home,
    colomboClinic: dehiwala.clinic,
    bandaragamaHome: bandaragama.home,
    bandaragamaClinic: bandaragama.clinic,
  };
}
