import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  LayoutGrid,
  Loader2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useGoToBranchSelect } from "@/hooks/use-go-to-branch-select";
import { useBranch } from "@/context/branch-context";
import { BRANCH_SELECTION_CARDS } from "@shared/branchAccess";
import type { OverviewContext } from "@shared/branchAccess";
import { branchMatchesEnterpriseCode } from "@shared/branches";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const BRANCH_HEADER: Record<string, string> = {
  DEHIWALA: "Dehiwala",
  BANDARAGAMA: "Bandaragama",
  NEURO: "Neuro Rehabilitation",
  NEXUS: "Nexus Physio",
};

const BRANCH_ACCENT: Record<string, { color: string; tint: string }> = {
  DEHIWALA: { color: "#1873A8", tint: "rgba(24,115,168,0.12)" },
  BANDARAGAMA: { color: "#16A34A", tint: "rgba(22,163,74,0.12)" },
  NEURO: { color: "#7C3AED", tint: "rgba(124,58,237,0.12)" },
  NEXUS: { color: "#EE862D", tint: "rgba(238,134,45,0.12)" },
};

const triggerClasses = cn(
  "flex h-11 min-h-[44px] min-w-0 max-w-[9rem] items-center gap-1.5 rounded-xl border border-[#D6E8F5]",
  "md:h-11 md:min-w-[11rem] md:max-w-[15rem] md:gap-2",
  "bg-gradient-to-b from-white to-[#EEF5FB] px-2.5 py-2 text-sm font-semibold leading-none shadow-sm",
  "text-[#105691] hover:border-[#1873A8] hover:shadow-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1873A8] focus-visible:ring-offset-1"
);

function workspaceLabel(
  selectedBranchName: string | null | undefined,
  selectedContext: OverviewContext | null
): string {
  if (selectedContext === "maximus-overview") return "Maximus Overview";
  if (selectedContext === "nexus-overview") return "Nexus Overview";
  return selectedBranchName?.trim() || "Choose workspace";
}

export function BranchSwitcher() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
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

  const label = workspaceLabel(selectedBranchName, selectedContext);

  const branchCards = useMemo(() => {
    return BRANCH_SELECTION_CARDS.filter((card) =>
      allowedBranches.some((b) => branchMatchesEnterpriseCode(b, card.code)),
    ).map((card) => {
      const branch = allowedBranches.find((b) => branchMatchesEnterpriseCode(b, card.code));
      return { ...card, branchId: branch?.id ?? "" };
    });
  }, [allowedBranches]);

  const handleSelectBranch = async (branchId: string) => {
    if (!branchId) return;
    setSubmitting(branchId);
    try {
      await selectBranch(branchId);
      setOpen(false);
      setLocation("/dashboard");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSelectOverview = async (context: OverviewContext, path: string) => {
    setSubmitting(context);
    try {
      await selectContext(context);
      setOpen(false);
      setLocation(path);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="branch-switcher-trigger"
        className={triggerClasses}
        aria-label={`Workspace: ${label}`}
        onClick={() => setOpen(true)}
      >
        {selectedContext ? (
          <LayoutGrid className="h-4 w-4 shrink-0 text-[#1873A8]" aria-hidden />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-[#1873A8]" aria-hidden />
        )}
        <span className="truncate text-[#105691]">{label}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#1873A8]" aria-hidden />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92dvh] bg-[#EEF5FB]">
          <DrawerHeader className="relative border-b border-[#D6E8F5] pb-4 text-left">
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Close branch selection"
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-white hover:text-[#105691]"
                data-testid="branch-switcher-close"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
            <DrawerTitle className="pr-10 text-lg font-extrabold text-[#105691]">
              Choose workspace
            </DrawerTitle>
            <DrawerDescription className="text-[#64748B]">
              Switch branch or open an organization overview. Data reloads for the selected workspace.
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,16px)+16px)] space-y-6">
            {branchCards.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Branches</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {branchCards.map((card) => {
                    const accent = BRANCH_ACCENT[card.code] ?? BRANCH_ACCENT.DEHIWALA;
                    const isActive =
                      !selectedContext &&
                      allowedBranches.some(
                        (b) =>
                          b.id === card.branchId &&
                          (b.branchName ?? b.name) === selectedBranchName
                      );
                    const busy = submitting === card.branchId;
                    return (
                      <button
                        key={card.code}
                        type="button"
                        disabled={!!submitting}
                        onClick={() => handleSelectBranch(card.branchId)}
                        style={{ borderLeftColor: accent.color }}
                        className={cn(
                          "group relative rounded-2xl border border-[#D6E8F5] border-l-[5px] bg-white p-4 text-left shadow-sm transition-all",
                          "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627]",
                          isActive && "ring-2 ring-[#1873A8] ring-offset-2",
                          busy && "opacity-70"
                        )}
                        data-testid={`branch-switcher-card-${card.code.toLowerCase()}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: accent.tint, color: accent.color }}
                            >
                              <MapPin className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-extrabold text-[#105691] truncate">
                                {BRANCH_HEADER[card.code] ?? card.code}
                              </p>
                              <span
                                className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                                style={{ backgroundColor: accent.tint, color: accent.color }}
                              >
                                {card.label}
                              </span>
                            </div>
                          </div>
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: accent.color }}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4" />
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(canAccessMaximusOverview || canAccessNexusOverview) && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Organization overview
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {canAccessMaximusOverview && (
                    <button
                      type="button"
                      disabled={!!submitting}
                      onClick={() => handleSelectOverview("maximus-overview", "/maximus-overview")}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border border-[#D6E8F5] border-l-[5px] bg-white p-4 text-left shadow-sm",
                        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627]",
                        selectedContext === "maximus-overview" && "ring-2 ring-[#1873A8] ring-offset-2"
                      )}
                      style={{ borderLeftColor: BRANCH_ACCENT.DEHIWALA.color }}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: BRANCH_ACCENT.DEHIWALA.color }}
                      >
                        {submitting === "maximus-overview" ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <LayoutGrid className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold text-[#105691]">Maximus Overview</span>
                        <span className="block text-xs text-[#64748B]">Dehiwala · Bandaragama · Neuro</span>
                      </span>
                    </button>
                  )}
                  {canAccessNexusOverview && (
                    <button
                      type="button"
                      disabled={!!submitting}
                      onClick={() => handleSelectOverview("nexus-overview", "/nexus-overview")}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border border-[#D6E8F5] border-l-[5px] bg-white p-4 text-left shadow-sm",
                        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627]",
                        selectedContext === "nexus-overview" && "ring-2 ring-[#1873A8] ring-offset-2"
                      )}
                      style={{ borderLeftColor: BRANCH_ACCENT.NEXUS.color }}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: BRANCH_ACCENT.NEXUS.color }}
                      >
                        {submitting === "nexus-overview" ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold text-[#105691]">Nexus Overview</span>
                        <span className="block text-xs text-[#64748B]">Nexus Physio &amp; Rehab</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void goToBranchSelect();
              }}
              className="w-full min-h-12 rounded-xl border border-[#D6E8F5] bg-white px-4 py-3 text-sm font-semibold text-[#105691] shadow-sm hover:bg-[#EEF5FB]"
            >
              Full workspace screen…
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
