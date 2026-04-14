import { io, Socket } from "socket.io-client";
import { getApiUrl, getStoredToken } from "../api/client";

/**
 * Singleton Socket.IO client. The server's realtime layer verifies the
 * JWT on connection and auto-joins admin users to the "admins" room, so
 * the Command Center just needs to hand over the stored auth token.
 *
 * We lazy-connect the first time someone asks for the socket so the login
 * page doesn't open a socket only to throw it away.
 */

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  const token = getStoredToken();
  if (!token) {
    throw new Error("Cannot open Socket.IO without an auth token");
  }

  if (!socket) {
    socket = io(getApiUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect_error", (err) => {
      // eslint-disable-next-line no-console
      console.warn("[CC WS] connect_error:", err.message);
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function closeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
