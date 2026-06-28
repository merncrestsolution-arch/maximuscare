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
  "flex h-11 min-w-0 max-w-[9rem] items-center gap-2 rounded-lg border-2 border-[#c5c0b8]",
  "md:min-w-[11rem] md:max-w-[14rem]",
  "bg-white px-3 py-2 text-sm font-bold leading-none shadow-md",
  "text-[#1a2332] hover:bg-[#f5f5f3]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d9d8b] focus-visible:ring-offset-2"
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
        <Building2 className="h-4 w-4 shrink-0 text-[#1a2332]" />
        <span className="truncate text-[#1a2332]">{selectedBranchName}</span>
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
              <LayoutGrid className="h-4 w-4 shrink-0 text-[#1a2332]" aria-hidden />
            ) : (
              <Building2 className="h-4 w-4 shrink-0 text-[#1a2332]" aria-hidden />
            )}
            <span className="truncate text-[#1a2332]">{workspaceLabel}</span>
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#1a2332]" aria-hidden />
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
