import { ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Header from "./header";
import BottomNav from "./bottom-nav";
import { AppSidebarNav } from "./app-sidebar-nav";
import { useNotificationSocket } from "@/hooks/use-notification-socket";
import { PageBackButton } from "./page-back-button";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [location] = useLocation();
  useNotificationSocket();

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
    
  const showBottomNav = isMobile && !isEditOrNew;
  // Back control on every page except the top-level landings (where "back" would
  // otherwise jump to the branch-selection screen).
  const isLandingPage = ["/dashboard", "/maximus-overview", "/nexus-overview"].includes(location);
  const showBack = !isLandingPage;

  if (!user) {
    return <div className="flex min-h-screen w-full flex-col bg-background">{children}</div>;
  }

  return (
    <SidebarProvider defaultOpen={!isTablet} className="min-h-svh w-full">
      <Sidebar
        collapsible="icon"
        className="[&_[data-sidebar=sidebar]]:border-[var(--sidebar-border)] [&_[data-sidebar=sidebar]]:bg-[var(--sidebar-bg)] [&_[data-sidebar=sidebar]]:text-[var(--sidebar-text)] [&_svg]:text-white/80"
      >
        <AppSidebarNav />
      </Sidebar>
      <SidebarInset className="flex min-h-svh min-w-0 w-full flex-1 flex-col overflow-hidden">
        <Header
          before={
            <div className="flex items-center shrink-0">
              {/* Fixed 40x40 touch target for the menu button so it doesn't render oversized on mobile. */}
              <SidebarTrigger
                className="h-10 w-10 shrink-0 text-[#105691] hover:bg-[#EEF5FB] md:text-foreground md:hover:bg-muted [&_svg]:h-5 [&_svg]:w-5"
                aria-label="Open menu"
              />
            </div>
          }
        />
        <div className={`flex-1 min-w-0 w-full overflow-x-hidden overflow-y-auto p-3 md:p-6 ${showBottomNav ? 'pb-28' : 'pb-6'} md:pb-6 px-safe`}>
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[1600px] min-w-0"
          >
            {showBack && <PageBackButton />}
            {children}
          </motion.div>
        </div>
      </SidebarInset>
      {showBottomNav && <BottomNav />}
    </SidebarProvider>
  );
}
