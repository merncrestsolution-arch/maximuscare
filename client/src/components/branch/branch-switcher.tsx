import { Building2, ChevronDown, LayoutGrid } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { useGoToBranchSelect } from "@/hooks/use-go-to-branch-select";
import { useBranch } from "@/context/branch-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Bug 7: on phones the branch trigger must shrink (and truncate its label) so it
// never crowds out the logo/user identity or overflow the header. It keeps its
// comfortable fixed width from the `md` breakpoint up.
const triggerClasses = cn(
  "flex h-10 min-w-0 max-w-[8.5rem] items-center gap-1.5 rounded-lg border border-[#D6E8F5]",
  "md:h-10 md:min-w-[10rem] md:max-w-[14rem] md:gap-2",
  "bg-[#EEF5FB] px-2.5 py-2 text-sm font-semibold leading-none shadow-sm",
  "text-[#105691] hover:bg-white hover:border-[#1873A8]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1873A8] focus-visible:ring-offset-1"
);

function workspaceLabelText(selectedBranchName: string | null | undefined): string {
  return selectedBranchName?.trim() || "Select branch";
}

export function BranchSwitcher() {
  const [, setLocation] = useLocation();
  const {
    selectedBranchName,
    selectedContext,
    allowedBranches,
    selectBranch,
    selectContext,
    canAccessMaximusOverview,
    canAccessNexusOverview,
  } = useBranch();
  const goToBranchSelect = useGoToBranchSelect();

  const workspaceLabel = workspaceLabelText(selectedBranchName);

  const branchOptions = useMemo(() => {
    const seen = new Set<string>();
    return allowedBranches.filter((b) => {
      const key = String(b.branchName ?? b.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allowedBranches]);

  if (branchOptions.length <= 1 && !selectedContext) {
    if (!selectedBranchName) return null;
    return (
      <button
        type="button"
        onClick={goToBranchSelect}
        data-testid="branch-switcher-trigger"
        className={triggerClasses}
      >
        <Building2 className="h-4 w-4 shrink-0 text-[#1873A8]" />
        <span className="truncate text-[#105691]">{selectedBranchName}</span>
      </button>
    );
  }

  return (
    <div className="isolate shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="branch-switcher-trigger"
            className={triggerClasses}
            aria-label={`Branch: ${workspaceLabel}`}
          >
            {selectedContext ? (
              <LayoutGrid className="h-4 w-4 shrink-0 text-[#1873A8]" aria-hidden />
            ) : (
              <Building2 className="h-4 w-4 shrink-0 text-[#1873A8]" aria-hidden />
            )}
            <span className="truncate text-[#105691]">{workspaceLabel}</span>
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#1873A8]" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 bg-white">
          {(canAccessMaximusOverview || canAccessNexusOverview) && (
            <>
              <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-[#5c6b7a]">
                Organization overview
              </DropdownMenuLabel>
              {canAccessMaximusOverview && (
                <DropdownMenuItem
                  className="min-h-11"
                  onClick={async () => {
                    await selectContext("maximus-overview");
                    setLocation("/maximus-overview");
                  }}
                >
                  Maximus Care Overview
                </DropdownMenuItem>
              )}
              {canAccessNexusOverview && (
                <DropdownMenuItem
                  className="min-h-11"
                  onClick={async () => {
                    await selectContext("nexus-overview");
                    setLocation("/nexus-overview");
                  }}
                >
                  Nexus Overview (Beruwala)
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border" />
            </>
          )}
          {branchOptions.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-[#5c6b7a]">
                Select branch
              </DropdownMenuLabel>
              {branchOptions.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  className="min-h-11"
                  onClick={async () => {
                    await selectBranch(b.id);
                    setLocation("/dashboard");
                  }}
                >
                  {b.branchName ?? b.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-border" />
            </>
          )}
          <DropdownMenuItem className="min-h-11 font-semibold" onClick={goToBranchSelect}>
            Change workspace…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
