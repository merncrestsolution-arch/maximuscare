import { useCallback } from "react";
import { useLocation } from "wouter";
import { useBranch } from "@/context/branch-context";
import { navigateToDashboard } from "@/lib/navigation";

export function useNavigateHome() {
  const [, setLocation] = useLocation();
  const {
    selectedBranchId,
    selectedContext,
    allowedBranches,
    selectBranch,
    refreshBranchContext,
  } = useBranch();

  return useCallback(
    (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();

      if (selectedBranchId && !selectedContext) {
        setLocation("/dashboard");
        return;
      }

      void navigateToDashboard({
        selectedBranchId,
        allowedBranches,
        selectBranch,
        refreshBranchContext,
        setLocation,
      });
    },
    [
      selectedBranchId,
      selectedContext,
      allowedBranches,
      selectBranch,
      refreshBranchContext,
      setLocation,
    ]
  );
}
