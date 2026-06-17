import { ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { useNavigateHome } from "@/hooks/use-navigate-home";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { BranchSwitcher } from "@/components/branch/branch-switcher";
import defaultLogo from "@assets/215e8e36-1d78-4eeb-b7c3-eb908ab749e8_1769436217800.jpeg";

export default function Header({ before }: { before?: ReactNode }) {
  const { user, logout } = useAuth();
  const { logoUri } = useBranding();
  const goHome = useNavigateHome();

  if (!user) return null;

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
          <div className="flex items-center gap-2 min-w-0 border-l border-border/60 pl-3">
            <span className="text-xs font-medium text-muted-foreground truncate">{user.name}</span>
            <span className="h-1 w-1 rounded-full bg-border shrink-0" />
            <span className="text-xs uppercase font-bold text-primary tracking-wider shrink-0">{user.role}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-foreground">
          <BranchSwitcher />
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg h-11 w-11" aria-label="Log out" data-testid="button-logout-header">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-2 px-safe py-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {before}
          <button
            type="button"
            onClick={() => goHome()}
            className="flex items-center gap-2 min-w-0 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/30"
            aria-label="Go to dashboard"
            data-testid="link-home-logo-mobile"
          >
            <div className="h-9 w-9 rounded-lg overflow-hidden border border-white/20 bg-white shadow-sm flex items-center justify-center shrink-0">
              <img src={logoUri} alt="Logo" className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.src = defaultLogo; }} />
            </div>
            <span className="text-sm font-bold text-white leading-none tracking-tight block truncate">Maximus Care</span>
          </button>
          <span className="text-xs text-white/75 truncate block ml-1">{user.name}</span>
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
