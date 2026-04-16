import { Router, Request, Response } from "express";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { taxiFares } from "../../shared/schema";
import { optionalAuth, AuthRequest } from "../middleware/auth";

/**
 * Public + semi-public fare lookup. Matches the shape TaxiFareScreen
 * expects from the bundled JSON so the mobile app can drop in the API
 * version without touching its UI code: {id, origin, destination, fare,
 * distance, estimatedTime, association}. Rows with verification_status
 * = "verified" and is_active = true are shown; rejected / archived rows
 * are admin-only surfaces.
 *
 * Admin CRUD lives in routes/admin.ts alongside the locations admin
 * endpoints to keep the moderation + write model in one place.
 */

const router = Router();

function toPublicShape(row: any) {
  return {
    id: row.id,
    routeName: `${row.origin} - ${row.destination}`,
    origin: row.origin,
    destination: row.destination,
    originRankId: row.originRankId,
    destinationRankId: row.destinationRankId,
    fare: row.amount,
    fareDisplay:
      row.amount != null
        ? `R${Number(row.amount).toFixed(2)}`
        : "Price TBD",
    currency: row.currency || "ZAR",
    distance: row.distanceKm,
    estimatedTime: row.estimatedTimeMinutes
      ? `${row.estimatedTimeMinutes} minutes`
      : null,
    association: row.association,
  };
}

// GET /api/fares — paginated list with optional origin/destination search.
// Public: no auth required so the mobile TaxiFareScreen can populate
// without forcing login. Only verified + active rows are returned.
router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      q,
      origin,
      destination,
      limit: rawLimit,
      offset: rawOffset,
    } = req.query as {
      q?: string;
      origin?: string;
      destination?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Number(rawLimit) || 200, 1000);
    const offset = Math.max(Number(rawOffset) || 0, 0);

    const conditions: any[] = [
      eq(taxiFares.verificationStatus, "verified"),
      eq(taxiFares.isActive, true),
    ];
    if (origin) conditions.push(ilike(taxiFares.origin, `%${origin}%`));
    if (destination)
      conditions.push(ilike(taxiFares.destination, `%${destination}%`));
    if (q) {
      conditions.push(
        or(
          ilike(taxiFares.origin, `%${q}%`),
          ilike(taxiFares.destination, `%${q}%`),
          ilike(taxiFares.association, `%${q}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(taxiFares)
        .where(whereClause)
        .orderBy(taxiFares.origin, taxiFares.destination)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(taxiFares)
        .where(whereClause),
    ]);

    res.json({
      data: rows.map(toPublicShape),
      pagination: {
        total: totalRow[0]?.count || 0,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error("Fares list error:", error);
    res.status(500).json({ error: "Failed to fetch fares" });
  }
});

// GET /api/fares/:id
router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [row] = await db
      .select()
      .from(taxiFares)
      .where(eq(taxiFares.id, id))
      .limit(1);

    if (!row || !row.isActive) {
      res.status(404).json({ error: "Fare not found" });
      return;
    }
    res.json(toPublicShape(row));
  } catch (error: any) {
    console.error("Fare detail error:", error);
    res.status(500).json({ error: "Failed to fetch fare" });
  }
});

export default router;
