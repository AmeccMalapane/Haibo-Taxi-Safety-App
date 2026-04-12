import { Router, Response } from "express";
import { db } from "../db";
import { events, eventRsvps } from "../../shared/schema";
import { eq, desc, sql, count, and, gte } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// GET /api/events - List events
router.get("/", async (req, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { category, status, province } = req.query as any;

    let results;
    if (category) {
      results = await db.select().from(events)
        .where(eq(events.category, category))
        .orderBy(desc(events.eventDate))
        .limit(limit).offset(offset);
    } else {
      results = await db.select().from(events)
        .orderBy(desc(events.eventDate))
        .limit(limit).offset(offset);
    }

    const [totalResult] = await db.select({ count: count() }).from(events);

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get events error:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// POST /api/events/create - Create an event
router.post("/create", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, description, category, eventDate, eventEndDate,
      startTime, endTime, location, venue, province,
      latitude, longitude, organizer, organizerPhone, organizerEmail,
      imageUrl, ticketPrice, ticketUrl, maxAttendees,
      isOnline, onlineUrl, tags,
    } = req.body;

    if (!title || !description || !eventDate || !location || !organizer) {
      res.status(400).json({ error: "Title, description, event date, location, and organizer are required" });
      return;
    }

    const [event] = await db.insert(events).values({
      title,
      description,
      category: category || "community",
      eventDate: new Date(eventDate),
      eventEndDate: eventEndDate ? new Date(eventEndDate) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      location,
      venue: venue || null,
      province: province || null,
      latitude: latitude || null,
      longitude: longitude || null,
      organizer,
      organizerPhone: organizerPhone || null,
      organizerEmail: organizerEmail || null,
      imageUrl: imageUrl || null,
      ticketPrice: ticketPrice || 0,
      ticketUrl: ticketUrl || null,
      maxAttendees: maxAttendees || null,
      isOnline: isOnline || false,
      onlineUrl: onlineUrl || null,
      tags: tags || [],
      postedBy: req.user!.userId,
      status: "upcoming",
    }).returning();

    res.status(201).json(event);
  } catch (error: any) {
    console.error("Create event error:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// GET /api/events/:id - Get event details
router.get("/:id", async (req, res: Response) => {
  try {
    const result = await db.select().from(events).where(eq(events.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const rsvps = await db.select().from(eventRsvps)
      .where(eq(eventRsvps.eventId, req.params.id))
      .orderBy(desc(eventRsvps.createdAt));

    res.json({ ...result[0], rsvps });
  } catch (error: any) {
    console.error("Get event error:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// POST /api/events/book-ticket - RSVP / Book ticket for an event
router.post("/book-ticket", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, attendeeName, attendeePhone, attendeeEmail, ticketCount, deviceId } = req.body;

    if (!eventId || !attendeeName || !attendeePhone) {
      res.status(400).json({ error: "Event ID, attendee name, and phone are required" });
      return;
    }

    // Check event exists and has capacity
    const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (eventResult.length === 0) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const event = eventResult[0];
    if (event.maxAttendees && event.currentAttendees! >= event.maxAttendees) {
      res.status(400).json({ error: "Event is fully booked" });
      return;
    }

    const tickets = ticketCount || 1;

    const [rsvp] = await db.insert(eventRsvps).values({
      eventId,
      attendeeName,
      attendeePhone,
      attendeeEmail: attendeeEmail || null,
      ticketCount: tickets,
      deviceId: deviceId || null,
      status: "confirmed",
    }).returning();

    // Update attendee count
    await db.update(events)
      .set({ currentAttendees: sql`${events.currentAttendees} + ${tickets}` })
      .where(eq(events.id, eventId));

    res.status(201).json({
      ...rsvp,
      message: "Ticket booked successfully",
    });
  } catch (error: any) {
    console.error("Book ticket error:", error);
    res.status(500).json({ error: "Failed to book ticket" });
  }
});

export default router;
