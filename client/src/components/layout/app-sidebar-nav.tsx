import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Plus,
  UserCircle,
  BarChart3,
  BedDouble,
  ListTodo,
  Bell,
  Settings,
  Receipt,
  Banknote,
  LayoutGrid,
  Sparkles,
  ScrollText,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { useBranch } from "@/context/branch-context";
import {
  canViewReportsHub,
  canViewAuditLogs,
  canViewStaffList,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useNavigateHome } from "@/hooks/use-navigate-home";
import { useGoToBranchSelect } from "@/hooks/use-go-to-branch-select";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { QuickAddSheet } from "./quick-add-sheet";
import defaultLogo from "@assets/215e8e36-1d78-4eeb-b7c3-eb908ab749e8_1769436217800.jpeg";

export function AppSidebarNav() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { logoUri } = useBranding();
  const { selectedBranchId, selectedContext, selectContext, selectedBranchName, canAccessMaximusOverview, canAccessNexusOverview } = useBranch();
  const { isMobile, setOpenMobile } = useSidebar();
  const [openQuickAdd, setOpenQuickAdd] = useState(false);

  if (!user) return null;

  const initials = (user.name?.trim().split(/\s+/) ?? [])
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "U";

  // Profile picture comes from the staff record (persisted via /staff/:id/photo and
  // returned by /auth/me). Render it when present; otherwise fall back to initials.
  const photoUri = (user as { photoUri?: string }).photoUri?.trim() || "";

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const goToOverview = (context: "maximus-overview" | "nexus-overview", path: string) => {
    closeMobile();
    if (selectedContext !== context) {
      void selectContext(context);
    }
    setLocation(path);
  };

  const isActive = (path: string) => location === path;
  const staffHref = canViewStaffList(user.role) ? "/staff" : "/profile";
  const staffActive = isActive("/staff") || isActive("/profile");
  const inBranchMode = !!selectedBranchId && !selectedContext;
  const showOperationalNav = inBranchMode;
  const goHome = useNavigateHome();
  const goToBranchSelect = useGoToBranchSelect();

  return (
    <>
      <QuickAddSheet open={openQuickAdd} onOpenChange={setOpenQuickAdd} />
      <SidebarHeader className="border-b border-white/10 p-2">
        <button
          type="button"
          onClick={() => {
            closeMobile();
            void goToBranchSelect();
          }}
          className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#F45627]"
          aria-label="Choose branch or workspace"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white p-1 shadow-sm">
            <img
              src={logoUri}
              alt="Maximus Care logo"
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                e.currentTarget.src = defaultLogo;
              }}
            />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-base font-extrabold tracking-tight">
              <span className="text-white">Maximus</span>
              <span className="text-[#F8B59B]"> Care</span>
            </span>
            <span className="flex items-center gap-1 truncate text-[0.7rem] font-medium text-white/60">
              {selectedBranchName?.trim() || "Choose workspace"}
              <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </button>
      </SidebarHeader>
      <SidebarContent className="touch-manipulation">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {showOperationalNav && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/dashboard")} className="min-h-11">
                    <Link
                      href="/dashboard"
                      onClick={(e) => {
                        closeMobile();
                        goHome(e);
                      }}
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {canAccessMaximusOverview && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/auth/branch-select")}
                    className={cn(
                      "min-h-11",
                      isActive("/auth/branch-select") && "bg-blue-600/20 text-white"
                    )}
                    onClick={() => {
                      closeMobile();
                      void goToBranchSelect();
                    }}
                  >
                    <LayoutGrid className="h-5 w-5" />
                    <span>Maximus Care</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {canAccessNexusOverview && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/nexus-overview")}
                    className={cn(
                      "min-h-11",
                      isActive("/nexus-overview") && "bg-amber-500/20 text-white"
                    )}
                    onClick={() => goToOverview("nexus-overview", "/nexus-overview")}
                  >
                    <Sparkles className="h-5 w-5" />
                    <span>Nexus (Beruwala)</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {showOperationalNav && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/patients")} className="min-h-11">
                      <Link href="/patients" onClick={closeMobile}>
                        <Users className="h-5 w-5" />
                        <span>Patients</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/appointments")} className="min-h-11">
                      <Link href="/appointments" onClick={closeMobile}>
                        <CalendarDays className="h-5 w-5" />
                        <span>Appointments</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="min-h-11" onClick={() => { closeMobile(); setOpenQuickAdd(true); }}>
                      <Plus className="h-5 w-5" />
                      <span>Quick Add</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {canViewReportsHub(user.role) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/reports") || isActive("/physio-summary")} className="min-h-11">
                        <Link href="/reports" onClick={closeMobile}>
                          <BarChart3 className="h-5 w-5" />
                          <span>Reports</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/therapist-summary")} className="min-h-11">
                      <Link href="/therapist-summary" onClick={closeMobile}>
                        <BarChart3 className="h-5 w-5" />
                        <span>Therapist Summary</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/inpatients")} className="min-h-11">
                      <Link href="/inpatients" onClick={closeMobile}>
                        <BedDouble className="h-5 w-5" />
                        <span>In-Patients</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/attendance")} className="min-h-11">
                      <Link href="/attendance" onClick={closeMobile}>
                        <CalendarCheck className="h-5 w-5" />
                        <span>Attendance</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/expenses")} className="min-h-11">
                      <Link href="/expenses" onClick={closeMobile}>
                        <Receipt className="h-5 w-5" />
                        <span>Expenses</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/tasks")} className="min-h-11">
                      <Link href="/tasks" onClick={closeMobile}>
                        <ListTodo className="h-5 w-5" />
                        <span>Tasks</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/notifications")} className="min-h-11">
                      <Link href="/notifications" onClick={closeMobile}>
                        <Bell className="h-5 w-5" />
                        <span>Notifications</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {(user.role === "Physiotherapist" ||
                    user.role === "Staff" ||
                    user.role === "Manager" ||
                    user.role === "Branch Manager" ||
                    ["Admin", "MD"].includes(user.role)) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/salary")} className="min-h-11">
                        <Link href="/salary" onClick={closeMobile}>
                          <Banknote className="h-5 w-5" />
                          <span>Salary</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {canViewAuditLogs(user.role) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/audit")} className="min-h-11">
                        <Link href="/audit" onClick={closeMobile}>
                          <ScrollText className="h-5 w-5" />
                          <span>Activity Log</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {["Admin", "MD"].includes(user.role) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/settings")} className="min-h-11">
                        <Link href="/settings" onClick={closeMobile}>
                          <Settings className="h-5 w-5" />
                          <span>Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={staffActive} className="min-h-11">
                      <Link href={staffHref} onClick={closeMobile}>
                        <UserCircle className="h-5 w-5" />
                        <span>{canViewStaffList(user.role) ? "Staff" : "Profile"}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-white/10 p-2">
        <Link
          href="/profile"
          onClick={closeMobile}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/10"
          data-testid="sidebar-user"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-bold text-white ring-2 ring-[#F45627]">
            {photoUri ? (
              <img
                src={photoUri}
                alt={user.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Broken/missing image → fall back to initials.
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <span
              className="h-full w-full items-center justify-center"
              style={{ display: photoUri ? "none" : "flex" }}
            >
              {initials}
            </span>
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-white">{user.name}</span>
            <span className="truncate text-[0.7rem] text-white/60">{user.role}</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => {
            closeMobile();
            logout();
          }}
          className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:bg-[#DC2626] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45627]"
          data-testid="sidebar-logout"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Log out</span>
        </button>
      </SidebarFooter>
    </>
  );
}
