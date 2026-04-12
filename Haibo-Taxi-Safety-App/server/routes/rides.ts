import { Router, Response } from "express";
import { db } from "../db";
import { groupRides, groupRideParticipants, rideChat, rideTracking } from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// GET /api/rides - List group rides
router.get("/", async (req, res: Response) => {
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

// POST /api/rides/book - Book a seat on a group ride
router.post("/book", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rideId } = req.body;

    if (!rideId) {
      res.status(400).json({ error: "Ride ID is required" });
      return;
    }

    // Check ride exists and has capacity
    const rideResult = await db.select().from(groupRides).where(eq(groupRides.id, rideId)).limit(1);
    if (rideResult.length === 0) {
      res.status(404).json({ error: "Ride not found" });
      return;
    }

    const ride = rideResult[0];

    // Check if already booked
    const existing = await db.select().from(groupRideParticipants)
      .where(and(
        eq(groupRideParticipants.rideId, rideId),
        eq(groupRideParticipants.userId, req.user!.userId)
      ))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Already booked on this ride" });
      return;
    }

    const [participant] = await db.insert(groupRideParticipants).values({
      rideId,
      userId: req.user!.userId,
      status: "confirmed",
      amountPaid: ride.costPerPerson || 0,
      paymentStatus: "pending",
    }).returning();

    res.status(201).json({ message: "Seat booked successfully", participant });
  } catch (error: any) {
    console.error("Book ride error:", error);
    res.status(500).json({ error: "Failed to book ride" });
  }
});

// GET /api/rides/:id - Get ride details with participants
router.get("/:id", async (req, res: Response) => {
  try {
    const result = await db.select().from(groupRides).where(eq(groupRides.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Ride not found" });
      return;
    }

    const participants = await db.select().from(groupRideParticipants)
      .where(eq(groupRideParticipants.rideId, req.params.id));

    const chat = await db.select().from(rideChat)
      .where(eq(rideChat.rideId, req.params.id))
      .orderBy(desc(rideChat.createdAt))
      .limit(50);

    res.json({ ...result[0], participants, chat });
  } catch (error: any) {
    console.error("Get ride error:", error);
    res.status(500).json({ error: "Failed to fetch ride" });
  }
});

// POST /api/rides/:id/chat - Send a chat message in a ride
router.post("/:id/chat", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const [chatMsg] = await db.insert(rideChat).values({
      rideId: req.params.id,
      userId: req.user!.userId,
      userName: req.user!.phone,
      message,
    }).returning();

    res.status(201).json(chatMsg);
  } catch (error: any) {
    console.error("Send chat error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
