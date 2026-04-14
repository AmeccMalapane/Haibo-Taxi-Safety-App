import { Router, Response } from "express";
import { db } from "../db";
import { pasopReports } from "../../shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { emitToAdmins, broadcast } from "../services/realtime";

const router = Router();

// Category → TTL hours (kept in sync with PASOP_CATEGORIES in the mobile
// client). Used by POST to set a server-side expiresAt so clients that
// can't compute it (or lie about it) all agree.
const CATEGORY_TTL_HOURS: Record<string, number> = {
  reckless_driving: 4,
  unsafe_vehicle: 24,
  accident: 6,
  robbery_risk: 12,
  roadblock: 4,
  police_checkpoint: 2,
  full_taxi: 1,
  rank_congestion: 1,
};

function computeExpiresAt(category: string): Date {
  const hours = CATEGORY_TTL_HOURS[category] ?? 4;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function toClientShape(row: typeof pasopReports.$inferSelect) {
  // Mobile client expects createdAt / expiresAt as ms timestamps because
  // the original local-first schema stored them as Date.now() numbers.
  // Keep that contract so turning server fetch on doesn't break existing
  // call sites.
  return {
    id: row.id,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    description: row.description || undefined,
    reporterId: row.reporterId || "",
    reporterName: row.reporterName || undefined,
    petitionCount: row.petitionCount || 0,
    petitioners: row.petitioners || [],
    status: row.status,
    createdAt: row.createdAt ? row.createdAt.getTime() : Date.now(),
    expiresAt: row.expiresAt.getTime(),
  };
}

// GET /api/pasop/reports — list active reports. Optional ?bbox=minLat,
// minLng,maxLat,maxLng trims to a bounding box client-side so we don't
// need PostGIS for the first pass. `includeExpired=true` surfaces all
// rows for the admin queue.
router.get("/reports", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { bbox, includeExpired } = req.query as {
      bbox?: string;
      includeExpired?: string;
    };

    const showAll = includeExpired === "true";
    const rows = showAll
      ? await db.select().from(pasopReports)
      : await db
          .select()
          .from(pasopReports)
          .where(
            and(
              eq(pasopReports.status, "active"),
              gte(pasopReports.expiresAt, new Date())
            )
          );

    let filtered = rows;
    if (bbox) {
      const parts = bbox.split(",").map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [minLat, minLng, maxLat, maxLng] = parts;
        filtered = rows.filter(
          (r) =>
            r.latitude >= minLat &&
            r.latitude <= maxLat &&
            r.longitude >= minLng &&
            r.longitude <= maxLng
        );
      }
    }

    res.json({ data: filtered.map(toClientShape) });
  } catch (error: any) {
    console.error("Pasop list error:", error);
    res.status(500).json({ error: "Failed to fetch pasop reports" });
  }
});

// POST /api/pasop/reports — file a new report. Authenticated users get
// their userId auto-linked; anonymous submissions are accepted too so
// commuters running in guest mode can still warn the community.
router.post("/reports", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category, latitude, longitude, description, reporterName } = req.body;

    if (!category || typeof latitude !== "number" || typeof longitude !== "number") {
      res.status(400).json({ error: "category, latitude, longitude are required" });
      return;
    }

    if (!(category in CATEGORY_TTL_HOURS)) {
      res.status(400).json({ error: `Unknown category: ${category}` });
      return;
    }

    const expiresAt = computeExpiresAt(category);

    const [inserted] = await db
      .insert(pasopReports)
      .values({
        category,
        latitude,
        longitude,
        description: description || null,
        reporterId: req.user?.userId || null,
        reporterName: reporterName || (req.user?.phone ?? "Anonymous"),
        petitionCount: 0,
        petitioners: [],
        status: "active",
        expiresAt,
      })
      .returning();

    const payload = toClientShape(inserted);

    // Fan out:
    //   • admins — show in CC moderation queue + dashboard toast
    //   • broadcast — mobile clients watching the map refresh the pin layer
    emitToAdmins("pasop:reported", payload);
    broadcast("pasop:new", payload);

    res.status(201).json(payload);
  } catch (error: any) {
    console.error("Pasop create error:", error);
    res.status(500).json({ error: "Failed to create pasop report" });
  }
});

// POST /api/pasop/reports/:id/petition — "still there?" confirmation.
// Increments petitionCount, extends expiresAt by 30 minutes per petition,
// and tracks the petitioner so the same user can't double-vote. Uses the
// authenticated userId when available, otherwise a client-supplied
// device-scoped petitioner token (accepted for anonymous use).
router.post(
  "/reports/:id/petition",
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { petitionerId: bodyPetitionerId } = req.body as {
        petitionerId?: string;
      };
      const petitionerId = req.user?.userId || bodyPetitionerId;
      if (!petitionerId) {
        res.status(400).json({ error: "petitionerId is required for guest petitions" });
        return;
      }

      const [existing] = await db
        .select()
        .from(pasopReports)
        .where(eq(pasopReports.id, req.params.id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const petitioners = existing.petitioners || [];
      if (petitioners.includes(petitionerId)) {
        // Idempotent — return the current state so clients can sync state
        // without special-casing the "already petitioned" path.
        res.json(toClientShape(existing));
        return;
      }

      const nextExpiresAt = new Date(
        existing.expiresAt.getTime() + 30 * 60 * 1000
      );

      const [updated] = await db
        .update(pasopReports)
        .set({
          petitionCount: sql`${pasopReports.petitionCount} + 1`,
          petitioners: [...petitioners, petitionerId],
          expiresAt: nextExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(pasopReports.id, req.params.id))
        .returning();

      res.json(toClientShape(updated));
    } catch (error: any) {
      console.error("Pasop petition error:", error);
      res.status(500).json({ error: "Failed to petition pasop report" });
    }
  }
);

export default router;
