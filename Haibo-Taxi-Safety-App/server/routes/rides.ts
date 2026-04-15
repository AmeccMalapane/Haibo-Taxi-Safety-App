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
    const { rideType, status } = req.query as any;

    let results;
    if (rideType) {
      results = await db.select().from(groupRides)
        .where(eq(groupRides.rideType, rideType))
        .orderBy(desc(groupRides.scheduledDate))
        .limit(limit).offset(offset);
    } else {
      results = await db.select().from(groupRides)
        .orderBy(desc(groupRides.scheduledDate))
        .limit(limit).offset(offset);
    }

    const [totalResult] = await db.select({ count: count() }).from(groupRides);

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get rides error:", error);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

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

    const [ride] = await db.insert(groupRides).values({
      organizerId: req.user!.userId,
      title,
      description: description || null,
      pickupLocation,
      dropoffLocation,
      scheduledDate: new Date(scheduledDate),
      maxPassengers,
      costPerPerson: costPerPerson || null,
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
