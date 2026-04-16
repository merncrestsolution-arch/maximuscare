import { ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import defaultLogo from "@assets/215e8e36-1d78-4eeb-b7c3-eb908ab749e8_1769436217800.jpeg";

export default function Header({ before }: { before?: ReactNode }) {
  const { user, logout } = useAuth();
  const { logoUri } = useBranding();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black text-white shadow-sm safe-top pt-2 md:border-border/60 md:bg-card/95 md:text-foreground md:backdrop-blur-md supports-[backdrop-filter]:md:bg-card/90">
      {/* Desktop Header (>= 768px) */}
      <div className="hidden md:flex h-14 items-center px-5 justify-between">
        <div className="flex items-center gap-3">
          {before}
          <div className="h-9 w-9 rounded-xl overflow-hidden border border-border/60 bg-card shadow-sm flex items-center justify-center">
            <img src={logoUri} alt="Maximus Care logo" className="w-full h-full object-contain p-0.5" data-testid="img-logo-header" onError={(e) => { e.currentTarget.src = defaultLogo; }} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-foreground leading-none tracking-tight">Maximus Care</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-medium text-muted-foreground">{user.name}</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="text-[10px] uppercase font-bold text-primary tracking-wider">{user.role}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end leading-tight" data-testid="header-user">
            <span className="text-xs font-semibold text-foreground" data-testid="text-header-user-name">{user.name}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground" data-testid="text-header-user-role">{user.role}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 -mr-2 rounded-lg" data-testid="button-logout-header">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Header (< 768px) */}
      <div className="flex md:hidden flex-col px-safe py-2.5 gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg overflow-hidden border border-white/20 bg-white shadow-sm flex items-center justify-center">
              <img src={logoUri} alt="Logo" className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.src = defaultLogo; }} />
            </div>
            <span className="text-sm font-bold text-white leading-none tracking-tight">Maximus Care</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-white hover:bg-white/10 -mr-2 rounded-lg" data-testid="button-logout-mobile">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-white/80 truncate max-w-full">
            <span className="font-medium text-white truncate">{user.name}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/40 shrink-0" />
            <span className="uppercase text-[9px] font-bold tracking-wide text-white/90 shrink-0">{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
