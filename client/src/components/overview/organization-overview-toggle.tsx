import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useBranch } from "@/context/branch-context";
import type { OverviewContext } from "@shared/branchAccess";
import { cn } from "@/lib/utils";

type OrgTab = {
  id: OverviewContext;
  label: string;
  path: string;
};

const TABS: OrgTab[] = [
  { id: "maximus-overview", label: "Maximus Care", path: "/maximus-overview" },
  { id: "nexus-overview", label: "Nexus (Beruwala)", path: "/nexus-overview" },
];

export function OrganizationOverviewToggle({ className }: { className?: string }) {
  const [, setLocation] = useLocation();
  const {
    selectedContext,
    canAccessMaximusOverview,
    canAccessNexusOverview,
    selectContext,
  } = useBranch();
  const [loading, setLoading] = useState<OverviewContext | null>(null);

  const visibleTabs = TABS.filter((tab) =>
    tab.id === "maximus-overview" ? canAccessMaximusOverview : canAccessNexusOverview
  );

  if (visibleTabs.length <= 1) return null;

  const handleSwitch = (tab: OrgTab) => {
    if (selectedContext === tab.id || loading) return;
    setLoading(tab.id);
    void selectContext(tab.id)
      .then(() => setLocation(tab.path))
      .finally(() => setLoading(null));
  };

  return (
    <div
      className={cn(
        "inline-flex rounded-xl border-2 border-[#c5c0b8] bg-white p-1 gap-1 shadow-sm",
        className
      )}
      role="tablist"
      aria-label="Organization overview"
    >
      {visibleTabs.map((tab) => {
        const active = selectedContext === tab.id;
        const isLoading = loading === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!!loading}
            onClick={() => handleSwitch(tab)}
            className={cn(
              "relative min-h-10 rounded-lg px-4 py-2 text-sm font-bold transition-colors border-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              active
                ? tab.id === "maximus-overview"
                  ? "border-[#2563eb] bg-[#2563eb] text-white shadow-md"
                  : "border-[#f59e0b] bg-[#f59e0b] text-white shadow-md"
                : "border-transparent bg-white text-[#1a2332] hover:bg-[#f5f5f3]"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              tab.label
            )}
          </button>
        );
      })}
    </div>
  );
}
