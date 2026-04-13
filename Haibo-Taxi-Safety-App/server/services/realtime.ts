import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, AuthPayload } from "../middleware/auth";
import { db } from "../db";
import { locationUpdates, driverProfiles } from "../../shared/schema";
import { eq } from "drizzle-orm";

let io: Server | null = null;

interface DriverLocation {
  userId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

// In-memory store of active driver locations (for real-time map)
const activeDrivers = new Map<string, DriverLocation>();

// Per-user last-event timestamps for throttling
const lastLocationUpdate = new Map<string, number>();
const lastSosTrigger = new Map<string, number>();
const LOCATION_MIN_INTERVAL_MS = 2000; // 1 update per 2s per driver
const SOS_MIN_INTERVAL_MS = 60_000; // 1 SOS per minute per user

function isValidLatLng(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lon === "number" && Number.isFinite(lon) && lon >= -180 && lon <= 180
  );
}

/**
 * Initialize Socket.IO on the existing HTTP server.
 */
export function initRealtime(httpServer: HttpServer): Server {
  const isProduction = process.env.NODE_ENV === "production";
  const wsAllowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [];

  io = new Server(httpServer, {
    cors: {
      origin: isProduction ? wsAllowedOrigins : true,
      credentials: true,
    },
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

  // Auth middleware — verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const user = verifyToken(token as string);
      (socket as any).user = user;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user: AuthPayload = (socket as any).user;
    console.log(`[WS] Connected: ${user.userId} (${user.role})`);

    // Join user to their own room for targeted notifications
    socket.join(`user:${user.userId}`);

    // Drivers join the drivers room
    if (user.role === "driver") {
      socket.join("drivers");
    }

    // --- GPS Location Updates (from drivers) ---
    socket.on("location:update", async (data: {
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
    }) => {
      if (!data || !isValidLatLng(data.latitude, data.longitude)) {
        socket.emit("error", { event: "location:update", reason: "Invalid coordinates" });
        return;
      }

      const now = Date.now();
      const last = lastLocationUpdate.get(user.userId) || 0;
      if (now - last < LOCATION_MIN_INTERVAL_MS) {
        return; // silently drop — throttle at 1 update per 2s per driver
      }
      lastLocationUpdate.set(user.userId, now);

      const location: DriverLocation = {
        userId: user.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading,
        timestamp: new Date().toISOString(),
      };

      // Update in-memory store
      activeDrivers.set(user.userId, location);

      // Broadcast to all connected clients watching the map
      socket.broadcast.to("map:watchers").emit("driver:moved", location);

      // Persist to database
      try {
        await db.insert(locationUpdates).values({
          userId: user.userId,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy || null,
          speed: data.speed || null,
          heading: data.heading || null,
        });

        // Update driver profile with current location
        await db.update(driverProfiles)
          .set({
            currentLatitude: data.latitude,
            currentLongitude: data.longitude,
            lastLocationUpdate: new Date(),
          })
          .where(eq(driverProfiles.userId, user.userId));
      } catch (err) {
        console.error("[WS] DB location save failed:", err);
      }
    });

    // --- Watch map (commuters watching driver positions) ---
    socket.on("map:watch", () => {
      socket.join("map:watchers");
      // Send current active drivers
      const drivers = Array.from(activeDrivers.values());
      socket.emit("drivers:snapshot", drivers);
    });

    socket.on("map:unwatch", () => {
      socket.leave("map:watchers");
    });

    // --- SOS Alert ---
    socket.on("sos:trigger", async (data: {
      latitude: number;
      longitude: number;
      message?: string;
    }) => {
      if (!data || !isValidLatLng(data.latitude, data.longitude)) {
        socket.emit("error", { event: "sos:trigger", reason: "Invalid coordinates" });
        return;
      }

      const now = Date.now();
      const last = lastSosTrigger.get(user.userId) || 0;
      if (now - last < SOS_MIN_INTERVAL_MS) {
        socket.emit("error", { event: "sos:trigger", reason: "SOS rate limit" });
        return;
      }
      lastSosTrigger.set(user.userId, now);

      console.log(`[SOS] WS alert from ${user.userId} at ${data.latitude},${data.longitude}`);

      // Notify the drivers room immediately for visibility
      io?.to("drivers").emit("sos:alert", {
        userId: user.userId,
        phone: user.phone,
        latitude: data.latitude,
        longitude: data.longitude,
        message: data.message || "Emergency SOS triggered!",
        timestamp: new Date().toISOString(),
      });

      // Route through the service so admins get push, SMS fires to emergency contact,
      // and the event is persisted to the sos_alerts audit table.
      try {
        const { sendSOSAlert } = await import("./notifications");
        await sendSOSAlert(user.userId, data.latitude, data.longitude, data.message, "websocket");
      } catch (err) {
        console.error("[SOS] WS-to-service dispatch failed:", err);
      }
    });

    // --- Group Ride Chat ---
    socket.on("ride:join", (rideId: string) => {
      socket.join(`ride:${rideId}`);
    });

    socket.on("ride:leave", (rideId: string) => {
      socket.leave(`ride:${rideId}`);
    });

    socket.on("ride:message", (data: { rideId: string; message: string }) => {
      io?.to(`ride:${data.rideId}`).emit("ride:newMessage", {
        userId: user.userId,
        phone: user.phone,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    // --- Delivery Tracking ---
    socket.on("delivery:track", (deliveryId: string) => {
      socket.join(`delivery:${deliveryId}`);
    });

    // --- Admin room ---
    if (user.role === "admin") {
      socket.join("admins");
    }

    // --- Disconnect ---
    socket.on("disconnect", () => {
      activeDrivers.delete(user.userId);
      lastLocationUpdate.delete(user.userId);
      lastSosTrigger.delete(user.userId);
      console.log(`[WS] Disconnected: ${user.userId}`);
    });
  });

  console.log("[WS] Socket.IO real-time server initialized");
  return io;
}

/**
 * Get the Socket.IO instance for emitting from routes/services.
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit an event to a specific user.
 */
export function emitToUser(userId: string, event: string, data: any): void {
  io?.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit to all connected clients.
 */
export function broadcast(event: string, data: any): void {
  io?.emit(event, data);
}

/**
 * Get count of active drivers broadcasting GPS.
 */
export function getActiveDriverCount(): number {
  return activeDrivers.size;
}
