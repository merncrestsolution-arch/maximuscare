import { ReactNode } from "react";
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
  useNotificationSocket();

  if (!user) {
    return <div className="flex min-h-screen w-full flex-col bg-background">{children}</div>;
  }

  return (
    <SidebarProvider defaultOpen={!isTablet} className="min-h-svh w-full">
      <Sidebar
        collapsible="icon"
        className="[&_[data-sidebar=sidebar]]:border-white/10 [&_[data-sidebar=sidebar]]:bg-black [&_[data-sidebar=sidebar]]:text-white [&_svg]:text-white [&_.text-sidebar-foreground]:text-white/95"
      >
        <AppSidebarNav />
      </Sidebar>
      <SidebarInset className="flex min-h-svh min-w-0 w-full flex-1 flex-col overflow-hidden">
        <Header
          before={
            <div className="flex items-center gap-1">
              <PageBackButton />
              <SidebarTrigger className="-ml-1 text-white md:text-foreground" aria-label="Open menu" />
            </div>
          }
        />
        <div className="flex-1 min-w-0 w-full overflow-x-hidden overflow-y-auto p-4 md:p-6 pb-28 md:pb-6 px-safe">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
        </div>
      </SidebarInset>
      {isMobile && <BottomNav />}
    </SidebarProvider>
  );
}
