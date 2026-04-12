import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import * as schema from "../../shared/schema";

export function groupRideRoutes(db: any) {
  const router = Router();

  // Get group rides
  router.get("/", async (req, res) => {
    try {
      const { status, type } = req.query;

      let rides = await db.select().from(schema.groupRides)
        .orderBy(desc(schema.groupRides.scheduledDate))
        .limit(50);

      if (status) {
        rides = rides.filter((r: any) => r.status === status);
      }
      if (type) {
        rides = rides.filter((r: any) => r.rideType === type);
      }

      res.json(rides);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch group rides", message: error.message });
    }
  });

  // Create group ride
  router.post("/", async (req, res) => {
    try {
      const {
        organizerId, title, description, pickupLocation, dropoffLocation,
        scheduledDate, maxPassengers, costPerPerson, rideType,
        driverId, driverPlateNumber, driverSafetyRating, paymentMethod,
      } = req.body;

      if (!organizerId || !title || !pickupLocation || !dropoffLocation || !scheduledDate || !maxPassengers) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const [ride] = await db.insert(schema.groupRides).values({
        organizerId,
        title,
        description: description || null,
        pickupLocation,
        dropoffLocation,
        scheduledDate: new Date(scheduledDate),
        maxPassengers,
        costPerPerson: costPerPerson || null,
        rideType: rideType || "scheduled",
        driverId: driverId || null,
        driverPlateNumber: driverPlateNumber || null,
        driverSafetyRating: driverSafetyRating || null,
        paymentMethod: paymentMethod || "individual",
        isVerifiedDriver: !!driverId,
      }).returning();

      res.status(201).json(ride);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create group ride", message: error.message });
    }
  });

  // Join a group ride
  router.post("/:rideId/join", async (req, res) => {
    try {
      const { rideId } = req.params;
      const { userId } = req.body;

      // Check ride exists and has capacity
      const [ride] = await db.select().from(schema.groupRides)
        .where(eq(schema.groupRides.id, rideId))
        .limit(1);

      if (!ride) {
        return res.status(404).json({ error: "Ride not found" });
      }

      // Count current participants
      const participants = await db.select({ count: sql`COUNT(*)` })
        .from(schema.groupRideParticipants)
        .where(eq(schema.groupRideParticipants.rideId, rideId));

      if (participants[0]?.count >= ride.maxPassengers) {
        return res.status(400).json({ error: "Ride is full" });
      }

      // Book with Haibo Pay if paid ride
      let paymentStatus = "pending";
      let amountPaid = 0;

      if (ride.costPerPerson && ride.costPerPerson > 0) {
        const [user] = await db.select().from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (!user || (user.walletBalance || 0) < ride.costPerPerson) {
          return res.status(400).json({
            error: "Insufficient Haibo Pay balance",
            required: ride.costPerPerson,
            currency: "R",
          });
        }

        // Deduct from wallet
        await db.update(schema.users).set({
          walletBalance: sql`wallet_balance - ${ride.costPerPerson}`,
        }).where(eq(schema.users.id, userId));

        // Record transaction
        const bookingRef = `GR-${rideId.substring(0, 6)}-${Date.now()}`;
        await db.insert(schema.walletTransactions).values({
          userId,
          type: "payment",
          amount: -ride.costPerPerson,
          description: `Group Ride: ${ride.title}`,
          status: "completed",
          paymentReference: bookingRef,
          metadata: { rideId, type: "group_ride_booking" },
        });

        paymentStatus = "completed";
        amountPaid = ride.costPerPerson;
      }

      // Add participant
      const [participant] = await db.insert(schema.groupRideParticipants).values({
        rideId,
        userId,
        status: "confirmed",
        amountPaid,
        paymentStatus,
        paymentReference: `GR-${rideId.substring(0, 6)}-${Date.now()}`,
      }).returning();

      res.status(201).json({
        participant,
        message: amountPaid > 0
          ? `Booked! R${amountPaid.toFixed(2)} deducted from Haibo Pay.`
          : "Joined the ride!",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to join ride", message: error.message });
    }
  });

  // Send chat message in ride
  router.post("/:rideId/chat", async (req, res) => {
    try {
      const { rideId } = req.params;
      const { userId, userName, message } = req.body;

      const [chatMsg] = await db.insert(schema.rideChat).values({
        rideId,
        userId,
        userName: userName || "Anonymous",
        message,
      }).returning();

      res.status(201).json(chatMsg);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send message", message: error.message });
    }
  });

  // Get ride chat
  router.get("/:rideId/chat", async (req, res) => {
    try {
      const { rideId } = req.params;

      const messages = await db.select().from(schema.rideChat)
        .where(eq(schema.rideChat.rideId, rideId))
        .orderBy(schema.rideChat.createdAt);

      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get chat", message: error.message });
    }
  });

  return router;
}
