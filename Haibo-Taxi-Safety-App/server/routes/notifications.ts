import { Router, Response } from "express";
import { db } from "../db";
import { notifications, users } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sosRateLimit, sosGuestRateLimit } from "../middleware/rateLimit";
import { notifyUser, sendSOSAlert } from "../services/notifications";

const router = Router();

// POST /api/notifications/register-token — Save FCM token for push notifications
router.post("/register-token", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      res.status(400).json({ error: "FCM token is required" });
      return;
    }

    await db.update(users)
      .set({ fcmToken })
      .where(eq(users.id, req.user!.userId));

    res.json({ message: "Push notification token registered" });
  } catch (error: any) {
    console.error("Register token error:", error);
    res.status(500).json({ error: "Failed to register token" });
  }
});

// GET /api/notifications — Get user's notifications
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const results = await db.select().from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadCount = results.filter((n) => !n.isRead).length;

    res.json({ data: results, unreadCount });
  } catch (error: any) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PUT /api/notifications/:id/read — Mark notification as read
router.put("/:id/read", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, req.params.id),
          eq(notifications.userId, req.user!.userId)
        )
      );

    res.json({ message: "Notification marked as read" });
  } catch (error: any) {
    console.error("Mark read error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// PUT /api/notifications/read-all — Mark all notifications as read
router.put("/read-all", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, req.user!.userId),
          eq(notifications.isRead, false)
        )
      );

    res.json({ message: "All notifications marked as read" });
  } catch (error: any) {
    console.error("Mark all read error:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

function validateSosCoords(latitude: unknown, longitude: unknown): { lat: number; lon: number } | null {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

// POST /api/notifications/sos — Authenticated SOS (real-time + push + audit)
router.post("/sos", authMiddleware, sosRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const coords = validateSosCoords(req.body.latitude, req.body.longitude);
    if (!coords) {
      res.status(400).json({ error: "Valid location (latitude, longitude) is required for SOS" });
      return;
    }

    await sendSOSAlert({
      userId: req.user!.userId,
      latitude: coords.lat,
      longitude: coords.lon,
      message: req.body.message,
      source: "api",
    });

    res.json({ message: "SOS alert sent", timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("SOS alert error:", error);
    res.status(500).json({ error: "Failed to send SOS alert" });
  }
});

// POST /api/notifications/sos/guest — Anonymous SOS for pre-login users.
// A safety app MUST let unauthenticated users in danger trigger an alert.
// Tight rate-limited by IP+deviceId; everything else is identical to the
// authenticated path (admins notified, WebSocket broadcast, audit row).
router.post("/sos/guest", sosGuestRateLimit, async (req, res: Response) => {
  try {
    const coords = validateSosCoords(req.body.latitude, req.body.longitude);
    if (!coords) {
      res.status(400).json({ error: "Valid location (latitude, longitude) is required for SOS" });
      return;
    }

    const { deviceId, phone, displayName, emergencyContactPhone, message } = req.body as {
      deviceId?: string;
      phone?: string;
      displayName?: string;
      emergencyContactPhone?: string;
      message?: string;
    };

    await sendSOSAlert({
      latitude: coords.lat,
      longitude: coords.lon,
      message,
      source: "guest_api",
      guestPhone: phone,
      guestDisplayName: displayName,
      guestEmergencyContact: emergencyContactPhone,
      guestDeviceId: deviceId,
    });

    res.json({ message: "SOS alert sent", timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Guest SOS alert error:", error);
    res.status(500).json({ error: "Failed to send SOS alert" });
  }
});

// POST /api/notifications/test — Send a test notification (development only)
router.post("/test", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Test notifications not available in production" });
    return;
  }

  try {
    const sent = await notifyUser({
      userId: req.user!.userId,
      type: "system",
      title: "Test Notification",
      body: "If you see this, push notifications are working!",
      data: { test: true },
    });

    res.json({ message: "Test notification sent", pushDelivered: sent });
  } catch (error: any) {
    console.error("Test notification error:", error);
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

export default router;
