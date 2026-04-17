/**
 * server/routes/admin-fare-sync.ts
 *
 * Admin endpoints for the fare-imports pipeline:
 *
 *   GET  /api/admin/fare-imports              — queue listing with status filter
 *   POST /api/admin/fare-imports/:id/approve  — promote to taxi_fares
 *   POST /api/admin/fare-imports/:id/reject   — terminal reject with reason
 *   POST /api/admin/fare-imports/:id/duplicate — terminal "already have this fare"
 *
 *   GET  /api/admin/demand-signals            — aggregated route demand (top N)
 *
 * Split out of the 3000-line routes/admin.ts because these touch three
 * tables (fare_imports, taxi_locations, taxi_fares) with non-trivial
 * join logic and are easier to review in isolation.
 *
 * Auth: every route requires authMiddleware + requireRole("admin").
 *
 * Mount (server/index.ts):
 *   app.use("/api/admin", adminFareSyncRoutes);
 *
 * The sub-paths are defined relative to /api/admin so they live alongside
 * the rest of the admin surface, not under a separate prefix.
 */

import { Router, Response } from "express";
import { alias } from "drizzle-orm/pg-core";
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  sql,
} from "drizzle-orm";

import { db } from "../db";
import {
  fareImports,
  routeDemandSignals,
  taxiFares,
  taxiLocations,
} from "../../shared/schema";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { recordAdminAction } from "../services/audit";

const router = Router();

// ─── Types + validation ──────────────────────────────────────────────────────

/**
 * Status values accepted in GET /api/admin/fare-imports?status=.
 * "all" is a sentinel — omit the where clause.
 */
const FARE_IMPORT_STATUSES = new Set([
  "pending_extraction",
  "pending_canonicalization",
  "pending_review",
  "orphan",
  "approved",
  "rejected",
  "duplicate",
  "superseded",
  "all",
]);

interface ApprovePayload {
  /** Admin override for the fare amount in ZAR. Falls back to fareZar from extraction. */
  amount?: number | null;
  /** Admin override for distance, if known. */
  distanceKm?: number | null;
  /** Admin override for duration (minutes). */
  estimatedTimeMinutes?: number | null;
  /** Taxi association if admin knows it. */
  association?: string | null;
  /** Optional reviewer note, lands on fare_imports.review_notes. */
  notes?: string | null;
  /**
   * If the canonicalizer matched only the destination, the admin can
   * explicitly supply origin_rank_id at approve time (e.g. they just
   * created a new taxi_locations row). Falls back to the canonicalized
   * origin_rank_id from the row.
   */
  originRankIdOverride?: string | null;
  /** Same idea for destination — rare but allowed. */
  destinationRankIdOverride?: string | null;
}

// ─── GET /api/admin/fare-imports ─────────────────────────────────────────────

