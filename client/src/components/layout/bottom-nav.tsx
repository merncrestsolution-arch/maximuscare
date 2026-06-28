import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, CalendarCheck, CalendarDays, Plus, BarChart3 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";
import { useNavigateHome } from "@/hooks/use-navigate-home";
import { canViewReportsHub } from "@/lib/permissions";

const navIconProps = { className: "h-5 w-5 shrink-0", strokeWidth: 2.25 as const };

function NavItem({
  href,
  active,
  label,
  icon,
  testId,
  onClick,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  testId: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link href={href} onClick={onClick} className="flex min-w-0 flex-1 justify-center touch-manipulation">
      <div
        className="relative flex max-w-full flex-col items-center justify-end gap-0.5 pb-0.5 transition-colors"
        data-testid={testId}
      >
        <div className={`shrink-0 ${active ? "text-[#F45627]" : "text-white/80"}`}>{icon}</div>
        <span
          className={`max-w-full truncate px-0.5 text-center text-xs font-semibold leading-tight ${active ? "text-[#F45627]" : "text-white/80"}`}
        >
          {label}
        </span>
        {active && (
          <div
            className="absolute bottom-0 h-0.5 w-6 rounded-full bg-[#F45627]"
            data-testid={`${testId}-active`}
          />
        )}
      </div>
    </Link>
  );
}

export default function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const goHome = useNavigateHome();
  const [openQuickAdd, setOpenQuickAdd] = useState(false);

  if (!user) return null;

  const isActive = (path: string) => location === path;
  const hideOnRoutes = ["/patients/new", "/staff/new", "/inpatients/new"];
  const isEditOrNew =
    hideOnRoutes.includes(location) ||
    /^\/patients\/[^/]+\/edit$/.test(location) ||
    /^\/staff\/[^/]+\/edit$/.test(location) ||
    /^\/visits\/edit\/.+/.test(location) ||
    /^\/inpatients\/[^/]+\/session\/new$/.test(location) ||
    /^\/inpatients\/[^/]+\/discharge$/.test(location) ||
    /^\/inpatients\/[^/]+\/edit$/.test(location) ||
    /^\/appointments\/edit\/.+/.test(location) ||
    /^\/appointments\/book.*/.test(location) ||
    location === "/visits/new";

  if (isEditOrNew) return null;

  return (
    <>
      <QuickAddSheet open={openQuickAdd} onOpenChange={setOpenQuickAdd} />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#105691] text-white safe-area-bottom border-t border-white/10 pb-2 pt-1.5 shadow-[0_-4px_24px_rgba(16,86,145,0.3)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
        data-testid="nav-bottom"
      >
        <div className="flex min-h-[3.5rem] min-w-0 items-end justify-between gap-0.5 px-1">
          <NavItem
            href="/dashboard"
            active={isActive("/dashboard")}
            label="Home"
            icon={<LayoutDashboard {...navIconProps} />}
            testId="link-nav-home"
            onClick={goHome}
          />

          <NavItem
            href="/patients"
            active={isActive("/patients")}
            label="Patients"
            icon={<Users {...navIconProps} />}
            testId="link-nav-patients"
          />

          <NavItem
            href="/appointments"
            active={location.startsWith("/appointments")}
            label="Appointments"
            icon={<CalendarDays {...navIconProps} />}
            testId="link-nav-appointments"
          />

          <div className="relative flex min-h-[2.75rem] min-w-0 flex-1 justify-center">
            <button
              type="button"
              className="absolute -top-3 z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-white text-black shadow-lg transition-transform hover:shadow-xl active:scale-95 touch-manipulation"
              onClick={() => setOpenQuickAdd(true)}
              data-testid="button-nav-add"
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.75} />
            </button>
          </div>

          {canViewReportsHub(user.role) && (
            <NavItem
              // Salary now lives inside the Reports hub (Salary Report), so the bottom
              // nav exposes a single "Reports" entry for every role that can view it.
              href="/reports"
              active={
                location.startsWith("/reports") ||
                location.startsWith("/salary") ||
                isActive("/physio-summary")
              }
              label="Reports"
              icon={<BarChart3 {...navIconProps} />}
              testId="link-nav-reports"
            />
          )}

          <NavItem
            href="/attendance"
            active={isActive("/attendance")}
            label="Attendance"
            icon={<CalendarCheck {...navIconProps} />}
            testId="link-nav-attendance"
          />
        </div>
      </div>
    </>
  );
}
