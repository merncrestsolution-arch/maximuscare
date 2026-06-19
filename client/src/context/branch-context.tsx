import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authApi, AUTH_EVENTS } from "@/lib/api";
import { useAuth } from "./auth-context";
import type { OverviewContext } from "@shared/branchAccess";

export interface BranchOption {
  id: string;
  name: string;
  branchName?: string | null;
  code?: string | null;
}

interface BranchContextType {
  selectedBranchId: string | null;
  selectedBranchName: string | null;
  selectedContext: OverviewContext | null;
  allowedBranches: BranchOption[];
  allowedBranchIds: string[];
  canAccessMaximusOverview: boolean;
  canAccessNexusOverview: boolean;
  requiresBranchSelection: boolean;
  isLoading: boolean;
  selectBranch: (branchId: string) => Promise<void>;
  selectContext: (context: OverviewContext) => Promise<void>;
  refreshBranchContext: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [optimisticBranchId, setOptimisticBranchId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auth-me-branch", user?.id],
    queryFn: () => authApi.me(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const selectContext = useCallback(
    async (context: OverviewContext) => {
      const result = await authApi.selectContext(context);
      queryClient.setQueryData(["auth-me-branch", user?.id], (old: Record<string, unknown> | undefined) => ({
        ...(old ?? {}),
        selectedBranchId: null,
        selectedBranchName: null,
        selectedContext: result.selectedContext,
        requiresBranchSelection: false,
      }));
      void queryClient.invalidateQueries({ queryKey: ["maximus-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["nexus-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    },
    [queryClient, user?.id]
  );

  const selectBranch = useCallback(
    async (branchId: string) => {
      setOptimisticBranchId(branchId);
      try {
        const result = await authApi.selectBranch(branchId);
        queryClient.setQueryData(["auth-me-branch", user?.id], (old: Record<string, unknown> | undefined) => ({
          ...(old ?? {}),
          selectedBranchId: result.selectedBranchId,
          selectedBranchName: result.selectedBranchName,
          selectedContext: null,
          requiresBranchSelection: false,
          allowedBranches: result.allowedBranches ?? (old as { allowedBranches?: BranchOption[] })?.allowedBranches ?? [],
        }));
        void queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
        void queryClient.invalidateQueries({ queryKey: ["patients"] });
        void queryClient.invalidateQueries({ queryKey: ["visits"] });
        void queryClient.invalidateQueries({ queryKey: ["maximus-overview"] });
        void queryClient.invalidateQueries({ queryKey: ["nexus-overview"] });
        void queryClient.invalidateQueries({ queryKey: ["staff"] });
        void queryClient.invalidateQueries({ queryKey: ["staff-directory"] });
        void queryClient.invalidateQueries({ queryKey: ["treating-staff"] });
        void queryClient.invalidateQueries({ queryKey: ["attendance"] });
        void queryClient.invalidateQueries({ queryKey: ["attendance-dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["revenue-summary"] });
        void queryClient.invalidateQueries({ queryKey: ["revenue-report"] });
        void queryClient.invalidateQueries({ queryKey: ["expenses"] });
        void queryClient.invalidateQueries({ queryKey: ["appointments"] });
        void queryClient.invalidateQueries({ queryKey: ["inpatients"] });
      } finally {
        setOptimisticBranchId(null);
      }
    },
    [queryClient, user?.id]
  );

  const refreshBranchContext = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    const onTokensRefreshed = () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-me-branch"] });
      void refetch();
    };
    const onBranchRequired = () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-me-branch"] });
      void refetch().then((result) => {
        if (!result.data?.selectedBranchId && !result.data?.selectedContext) {
          if (!window.location.pathname.startsWith("/auth/")) {
            setLocation("/auth/branch-select");
          }
        }
      });
    };

    window.addEventListener(AUTH_EVENTS.tokensRefreshed, onTokensRefreshed);
    window.addEventListener(AUTH_EVENTS.branchRequired, onBranchRequired);
    return () => {
      window.removeEventListener(AUTH_EVENTS.tokensRefreshed, onTokensRefreshed);
      window.removeEventListener(AUTH_EVENTS.branchRequired, onBranchRequired);
    };
  }, [queryClient, refetch, setLocation]);

  return (
    <BranchContext.Provider
      value={{
        selectedBranchId: optimisticBranchId ?? data?.selectedBranchId ?? null,
        selectedBranchName: optimisticBranchId
          ? (data?.allowedBranches ?? []).find((b: BranchOption) => b.id === optimisticBranchId)?.branchName ??
            (data?.allowedBranches ?? []).find((b: BranchOption) => b.id === optimisticBranchId)?.name ??
            data?.selectedBranchName ??
            null
          : (data?.selectedBranchName ?? null),
        selectedContext: optimisticBranchId
          ? null
          : ((data?.selectedContext as OverviewContext | null) ?? null),
        allowedBranches: data?.allowedBranches ?? [],
        allowedBranchIds: data?.allowedBranchIds ?? [],
        canAccessMaximusOverview: !!data?.canAccessMaximusOverview,
        canAccessNexusOverview: !!data?.canAccessNexusOverview,
        requiresBranchSelection: optimisticBranchId ? false : !!data?.requiresBranchSelection,
        isLoading,
        selectBranch,
        selectContext,
        refreshBranchContext,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
