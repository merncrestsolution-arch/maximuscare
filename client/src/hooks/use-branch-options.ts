import { useMemo } from "react";
import { useBranch } from "@/context/branch-context";
import { useBranches } from "@/hooks/useData";
import { BRANCH_OPTIONS } from "@/lib/branches";
import { isAdminRole } from "@/lib/permissions";
import { useAuth } from "@/context/auth-context";

export interface BranchOption {
  id: string;
  value: string;
  label: string;
}

function labelForBranchValue(value: string, fallbackName: string): string {
  const match = BRANCH_OPTIONS.find((b) => b.value === value);
  return match?.label ?? fallbackName;
}

/** Branch short names for form selects — driven by user's allowed branches. */
export function useBranchOptions(opts?: { forRegistration?: boolean }) {
  const { user } = useAuth();
  const { allowedBranches, selectedBranchName, allowedBranchIds } = useBranch();
  const { data: allBranches = [] } = useBranches();

  const options: BranchOption[] = useMemo(() => {
    const allowedIdSet = new Set(allowedBranchIds);

    if (opts?.forRegistration && allBranches.length > 0) {
      return allBranches
        .filter((b: { id: string; isActive?: boolean | number }) => {
          const active = b.isActive !== false && b.isActive !== 0;
          return active && allowedIdSet.has(b.id);
        })
        .map((b: { id: string; name: string; branchName?: string | null; code?: string | null }) => {
          const value = b.branchName ?? b.name;
          return {
            id: b.id,
            value,
            label: labelForBranchValue(value, b.name),
          };
        })
        .sort((a: BranchOption, b: BranchOption) => a.label.localeCompare(b.label));
    }

    if (opts?.forRegistration && user && isAdminRole(user.role)) {
      return BRANCH_OPTIONS.map((b, index) => ({
        id: allowedBranches.find((ab) => (ab.branchName ?? ab.name) === b.value)?.id ?? `static-${index}`,
        value: b.value,
        label: b.label,
      }));
    }

    return allowedBranches.map((b) => ({
      id: b.id,
      value: b.branchName ?? b.name,
      label: labelForBranchValue(b.branchName ?? b.name, b.name),
    }));
  }, [opts?.forRegistration, allBranches, allowedBranchIds, allowedBranches, user]);

  const defaultValue = selectedBranchName ?? options[0]?.value ?? "";
  return { options, defaultValue };
}
