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
// Length caps match the schema's pragmatic needs and protect the public
// marketing feed render path (app.haibo.africa/events) from DoS via
// unbounded titles/descriptions. These endpoints follow the reactive
// moderation model — content goes live immediately; admins hide
// after-the-fact — so the validation layer is the only line of defence
// against junk content.
const MAX_EVENT_TITLE = 200;
const MAX_EVENT_DESCRIPTION = 5000;
const MAX_EVENT_LOCATION = 200;
const MAX_EVENT_ORGANIZER = 150;
const MAX_EVENT_TAGS = 20;
const MAX_EVENT_TAG_LENGTH = 40;

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

    // String length caps on every free-text field that renders on the
    // public marketing page.
    if (typeof title !== "string" || title.length > MAX_EVENT_TITLE) {
      res.status(400).json({ error: `Title must be ≤ ${MAX_EVENT_TITLE} characters` });
      return;
    }
    if (typeof description !== "string" || description.length > MAX_EVENT_DESCRIPTION) {
      res.status(400).json({ error: `Description must be ≤ ${MAX_EVENT_DESCRIPTION} characters` });
      return;
    }
    if (typeof location !== "string" || location.length > MAX_EVENT_LOCATION) {
      res.status(400).json({ error: `Location must be ≤ ${MAX_EVENT_LOCATION} characters` });
      return;
    }
    if (typeof organizer !== "string" || organizer.length > MAX_EVENT_ORGANIZER) {
      res.status(400).json({ error: `Organizer must be ≤ ${MAX_EVENT_ORGANIZER} characters` });
      return;
    }

    // new Date(junk) silently returns Invalid Date which the DB then
    // rejects with a cryptic error. Catch it here with a friendly 400.
    const eventDateParsed = new Date(eventDate);
    if (Number.isNaN(eventDateParsed.getTime())) {
      res.status(400).json({ error: "eventDate must be a valid ISO date" });
      return;
    }
    let eventEndDateParsed: Date | null = null;
    if (eventEndDate) {
      const d = new Date(eventEndDate);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "eventEndDate must be a valid ISO date" });
        return;
      }
      eventEndDateParsed = d;
    }

    // Coordinate bounds (optional fields — only check when provided).
    if (
      latitude !== undefined && latitude !== null &&
      (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    ) {
      res.status(400).json({ error: "latitude must be between -90 and 90" });
      return;
    }
    if (
      longitude !== undefined && longitude !== null &&
      (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    ) {
      res.status(400).json({ error: "longitude must be between -180 and 180" });
      return;
    }

    // Ticket price — optional but must be non-negative + finite when set.
    // Cap at R100k per ticket to match the wallet transaction ceiling.
    if (
      ticketPrice !== undefined && ticketPrice !== null &&
      (typeof ticketPrice !== "number" || !Number.isFinite(ticketPrice) || ticketPrice < 0 || ticketPrice > 100_000)
    ) {
      res.status(400).json({ error: "ticketPrice must be between 0 and 100000" });
      return;
    }

    // Tags array — cap count and per-tag length so the JSONB column
    // doesn't balloon on reads.
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags) || tags.length > MAX_EVENT_TAGS ||
          tags.some((t) => typeof t !== "string" || t.length > MAX_EVENT_TAG_LENGTH)) {
        res.status(400).json({
          error: `tags must be an array of ≤ ${MAX_EVENT_TAGS} strings, each ≤ ${MAX_EVENT_TAG_LENGTH} chars`,
        });
        return;
      }
    }

    const [event] = await db.insert(events).values({
      title: title.trim(),
      description: description.trim(),
      category: category || "community",
      eventDate: eventDateParsed,
      eventEndDate: eventEndDateParsed,
      startTime: startTime || null,
      endTime: endTime || null,
      location: location.trim(),
      venue: venue || null,
      province: province || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      organizer: organizer.trim(),
      organizerPhone: organizerPhone || null,
      organizerEmail: organizerEmail || null,
      imageUrl: imageUrl || null,
      ticketPrice: ticketPrice ?? 0,
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
