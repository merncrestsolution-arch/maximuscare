import { ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { useBranch } from "@/context/branch-context";
import { useNavigateHome } from "@/hooks/use-navigate-home";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { BranchSwitcher } from "@/components/branch/branch-switcher";
import defaultLogo from "@assets/215e8e36-1d78-4eeb-b7c3-eb908ab749e8_1769436217800.jpeg";

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-[#105691]">Maximus</span>
      <span className="text-[#F45627]"> Care</span>
    </span>
  );
}

export default function Header({ before }: { before?: ReactNode }) {
  const { user, logout } = useAuth();
  const { logoUri } = useBranding();
  const { selectedBranchName } = useBranch();
  const goHome = useNavigateHome();

  if (!user) return null;

  const initials = (user.name?.trim().split(/\s+/) ?? [])
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  const mobileSubtitle = selectedBranchName?.trim() || user.role;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm shadow-[0_2px_12px_rgba(16,86,145,0.08)] safe-top">
      {/* Brand accent line */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#105691] via-[#1873A8] to-[#F45627]" />

      {/* Desktop / Tablet */}
      <div className="hidden md:flex h-14 items-center px-4 lg:px-6 justify-between gap-3 border-b border-[#E2ECF5]">
        <div className="flex items-center gap-3 min-w-0">
          {before}
          <button
            type="button"
            onClick={() => goHome()}
            className="flex items-center gap-3 min-w-0 rounded-xl px-1.5 py-1 outline-none transition-colors hover:bg-[#EEF5FB] focus-visible:ring-2 focus-visible:ring-[#1873A8]/40"
            aria-label="Go to dashboard"
            data-testid="link-home-logo"
          >
            <div className="h-10 w-10 rounded-xl overflow-hidden border border-[#D6E8F5] bg-white shadow-sm flex items-center justify-center shrink-0 p-1">
              <img src={logoUri} alt="Maximus Care logo" className="max-h-full max-w-full object-contain" data-testid="img-logo-header" onError={(e) => { e.currentTarget.src = defaultLogo; }} />
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <Wordmark className="text-base font-extrabold leading-none tracking-tight" />
              <span className="text-[0.7rem] font-medium text-[#94A3B8] leading-tight mt-0.5 truncate">
                Physio &amp; Rehab Unit
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <BranchSwitcher />
          <NotificationBell />
          <div className="flex items-center gap-2.5 border-l border-[#E2ECF5] pl-3" data-testid="header-user-identity">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1873A8] to-[#105691] text-white text-xs font-bold ring-2 ring-[#F45627] ring-offset-1" aria-hidden="true">
              {initials || "U"}
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold text-[#1E293B] truncate" data-testid="text-header-username">{user.name}</span>
              <span className="text-[0.7rem] text-[#94A3B8] truncate">
                {user.role}{selectedBranchName ? ` · ${selectedBranchName}` : ""}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg h-10 w-10" aria-label="Log out" data-testid="button-logout-header">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-2 px-2 py-2 border-b border-[#E2ECF5]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {before}
          <button
            type="button"
            onClick={() => goHome()}
            className="flex items-center gap-2 min-w-0 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#1873A8]/30"
            aria-label="Go to dashboard"
            data-testid="link-home-logo-mobile"
          >
            <div className="h-9 w-9 rounded-xl overflow-hidden border border-[#D6E8F5] bg-white shadow-sm flex items-center justify-center shrink-0 p-0.5">
              <img src={logoUri} alt="Maximus Care logo" className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.src = defaultLogo; }} />
            </div>
            <div className="flex flex-col leading-tight min-w-0 text-left">
              <Wordmark className="text-[0.95rem] font-extrabold leading-none tracking-tight" />
              <span className="text-[0.62rem] font-medium text-[#94A3B8] leading-tight mt-0.5 truncate">{mobileSubtitle}</span>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <BranchSwitcher />
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={logout} className="h-10 w-10 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg" aria-label="Log out" data-testid="button-logout-mobile">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
