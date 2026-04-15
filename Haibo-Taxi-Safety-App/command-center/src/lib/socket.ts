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

// Wipe auth + bounce to /login with a reason. Shared between the 401/403
// handler in the HTTP client and the socket-level revocation handler so
// both transports fall off consistently.
function forceLoginRedirect(reason: "suspended" | "auth_error"): void {
  try {
    localStorage.removeItem("haibo_cc_token");
    localStorage.removeItem("haibo_cc_user");
  } catch {
    // ignore — Safari private mode etc.
  }
  if (typeof window !== "undefined") {
    window.location.href = `/login?reason=${reason}`;
  }
}

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
      // Server-side io.use middleware rejects with a bare Error whose
      // message is the reason. Bounce the operator to /login if their
      // account was suspended or the token no longer maps to a valid
      // user (e.g. mid-session delete).
      const msg = (err?.message || "").toLowerCase();
      if (
        msg.includes("account suspended") ||
        msg.includes("account not found") ||
        msg.includes("invalid token")
      ) {
        closeSocket();
        forceLoginRedirect("suspended");
      }
    });

    // Server's kickUserSockets() helper emits auth:revoked before
    // disconnecting the socket. We can catch it here and give the
    // operator a friendlier experience than a silent drop.
    socket.on("auth:revoked", (payload: { reason?: string }) => {
      // eslint-disable-next-line no-console
      console.warn("[CC WS] auth:revoked:", payload?.reason || "unknown");
      closeSocket();
      forceLoginRedirect("suspended");
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
