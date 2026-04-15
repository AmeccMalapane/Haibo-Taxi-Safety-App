import { Router, Response } from "express";
import { db } from "../db";
import {
  deliveries, deliveryTracking, packages, packageStatusHistory,
  courierHubs, groupRides, groupRideParticipants, rideChat,
} from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { parsePagination, paginationResponse, generateTrackingNumber, generateConfirmationCode } from "../utils/helpers";

const router = Router();

// ============ DELIVERIES (Haibo Hub) ============

// GET /api/deliveries - List user's deliveries
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const results = await db.select().from(deliveries)
      .where(eq(deliveries.senderId, req.user!.userId))
      .orderBy(desc(deliveries.createdAt))
      .limit(limit).offset(offset);

    const [totalResult] = await db.select({ count: count() })
      .from(deliveries)
      .where(eq(deliveries.senderId, req.user!.userId));

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get deliveries error:", error);
    res.status(500).json({ error: "Failed to fetch deliveries" });
  }
});

// POST /api/deliveries - Create a delivery
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      taxiPlateNumber, description, pickupRank, dropoffRank,
      amount, driverPhone, insuranceIncluded, insuranceAmount,
    } = req.body;

    if (!taxiPlateNumber || !description || !pickupRank || !dropoffRank || !amount) {
      res.status(400).json({ error: "Taxi plate, description, pickup/dropoff ranks, and amount are required" });
      return;
    }

    const confirmationCode = generateConfirmationCode();

    const [delivery] = await db.insert(deliveries).values({
      senderId: req.user!.userId,
      taxiPlateNumber,
      description,
      pickupRank,
      dropoffRank,
      amount,
      driverPhone: driverPhone || null,
      confirmationCode,
      insuranceIncluded: insuranceIncluded || false,
      insuranceAmount: insuranceAmount || 0,
      status: "pending",
      paymentStatus: "pending",
    }).returning();

    res.status(201).json({ ...delivery, confirmationCode });
  } catch (error: any) {
    console.error("Create delivery error:", error);
    res.status(500).json({ error: "Failed to create delivery" });
  }
});

// GET /api/deliveries/:id - Get delivery details (sender, driver, or admin)
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select().from(deliveries).where(eq(deliveries.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }

    const delivery = result[0];
    const isSender = delivery.senderId === req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    const isDriver = req.user!.role === "driver";
    if (!isSender && !isAdmin && !isDriver) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const tracking = await db.select().from(deliveryTracking)
      .where(eq(deliveryTracking.deliveryId, req.params.id))
      .orderBy(desc(deliveryTracking.timestamp));

    res.json({ ...delivery, tracking });
  } catch (error: any) {
    console.error("Get delivery error:", error);
    res.status(500).json({ error: "Failed to fetch delivery" });
  }
});

// PUT /api/deliveries/:id/status - Update delivery status (sender, assigned driver, or admin)
// Valid delivery state transitions. Keys are the CURRENT state, values
// are the states this delivery is allowed to move to. Prevents clients
// from skipping past required steps (e.g. "pending" → "delivered"
// bypassing the accepted + in_transit audit trail) or reverting to
// earlier states after delivery is complete.
const DELIVERY_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(["accepted", "cancelled"]),
  accepted: new Set(["in_transit", "cancelled"]),
  in_transit: new Set(["delivered", "cancelled"]),
  delivered: new Set([]),
  cancelled: new Set([]),
};

