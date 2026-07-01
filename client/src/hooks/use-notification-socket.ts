import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

type IncomingNotification = {
  id?: string;
  title?: string;
  message?: string;
  type?: string;
};

function wsBaseUrl(): string {
  const api = import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return `${api}/ws`;
}

async function showNativeNotification(notification: IncomingNotification) {
  if (!("Notification" in window)) return;
  if (!window.isSecureContext) return;

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (permission !== "granted") return;

  const title = notification.title || "New notification";
  const options: NotificationOptions = {
    body: notification.message || "",
    tag: notification.id,
    data: { url: "/notifications" },
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  }

  const native = new Notification(title, options);
  native.onclick = () => {
    window.focus();
    window.location.assign("/notifications");
  };
}

export function useNotificationSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (!user || !token) return;

    const socket = new WebSocket(`${wsBaseUrl()}?token=${encodeURIComponent(token)}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          const notification = data.notification as IncomingNotification | undefined;
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
          toast({
            title: notification?.title || "New notification",
            description: notification?.message,
          });
          if (notification) {
            void showNativeNotification(notification);
          }
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => socket.close();
  }, [user?.id, queryClient, toast]);
}
