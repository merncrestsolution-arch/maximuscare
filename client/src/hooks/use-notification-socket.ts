import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

function wsBaseUrl(): string {
  const api = import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return `${api}/ws`;
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
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
          toast({
            title: data.notification?.title || "New notification",
            description: data.notification?.message,
          });
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => socket.close();
  }, [user?.id, queryClient, toast]);
}
