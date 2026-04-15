import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, AuthPayload } from "../middleware/auth";
import { db } from "../db";
import {
  locationUpdates,
  driverProfiles,
  users,
  groupRides,
  groupRideParticipants,
} from "../../shared/schema";
import { and, eq, or } from "drizzle-orm";

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

  // Auth middleware — verify JWT on connection, then do a single PK
  // lookup to block suspended accounts. The HTTP authMiddleware does the
  // same check on every request; without mirroring it here, a user whose
  // /api/user/delete call just flipped isSuspended=true could keep
  // connecting on WebSocket until their access token expires (up to 30
  // days) and keep spamming events, watching map positions, or posting
  // ride chat. Critical for POPIA erasure — "delete" has to mean the
  // user stops being able to do anything immediately, not eventually.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    let user: AuthPayload;
    try {
      user = verifyToken(token as string);
    } catch {
      return next(new Error("Invalid token"));
    }

    try {
      const [row] = await db
        .select({ isSuspended: users.isSuspended })
        .from(users)
        .where(eq(users.id, user.userId))
        .limit(1);
      if (!row) {
        return next(new Error("Account not found"));
      }
      if (row.isSuspended) {
        return next(new Error("Account suspended"));
      }
    } catch (err) {
      console.error("[WS] Suspension lookup failed:", err);
      return next(new Error("Authentication check failed"));
    }

    (socket as any).user = user;
    next();
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

    // Admins join the admins room so the Command Center can receive
    // sos:alert, complaint:new, withdrawal:requested fanouts without every
    // route having to look up admin user IDs.
    if (user.role === "admin") {
      socket.join("admins");
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
        await sendSOSAlert({
          userId: user.userId,
          latitude: data.latitude,
          longitude: data.longitude,
          message: data.message,
          source: "websocket",
        });
      } catch (err) {
        console.error("[SOS] WS-to-service dispatch failed:", err);
      }
    });

    // --- Group Ride Chat ---
    // Any user who knows a ride UUID could previously join the ride room
    // and eavesdrop on chat + GPS. Gate both join and message on actual
    // membership: either the organizer of the ride, or a participant row
    // for the ride. UUIDs aren't easily guessed but "hard to guess" is
    // not a security control — check membership properly.
    async function isRideMember(rideId: string): Promise<boolean> {
      if (!rideId || typeof rideId !== "string") return false;
      try {
        const [organizerHit] = await db
          .select({ id: groupRides.id })
          .from(groupRides)
          .where(
            and(
              eq(groupRides.id, rideId),
              eq(groupRides.organizerId, user.userId),
            ),
          )
          .limit(1);
        if (organizerHit) return true;

        const [participantHit] = await db
          .select({ id: groupRideParticipants.id })
          .from(groupRideParticipants)
          .where(
            and(
              eq(groupRideParticipants.rideId, rideId),
              eq(groupRideParticipants.userId, user.userId),
            ),
          )
          .limit(1);
        return Boolean(participantHit);
      } catch (err) {
        console.error("[WS] Ride membership check failed:", err);
        return false;
      }
    }

    socket.on("ride:join", async (rideId: string) => {
      if (!(await isRideMember(rideId))) {
        socket.emit("error", { event: "ride:join", reason: "Not a member of this ride" });
        return;
      }
      socket.join(`ride:${rideId}`);
    });

    socket.on("ride:leave", (rideId: string) => {
      if (typeof rideId === "string" && rideId.length > 0) {
        socket.leave(`ride:${rideId}`);
      }
    });

    socket.on("ride:message", async (data: { rideId: string; message: string }) => {
      if (!data || typeof data.rideId !== "string" || typeof data.message !== "string") {
        return;
      }
      // Cap message length to protect the feed read path — same rationale
      // as the community post caption cap. 1000 chars is plenty for a
      // group-ride chat message while refusing wall-of-text abuse.
      if (data.message.length === 0 || data.message.length > 1000) {
        socket.emit("error", {
          event: "ride:message",
          reason: "Message must be 1–1000 characters",
        });
        return;
      }
      if (!(await isRideMember(data.rideId))) {
        socket.emit("error", {
          event: "ride:message",
          reason: "Not a member of this ride",
        });
        return;
      }
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
 * Emit an event to every connected admin (Command Center). Admins join the
 * "admins" room on connection — this is the single entry point for fanning
 * out admin-facing events from any route or service.
 */
export function emitToAdmins(event: string, data: any): void {
  io?.to("admins").emit(event, data);
}

/**
 * Forcefully disconnect all live WebSocket sessions for a given user.
 * Called by the admin suspend / unsuspend / user-delete flows so a
 * suspended user can't keep an already-connected socket alive after
 * their token has been invalidated at the DB level. A last-gasp
 * `auth:revoked` event fires before the disconnect so the client can
 * surface an appropriate toast instead of a silent drop.
 */
export async function kickUserSockets(userId: string, reason: string): Promise<number> {
  if (!io) return 0;
  const room = `user:${userId}`;
  const sockets = await io.in(room).fetchSockets();
  for (const socket of sockets) {
    socket.emit("auth:revoked", { reason });
    socket.disconnect(true);
  }
  return sockets.length;
}

/**
 * Get count of active drivers broadcasting GPS.
 */
export function getActiveDriverCount(): number {
  return activeDrivers.size;
}