router.get(
  "/fare-imports",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        status: rawStatus,
        limit: rawLimit,
        offset: rawOffset,
      } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };

      const status = rawStatus || "pending_review";
      if (!FARE_IMPORT_STATUSES.has(status)) {
        res.status(400).json({
          error: `status must be one of: ${[...FARE_IMPORT_STATUSES].join(", ")}`,
        });
        return;
      }

      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      // JOIN twice to get both canonical rank names in one query.
      const originLoc = alias(taxiLocations, "origin_loc");
      const destLoc = alias(taxiLocations, "dest_loc");

      const whereClause = status === "all"
        ? undefined
        : eq(fareImports.status, status);

      const rows = await db
        .select({
          id: fareImports.id,
          source: fareImports.source,
          sourcePostId: fareImports.sourcePostId,
          sourcePostUrl: fareImports.sourcePostUrl,
          sourceCommentId: fareImports.sourceCommentId,
          sourceCommentUrl: fareImports.sourceCommentUrl,
          postTimestamp: fareImports.postTimestamp,
          harvestedAt: fareImports.harvestedAt,
          harvesterRunId: fareImports.harvesterRunId,
          rawTextRedacted: fareImports.rawTextRedacted,
          containsPhoneNumber: fareImports.containsPhoneNumber,
          containsEmail: fareImports.containsEmail,
          extractorVersion: fareImports.extractorVersion,
          extractorModel: fareImports.extractorModel,
          originRaw: fareImports.originRaw,
          destinationRaw: fareImports.destinationRaw,
          fareZar: fareImports.fareZar,
          metroHint: fareImports.metroHint,
          confidence: fareImports.confidence,
          evidenceQuote: fareImports.evidenceQuote,
          extractionNotes: fareImports.extractionNotes,
          originRankId: fareImports.originRankId,
          destinationRankId: fareImports.destinationRankId,
          originMatchScore: fareImports.originMatchScore,
          destinationMatchScore: fareImports.destinationMatchScore,
          canonicalizationMethod: fareImports.canonicalizationMethod,
          canonicalizedAt: fareImports.canonicalizedAt,
          status: fareImports.status,
          reviewedBy: fareImports.reviewedBy,
          reviewedAt: fareImports.reviewedAt,
          reviewNotes: fareImports.reviewNotes,
          rejectionReason: fareImports.rejectionReason,
          taxiFareId: fareImports.taxiFareId,
          originRankName: originLoc.name,
          destinationRankName: destLoc.name,
        })
        .from(fareImports)
        .leftJoin(originLoc, eq(originLoc.id, fareImports.originRankId))
        .leftJoin(destLoc, eq(destLoc.id, fareImports.destinationRankId))
        .where(whereClause)
        .orderBy(desc(fareImports.harvestedAt))
        .limit(limit)
        .offset(offset);

      // Status-bucket counts so the UI tabs can show "Pending review (23)".
      const counts = await db
        .select({
          status: fareImports.status,
          count: sql<number>`count(*)::int`,
        })
        .from(fareImports)
        .groupBy(fareImports.status);

      res.json({
        data: rows,
        counts: Object.fromEntries(counts.map((c) => [c.status, c.count])),
        pagination: { limit, offset, returned: rows.length },
      });
    } catch (error: any) {
      console.error("Admin fare-imports list error:", error);
      res.status(500).json({ error: "Failed to fetch fare imports" });
    }
  },
);

// ─── POST /api/admin/fare-imports/:id/approve ────────────────────────────────

