import { Router, Response } from "express";
import { db } from "../db";
import { driverProfiles, driverRatings, users, locationUpdates } from "../../shared/schema";
import { eq, desc, count, avg, sql } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { generatePayReferenceCode, parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// POST /api/drivers/register - Register as a driver
router.post("/register", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      taxiPlateNumber, licenseNumber, licenseExpiry,
      insuranceNumber, insuranceExpiry, vehicleColor,
      vehicleModel, vehicleYear,
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
      payReferenceCode,
    }).returning();

    // Update user role to driver
    await db.update(users).set({ role: "driver" }).where(eq(users.id, req.user!.userId));

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
