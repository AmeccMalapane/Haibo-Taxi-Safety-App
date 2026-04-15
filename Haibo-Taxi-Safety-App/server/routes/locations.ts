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
// Allowlisted location types — kept in sync with the mobile HomeScreen
// category filter. Rejecting unknown values prevents an attacker from
// polluting the map with a "nuclear_bunker" type the render layer
// silently ignores, plus protects the admin filter chips.
const LOCATION_TYPES = new Set([
  "taxi_rank",
  "informal_stop",
  "interchange",
  "hub",
  "minor_stop",
]);

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

    // Length caps — every commuter's map pin tap loads these fields,
    // so unbounded name/address/description become a DoS vector across
    // every user on the platform, not just the one viewing the row.
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 200) {
      res.status(400).json({ error: "name must be a non-empty string ≤ 200 characters" });
      return;
    }
    if (address !== undefined && address !== null && (typeof address !== "string" || address.length > 300)) {
      res.status(400).json({ error: "address must be a string ≤ 300 characters" });
      return;
    }
    if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 1000)) {
      res.status(400).json({ error: "description must be a string ≤ 1000 characters" });
      return;
    }

    // Coordinate bounds — same validation the WS driver path uses.
    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      res.status(400).json({
        error: "Valid latitude (-90..90) and longitude (-180..180) are required",
      });
      return;
    }

    // Type allowlist — default to informal_stop when unset, reject
    // unknown strings otherwise.
    const locationType = type === undefined || type === null || type === ""
      ? "informal_stop"
      : type;
    if (!LOCATION_TYPES.has(locationType)) {
      res.status(400).json({ error: "Invalid location type" });
      return;
    }

    // Capacity sanity — a rank maxes out around a few hundred seats
    // across simultaneous departures; anything beyond 500 is pollution.
    if (
      capacity !== undefined && capacity !== null &&
      (!Number.isInteger(capacity) || capacity < 0 || capacity > 500)
    ) {
      res.status(400).json({ error: "capacity must be an integer between 0 and 500" });
      return;
    }

    const [location] = await db.insert(taxiLocations).values({
      name: name.trim(),
      type: locationType,
      latitude,
      longitude,
      address: address || null,
      description: description || null,
      capacity: capacity ?? null,
      opensAt: opensAt || null,
      closesAt: closesAt || null,
      operatingDays: operatingDays || null,
      addedBy: req.user!.userId,
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
const LOCATION_IMAGE_TYPES = new Set([
  "general",
  "entrance",
  "interior",
  "signage",
  "route_board",
]);

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
    // The bytes must already be uploaded via /api/uploads/image (which
    // returns either an https Azure Blob URL or a local /uploads/ path).
    // Reject anything else so a user can't inject a data: / javascript:
    // URI that then renders on the location detail hero.
    if (url.length > 500 || !(/^https:\/\//i.test(url) || url.startsWith("/uploads/"))) {
      res.status(400).json({
        error: "url must be an https:// URL or a Haibo upload path (≤ 500 chars)",
      });
      return;
    }
    if (caption !== undefined && caption !== null &&
        (typeof caption !== "string" || caption.length > 300)) {
      res.status(400).json({ error: "caption must be a string ≤ 300 characters" });
      return;
    }
    const resolvedImageType = imageType || "general";
    if (!LOCATION_IMAGE_TYPES.has(resolvedImageType)) {
      res.status(400).json({ error: "Invalid imageType" });
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
        imageType: resolvedImageType,
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
//
// Vote stuffing fix: locationVotes has no (locationId, userId) unique
// constraint, and the old handler blindly inserted + incremented the
// counter on every call. A single user could spam upvotes on their
// own location submission to game the verification queue.
//
// Now we look up the user's existing vote for this location inside a
// transaction. Four cases:
//   1. No prior vote → insert + increment the chosen side.
//   2. Prior vote same as new → no-op (already recorded, return 200).
//   3. Prior vote opposite → update the row + decrement old side +
//      increment new side (lets users change their mind).
//   4. Prior vote of an unknown type → replace with the new vote, only
//      increment the new side. Defensive path.
//
// Wrapped in db.transaction() so the counter updates can't diverge
// from the ballot row under concurrent calls.
router.post("/:id/vote", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { voteType } = req.body as { voteType?: string };
    const userId = req.user!.userId;
    const locationId = req.params.id;

    if (voteType !== "up" && voteType !== "down") {
      res.status(400).json({ error: "voteType must be 'up' or 'down'" });
      return;
    }

    const [location] = await db
      .select({ id: taxiLocations.id })
      .from(taxiLocations)
      .where(eq(taxiLocations.id, locationId))
      .limit(1);
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    let changed = false;
    await db.transaction(async (tx) => {
      const [prior] = await tx
        .select()
        .from(locationVotes)
        .where(
          and(eq(locationVotes.locationId, locationId), eq(locationVotes.userId, userId)),
        )
        .limit(1);

      if (!prior) {
        await tx.insert(locationVotes).values({ locationId, userId, voteType });
        await tx
          .update(taxiLocations)
          .set(
            voteType === "up"
              ? { upvotes: sql`${taxiLocations.upvotes} + 1` }
              : { downvotes: sql`${taxiLocations.downvotes} + 1` },
          )
          .where(eq(taxiLocations.id, locationId));
        changed = true;
        return;
      }

      if (prior.voteType === voteType) {
        // Idempotent repeat — nothing to do.
        return;
      }

      await tx
        .update(locationVotes)
        .set({ voteType })
        .where(eq(locationVotes.id, prior.id));

      if (prior.voteType === "up" && voteType === "down") {
        await tx
          .update(taxiLocations)
          .set({
            upvotes: sql`GREATEST(${taxiLocations.upvotes} - 1, 0)`,
            downvotes: sql`${taxiLocations.downvotes} + 1`,
          })
          .where(eq(taxiLocations.id, locationId));
      } else if (prior.voteType === "down" && voteType === "up") {
        await tx
          .update(taxiLocations)
          .set({
            upvotes: sql`${taxiLocations.upvotes} + 1`,
            downvotes: sql`GREATEST(${taxiLocations.downvotes} - 1, 0)`,
          })
          .where(eq(taxiLocations.id, locationId));
      } else {
        // Defensive: prior vote was some unknown string — just bump
        // the new side without touching the stale counter.
        await tx
          .update(taxiLocations)
          .set(
            voteType === "up"
              ? { upvotes: sql`${taxiLocations.upvotes} + 1` }
              : { downvotes: sql`${taxiLocations.downvotes} + 1` },
          )
          .where(eq(taxiLocations.id, locationId));
      }
      changed = true;
    });

    res.json({ message: changed ? "Vote recorded" : "Vote unchanged" });
  } catch (error: any) {
    console.error("Vote error:", error);
    res.status(500).json({ error: "Failed to record vote" });
  }
});

// POST /api/locations/:id/review - Add a review
router.post("/:id/review", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId, userName, rating, comment } = req.body;

    if (!deviceId || !userName || rating === undefined || rating === null) {
      res.status(400).json({ error: "Device ID, user name, and rating are required" });
      return;
    }

    if (typeof deviceId !== "string" || deviceId.length > 100) {
      res.status(400).json({ error: "deviceId must be a string ≤ 100 characters" });
      return;
    }
    if (typeof userName !== "string" || userName.length === 0 || userName.length > 80) {
      res.status(400).json({ error: "userName must be a non-empty string ≤ 80 characters" });
      return;
    }
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be an integer between 1 and 5" });
      return;
    }
    if (comment !== undefined && comment !== null &&
        (typeof comment !== "string" || comment.length > 1000)) {
      res.status(400).json({ error: "comment must be a string ≤ 1000 characters" });
      return;
    }

    // Verify the location exists before accepting a review — otherwise
    // we end up with orphaned review rows for invalid location ids.
    const [location] = await db
      .select({ id: taxiLocations.id })
      .from(taxiLocations)
      .where(eq(taxiLocations.id, req.params.id))
      .limit(1);
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const [review] = await db.insert(locationReviews).values({
      locationId: req.params.id,
      deviceId,
      userName: userName.trim(),
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
