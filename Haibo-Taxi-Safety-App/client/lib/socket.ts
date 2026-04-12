import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/query-client";
import { getCurrentToken } from "@/contexts/AuthContext";

let socket: Socket | null = null;

/**
 * Connect to the real-time server via Socket.IO.
 * Requires an auth token — call after login.
 */
export function connectSocket(): Socket | null {
  const baseUrl = getApiUrl();
  const token = getCurrentToken();

  if (!baseUrl || !token) {
    console.log("[Socket] No API URL or token — skipping connection");
    return null;
  }

  if (socket?.connected) {
    return socket;
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  socket = io(baseUrl, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("connect_error", (err) => {
    console.log("[Socket] Connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  return socket;
}

/**
 * Disconnect from the real-time server.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket instance.
 */
export function getSocket(): Socket | null {
  return socket;
}

// ─── Driver GPS Broadcasting ─────────────────────────────────────────────────

/**
 * Send a location update to the server (driver mode).
 */
export function sendLocationUpdate(data: {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}): void {
  socket?.emit("location:update", data);
}

// ─── Map Watching (Commuters) ────────────────────────────────────────────────

export interface DriverLocation {
  userId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

/**
 * Start watching driver locations on the map.
 */
export function watchDriverLocations(
  onSnapshot: (drivers: DriverLocation[]) => void,
  onDriverMoved: (location: DriverLocation) => void
): () => void {
  if (!socket) return () => {};

  socket.emit("map:watch");
  socket.on("drivers:snapshot", onSnapshot);
  socket.on("driver:moved", onDriverMoved);

  return () => {
    socket?.emit("map:unwatch");
    socket?.off("drivers:snapshot", onSnapshot);
    socket?.off("driver:moved", onDriverMoved);
  };
}

// ─── SOS ─────────────────────────────────────────────────────────────────────

/**
 * Trigger an SOS alert via real-time channel.
 */
export function triggerSOS(latitude: number, longitude: number, message?: string): void {
  socket?.emit("sos:trigger", { latitude, longitude, message });
}

/**
 * Listen for SOS alerts (drivers/admins).
 */
export function onSOSAlert(callback: (alert: {
  userId: string;
  phone: string;
  latitude: number;
  longitude: number;
  message: string;
  timestamp: string;
}) => void): () => void {
  socket?.on("sos:alert", callback);
  return () => { socket?.off("sos:alert", callback); };
}

// ─── Group Ride Chat ─────────────────────────────────────────────────────────

export function joinRideChat(rideId: string): void {
  socket?.emit("ride:join", rideId);
}

export function leaveRideChat(rideId: string): void {
  socket?.emit("ride:leave", rideId);
}

export function sendRideMessage(rideId: string, message: string): void {
  socket?.emit("ride:message", { rideId, message });
}

export function onRideMessage(callback: (msg: {
  userId: string;
  phone: string;
  message: string;
  timestamp: string;
}) => void): () => void {
  socket?.on("ride:newMessage", callback);
  return () => { socket?.off("ride:newMessage", callback); };
}
