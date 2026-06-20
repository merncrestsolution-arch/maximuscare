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
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useBranch } from "@/context/branch-context";
import {
  canAccessMaximusOverview,
  canAccessNexusOverview,
  canViewReports,
  canViewAuditLogs,
  canViewStaffList,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useNavigateHome } from "@/hooks/use-navigate-home";
import { useGoToBranchSelect } from "@/hooks/use-go-to-branch-select";
import {
  SidebarContent,
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

export function AppSidebarNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { selectedBranchId, selectedContext, selectContext } = useBranch();
  const { isMobile, setOpenMobile } = useSidebar();
  const [openQuickAdd, setOpenQuickAdd] = useState(false);

  if (!user) return null;

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
      <SidebarHeader className="border-b border-sidebar-border">
        <button
          type="button"
          onClick={() => {
            closeMobile();
            void goToBranchSelect();
          }}
          className="flex w-full items-center gap-2 px-2 py-3 rounded-md text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Choose branch or workspace"
        >
          <span className="font-bold text-sidebar-foreground text-base">Maximus Care</span>
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
              {canAccessMaximusOverview(user.role) && (
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
              {canAccessNexusOverview(user.role) && (
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
                  {canViewReports(user.role) && (
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
                  {(user.role === "Physiotherapist" || user.role === "Staff" || ["Admin", "MD"].includes(user.role)) && (
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
    </>
  );
}
