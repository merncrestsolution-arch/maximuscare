import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Plus,
  BarChart3,
  BedDouble,
  Receipt,
  ListTodo,
  Bell,
  Banknote,
  UserCircle,
  ScrollText,
  Settings,
  Activity,
  LayoutGrid,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";
import { useNavigateHome } from "@/hooks/use-navigate-home";
import {
  canViewReportsHub,
  canViewSalary,
  canViewAuditLogs,
  canViewStaffList,
  isManagementRole,
} from "@/lib/permissions";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

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
  const { user, logout } = useAuth();
  const goHome = useNavigateHome();
  const [openQuickAdd, setOpenQuickAdd] = useState(false);
  const [openMore, setOpenMore] = useState(false);

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

  const role = user.role;
  const staffHref = canViewStaffList(role) ? "/staff" : "/profile";

  // Full navigation surfaced inside the "More" sheet so every page is reachable
  // from the bottom bar. Visibility mirrors the sidebar's role gating.
  const moreItems: Array<{
    href: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    show: boolean;
  }> = [
    { href: "/dashboard", label: "Home", icon: <LayoutDashboard className="h-6 w-6" />, active: isActive("/dashboard"), show: true },
    { href: "/patients", label: "Patients", icon: <Users className="h-6 w-6" />, active: location.startsWith("/patients"), show: true },
    { href: "/appointments", label: "Appointments", icon: <CalendarDays className="h-6 w-6" />, active: location.startsWith("/appointments"), show: true },
    { href: "/attendance", label: "Attendance", icon: <CalendarCheck className="h-6 w-6" />, active: isActive("/attendance"), show: true },
    { href: "/inpatients", label: "In-Patients", icon: <BedDouble className="h-6 w-6" />, active: location.startsWith("/inpatients"), show: true },
    { href: "/reports", label: "Reports", icon: <BarChart3 className="h-6 w-6" />, active: location.startsWith("/reports"), show: canViewReportsHub(role) },
    { href: "/therapist-summary", label: "Therapist Summary", icon: <Activity className="h-6 w-6" />, active: isActive("/therapist-summary"), show: true },
    { href: "/expenses", label: "Expenses", icon: <Receipt className="h-6 w-6" />, active: location.startsWith("/expenses"), show: true },
    { href: "/tasks", label: "Tasks", icon: <ListTodo className="h-6 w-6" />, active: isActive("/tasks"), show: true },
    { href: "/notifications", label: "Notifications", icon: <Bell className="h-6 w-6" />, active: isActive("/notifications"), show: true },
    { href: "/salary", label: "Salary", icon: <Banknote className="h-6 w-6" />, active: location.startsWith("/salary"), show: canViewSalary(role) },
    { href: staffHref, label: canViewStaffList(role) ? "Staff" : "Profile", icon: <UserCircle className="h-6 w-6" />, active: isActive("/staff") || isActive("/profile"), show: true },
    { href: "/audit", label: "Activity Log", icon: <ScrollText className="h-6 w-6" />, active: isActive("/audit"), show: canViewAuditLogs(role) },
    { href: "/settings", label: "Settings", icon: <Settings className="h-6 w-6" />, active: isActive("/settings"), show: isManagementRole(role) },
  ];

  const visibleMoreItems = moreItems.filter((item) => item.show);

  return (
    <>
      <QuickAddSheet open={openQuickAdd} onOpenChange={setOpenQuickAdd} />

      <Drawer open={openMore} onOpenChange={setOpenMore}>
        <DrawerContent className="bg-white">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-[#105691]">All menu</DrawerTitle>
            <DrawerDescription>Jump to any section</DrawerDescription>
          </DrawerHeader>
          <div className="grid grid-cols-4 gap-3 px-4 pb-[calc(env(safe-area-inset-bottom,16px)+16px)] sm:grid-cols-5">
            {visibleMoreItems.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setOpenMore(false)}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-[#EEF5FB] touch-manipulation"
                data-testid={`more-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    item.active
                      ? "bg-[#F45627]/12 text-[#F45627]"
                      : "bg-[#EEF5FB] text-[#105691]"
                  }`}
                >
                  {item.icon}
                </div>
                <span
                  className={`w-full truncate text-[0.7rem] font-semibold leading-tight ${
                    item.active ? "text-[#F45627]" : "text-[#334155]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom,16px)+16px)] pt-1">
            <button
              type="button"
              onClick={() => {
                setOpenMore(false);
                logout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#DC2626] transition-colors hover:bg-[#FEE2E2] active:scale-[0.99] touch-manipulation"
              data-testid="more-nav-logout"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Log out
            </button>
          </div>
        </DrawerContent>
      </Drawer>

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
            active={location.startsWith("/patients")}
            label="Patients"
            icon={<Users {...navIconProps} />}
            testId="link-nav-patients"
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

          <NavItem
            href="/attendance"
            active={isActive("/attendance")}
            label="Attendance"
            icon={<CalendarCheck {...navIconProps} />}
            testId="link-nav-attendance"
          />

          <button
            type="button"
            onClick={() => setOpenMore(true)}
            className="flex min-w-0 flex-1 justify-center touch-manipulation"
            data-testid="button-nav-more"
            aria-label="Open full menu"
          >
            <div className="relative flex max-w-full flex-col items-center justify-end gap-0.5 pb-0.5 transition-colors">
              <div className={`shrink-0 ${openMore ? "text-[#F45627]" : "text-white/80"}`}>
                <LayoutGrid {...navIconProps} />
              </div>
              <span
                className={`max-w-full truncate px-0.5 text-center text-xs font-semibold leading-tight ${openMore ? "text-[#F45627]" : "text-white/80"}`}
              >
                More
              </span>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}
