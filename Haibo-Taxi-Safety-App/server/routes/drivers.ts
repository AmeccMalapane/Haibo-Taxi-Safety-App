import { Router, Response } from "express";
import { db } from "../db";
import {
  driverProfiles,
  driverRatings,
  users,
  locationUpdates,
  p2pTransfers,
} from "../../shared/schema";
import { eq, desc, count, avg, sql, and, gte, isNull } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { notifyUser } from "../services/notifications";
import { generatePayReferenceCode, parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// GET /api/drivers/me - Read the current user's driver profile (or null)
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, req.user!.userId))
      .limit(1);
    res.json({ data: row || null });
  } catch (error: any) {
    console.error("Get own driver profile error:", error);
    res.status(500).json({ error: "Failed to fetch driver profile" });
  }
});

// GET /api/drivers/me/earnings — today / week / month totals plus a
// short recent-fares feed for the driver dashboard. Driver earnings on
// Haibo come through the p2pTransfers rail: every commuter tap-to-pay
// lands here as a completed row where recipientId = driverUserId. We
// deliberately exclude rows with a vendorRef tag so vendor sales don't
// get double-counted as ride fares (same user might run a taxi AND a
// rank stall with one wallet).
router.get(
  "/me/earnings",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      // Time boundaries — use UTC midnight + ISO week so "today" rolls
      // over at midnight local for the overwhelming majority of
      // our users (Southern African UTC+2, so UTC midnight ≈ 02:00 SAST,
      // close enough for a dashboard summary).
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setUTCHours(0, 0, 0, 0);
      const weekStart = new Date(dayStart);
      weekStart.setUTCDate(weekStart.getUTCDate() - 7);
      const monthStart = new Date(dayStart);
      monthStart.setUTCDate(monthStart.getUTCDate() - 30);

      // Base predicate: completed ride fares paid TO this driver.
      // isNull(vendorRef) strips out any vendor sales so the totals
      // only reflect transport income.
      const rideFaresBase = and(
        eq(p2pTransfers.recipientId, userId),
        eq(p2pTransfers.status, "completed"),
        isNull(p2pTransfers.vendorRef),
      );

      const [todayTotals] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${p2pTransfers.amount}), 0)::float`,
          txns: sql<number>`COUNT(*)::int`,
        })
        .from(p2pTransfers)
        .where(and(rideFaresBase, gte(p2pTransfers.createdAt, dayStart)));

      const [weekTotals] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${p2pTransfers.amount}), 0)::float`,
          txns: sql<number>`COUNT(*)::int`,
        })
        .from(p2pTransfers)
        .where(and(rideFaresBase, gte(p2pTransfers.createdAt, weekStart)));

      const [monthTotals] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${p2pTransfers.amount}), 0)::float`,
          txns: sql<number>`COUNT(*)::int`,
        })
        .from(p2pTransfers)
        .where(and(rideFaresBase, gte(p2pTransfers.createdAt, monthStart)));

      const recent = await db
        .select({
          id: p2pTransfers.id,
          amount: p2pTransfers.amount,
          message: p2pTransfers.message,
          createdAt: p2pTransfers.createdAt,
          payerName: users.displayName,
          payerPhone: users.phone,
        })
        .from(p2pTransfers)
        .leftJoin(users, eq(p2pTransfers.senderId, users.id))
        .where(rideFaresBase)
        .orderBy(desc(p2pTransfers.createdAt))
        .limit(15);

      res.json({
        today: {
          total: Number(todayTotals?.total) || 0,
          txns: Number(todayTotals?.txns) || 0,
        },
        week: {
          total: Number(weekTotals?.total) || 0,
          txns: Number(weekTotals?.txns) || 0,
        },
        month: {
          total: Number(monthTotals?.total) || 0,
          txns: Number(monthTotals?.txns) || 0,
        },
        recent,
      });
    } catch (error: any) {
      console.error("Driver earnings error:", error);
      res.status(500).json({ error: "Failed to fetch driver earnings" });
    }
  }
);

// POST /api/drivers/register - Register as a driver
router.post("/register", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      taxiPlateNumber, licenseNumber, licenseExpiry,
      insuranceNumber, insuranceExpiry, vehicleColor,
      vehicleModel, vehicleYear, licenseImageUrl, vehicleImageUrl,
    } = req.body;

    if (!taxiPlateNumber) {
      res.status(400).json({ error: "Taxi plate number is required" });
      return;
    }

    // Check if already registered
    const existing = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, req.user!.userId)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Driver profile already exists" });
      return;
    }

    const payReferenceCode = generatePayReferenceCode(taxiPlateNumber);

    const [profile] = await db.insert(driverProfiles).values({
      userId: req.user!.userId,
      taxiPlateNumber,
      licenseNumber: licenseNumber || null,
      licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
      insuranceNumber: insuranceNumber || null,
      insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
      vehicleColor: vehicleColor || null,
      vehicleModel: vehicleModel || null,
      vehicleYear: vehicleYear || null,
      licenseImageUrl: licenseImageUrl || null,
      vehicleImageUrl: vehicleImageUrl || null,
      payReferenceCode,
    }).returning();

    // Update user role to driver
    await db.update(users).set({ role: "driver" }).where(eq(users.id, req.user!.userId));

    // Onboarding confirmation. KYC is still pending at this point but
    // the driver can already accept Haibo Pay payments, so the copy
    // leans on that rather than the verification state.
    try {
      await notifyUser({
        userId: req.user!.userId,
        type: "system",
        title: "You're registered as a Haibo driver",
        body: `Plate ${profile.taxiPlateNumber} is linked to your wallet. Share your Haibo Pay QR to start receiving fares — KYC review runs in parallel.`,
        data: { kind: "welcome_driver", plate: profile.taxiPlateNumber },
      });
    } catch (notifyErr) {
      console.log("[Drivers] welcome notify failed:", notifyErr);
    }

    res.status(201).json({
      id: profile.id,
      taxiPlateNumber: profile.taxiPlateNumber,
      payReferenceCode: profile.payReferenceCode,
      status: "active",
    });
  } catch (error: any) {
    console.error("Register driver error:", error);
    res.status(500).json({ error: "Failed to register driver" });
  }
});

// POST /api/drivers/location-update - Update driver GPS location
router.post("/location-update", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, accuracy, speed, heading } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "Latitude and longitude are required" });
      return;
    }

    // Update driver profile with current location
    await db.update(driverProfiles)
      .set({
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdate: new Date(),
      })
      .where(eq(driverProfiles.userId, req.user!.userId));

    // Insert location history
    await db.insert(locationUpdates).values({
      userId: req.user!.userId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      speed: speed || null,
      heading: heading || null,
    });

    res.json({ message: "Location updated" });
  } catch (error: any) {
    console.error("Location update error:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// GET /api/drivers/:id - Get driver profile
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select().from(driverProfiles).where(eq(driverProfiles.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    res.json(result[0]);
  } catch (error: any) {
    console.error("Get driver error:", error);
    res.status(500).json({ error: "Failed to fetch driver" });
  }
});

// GET /api/drivers/:id/performance - Get driver performance metrics
router.get("/:id/performance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await db.select().from(driverProfiles).where(eq(driverProfiles.id, req.params.id)).limit(1);
    if (profile.length === 0) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const driver = profile[0];

    // Get rating stats
    const [ratingStats] = await db
      .select({
        avgRating: avg(driverRatings.rating),
        totalRatings: count(),
      })
      .from(driverRatings)
      .where(eq(driverRatings.driverId, driver.userId));

    res.json({
      id: driver.id,
      userId: driver.userId,
      taxiPlateNumber: driver.taxiPlateNumber,
      rating: Number(ratingStats.avgRating) || driver.safetyRating,
      totalRatings: ratingStats.totalRatings || driver.totalRatings,
      totalRides: driver.totalRides,
      acceptanceRate: driver.acceptanceRate,
      safetyRating: driver.safetyRating,
      isVerified: driver.isVerified,
    });
  } catch (error: any) {
    console.error("Get driver performance error:", error);
    res.status(500).json({ error: "Failed to fetch driver performance" });
  }
});

// POST /api/drivers/rate - Rate a driver
router.post("/rate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId, rating, review, rideId } = req.body;

    if (!driverId || !rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Driver ID and rating (1-5) are required" });
      return;
    }

    await db.insert(driverRatings).values({
      driverId,
      userId: req.user!.userId,
      rating,
      review: review || null,
      rideId: rideId || null,
    });

    // Update driver's average rating
    const [stats] = await db
      .select({ avgRating: avg(driverRatings.rating), total: count() })
      .from(driverRatings)
      .where(eq(driverRatings.driverId, driverId));

    await db.update(driverProfiles)
      .set({
        safetyRating: Number(stats.avgRating) || 5,
        totalRatings: stats.total,
      })
      .where(eq(driverProfiles.userId, driverId));

    res.json({ message: "Rating submitted" });
  } catch (error: any) {
    console.error("Rate driver error:", error);
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

export default router;
