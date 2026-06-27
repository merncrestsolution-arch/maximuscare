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

export default function Header({ before }: { before?: ReactNode }) {
  const { user, logout } = useAuth();
  const { logoUri } = useBranding();
  const { selectedBranchName } = useBranch();
  const goHome = useNavigateHome();

  if (!user) return null;

  // Bug 18: clear identity in the header — avatar initial + name, with role/branch as muted text.
  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";
  const initials = (user.name?.trim().split(/\s+/) ?? [])
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  const branchLabel = selectedBranchName ? `${selectedBranchName} Branch` : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black text-white shadow-sm safe-top md:border-border/60 md:bg-card/95 md:text-foreground md:backdrop-blur-md supports-[backdrop-filter]:md:bg-card/90">
      {/* Desktop / Tablet */}
      <div className="hidden md:flex h-14 items-center px-4 lg:px-5 justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {before}
          <button
            type="button"
            onClick={() => goHome()}
            className="flex items-center gap-3 min-w-0 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Go to dashboard"
            data-testid="link-home-logo"
          >
            <div className="h-9 w-9 rounded-xl overflow-hidden border border-border/60 bg-card shadow-sm flex items-center justify-center shrink-0">
              <img src={logoUri} alt="Maximus Care logo" className="w-full h-full object-contain p-0.5" data-testid="img-logo-header" onError={(e) => { e.currentTarget.src = defaultLogo; }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-foreground leading-none tracking-tight truncate">Maximus Care</span>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-foreground">
          <BranchSwitcher />
          <NotificationBell />
          <div className="flex items-center gap-2 border-l border-border/60 pl-3" data-testid="header-user-identity">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold" aria-hidden="true">
              {initials || "U"}
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold text-foreground truncate" data-testid="text-header-username">{user.name}</span>
              <span className="text-[0.7rem] text-muted-foreground truncate">
                {user.role}{branchLabel ? ` · ${branchLabel}` : ""}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg h-11 w-11" aria-label="Log out" data-testid="button-logout-header">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-2 px-safe py-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {before}
          {/* Bug 1: logo box is shrink-0 with a fixed size so it never collapses/clips on small phones. */}
          <button
            type="button"
            onClick={() => goHome()}
            className="flex items-center gap-2 min-w-0 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/30"
            aria-label="Go to dashboard"
            data-testid="link-home-logo-mobile"
          >
            <div className="h-9 w-9 max-w-[36px] rounded-lg overflow-hidden border border-white/20 bg-white shadow-sm flex items-center justify-center shrink-0">
              <img src={logoUri} alt="Logo" className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.src = defaultLogo; }} />
            </div>
          </button>
          {/* Bug 18: show the logged-in user's first name + role clearly on mobile. */}
          <div className="flex flex-col leading-tight min-w-0 ml-0.5" data-testid="header-user-identity-mobile">
            <span className="text-sm font-semibold text-white truncate" data-testid="text-header-username-mobile">{firstName}</span>
            <span className="text-[0.65rem] text-white/70 truncate">{user.role}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 text-foreground">
          <BranchSwitcher />
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={logout} className="h-11 w-11 text-white hover:bg-white/10 rounded-lg" aria-label="Log out" data-testid="button-logout-mobile">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
