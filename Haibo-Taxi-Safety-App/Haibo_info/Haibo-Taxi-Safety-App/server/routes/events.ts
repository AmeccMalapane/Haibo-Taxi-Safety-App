import { Router } from "express";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import * as schema from "../../shared/schema";

const PROMOTION_FEE_ZAR = 50; // R50 for 7-day promotion
const PROMOTION_DURATION_DAYS = 7;

export function eventRoutes(db: any) {
  const router = Router();

  // Get events (with optional filters)
  router.get("/", async (req, res) => {
    try {
      const { category, upcoming, featured, limit: limitParam } = req.query;
      const limit = parseInt(limitParam as string) || 20;

      let query = db.select().from(schema.events);

      if (upcoming === "true") {
        query = query.where(gte(schema.events.eventDate, new Date()));
      }

      const events = await query.orderBy(desc(schema.events.eventDate)).limit(limit);

      // Filter by category in JS if needed
      let filtered = events;
      if (category && category !== "all") {
        filtered = events.filter((e: any) => e.category === category);
      }
      if (featured === "true") {
        filtered = filtered.filter((e: any) => e.isFeatured);
      }

      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch events", message: error.message });
    }
  });

  // Get event by ID
  router.get("/:id", async (req, res) => {
    try {
      const [event] = await db.select().from(schema.events)
        .where(eq(schema.events.id, req.params.id))
        .limit(1);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch event", message: error.message });
    }
  });

  // Create event
  router.post("/", async (req, res) => {
    try {
      const [event] = await db.insert(schema.events).values({
        ...req.body,
        status: "upcoming",
      }).returning();

      res.status(201).json(event);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create event", message: error.message });
    }
  });

  // Promote event (R50 fee, 7-day promotion)
  router.post("/:id/promote", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, paymentReference } = req.body;

      // Verify event exists
      const [event] = await db.select().from(schema.events)
        .where(eq(schema.events.id, id))
        .limit(1);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Check user wallet balance
      const [user] = await db.select().from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!user || (user.walletBalance || 0) < PROMOTION_FEE_ZAR) {
        return res.status(400).json({
          error: "Insufficient funds",
          required: PROMOTION_FEE_ZAR,
          balance: user?.walletBalance || 0,
          currency: "R",
        });
      }

      // Deduct R50 from wallet
      await db.update(schema.users).set({
        walletBalance: sql`wallet_balance - ${PROMOTION_FEE_ZAR}`,
      }).where(eq(schema.users.id, userId));

      // Record transaction
      await db.insert(schema.walletTransactions).values({
        userId,
        type: "payment",
        amount: -PROMOTION_FEE_ZAR,
        description: `Event promotion: ${event.title}`,
        status: "completed",
        paymentReference: paymentReference || `PROMO-${Date.now()}`,
        metadata: { eventId: id, promotionDays: PROMOTION_DURATION_DAYS },
      });

      // Set promotion expiry (7 days from now)
      const promotionExpiry = new Date(Date.now() + PROMOTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      await db.update(schema.events).set({
        isFeatured: true,
        updatedAt: new Date(),
      }).where(eq(schema.events.id, id));

      res.json({
        message: "Event promoted successfully",
        promotionExpiry: promotionExpiry.toISOString(),
        fee: `R${PROMOTION_FEE_ZAR}`,
        duration: `${PROMOTION_DURATION_DAYS} days`,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to promote event", message: error.message });
    }
  });

  // Book ticket for event
  router.post("/book-ticket", async (req, res) => {
    try {
      const { eventId, userId, attendeeName, attendeePhone, attendeeEmail, ticketCount } = req.body;

      if (!eventId || !attendeeName || !attendeePhone) {
        return res.status(400).json({ error: "eventId, attendeeName, and attendeePhone are required" });
      }

      // Get event
      const [event] = await db.select().from(schema.events)
        .where(eq(schema.events.id, eventId))
        .limit(1);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const count = ticketCount || 1;
      const totalCost = (event.ticketPrice || 0) * count;

      // If paid event, deduct from wallet
      if (totalCost > 0 && userId) {
        const [user] = await db.select().from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (!user || (user.walletBalance || 0) < totalCost) {
          return res.status(400).json({
            error: "Insufficient funds",
            required: totalCost,
            balance: user?.walletBalance || 0,
            currency: "R",
          });
        }

        // Deduct from wallet
        await db.update(schema.users).set({
          walletBalance: sql`wallet_balance - ${totalCost}`,
        }).where(eq(schema.users.id, userId));

        // Record transaction
        await db.insert(schema.walletTransactions).values({
          userId,
          type: "payment",
          amount: -totalCost,
          description: `Ticket: ${event.title} (x${count})`,
          status: "completed",
          metadata: { eventId, ticketCount: count },
        });
      }

      // Create RSVP
      const [rsvp] = await db.insert(schema.eventRsvps).values({
        eventId,
        attendeeName,
        attendeePhone,
        attendeeEmail: attendeeEmail || null,
        ticketCount: count,
        deviceId: req.body.deviceId || null,
      }).returning();

      // Update attendee count
      await db.update(schema.events).set({
        currentAttendees: sql`current_attendees + ${count}`,
      }).where(eq(schema.events.id, eventId));

      // Generate QR ticket reference
      const ticketRef = `HB-TKT-${rsvp.id.substring(0, 8).toUpperCase()}`;

      res.status(201).json({
        rsvp,
        ticketReference: ticketRef,
        totalCost: `R${totalCost.toFixed(2)}`,
        message: `Ticket booked! Reference: ${ticketRef}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to book ticket", message: error.message });
    }
  });

  // Get event stats
  router.get("/stats/overview", async (req, res) => {
    try {
      const upcoming = await db.select({ count: sql`COUNT(*)` }).from(schema.events)
        .where(gte(schema.events.eventDate, new Date()));

      res.json({
        upcoming: upcoming[0]?.count || 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch stats", message: error.message });
    }
  });

  return router;
}
