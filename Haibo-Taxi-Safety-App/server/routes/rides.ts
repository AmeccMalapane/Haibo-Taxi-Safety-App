import { Router, Response } from "express";
import { db } from "../db";
import { groupRides } from "../../shared/schema";
import { eq, desc, count } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// GET /api/rides - List group rides
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { rideType } = req.query as { rideType?: string };

    // Share the same filter between the data query and the count query
    // so the pagination total actually reflects the filtered set.
    // Previously the count always hit the unfiltered table, so the
    // mobile app would show `15 results` above a 3-item list when a
    // rideType filter was active.
    const filter = rideType ? eq(groupRides.rideType, rideType) : undefined;

    const rowsQuery = db
      .select()
      .from(groupRides)
      .orderBy(desc(groupRides.scheduledDate))
      .limit(limit)
      .offset(offset);
    const results = filter ? await rowsQuery.where(filter) : await rowsQuery;

    const countQuery = db.select({ count: count() }).from(groupRides);
    const [totalResult] = filter ? await countQuery.where(filter) : await countQuery;

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get rides error:", error);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// Allowlists mirror the schema comments on groupRides.rideType and
// groupRides.paymentMethod. Keeping them explicit here stops a junk
// value from breaking the admin filters or the mobile chip UI.
const RIDE_TYPES = new Set([
  "scheduled",
  "odd_hours",
  "school_transport",
  "staff_transport",
]);
const RIDE_PAYMENT_METHODS = new Set(["split", "sponsor", "individual"]);

// POST /api/rides/create - Create a group ride
router.post("/create", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, description, pickupLocation, dropoffLocation,
      scheduledDate, maxPassengers, costPerPerson, rideType,
      driverPlateNumber, paymentMethod,
    } = req.body;

    if (!title || !pickupLocation || !dropoffLocation || !scheduledDate || !maxPassengers || !rideType) {
      res.status(400).json({ error: "Title, pickup/dropoff locations, date, max passengers, and ride type are required" });
      return;
    }

    // String length caps — group rides list is public within the app so
    // unbounded titles/descriptions become DoS vectors on every feed read.
    if (typeof title !== "string" || title.length > 200) {
      res.status(400).json({ error: "title must be ≤ 200 characters" });
      return;
    }
    if (
      description !== undefined && description !== null &&
      (typeof description !== "string" || description.length > 2000)
    ) {
      res.status(400).json({ error: "description must be ≤ 2000 characters" });
      return;
    }
    if (typeof pickupLocation !== "string" || pickupLocation.length > 200) {
      res.status(400).json({ error: "pickupLocation must be ≤ 200 characters" });
      return;
    }
    if (typeof dropoffLocation !== "string" || dropoffLocation.length > 200) {
      res.status(400).json({ error: "dropoffLocation must be ≤ 200 characters" });
      return;
    }

    // Allowlist rideType + paymentMethod against the schema's documented
    // values so the admin filters and mobile chip selector don't need
    // to handle arbitrary strings.
    if (!RIDE_TYPES.has(rideType)) {
      res.status(400).json({ error: "Invalid rideType" });
      return;
    }
    if (paymentMethod !== undefined && !RIDE_PAYMENT_METHODS.has(paymentMethod)) {
      res.status(400).json({ error: "Invalid paymentMethod" });
      return;
    }

    // Passenger count sanity — a minibus taxi is 15 seats, give a bit
    // of headroom for reserved charters but reject absurd values that
    // would blow through capacity limits if we ever wire them up.
    if (
      typeof maxPassengers !== "number" ||
      !Number.isInteger(maxPassengers) ||
      maxPassengers < 1 ||
      maxPassengers > 50
    ) {
      res.status(400).json({ error: "maxPassengers must be an integer between 1 and 50" });
      return;
    }

    // Cost per person — optional, must be non-negative finite, capped
    // at the same R100k wallet ceiling. A R100k/seat ride is absurd
    // but at least won't trip downstream math.
    if (
      costPerPerson !== undefined && costPerPerson !== null &&
      (typeof costPerPerson !== "number" || !Number.isFinite(costPerPerson) || costPerPerson < 0 || costPerPerson > 100_000)
    ) {
      res.status(400).json({ error: "costPerPerson must be between 0 and 100000" });
      return;
    }

    // Scheduled date must parse and be in the future. A ride for
    // yesterday is pointless noise on the feed.
    const scheduled = new Date(scheduledDate);
    if (Number.isNaN(scheduled.getTime())) {
      res.status(400).json({ error: "scheduledDate must be a valid ISO date" });
      return;
    }
    if (scheduled.getTime() <= Date.now()) {
      res.status(400).json({ error: "scheduledDate must be in the future" });
      return;
    }

    const [ride] = await db.insert(groupRides).values({
      organizerId: req.user!.userId,
      title: title.trim(),
      description: description ? description.trim() : null,
      pickupLocation: pickupLocation.trim(),
      dropoffLocation: dropoffLocation.trim(),
      scheduledDate: scheduled,
      maxPassengers,
      costPerPerson: costPerPerson ?? null,
      rideType,
      driverPlateNumber: driverPlateNumber || null,
      paymentMethod: paymentMethod || "individual",
      status: "open",
    }).returning();

    res.status(201).json(ride);
  } catch (error: any) {
    console.error("Create ride error:", error);
    res.status(500).json({ error: "Failed to create ride" });
  }
});

// Booking, ride-detail, and ride-chat endpoints were deleted in Chunk 44
// after the mobile ↔ CC audit surfaced they had no callers. On Haibo the
// actual booking mechanism is Haibo Pay: a commuter scans the driver's
// QR code and fires a P2P transfer, which both confirms the seat and
// settles the fare in one motion. A parallel "participant" ledger would
// duplicate that system without enforcing capacity anywhere, so the
// groupRideParticipants and rideChat tables stay in the schema (a drop
// is cross-system destructive) but nothing writes to them from the
// application layer anymore.

export default router;
