import { useMemo } from "react";
import { MapPin, Home, Building2 } from "lucide-react";
import { ENTERPRISE_BRANCHES, normalizeBranchName } from "@shared/branches";
import { MAXIMUS_BRANCH_CODES, NEXUS_BRANCH_CODE } from "@shared/branchAccess";
import { useBranch } from "@/context/branch-context";
import { BRANCH_OPTIONS } from "@/lib/branches";
import { calculateVisitStatsByBranch } from "@/lib/stats";
import type { Visit } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CARD_ACCENTS = [
  { border: "border-l-primary", text: "text-primary", bg: "bg-primary/10" },
  { border: "border-l-secondary", text: "text-secondary", bg: "bg-secondary/10" },
  { border: "border-l-[#9333ea]", text: "text-[#9333ea]", bg: "bg-[#9333ea]/10" },
  { border: "border-l-[#f59e0b]", text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10" },
] as const;

function branchDisplayName(shortName: string): string {
  return BRANCH_OPTIONS.find((b) => b.value === shortName)?.label ?? shortName;
}

function resolveBranchesToShow(
  statsByBranch: Map<string, { branch: string; home: number; clinic: number }>,
  options: {
    limitToBranch?: string | null;
    selectedBranchName: string | null;
    selectedContext: string | null;
    allowedBranchNames: string[];
  }
): string[] {
  if (options.limitToBranch) {
    const name = normalizeBranchName(options.limitToBranch);
    return name ? [name] : [];
  }
  if (options.selectedBranchName && !options.selectedContext) {
    const name = normalizeBranchName(options.selectedBranchName);
    return name ? [name] : [];
  }
  if (options.selectedContext === "maximus-overview") {
    return ENTERPRISE_BRANCHES.filter((b) => MAXIMUS_BRANCH_CODES.includes(b.code)).map(
      (b) => b.shortName
    );
  }
  if (options.selectedContext === "nexus-overview") {
    const nexus = ENTERPRISE_BRANCHES.find((b) => b.code === NEXUS_BRANCH_CODE);
    return nexus ? [nexus.shortName] : [];
  }
  if (options.allowedBranchNames.length === 1) {
    return options.allowedBranchNames;
  }
  if (options.allowedBranchNames.length > 1) {
    return options.allowedBranchNames;
  }
  if (statsByBranch.size > 0) {
    return Array.from(statsByBranch.keys());
  }
  return [];
}

export function VisitStatsCards({
  visits,
  limitToBranch,
}: {
  visits: Visit[];
  /** Pin to one branch (e.g. staff profile). */
  limitToBranch?: string | null;
}) {
  const { selectedBranchName, selectedContext, allowedBranches } = useBranch();

  const statsByBranch = useMemo(() => calculateVisitStatsByBranch(visits), [visits]);

  const allowedBranchNames = useMemo(
    () =>
      Array.from(new Set(
        allowedBranches
          .map((b) => normalizeBranchName(b.branchName ?? b.name))
          .filter(Boolean) as string[]
      )),
    [allowedBranches]
  );

  const branches = useMemo(
    () =>
      resolveBranchesToShow(statsByBranch, {
        limitToBranch,
        selectedBranchName,
        selectedContext,
        allowedBranchNames,
      }),
    [statsByBranch, limitToBranch, selectedBranchName, selectedContext, allowedBranchNames]
  );

  if (branches.length === 0) return null;

  return (
    <div
      className={cn(
        "grid w-full min-w-0 gap-3 sm:gap-4",
        branches.length === 1 ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"
      )}
    >
      {branches.map((branch, index) => {
        const stats = statsByBranch.get(branch) ?? { branch, home: 0, clinic: 0 };
        const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
        return (
          <Card
            key={branch}
            className={cn(
              "min-w-0 overflow-hidden border-l-4 shadow-sm transition-all duration-200 hover:shadow-md",
              accent.border
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className={cn("mb-4 flex items-center gap-2 border-b pb-2", accent.text)}>
                <div className={cn("rounded-full p-1.5", accent.bg)}>
                  <MapPin className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold uppercase tracking-wider">
                  {branchDisplayName(branch)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col rounded-lg border border-border/50 bg-muted/30 p-2">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Home className="h-3.5 w-3.5" /> Home
                  </span>
                  <span className="text-2xl font-extrabold text-foreground">{stats.home}</span>
                </div>
                <div className="flex flex-col rounded-lg border border-border/50 bg-muted/30 p-2">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> Clinic
                  </span>
                  <span className="text-2xl font-extrabold text-foreground">{stats.clinic}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
