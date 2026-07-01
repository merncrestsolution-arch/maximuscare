import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

type IncomingNotification = {
  id?: string;
  title?: string;
  message?: string;
  type?: string;
};

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

function wsBaseUrl(): string {
  const api = import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return `${api}/ws`;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Call from a user gesture (button click) so browsers allow the prompt. */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window) || !window.isSecureContext) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function showNativeNotification(notification: IncomingNotification) {
  if (!("Notification" in window)) return;
  if (!window.isSecureContext) return;
  if (Notification.permission !== "granted") return;

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
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (!user || !token) return;

    let closed = false;

    const clearReconnect = () => {
      if (reconnectTimer.current != null) {
        window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** reconnectAttempt.current,
        RECONNECT_MAX_MS,
      );
      reconnectAttempt.current += 1;
      clearReconnect();
      reconnectTimer.current = window.setTimeout(connect, delay);
    };

    const connect = () => {
      if (closed) return;
      clearReconnect();

      const socket = new WebSocket(`${wsBaseUrl()}?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "notification") {
            const notification = data.notification as IncomingNotification | undefined;
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
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

      socket.onclose = () => {
        socketRef.current = null;
        if (!closed) scheduleReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        reconnectAttempt.current = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      closed = true;
      clearReconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [user?.id, queryClient, toast]);
}
