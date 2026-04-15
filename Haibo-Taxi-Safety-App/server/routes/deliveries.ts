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

    // Length caps on all text fields — these render in driver/admin
    // dashboards and on receipts, so unbounded values become DoS
    // vectors on every feed read.
    if (typeof description !== "string" || description.length > 1000) {
      res.status(400).json({ error: "description must be ≤ 1000 characters" });
      return;
    }
    if (typeof pickupRank !== "string" || pickupRank.length > 200 ||
        typeof dropoffRank !== "string" || dropoffRank.length > 200) {
      res.status(400).json({ error: "pickupRank and dropoffRank must be ≤ 200 characters" });
      return;
    }
    if (typeof taxiPlateNumber !== "string" || taxiPlateNumber.length > 20) {
      res.status(400).json({ error: "taxiPlateNumber must be ≤ 20 characters" });
      return;
    }

    // Amount validation — finite, positive, bounded. Mirrors the wallet
    // MAX_TRANSACTION_AMOUNT (R100k) since deliveries settle against
    // the same money rails downstream.
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
      res.status(400).json({ error: "amount must be between 0 and 100000" });
      return;
    }
    if (
      insuranceAmount !== undefined && insuranceAmount !== null &&
      (typeof insuranceAmount !== "number" || !Number.isFinite(insuranceAmount) || insuranceAmount < 0 || insuranceAmount > 100_000)
    ) {
      res.status(400).json({ error: "insuranceAmount must be between 0 and 100000" });
      return;
    }

    const confirmationCode = generateConfirmationCode();

    const [delivery] = await db.insert(deliveries).values({
      senderId: req.user!.userId,
      taxiPlateNumber: taxiPlateNumber.trim(),
      description: description.trim(),
      pickupRank: pickupRank.trim(),
      dropoffRank: dropoffRank.trim(),
      amount,
      driverPhone: driverPhone || null,
      confirmationCode,
      insuranceIncluded: insuranceIncluded || false,
      insuranceAmount: insuranceAmount ?? 0,
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
    const userId = req.user!.userId;
    const isSender = delivery.senderId === userId;
    const isAdmin = req.user!.role === "admin";
    // Mirror the /status fix — only the assigned driver, not every
    // driver in the system, can read a delivery by id. A delivery with
    // no driverId (still pending) is readable by sender + admins only.
    const isAssignedDriver =
      req.user!.role === "driver" && delivery.driverId === userId;
    if (!isSender && !isAdmin && !isAssignedDriver) {
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

    // Required-field presence + length caps. Previously the endpoint
    // accepted completely empty bodies and trusted the DB's NOT NULL
    // constraints to surface errors via a generic 500.
    const requiredStrings: Array<[unknown, string, number]> = [
      [senderName, "senderName", 150],
      [senderPhone, "senderPhone", 20],
      [senderAddress, "senderAddress", 300],
      [receiverName, "receiverName", 150],
      [receiverPhone, "receiverPhone", 20],
      [receiverAddress, "receiverAddress", 300],
      [contents, "contents", 500],
    ];
    for (const [v, label, max] of requiredStrings) {
      if (typeof v !== "string" || v.trim().length === 0) {
        res.status(400).json({ error: `${label} is required` });
        return;
      }
      if (v.length > max) {
        res.status(400).json({ error: `${label} must be ≤ ${max} characters` });
        return;
      }
    }

    // Numeric bounds — fare and declaredValue are money-adjacent so
    // reject negative / non-finite / absurd values.
    if (
      fare !== undefined && fare !== null &&
      (typeof fare !== "number" || !Number.isFinite(fare) || fare < 0 || fare > 100_000)
    ) {
      res.status(400).json({ error: "fare must be between 0 and 100000" });
      return;
    }
    if (
      declaredValue !== undefined && declaredValue !== null &&
      (typeof declaredValue !== "number" || !Number.isFinite(declaredValue) || declaredValue < 0 || declaredValue > 1_000_000)
    ) {
      res.status(400).json({ error: "declaredValue must be between 0 and 1000000" });
      return;
    }

    const trackingNumber = generateTrackingNumber();

    const [pkg] = await db.insert(packages).values({
      trackingNumber,
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      senderAddress: senderAddress.trim(),
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      receiverAddress: receiverAddress.trim(),
      contents: contents.trim(),
      weight: weight || null,
      dimensions: dimensions || null,
      declaredValue: declaredValue ?? null,
      fare: fare ?? 25,
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
//
// SECURITY: tracking numbers are deliberately share-safe — the entire
// point is that anyone the sender shares the number with (via SMS or
// WhatsApp) can see delivery status without needing a Haibo account.
// But the underlying row has sender + receiver PII (name / phone /
// address) which previously shipped in the response, so any
// authenticated user who could guess a tracking number (~24 bits of
// entropy in the current generator) could extract that PII.
//
// Now we redact. The sender (who created the row) gets the full
// record, and admins get it for support flows. Everyone else — the
// recipient, a curious tracking-number-sharer, or an attacker — gets
// only fields that are already on the physical parcel label: status,
// hub references, tracking number, timestamps.
router.get("/packages/track/:trackingNumber", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select().from(packages)
      .where(eq(packages.trackingNumber, req.params.trackingNumber))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "Package not found" });
      return;
    }

    const pkg = result[0];
    const history = await db.select().from(packageStatusHistory)
      .where(eq(packageStatusHistory.packageId, pkg.id))
      .orderBy(desc(packageStatusHistory.createdAt));

    const isSender = pkg.deviceId === req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    if (isSender || isAdmin) {
      res.json({ ...pkg, statusHistory: history });
      return;
    }

    // Redacted view — no PII, no address info.
    res.json({
      id: pkg.id,
      trackingNumber: pkg.trackingNumber,
      status: pkg.status,
      contents: pkg.contents,
      weight: pkg.weight,
      dimensions: pkg.dimensions,
      pickupHubId: pkg.pickupHubId,
      dropoffHubId: pkg.dropoffHubId,
      createdAt: pkg.createdAt,
      statusHistory: history,
    });
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
