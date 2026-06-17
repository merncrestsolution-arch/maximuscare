import { ENTERPRISE_BRANCHES, normalizeBranchName } from "@shared/branches";
import { authApi } from "@/lib/api";

export function pickDefaultBranchId(
  allowedBranches: { id: string; code?: string | null; name?: string; branchName?: string | null }[]
): string | null {
  if (allowedBranches.length === 0) return null;

  const order = ["DEHIWALA", "BANDARAGAMA", "NEURO", "NEXUS"] as const;
  for (const code of order) {
    const def = ENTERPRISE_BRANCHES.find((b) => b.code === code);
    const match = allowedBranches.find((branch) => {
      if (String(branch.code ?? "").toUpperCase() === code) return true;
      const label = normalizeBranchName(branch.branchName ?? branch.name);
      return !!def && label === def.shortName;
    });
    if (match) return match.id;
  }

  return allowedBranches[0]?.id ?? null;
}

export async function navigateToDashboard(options: {
  selectedBranchId: string | null;
  allowedBranches: { id: string; code?: string | null; name?: string; branchName?: string | null }[];
  selectBranch: (branchId: string) => Promise<void>;
  refreshBranchContext?: () => Promise<void>;
  setLocation: (path: string) => void;
}): Promise<boolean> {
  try {
    let branchId = options.selectedBranchId;

    if (!branchId) {
      let branches = options.allowedBranches;
      if (branches.length === 0) {
        branches = await authApi.getBranches();
      }
      branchId = pickDefaultBranchId(branches);
      if (!branchId) {
        options.setLocation("/auth/branch-select");
        return false;
      }
      await options.selectBranch(branchId);
      await options.refreshBranchContext?.();
    }

    options.setLocation("/dashboard");
    return true;
  } catch {
    options.setLocation("/auth/branch-select");
    return false;
  }
}
