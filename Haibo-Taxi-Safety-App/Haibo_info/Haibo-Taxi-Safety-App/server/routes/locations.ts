import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import * as schema from "../../shared/schema";

export function locationRoutes(db: any) {
  const router = Router();

  // Get all taxi locations
  router.get("/", async (req, res) => {
    try {
      const { type, active } = req.query;

      let locations = await db.select().from(schema.taxiLocations)
        .where(eq(schema.taxiLocations.isActive, true))
        .orderBy(desc(schema.taxiLocations.lastUpdated));

      if (type) {
        locations = locations.filter((l: any) => l.type === type);
      }

      res.json(locations);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch locations", message: error.message });
    }
  });

  // Get location by ID with details
  router.get("/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const [location] = await db.select().from(schema.taxiLocations)
        .where(eq(schema.taxiLocations.id, id))
        .limit(1);

      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }

      // Get images
      const images = await db.select().from(schema.locationImages)
        .where(eq(schema.locationImages.locationId, id));

      // Get hand signals
      const handSignals = await db.select().from(schema.handSignals)
        .where(eq(schema.handSignals.locationId, id));

      // Get reviews
      const reviews = await db.select().from(schema.locationReviews)
        .where(eq(schema.locationReviews.locationId, id))
        .orderBy(desc(schema.locationReviews.createdAt));

      // Get connected routes
      const routes = await db.select().from(schema.routeContributions)
        .where(eq(schema.routeContributions.status, "approved"));

      const connectedRoutes = routes.filter((r: any) =>
        r.taxiRankName?.toLowerCase().includes(location.name.toLowerCase()) ||
        r.origin?.toLowerCase().includes(location.name.toLowerCase()) ||
        r.destination?.toLowerCase().includes(location.name.toLowerCase())
      );

      // Get active drivers nearby (within 500m)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentUpdates = await db.select().from(schema.locationUpdates)
        .where(sql`timestamp >= ${tenMinutesAgo}`);

      const nearbyCount = recentUpdates.filter((loc: any) => {
        const R = 6371;
        const dLat = (loc.latitude - location.latitude) * Math.PI / 180;
        const dLon = (loc.longitude - location.longitude) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(location.latitude * Math.PI / 180) * Math.cos(loc.latitude * Math.PI / 180) *
          Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c <= 0.5;
      }).length;

      res.json({
        ...location,
        images,
        handSignals,
        reviews,
        connectedRoutes,
        liveAvailability: nearbyCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch location details", message: error.message });
    }
  });

  // Add new location
  router.post("/", async (req, res) => {
    try {
      const [location] = await db.insert(schema.taxiLocations).values({
        ...req.body,
        verificationStatus: "pending",
      }).returning();

      res.status(201).json(location);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add location", message: error.message });
    }
  });

  // Vote on location
  router.post("/:id/vote", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, voteType } = req.body;

      await db.insert(schema.locationVotes).values({
        locationId: id,
        userId,
        voteType,
      });

      if (voteType === "up") {
        await db.update(schema.taxiLocations).set({
          upvotes: sql`upvotes + 1`,
        }).where(eq(schema.taxiLocations.id, id));
      } else {
        await db.update(schema.taxiLocations).set({
          downvotes: sql`downvotes + 1`,
        }).where(eq(schema.taxiLocations.id, id));
      }

      res.json({ message: "Vote recorded" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to vote", message: error.message });
    }
  });

  // Add review
  router.post("/:id/review", async (req, res) => {
    try {
      const { id } = req.params;
      const [review] = await db.insert(schema.locationReviews).values({
        locationId: id,
        ...req.body,
      }).returning();

      res.status(201).json(review);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add review", message: error.message });
    }
  });

  return router;
}
