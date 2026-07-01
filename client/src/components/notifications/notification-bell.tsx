import { useState } from "react";
import { ArrowLeft, Bell, Loader2, RefreshCw, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useData";

type NotificationRow = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
};

function formatNotificationDate(createdAt?: string) {
  if (!createdAt) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function NotificationDetail({
  notification,
  onBack,
  onViewAll,
}: {
  notification: NotificationRow;
  onBack: () => void;
  onViewAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#1873A8] hover:underline w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </button>

      <div className="rounded-2xl border border-[#D6E8F5] bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2">
          {notification.type === "app_update" && (
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-[#1873A8]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-[#105691]">{notification.title}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">
              {notification.message}
            </p>
            <p className="mt-4 text-[10px] text-[#94A3B8]">
              {formatNotificationDate(notification.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {notification.type === "app_update" && (
        <Button
          className="w-full"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh app
        </Button>
      )}

      <Button
        variant="outline"
        className="w-full border-[#D6E8F5] bg-white text-[#105691]"
        onClick={onViewAll}
      >
        Open notifications page
      </Button>
    </div>
  );
}

export function NotificationBell() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: notifications = [], isLoading } = useNotifications({ archived: false });
  const { data: unread } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = unread?.count ?? 0;

  const selected = notifications.find((n: NotificationRow) => n.id === selectedId);

  const openNotification = (notification: NotificationRow) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    setSelectedId(notification.id);
  };

  const closeDrawer = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSelectedId(null);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-10 w-10 text-[#105691] hover:bg-[#EEF5FB] hover:text-[#1873A8]"
        data-testid="button-notifications"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F45627] px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      <Drawer open={open} onOpenChange={closeDrawer}>
        <DrawerContent className="max-h-[85dvh] bg-[#EEF5FB]">
          <DrawerHeader className="relative border-b border-[#D6E8F5] pb-4 text-left">
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Close notifications"
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-white hover:text-[#105691]"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
            <DrawerTitle className="pr-10 text-lg font-extrabold text-[#105691]">
              {selected ? "Notification" : "Notifications"}
            </DrawerTitle>
            <DrawerDescription className="flex items-center justify-between gap-2 text-[#64748B]">
              {selected ? (
                <span>Read the full message below</span>
              ) : (
                <>
                  <span>{count > 0 ? `${count} unread` : "You're all caught up"}</span>
                  {count > 0 && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#1873A8] hover:underline"
                      onClick={() => markAll.mutate()}
                    >
                      Mark all read
                    </button>
                  )}
                </>
              )}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,16px)+16px)]">
            {selected ? (
              <NotificationDetail
                notification={selected}
                onBack={() => setSelectedId(null)}
                onViewAll={() => {
                  setOpen(false);
                  setSelectedId(null);
                  setLocation("/notifications");
                }}
              />
            ) : isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#1873A8]" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#64748B]">No notifications</p>
            ) : (
              <div className="space-y-2 pt-2">
                {notifications.slice(0, 20).map((n: NotificationRow) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`w-full rounded-2xl border border-[#D6E8F5] bg-white p-4 text-left shadow-sm transition-colors hover:bg-[#F8FBFE] ${
                      !n.isRead ? "ring-1 ring-[#1873A8]/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {n.type === "app_update" && (
                        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[#1873A8]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#105691]">{n.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">{n.message}</p>
                        <p className="mt-2 text-[10px] text-[#94A3B8]">
                          {formatNotificationDate(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}

                <Button
                  variant="outline"
                  className="mt-4 w-full border-[#D6E8F5] bg-white text-[#105691]"
                  onClick={() => {
                    setOpen(false);
                    setLocation("/notifications");
                  }}
                >
                  View all notifications
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