router.post(
  "/fare-imports/:id/approve",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const payload: ApprovePayload = req.body || {};

      // Load the row + canonical rank names in one round trip.
      const originLoc = alias(taxiLocations, "origin_loc");
      const destLoc = alias(taxiLocations, "dest_loc");
      const [row] = await db
        .select({
          row: fareImports,
          originName: originLoc.name,
          destName: destLoc.name,
        })
        .from(fareImports)
        .leftJoin(originLoc, eq(originLoc.id, fareImports.originRankId))
        .leftJoin(destLoc, eq(destLoc.id, fareImports.destinationRankId))
        .where(eq(fareImports.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Fare import not found" });
        return;
      }

      // Only pending_review + orphan are approvable. Approving a
      // pending_canonicalization row bypasses the matching step which is
      // almost always a mistake.
      const approvableStatuses = new Set(["pending_review", "orphan"]);
      if (!approvableStatuses.has(row.row.status)) {
        res.status(409).json({
          error: `Cannot approve a fare import with status "${row.row.status}". ` +
            `Only pending_review and orphan are approvable.`,
        });
        return;
      }

      const originRankId =
        payload.originRankIdOverride !== undefined
          ? payload.originRankIdOverride
          : row.row.originRankId;
      const destinationRankId =
        payload.destinationRankIdOverride !== undefined
          ? payload.destinationRankIdOverride
          : row.row.destinationRankId;

      // For an orphan approval the admin MUST have supplied at least a
      // destination rank override — otherwise we'd end up with a
      // taxi_fares row that can't be looked up by rank id, defeating the
      // canonicalization pipeline's purpose.
      if (!destinationRankId) {
        res.status(400).json({
          error:
            "Destination rank id is required to approve. " +
            "Pass destinationRankIdOverride or canonicalize the row first.",
        });
        return;
      }

      const amount =
        typeof payload.amount === "number" ? payload.amount : row.row.fareZar;

      // For text fields (origin/destination on taxi_fares), prefer the
      // canonical gazetteer name if the admin's override points at a
      // known rank, otherwise use the extractor's origin_raw/dest_raw.
      // We re-load names if the admin overrode rank ids.
      let originName = row.originName;
      let destName = row.destName;
      if (payload.originRankIdOverride && payload.originRankIdOverride !== row.row.originRankId) {
        const [loc] = await db
          .select({ name: taxiLocations.name })
          .from(taxiLocations)
          .where(eq(taxiLocations.id, payload.originRankIdOverride))
          .limit(1);
        originName = loc?.name ?? null;
      }
      if (payload.destinationRankIdOverride && payload.destinationRankIdOverride !== row.row.destinationRankId) {
        const [loc] = await db
          .select({ name: taxiLocations.name })
          .from(taxiLocations)
          .where(eq(taxiLocations.id, payload.destinationRankIdOverride))
          .limit(1);
        destName = loc?.name ?? null;
      }

      const originText = originName ?? row.row.originRaw ?? "Unknown origin";
      const destText = destName ?? row.row.destinationRaw ?? "Unknown destination";

      // INSERT the taxi_fares row. We don't attempt merge-on-conflict
      // here — duplicate detection is surfaced to the admin via the
      // separate /duplicate endpoint. Launch-sprint pragmatism; merge
      // logic can land post-launch.
      const [fare] = await db
        .insert(taxiFares)
        .values({
          origin: originText,
          destination: destText,
          originRankId,
          destinationRankId,
          amount: amount ?? null,
          currency: "ZAR",
          distanceKm: payload.distanceKm ?? null,
          estimatedTimeMinutes: payload.estimatedTimeMinutes ?? null,
          association: payload.association ?? null,
          addedBy: req.user!.userId,
          verificationStatus: "verified",
          isActive: true,
        })
        .returning();

      // Mark the import approved + back-reference.
      const [updatedImport] = await db
        .update(fareImports)
        .set({
          status: "approved",
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
          reviewNotes: payload.notes ?? null,
          taxiFareId: fare.id,
          // Any override the admin applied should be persisted for audit.
          originRankId,
          destinationRankId,
          updatedAt: new Date(),
        })
        .where(eq(fareImports.id, id))
        .returning();

      await recordAdminAction(
        req,
        "fare_import.approve",
        "fare_imports",
        id,
        {
          taxiFareId: fare.id,
          amount,
          originRankId,
          destinationRankId,
          amountOverridden:
            typeof payload.amount === "number" && payload.amount !== row.row.fareZar,
        },
      );

      res.json({ fareImport: updatedImport, taxiFare: fare });
    } catch (error: any) {
      console.error("Admin fare-imports approve error:", error);
      res.status(500).json({ error: "Failed to approve fare import" });
    }
  },
);

// ─── POST /api/admin/fare-imports/:id/reject ─────────────────────────────────

router.post(
  "/fare-imports/:id/reject",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason, notes } = (req.body || {}) as {
        reason?: string;
        notes?: string;
      };

      if (!reason || reason.trim().length < 3) {
        res.status(400).json({
          error: "reason is required (min 3 chars) and lands in the audit log",
        });
        return;
      }

      const [updated] = await db
        .update(fareImports)
        .set({
          status: "rejected",
          rejectionReason: reason.trim(),
          reviewNotes: notes?.trim() || null,
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fareImports.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Fare import not found" });
        return;
      }

      await recordAdminAction(
        req,
        "fare_import.reject",
        "fare_imports",
        id,
        { reason: reason.trim() },
      );

      res.json(updated);
    } catch (error: any) {
      console.error("Admin fare-imports reject error:", error);
      res.status(500).json({ error: "Failed to reject fare import" });
    }
  },
);

// ─── POST /api/admin/fare-imports/:id/duplicate ──────────────────────────────

/**
 * Mark an import as a duplicate — admin already approved an equivalent
 * fare from another post. Separate from reject so the bucket counts
 * reflect reality ("we didn't reject bad data, we just already had it").
 */
