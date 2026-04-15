import { Router, Response } from "express";
import { db } from "../db";
import {
  taxiLocations, locationImages, handSignals, locationVotes,
  locationReviews, routeContributions, routeContributionVotes,
} from "../../shared/schema";
import { eq, and, sql, desc, asc, count } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// GET /api/locations - List all taxi locations/ranks (public — pre-login browsing)
router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { type, search } = req.query as any;

    let results;
    if (type) {
      results = await db.select().from(taxiLocations)
        .where(eq(taxiLocations.type, type))
        .limit(limit).offset(offset)
        .orderBy(desc(taxiLocations.upvotes));
    } else {
      results = await db.select().from(taxiLocations)
        .limit(limit).offset(offset)
        .orderBy(desc(taxiLocations.upvotes));
    }

    const [totalResult] = await db.select({ count: count() }).from(taxiLocations);

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get locations error:", error);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// GET /api/locations/nearby - Find nearby taxi ranks (public — pre-login browsing)
router.get("/nearby", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, radius } = req.query as any;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseFloat(radius) || 5; // Default 5km

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: "Valid latitude and longitude are required" });
      return;
    }

    // Haversine formula in SQL for distance calculation
    const results = await db.execute(sql`
      SELECT *, 
        (6371 * acos(cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude)))) AS distance
      FROM taxi_locations
      WHERE is_active = true
      HAVING distance <= ${rad}
      ORDER BY distance
      LIMIT 50
    `);

    res.json({ data: results.rows || results });
  } catch (error: any) {
    console.error("Nearby locations error:", error);
    res.status(500).json({ error: "Failed to fetch nearby locations" });
  }
});

// POST /api/locations - Add a new taxi location
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, type, latitude, longitude, address, description,
      capacity, opensAt, closesAt, operatingDays, routes,
    } = req.body;

    if (!name || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "Name, latitude, and longitude are required" });
      return;
    }

    const [location] = await db.insert(taxiLocations).values({
      name,
      type: type || "informal_stop",
      latitude,
      longitude,
      address: address || null,
      description: description || null,
      capacity: capacity || null,
      opensAt: opensAt || null,
      closesAt: closesAt || null,
      operatingDays: operatingDays || null,
      addedBy: req.user?.userId || null,
      routes: routes || null,
      verificationStatus: "pending",
    }).returning();

    res.status(201).json(location);
  } catch (error: any) {
    console.error("Add location error:", error);
    res.status(500).json({ error: "Failed to add location" });
  }
});

// GET /api/locations/:id - Get location details with images and signals
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const location = await db.select().from(taxiLocations).where(eq(taxiLocations.id, req.params.id)).limit(1);
    if (location.length === 0) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const images = await db.select().from(locationImages).where(eq(locationImages.locationId, req.params.id));
    const signals = await db.select().from(handSignals).where(eq(handSignals.locationId, req.params.id));
    const reviews = await db.select().from(locationReviews)
      .where(eq(locationReviews.locationId, req.params.id))
      .orderBy(desc(locationReviews.createdAt))
      .limit(20);

    res.json({
      ...location[0],
      images,
      handSignals: signals,
      reviews,
    });
  } catch (error: any) {
    console.error("Get location error:", error);
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

// POST /api/locations/:id/images — attach a user-contributed photo to a
// location. The actual bytes are already uploaded via /api/uploads/image
// (folder "lost-found" or "events" pattern); here we only persist the
// returned URL and optional caption. New contributions default to
// verified=false so moderators can sweep them from the command center
// before they show up on the location detail hero.
router.post("/:id/images", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { url, caption, imageType } = req.body as {
      url?: string;
      caption?: string;
      imageType?: string;
    };

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const [location] = await db
      .select({ id: taxiLocations.id })
      .from(taxiLocations)
      .where(eq(taxiLocations.id, req.params.id))
      .limit(1);
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const [image] = await db
      .insert(locationImages)
      .values({
        locationId: req.params.id,
        url,
        caption: caption || null,
        imageType: imageType || "general",
        uploadedBy: req.user!.userId,
        verified: false,
      })
      .returning();

    res.status(201).json({ data: image });
  } catch (error: any) {
    console.error("Add location image error:", error);
    res.status(500).json({ error: "Failed to add location image" });
  }
});

// POST /api/locations/:id/vote - Vote on a location
router.post("/:id/vote", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { voteType } = req.body;
    const userId = req.user!.userId;

    if (!userId || !voteType) {
      res.status(400).json({ error: "Vote type and user identification required" });
      return;
    }

    await db.insert(locationVotes).values({
      locationId: req.params.id,
      userId,
      voteType,
    });

    // Update vote counts
    if (voteType === "up") {
      await db.update(taxiLocations)
        .set({ upvotes: sql`${taxiLocations.upvotes} + 1` })
        .where(eq(taxiLocations.id, req.params.id));
    } else {
      await db.update(taxiLocations)
        .set({ downvotes: sql`${taxiLocations.downvotes} + 1` })
        .where(eq(taxiLocations.id, req.params.id));
    }

    res.json({ message: "Vote recorded" });
  } catch (error: any) {
    console.error("Vote error:", error);
    res.status(500).json({ error: "Failed to record vote" });
  }
});

// POST /api/locations/:id/review - Add a review
router.post("/:id/review", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId, userName, rating, comment } = req.body;

    if (!deviceId || !userName || !rating) {
      res.status(400).json({ error: "Device ID, user name, and rating are required" });
      return;
    }

    const [review] = await db.insert(locationReviews).values({
      locationId: req.params.id,
      deviceId,
      userName,
      rating,
      comment: comment || null,
    }).returning();

    res.status(201).json(review);
  } catch (error: any) {
    console.error("Add review error:", error);
    res.status(500).json({ error: "Failed to add review" });
  }
});

// POST /api/routes/contribute - Contribute a route
router.post("/routes/contribute", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      origin, originLatitude, originLongitude,
      destination, destinationLatitude, destinationLongitude,
      taxiRankName, fare, estimatedTime, distance,
      province, routeType, handSignal, handSignalDescription,
      additionalNotes, contributorName, deviceId,
    } = req.body;

    if (!origin || !destination || fare === undefined) {
      res.status(400).json({ error: "Origin, destination, and fare are required" });
      return;
    }

    const [contribution] = await db.insert(routeContributions).values({
      origin,
      originLatitude: originLatitude || null,
      originLongitude: originLongitude || null,
      destination,
      destinationLatitude: destinationLatitude || null,
      destinationLongitude: destinationLongitude || null,
      taxiRankName: taxiRankName || null,
      fare,
      currency: "ZAR",
      estimatedTime: estimatedTime || null,
      distance: distance || null,
      province: province || null,
      routeType: routeType || "local",
      handSignal: handSignal || null,
      handSignalDescription: handSignalDescription || null,
      additionalNotes: additionalNotes || null,
      contributorName: contributorName || null,
      deviceId: deviceId || null,
      status: "pending",
    }).returning();

    res.status(201).json(contribution);
  } catch (error: any) {
    console.error("Route contribution error:", error);
    res.status(500).json({ error: "Failed to submit route contribution" });
  }
});

export default router;
