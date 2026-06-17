import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  MapPin,
  LayoutGrid,
  Sparkles,
  LogOut,
  ChevronRight,
  Building2,
  Users,
  Activity,
  Loader2,
} from "lucide-react";
import { useBranch } from "@/context/branch-context";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { LoginStyleSplash } from "@/components/auth/login-style-splash";
import { BRANCH_SELECTION_CARDS } from "@shared/branchAccess";
import type { OverviewContext } from "@shared/branchAccess";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const BRANCH_HEADER: Record<string, string> = {
  DEHIWALA: "DEHIWALA",
  BANDARAGAMA: "BANDARAGAMA",
  NEURO: "NEURO REHABILITATION",
  NEXUS: "NEXUS PHYSIO",
};

const BRANCH_ACCENT: Record<
  string,
  { border: string; text: string; pill: string; icon: string }
> = {
  DEHIWALA: {
    border: "border-l-[#2563eb]",
    text: "text-[#2563eb]",
    pill: "bg-blue-50 text-blue-700",
    icon: "text-[#2563eb]",
  },
  BANDARAGAMA: {
    border: "border-l-[#16a34a]",
    text: "text-[#16a34a]",
    pill: "bg-green-50 text-green-700",
    icon: "text-[#16a34a]",
  },
  NEURO: {
    border: "border-l-[#9333ea]",
    text: "text-[#9333ea]",
    pill: "bg-purple-50 text-purple-700",
    icon: "text-[#9333ea]",
  },
  NEXUS: {
    border: "border-l-[#f59e0b]",
    text: "text-[#f59e0b]",
    pill: "bg-amber-50 text-amber-800",
    icon: "text-[#f59e0b]",
  },
};

function BranchKpiPreview({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-black bg-white px-3 py-3 sm:px-4 sm:py-4",
        "border-l-[5px]",
        accentClass
      )}
    >
      <p className="text-xs font-medium text-muted-foreground leading-snug">{label}</p>
      <p className="mt-1 text-lg font-extrabold tracking-tight text-foreground sm:text-xl">{value}</p>
    </div>
  );
}

export default function BranchSelectPage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { logoUri } = useBranding();
  const {
    allowedBranches,
    selectBranch,
    selectContext,
    canAccessMaximusOverview,
    canAccessNexusOverview,
    isLoading,
  } = useBranch();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branchCards = useMemo(() => {
    const allowedCodes = new Set(
      allowedBranches.map((b) => String(b.code ?? "").toUpperCase())
    );
    return BRANCH_SELECTION_CARDS.filter((card) => allowedCodes.has(card.code)).map((card) => {
      const branch = allowedBranches.find(
        (b) => String(b.code ?? "").toUpperCase() === card.code
      );
      return { ...card, branchId: branch?.id ?? "" };
    });
  }, [allowedBranches]);

  if (isLoading) {
    return <LoginStyleSplash message="Loading branches…" />;
  }

  const handleSelectBranch = async (branchId: string) => {
    setSubmitting(branchId);
    setError(null);
    try {
      await selectBranch(branchId);
      setLocation("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to select branch");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSelectOverview = async (context: OverviewContext, path: string) => {
    setSubmitting(context);
    setError(null);
    try {
      await selectContext(context);
      setLocation(path);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open overview");
    } finally {
      setSubmitting(null);
    }
  };

  const overviewCards: {
    id: OverviewContext;
    title: string;
    subtitle: string;
    path: string;
    icon: React.ReactNode;
    accent: (typeof BRANCH_ACCENT)[string];
  }[] = [];

  if (canAccessMaximusOverview) {
    overviewCards.push({
      id: "maximus-overview",
      title: "Maximus Overview",
      subtitle: "Dehiwala · Bandaragama · Neuro",
      path: "/maximus-overview",
      icon: <LayoutGrid className="h-6 w-6" />,
      accent: BRANCH_ACCENT.DEHIWALA,
    });
  }
  if (canAccessNexusOverview) {
    overviewCards.push({
      id: "nexus-overview",
      title: "Nexus Overview",
      subtitle: "Nexus Physio & Rehab Center",
      path: "/nexus-overview",
      icon: <Sparkles className="h-6 w-6" />,
      accent: BRANCH_ACCENT.NEXUS,
    });
  }

  const hasOptions = branchCards.length > 0 || overviewCards.length > 0;

  return (
    <div className="min-h-dvh bg-[#f0f0f0] flex flex-col">
      {/* Top header — matches dashboard chrome */}
      <header className="sticky top-0 z-10 border-b-2 border-black bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-black bg-white">
              <img src={logoUri} alt="" className="h-full w-full object-contain p-0.5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-black sm:text-xl">Maximus Care</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                Select your workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-10 border-2 border-black rounded-xl font-medium"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
            <div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Choose a Branch</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick the clinic location you are working in today. KPIs and records are isolated per
                branch.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {branchCards.map((card) => {
            const accent = BRANCH_ACCENT[card.code] ?? BRANCH_ACCENT.DEHIWALA;
            const isSubmitting = submitting === card.branchId;

            return (
              <section key={card.code} className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className={cn("h-5 w-5", accent.icon)} />
                  <h3 className="text-base font-bold uppercase tracking-wide text-foreground sm:text-lg">
                    {BRANCH_HEADER[card.code] ?? card.code}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      accent.pill
                    )}
                  >
                    {card.label}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!!submitting}
                  onClick={() => handleSelectBranch(card.branchId)}
                  className={cn(
                    "group w-full rounded-2xl border-2 border-black bg-white p-4 text-left shadow-sm transition-all sm:p-5",
                    "hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    "border-l-[6px]",
                    accent.border,
                    isSubmitting && "opacity-70 pointer-events-none"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className={cn("text-lg font-extrabold sm:text-xl", accent.text)}>
                        {card.subtitle}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Open branch dashboard — visits, patients, attendance &amp; reports
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white transition group-hover:bg-muted",
                        accent.icon
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    <BranchKpiPreview
                      label="Workspace"
                      value="Branch"
                      accentClass={accent.border}
                    />
                    <BranchKpiPreview
                      label="Module"
                      value="Patients"
                      accentClass={accent.border}
                    />
                    <BranchKpiPreview
                      label="Module"
                      value="Visits"
                      accentClass={accent.border}
                    />
                    <BranchKpiPreview
                      label="Status"
                      value="Active"
                      accentClass={accent.border}
                    />
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                    Tap to enter →
                  </p>
                </button>
              </section>
            );
          })}

          {overviewCards.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-foreground" />
                <h3 className="text-base font-bold uppercase tracking-wide text-foreground sm:text-lg">
                  Overview Dashboards
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {overviewCards.map((card) => {
                  const isSubmitting = submitting === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={!!submitting}
                      onClick={() => handleSelectOverview(card.id, card.path)}
                      className={cn(
                        "group flex items-center gap-4 rounded-2xl border-2 border-black bg-white p-5 text-left shadow-sm transition-all",
                        "border-l-[6px]",
                        card.accent.border,
                        "hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isSubmitting && "opacity-70"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white",
                          card.accent.icon
                        )}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          card.icon
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-lg font-extrabold", card.accent.text)}>
                          {card.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {card.subtitle}
                        </span>
                        <span className="mt-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Multi-branch analytics
                          <Activity className="ml-auto h-4 w-4" />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {!hasOptions && (
            <div className="rounded-2xl border-2 border-black bg-white p-8 text-center shadow-sm">
              <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 text-lg font-bold text-foreground">No Access</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No branches assigned. Contact your administrator.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
