import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  requestBrowserNotificationPermission,
  notificationPermission,
} from "@/hooks/use-notification-socket";

const DISMISS_KEY = "mc_notification_permission_dismissed";

export function NotificationPermissionPrompt() {
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return true;
    if (!("Notification" in window) || !window.isSecureContext) return true;
    if (Notification.permission !== "default") return true;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [requesting, setRequesting] = useState(false);

  if (hidden || notificationPermission() !== "default") return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const enable = async () => {
    setRequesting(true);
    try {
      await requestBrowserNotificationPermission();
    } finally {
      setRequesting(false);
      setHidden(true);
    }
  };

  return (
    <div
      role="region"
      aria-label="Enable notifications"
      className="mb-4 rounded-xl border border-[#D6E8F5] bg-[#F8FBFE] px-4 py-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1873A8]/10 text-[#1873A8]">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#105691]">Enable desktop notifications?</p>
          <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
            Get alerts when an admin sends a message or assigns you a task — even when this tab is
            in the background. You can still use in-app notifications if you skip this.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void enable()} disabled={requesting}>
              {requesting ? "Requesting…" : "Enable notifications"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-[#94A3B8] hover:bg-white hover:text-[#105691]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
