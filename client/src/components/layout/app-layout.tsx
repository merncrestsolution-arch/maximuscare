import { ReactNode, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Header from "./header";
import BottomNav from "./bottom-nav";
import { QuickAddSheet } from "./quick-add-sheet";

function DesktopSidebarNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [openQuickAdd, setOpenQuickAdd] = useState(false);

  if (!user) return null;

  const isActive = (path: string) => location === path;
  const staffHref = ["Admin", "MD"].includes(user.role) ? "/staff" : "/profile";
  const staffActive = isActive("/staff") || isActive("/profile");

  return (
    <>
      <QuickAddSheet open={openQuickAdd} onOpenChange={setOpenQuickAdd} />
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="font-semibold text-sidebar-foreground">Maximus Care</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/patients")}>
                  <Link href="/patients">
                    <Users className="h-4 w-4" />
                    <span>Patients</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/appointments")}>
                  <Link href="/appointments">
                    <CalendarDays className="h-4 w-4" />
                    <span>Appointments</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setOpenQuickAdd(true)}>
                  <Plus className="h-4 w-4" />
                  <span>Add</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {user.role !== "Receptionist" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/physio-summary")}>
                    <Link href="/physio-summary">
                      <BarChart3 className="h-4 w-4" />
                      <span>Reports</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/inpatients")}>
                  <Link href="/inpatients">
                    <BedDouble className="h-4 w-4" />
                    <span>In-Patients</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/attendance")}>
                  <Link href="/attendance">
                    <CalendarCheck className="h-4 w-4" />
                    <span>Attendance</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={staffActive}>
                  <Link href={staffHref}>
                    <UserCircle className="h-4 w-4" />
                    <span>{["Admin", "MD"].includes(user.role) ? "Staff" : "Profile"}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Desktop: Sidebar + main area */}
      {!isMobile && user && (
        <SidebarProvider>
          <Sidebar className="[&_[data-sidebar=sidebar]]:border-white/10 [&_[data-sidebar=sidebar]]:bg-black [&_[data-sidebar=sidebar]]:text-white [&_svg]:text-white [&_.text-sidebar-foreground]:text-white/95">
            <DesktopSidebarNav />
          </Sidebar>
          <SidebarInset>
            <Header before={<SidebarTrigger className="-ml-1 text-foreground" />} />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      )}

      {/* Mobile: Header + main + bottom nav */}
      {isMobile && (
        <>
          {user && <Header />}
          <main className="flex-1 min-w-0 max-w-full overflow-x-hidden pb-32 pt-4 px-safe">{children}</main>
          {user && <BottomNav />}
        </>
      )}
    </div>
  );
}
