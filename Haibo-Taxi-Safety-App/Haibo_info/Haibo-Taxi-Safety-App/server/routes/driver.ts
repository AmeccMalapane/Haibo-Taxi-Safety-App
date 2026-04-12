import { Router } from "express";
import { eq, and, sql, gte } from "drizzle-orm";
import * as schema from "../../shared/schema";

export function driverRoutes(db: any) {
  const router = Router();

  // Register driver profile
  router.post("/register", async (req, res) => {
    try {
      const { userId, name, taxiPlateNumber, licenseNumber, vehicleColor, vehicleModel, vehicleYear } = req.body;

      if (!userId || !taxiPlateNumber) {
        return res.status(400).json({ error: "userId and taxiPlateNumber are required" });
      }

      // Generate Haibo Pay reference code: HB-[PLATE]
      const payReferenceCode = `HB-${taxiPlateNumber.replace(/\s/g, "").toUpperCase()}`;

      // Create driver profile
      const [driverProfile] = await db.insert(schema.driverProfiles).values({
        userId,
        taxiPlateNumber: taxiPlateNumber.toUpperCase(),
        licenseNumber: licenseNumber || null,
        vehicleColor: vehicleColor || null,
        vehicleModel: vehicleModel || null,
        vehicleYear: vehicleYear || null,
      }).returning();

      // Update user role to driver
      await db.update(schema.users).set({
        role: "driver",
        displayName: name || undefined,
      }).where(eq(schema.users.id, userId));

      // Create user profile with pay reference
      await db.insert(schema.userProfiles).values({
        userId,
        username: name,
        taxiPlateNumber: taxiPlateNumber.toUpperCase(),
        isDriver: true,
      }).onConflictDoUpdate({
        target: schema.userProfiles.userId,
        set: {
          taxiPlateNumber: taxiPlateNumber.toUpperCase(),
          isDriver: true,
        },
      });

      res.status(201).json({
        driverProfile,
        payReferenceCode,
        message: `Driver registered. Haibo Pay Reference: ${payReferenceCode}`,
      });
    } catch (error: any) {
      console.error("Driver registration error:", error);
      res.status(500).json({ error: "Failed to register driver", message: error.message });
    }
  });

  // Update driver location (GPS tracking - every 60 seconds)
  router.post("/location-update", async (req, res) => {
    try {
      const { userId, latitude, longitude, accuracy, speed, heading } = req.body;

      if (!userId || latitude == null || longitude == null) {
        return res.status(400).json({ error: "userId, latitude, and longitude are required" });
      }

      // Insert location update record
      await db.insert(schema.locationUpdates).values({
        userId,
        latitude,
        longitude,
        accuracy: accuracy || null,
        speed: speed || null,
        heading: heading || null,
      });

      res.json({ message: "Location updated", timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error("Location update error:", error);
      res.status(500).json({ error: "Failed to update location", message: error.message });
    }
  });

  // Get driver profile
  router.get("/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const [profile] = await db.select().from(schema.driverProfiles)
        .where(eq(schema.driverProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      // Get pay reference code
      const payReferenceCode = `HB-${profile.taxiPlateNumber.replace(/\s/g, "").toUpperCase()}`;

      // Get earnings
      const earnings = await db.select({
        total: sql`COALESCE(SUM(amount), 0)`,
      }).from(schema.walletTransactions)
        .where(and(
          eq(schema.walletTransactions.userId, userId),
          eq(schema.walletTransactions.type, "payment"),
        ));

      res.json({
        ...profile,
        payReferenceCode,
        totalEarnings: earnings[0]?.total || 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get driver profile", message: error.message });
    }
  });

  // Get driver dashboard data
  router.get("/dashboard/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const [profile] = await db.select().from(schema.driverProfiles)
        .where(eq(schema.driverProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ error: "Driver not found" });
      }

      const payReferenceCode = `HB-${profile.taxiPlateNumber.replace(/\s/g, "").toUpperCase()}`;

      // Get wallet balance
      const [user] = await db.select().from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      // Get recent transactions
      const recentTransactions = await db.select().from(schema.walletTransactions)
        .where(eq(schema.walletTransactions.userId, userId))
        .orderBy(sql`created_at DESC`)
        .limit(10);

      // Get ratings
      const ratings = await db.select().from(schema.driverRatings)
        .where(eq(schema.driverRatings.driverId, userId))
        .orderBy(sql`created_at DESC`)
        .limit(5);

      // Get latest location
      const [latestLocation] = await db.select().from(schema.locationUpdates)
        .where(eq(schema.locationUpdates.userId, userId))
        .orderBy(sql`timestamp DESC`)
        .limit(1);

      res.json({
        profile: { ...profile, payReferenceCode },
        balance: user?.walletBalance || 0,
        recentTransactions,
        ratings,
        latestLocation,
        currency: "R",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load dashboard", message: error.message });
    }
  });

  // Get active drivers near a rank (within 500m)
  router.get("/active-near/:latitude/:longitude", async (req, res) => {
    try {
      const { latitude, longitude } = req.params;
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusKm = 0.5; // 500m

      // Get location updates from last 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const activeDrivers = await db.select().from(schema.locationUpdates)
        .where(gte(schema.locationUpdates.timestamp, tenMinutesAgo));

      // Filter by distance using Haversine
      const nearbyDrivers = activeDrivers.filter((loc: any) => {
        const R = 6371;
        const dLat = (loc.latitude - lat) * Math.PI / 180;
        const dLon = (loc.longitude - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat * Math.PI / 180) * Math.cos(loc.latitude * Math.PI / 180) *
          Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c <= radiusKm;
      });

      // Deduplicate by userId (latest only)
      const uniqueDrivers = new Map();
      nearbyDrivers.forEach((d: any) => {
        if (!uniqueDrivers.has(d.userId) || new Date(d.timestamp) > new Date(uniqueDrivers.get(d.userId).timestamp)) {
          uniqueDrivers.set(d.userId, d);
        }
      });

      res.json({
        count: uniqueDrivers.size,
        drivers: Array.from(uniqueDrivers.values()),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to find active drivers", message: error.message });
    }
  });

  // Rate a driver
  router.post("/rate", async (req, res) => {
    try {
      const { driverId, userId, rideId, rating, review } = req.body;

      if (!driverId || !userId || !rating) {
        return res.status(400).json({ error: "driverId, userId, and rating are required" });
      }

      await db.insert(schema.driverRatings).values({
        driverId,
        userId,
        rideId: rideId || null,
        rating: Math.min(5, Math.max(1, rating)),
        review: review || null,
      });

      // Update driver's average rating
      const allRatings = await db.select({
        avg: sql`AVG(rating)`,
        count: sql`COUNT(*)`,
      }).from(schema.driverRatings)
        .where(eq(schema.driverRatings.driverId, driverId));

      await db.update(schema.driverProfiles).set({
        safetyRating: allRatings[0]?.avg || 5,
        totalRatings: allRatings[0]?.count || 0,
      }).where(eq(schema.driverProfiles.userId, driverId));

      res.json({ message: "Rating submitted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to submit rating", message: error.message });
    }
  });

  return router;
}
