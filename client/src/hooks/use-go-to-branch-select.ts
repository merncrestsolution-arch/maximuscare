import { useCallback } from "react";
import { useLocation } from "wouter";
import { useBranch } from "@/context/branch-context";
import { authApi } from "@/lib/api";

export function useGoToBranchSelect() {
  const [, setLocation] = useLocation();
  const { refreshBranchContext } = useBranch();

  return useCallback(async () => {
    await authApi.clearWorkspace();
    await refreshBranchContext();
    setLocation("/auth/branch-select");
  }, [refreshBranchContext, setLocation]);
}