router.post(
  "/fare-imports/:id/duplicate",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { duplicateOfFareId, notes } = (req.body || {}) as {
        duplicateOfFareId?: string;
        notes?: string;
      };

      const [updated] = await db
        .update(fareImports)
        .set({
          status: "duplicate",
          taxiFareId: duplicateOfFareId ?? null,
          reviewNotes: notes?.trim() || null,
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fareImports.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Fare import not found" });
        return;
      }

      await recordAdminAction(
        req,
        "fare_import.duplicate",
        "fare_imports",
        id,
        { duplicateOfFareId: duplicateOfFareId || null },
      );

      res.json(updated);
    } catch (error: any) {
      console.error("Admin fare-imports duplicate error:", error);
      res.status(500).json({ error: "Failed to mark fare import as duplicate" });
    }
  },
);

// ─── GET /api/admin/demand-signals ───────────────────────────────────────────

/**
 * Aggregated route demand over a rolling window. One row per
 * (origin_rank_id, destination_rank_id, metro_hint) tuple with the
 * count of posts and the most recent harvest timestamp.
 *
 * Only counts status = "canonicalized" rows — orphans don't aggregate
 * (they'd collapse onto a synthetic null-pair bucket and mask actual
 * demand).
 *
 * Used by:
 *   - admin city-explorer dashboard ("top-asked routes in JHB this month")
 *   - feature gating: "should we build a formal rank at X?"
 *
 * Not a materialized view yet — launch-sprint pragmatism. The query is
 * fast enough at the table's current size (<100k rows) that a GROUP BY
 * on demand is fine. Promote to a refreshed mview once rows cross ~1M.
 */
router.get(
  "/demand-signals",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        metro: rawMetro,
        windowDays: rawWindow,
        limit: rawLimit,
      } = req.query as {
        metro?: string;
        windowDays?: string;
        limit?: string;
      };

      const windowDays = Math.min(
        Math.max(Number(rawWindow) || 30, 1),
        365,
      );
      const limit = Math.min(Number(rawLimit) || 50, 500);

      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      const originLoc = alias(taxiLocations, "origin_loc");
      const destLoc = alias(taxiLocations, "dest_loc");

      const conditions = [
        eq(routeDemandSignals.status, "canonicalized"),
        gte(routeDemandSignals.harvestedAt, since),
        // Destination must be non-null — enforced by schema but still a
        // cheap predicate that lets Postgres skip the index-miss case.
        isNotNull(routeDemandSignals.destinationRankId),
      ];
      if (rawMetro) conditions.push(eq(routeDemandSignals.metroHint, rawMetro));

      const rows = await db
        .select({
          originRankId: routeDemandSignals.originRankId,
          destinationRankId: routeDemandSignals.destinationRankId,
          metroHint: routeDemandSignals.metroHint,
          originRankName: originLoc.name,
          destinationRankName: destLoc.name,
          count: sql<number>`count(*)::int`,
          lastSeenAt: sql<Date | null>`max(${routeDemandSignals.harvestedAt})`,
          sampleQuote: sql<string | null>`max(${routeDemandSignals.evidenceQuote})`,
        })
        .from(routeDemandSignals)
        .leftJoin(
          originLoc,
          eq(originLoc.id, routeDemandSignals.originRankId),
        )
        .leftJoin(
          destLoc,
          eq(destLoc.id, routeDemandSignals.destinationRankId),
        )
        .where(and(...conditions))
        .groupBy(
          routeDemandSignals.originRankId,
          routeDemandSignals.destinationRankId,
          routeDemandSignals.metroHint,
          originLoc.name,
          destLoc.name,
        )
        .orderBy(desc(sql<number>`count(*)`))
        .limit(limit);

      res.json({
        data: rows,
        windowDays,
        since: since.toISOString(),
        returned: rows.length,
      });
    } catch (error: any) {
      console.error("Admin demand-signals error:", error);
      res.status(500).json({ error: "Failed to fetch demand signals" });
    }
  },
);

export default router;
