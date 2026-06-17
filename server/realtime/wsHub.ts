import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyAccessToken } from "../services/jwtService";
import type { Notification } from "@shared/schema";

const staffSockets = new Map<string, Set<WebSocket>>();

export function initWebSocketServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) {
      socket.close(4401, "Unauthorized");
      return;
    }
    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      socket.close(4401, "Unauthorized");
      return;
    }

    const staffId = payload.sub;
    let set = staffSockets.get(staffId);
    if (!set) {
      set = new Set();
      staffSockets.set(staffId, set);
    }
    set.add(socket);

    socket.on("close", () => {
      set!.delete(socket);
      if (set!.size === 0) staffSockets.delete(staffId);
    });

    socket.send(JSON.stringify({ type: "connected", staffId }));
  });

  console.log("[ws] WebSocket server listening on /ws");
}

export function pushNotificationToStaff(staffId: string, notification: Notification): void {
  const set = staffSockets.get(staffId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify({
    type: "notification",
    notification: {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    },
  });
  for (const socket of Array.from(set)) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}
