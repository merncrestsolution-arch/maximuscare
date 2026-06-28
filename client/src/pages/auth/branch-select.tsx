import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  MapPin,
  LayoutGrid,
  Sparkles,
  LogOut,
  ArrowRight,
  Building2,
  Loader2,
  MoreVertical,
  ScrollText,
  Bell,
  Settings,
  Send,
} from "lucide-react";
import { useBranch } from "@/context/branch-context";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { LoginStyleSplash } from "@/components/auth/login-style-splash";
import { BRANCH_SELECTION_CARDS } from "@shared/branchAccess";
import type { OverviewContext } from "@shared/branchAccess";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canViewAuditLogs, canManageSettings } from "@/lib/permissions";
import { SendNotificationDialog } from "@/components/notifications/send-notification-dialog";

const BRANCH_HEADER: Record<string, string> = {
  DEHIWALA: "Dehiwala",
  BANDARAGAMA: "Bandaragama",
  NEURO: "Neuro Rehabilitation",
  NEXUS: "Nexus Physio",
};

type Accent = { color: string; tint: string };

const BRANCH_ACCENT: Record<string, Accent> = {
  DEHIWALA: { color: "#1873A8", tint: "rgba(24,115,168,0.12)" },
  BANDARAGAMA: { color: "#16A34A", tint: "rgba(22,163,74,0.12)" },
  NEURO: { color: "#7C3AED", tint: "rgba(124,58,237,0.12)" },
  NEXUS: { color: "#EE862D", tint: "rgba(238,134,45,0.12)" },
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
};

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

  const showAdminMenu = canViewAuditLogs(user?.role) || canManageSettings(user?.role);
  const [openSend, setOpenSend] = useState(false);

  const initials = (user?.name?.trim().split(/\s+/) ?? [])
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "U";

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
    accent: Accent;
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
    <div
      className="relative min-h-dvh flex flex-col overflow-hidden text-white px-safe safe-top"
      style={{ background: "linear-gradient(135deg, #0d4a7e 0%, #105691 45%, #1873A8 100%)" }}
    >
      <SendNotificationDialog open={openSend} onOpenChange={setOpenSend} />

      {/* Decorative brand glow */}
      <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#F45627]/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-80 w-80 rounded-full bg-[#1B7EB7]/30 blur-3xl" aria-hidden />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 px-4 py-3 sm:px-6"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg">
              <img src={logoUri} alt="Maximus Care logo" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                <span className="text-white">Maximus</span>
                <span className="text-[#F8B59B]"> Care</span>
              </h1>
              <p className="truncate text-xs text-white/70">Physio &amp; Rehab Unit</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <div className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 backdrop-blur-sm sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold ring-2 ring-[#F45627]">
                  {initials}
                </div>
                <div className="text-left leading-tight">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-[0.7rem] text-white/70">{user.role}</p>
                </div>
              </div>
            )}
            {showAdminMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627]"
                    aria-label="Admin tools"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <DropdownMenuLabel>Admin tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setOpenSend(true)}>
                    <Send className="h-4 w-4" />
                    Send Notification
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setLocation("/notifications")}>
                    <Bell className="h-4 w-4" />
                    Notifications
                  </DropdownMenuItem>
                  {canViewAuditLogs(user?.role) && (
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setLocation("/audit")}>
                      <ScrollText className="h-4 w-4" />
                      Activity Log
                    </DropdownMenuItem>
                  )}
                  {canManageSettings(user?.role) && (
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setLocation("/settings")}>
                      <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627]"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main */}
      <main className="relative z-10 flex-1 px-4 pb-10 pt-4 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mb-7 text-center sm:mb-9"
          >
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Choose your workspace</h2>
            <p className="mt-2 text-sm text-white/70 sm:text-base">
              Pick the clinic location you're working in today. Records and KPIs are isolated per branch.
            </p>
          </motion.div>

          {error && (
            <div className="mx-auto mb-6 max-w-xl rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Branch cards */}
          {branchCards.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {branchCards.map((card) => {
                const accent = BRANCH_ACCENT[card.code] ?? BRANCH_ACCENT.DEHIWALA;
                const isSubmitting = submitting === card.branchId;
                return (
                  <motion.button
                    key={card.code}
                    type="button"
                    variants={itemVariants}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={!!submitting}
                    onClick={() => handleSelectBranch(card.branchId)}
                    style={{ borderLeftColor: accent.color }}
                    className={`group relative overflow-hidden rounded-2xl border border-[#D6E8F5] border-l-[5px] bg-white p-5 text-left shadow-[0_8px_30px_rgba(16,86,145,0.12)] transition-shadow hover:shadow-[0_14px_40px_rgba(16,86,145,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${isSubmitting ? "opacity-70" : ""}`}
                    data-testid={`branch-card-${card.code.toLowerCase()}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: accent.tint, color: accent.color }}
                        >
                          <MapPin className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-lg font-extrabold tracking-tight text-[#105691]">
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
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform group-hover:translate-x-0.5"
                        style={{ backgroundColor: accent.color }}
                      >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#64748B]">
                      Open the branch dashboard — visits, patients, attendance &amp; reports.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {["Patients", "Visits", "Attendance", "Reports"].map((chip) => (
                        <span
                          key={chip}
                          className="rounded-md bg-[#EEF5FB] px-2 py-1 text-[11px] font-semibold text-[#105691]"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* Overview cards */}
          {overviewCards.length > 0 && (
            <div className="mt-9">
              <div className="mb-3 flex items-center gap-2 text-white/85">
                <LayoutGrid className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Overview Dashboards</h3>
              </div>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                {overviewCards.map((card) => {
                  const isSubmitting = submitting === card.id;
                  return (
                    <motion.button
                      key={card.id}
                      type="button"
                      variants={itemVariants}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.99 }}
                      disabled={!!submitting}
                      onClick={() => handleSelectOverview(card.id, card.path)}
                      style={{ borderLeftColor: card.accent.color }}
                      className={`group flex items-center gap-4 rounded-2xl border border-white/30 border-l-[5px] bg-white/10 p-5 text-left backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627] ${isSubmitting ? "opacity-70" : ""}`}
                      data-testid={`overview-card-${card.id}`}
                    >
                      <span
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
                        style={{ backgroundColor: card.accent.color }}
                      >
                        {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : card.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-extrabold text-white">{card.title}</span>
                        <span className="mt-0.5 block text-sm text-white/70">{card.subtitle}</span>
                        <span className="mt-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                          Multi-branch analytics
                          <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          )}

          {!hasOptions && (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/30 bg-white/10 p-8 text-center backdrop-blur-md">
              <Building2 className="mx-auto h-10 w-10 text-white/80" />
              <h3 className="mt-3 text-lg font-bold">No Access</h3>
              <p className="mt-1 text-sm text-white/70">
                No branches assigned. Contact your administrator.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