router.put("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.select().from(deliveries).where(eq(deliveries.id, req.params.id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }

    const delivery = existing[0];
    const userId = req.user!.userId;
    const isSender = delivery.senderId === userId;
    const isAdmin = req.user!.role === "admin";
    // Before this fix, any authenticated user with role="driver" could
    // mutate any delivery regardless of assignment. A driver can only
    // act on a delivery they're actually assigned to — look it up on
    // the row, not the token.
    const isAssignedDriver =
      req.user!.role === "driver" && delivery.driverId === userId;

    if (!isSender && !isAdmin && !isAssignedDriver) {
      res.status(403).json({ error: "Not authorized to update this delivery" });
      return;
    }

    const { status } = req.body;
    if (!status || typeof status !== "string") {
      res.status(400).json({ error: "Status is required" });
      return;
    }

    const currentStatus = delivery.status || "pending";
    const allowedNext = DELIVERY_TRANSITIONS[currentStatus];
    if (!allowedNext) {
      // Defensive — shouldn't happen with a clean schema, but don't
      // let an unknown current state become a transition-check bypass.
      res.status(409).json({ error: "Delivery is in an unknown state" });
      return;
    }
    if (!allowedNext.has(status)) {
      res.status(409).json({
        error: `Cannot transition from ${currentStatus} to ${status}`,
      });
      return;
    }

    // Scope which party can drive which transition. Admins bypass this
    // (they're the override path for support tickets).
    if (!isAdmin) {
      if (status === "cancelled") {
        // Senders and the assigned driver may cancel at any pre-delivery stage.
        if (!isSender && !isAssignedDriver) {
          res.status(403).json({ error: "Not authorized to cancel this delivery" });
          return;
        }
      } else {
        // Forward transitions (accepted / in_transit / delivered) are
        // the assigned driver's job only — a sender cannot self-mark
        // their own package as delivered.
        if (!isAssignedDriver) {
          res.status(403).json({ error: "Only the assigned driver can advance this delivery" });
          return;
        }
      }
    }

    const updateData: any = { status };
    if (status === "accepted") updateData.acceptedAt = new Date();
    if (status === "delivered") updateData.deliveredAt = new Date();

    const [updated] = await db.update(deliveries)
      .set(updateData)
      .where(eq(deliveries.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error("Update delivery status error:", error);
    res.status(500).json({ error: "Failed to update delivery status" });
  }
});

// ============ PACKAGES ============

// POST /api/packages - Create a package
router.post("/packages", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      senderName, senderPhone, senderAddress,
      receiverName, receiverPhone, receiverAddress,
      contents, weight, dimensions, declaredValue,
      fare, pickupHubId, dropoffHubId,
    } = req.body;

    const trackingNumber = generateTrackingNumber();

    const [pkg] = await db.insert(packages).values({
      trackingNumber,
      senderName,
      senderPhone,
      senderAddress,
      receiverName,
      receiverPhone,
      receiverAddress,
      contents,
      weight: weight || null,
      dimensions: dimensions || null,
      declaredValue: declaredValue || null,
      fare: fare || 25,
      pickupHubId: pickupHubId || null,
      dropoffHubId: dropoffHubId || null,
      deviceId: req.user!.userId,
      status: "pending",
    }).returning();

    res.status(201).json({ ...pkg, trackingNumber });
  } catch (error: any) {
    console.error("Create package error:", error);
    res.status(500).json({ error: "Failed to create package" });
  }
});

// GET /api/packages/track/:trackingNumber - Track a package
router.get("/packages/track/:trackingNumber", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select().from(packages)
      .where(eq(packages.trackingNumber, req.params.trackingNumber))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "Package not found" });
      return;
    }

    const history = await db.select().from(packageStatusHistory)
      .where(eq(packageStatusHistory.packageId, result[0].id))
      .orderBy(desc(packageStatusHistory.createdAt));

    res.json({ ...result[0], statusHistory: history });
  } catch (error: any) {
    console.error("Track package error:", error);
    res.status(500).json({ error: "Failed to track package" });
  }
});

// GET /api/courier-hubs - List courier hubs (public — pre-login hub discovery)
router.get("/courier-hubs", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const hubs = await db.select().from(courierHubs).where(eq(courierHubs.isActive, true));
    res.json({ data: hubs });
  } catch (error: any) {
    console.error("Get courier hubs error:", error);
    res.status(500).json({ error: "Failed to fetch courier hubs" });
  }
});

export default router;
