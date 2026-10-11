import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { store } from "../../app/store";
import { apiSlice, getBaseUrl } from "../api/apiSlice";
import type { Notification } from "../../types/models";

export type SocketConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected";

let socket: Socket | null = null;
let statusListeners: Array<(status: SocketConnectionStatus) => void> = [];
let currentStatus: SocketConnectionStatus = "disconnected";

function setConnectionStatus(status: SocketConnectionStatus) {
  currentStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

export function subscribeSocketStatus(
  listener: (status: SocketConnectionStatus) => void,
): () => void {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

export function getSocketStatus(): SocketConnectionStatus {
  return currentStatus;
}

export async function fetchSocketToken(): Promise<string | null> {
  try {
    const sessionToken =
      typeof window !== "undefined" ? localStorage.getItem("ems_token") : null;
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
    const res = await fetch(`${getBaseUrl()}/auth/socket-token`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.socketToken || null;
  } catch {
    return null;
  }
}

function getSocketUrl(): string {
  const socketEnv =
    import.meta.env.VITE_SOCKET_URL || import.meta.env.SOCKET_URL;
  if (socketEnv) {
    return socketEnv.endsWith("/") ? socketEnv.slice(0, -1) : socketEnv;
  }
  const apiEnv =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.API_BASE_URL ||
    import.meta.env.VITE_API_KEY_BASE ||
    import.meta.env.API_KEY_BASE ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.API_URL;
  if (apiEnv) {
    try {
      const parsed = new URL(apiEnv);
      return parsed.origin;
    } catch {
      // ignore
    }
  }
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://localhost:5000";
  }
  return "https://ems-server-wjey.onrender.com";
}

export async function connectSocket(): Promise<Socket | null> {
  if (socket?.connected) {
    return socket;
  }

  setConnectionStatus("connecting");
  const token = await fetchSocketToken();
  if (!token) {
    setConnectionStatus("disconnected");
    return null;
  }

  const socketUrl = getSocketUrl();

  if (!socket) {
    socket = io(socketUrl, {
      auth: { token },
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      setConnectionStatus("connected");
      // On reconnect/connect, invalidate cache tags to catch up
      store.dispatch(
        apiSlice.util.invalidateTags([
          "Today",
          "Attendance",
          "Dashboard",
          "Notification",
          "Overtime",
          "Report",
        ]),
      );
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setConnectionStatus("disconnected");
    });

    // Handle token refresh on reconnection attempt
    socket.io.on("reconnect_attempt", async () => {
      setConnectionStatus("connecting");
      const freshToken = await fetchSocketToken();
      if (freshToken && socket) {
        socket.auth = { token: freshToken };
      }
    });

    // Realtime Events Handling
    socket.on("attendance:updated", () => {
      store.dispatch(
        apiSlice.util.invalidateTags([
          "Today",
          "Attendance",
          "Dashboard",
          "Overtime",
          "Report",
        ]),
      );
    });

    socket.on("notification:new", (payload: { notification: Notification }) => {
      store.dispatch(apiSlice.util.invalidateTags(["Notification"]));

      const n = payload?.notification;
      if (n) {
        if (n.type === "invitation_accepted") {
          store.dispatch(
            apiSlice.util.invalidateTags(["User", "Invitation", "Dashboard"])
          );
        }
        toast.info(n.title, {
          description: n.message,
          duration: 6000,
        });
      }
    });
  } else {
    socket.auth = { token };
  }

  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  setConnectionStatus("disconnected");
}

export function getSocketInstance(): Socket | null {
  return socket;
}
