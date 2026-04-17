/**
 * scripts/fare-sync/canonicalize.ts
 *
 * Post-extraction pass: matches `origin_raw` / `destination_raw` on
 * pending fare_imports + route_demand_signals rows against the
 * `taxi_locations` gazetteer, populates `*_rank_id` + `*_match_score`,
 * and promotes status:
 *
 *   fare_imports:
 *     pending_canonicalization → pending_review   (if at least destination matched)
 *     pending_canonicalization → rejected/orphan  (if destination orphaned)
 *
 *   route_demand_signals:
 *     pending_canonicalization → canonicalized    (if at least destination matched)
 *     pending_canonicalization → orphan           (if destination orphaned)
 *
 * Origin-orphan but destination-matched is common and acceptable
 * (extractor sees "R20 at Bree" but commenter said "Bree" and the
 * gazetteer has "Bree Street Taxi Rank" — origin matches too). When
 * origin is orphaned we still promote the row and leave origin_rank_id
 * null so the admin can decide whether to add a new gazetteer row.
 *
 * Usage:
 *   tsx scripts/fare-sync/canonicalize.ts                     # both tables
 *   tsx scripts/fare-sync/canonicalize.ts --table fare_imports
 *   tsx scripts/fare-sync/canonicalize.ts --dry-run --limit 20
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { findBestMatch, type GazetteerEntry, type MatchResult } from "./match";

type TableTarget = "fare_imports" | "route_demand_signals" | "both";

interface CanonicalizeOptions {
  dryRun: boolean;
  limit: number | null;
  table: TableTarget;
  /** Threshold below which a match is treated as orphan. */
  threshold: number;
}

function parseArgs(argv: string[]): CanonicalizeOptions {
  const opts: CanonicalizeOptions = {
    dryRun: argv.includes("--dry-run"),
    limit: null,
    table: "both",
    threshold: 0.35,
  };
  const limitIdx = argv.indexOf("--limit");
  if (limitIdx >= 0 && argv[limitIdx + 1]) {
    const n = Number.parseInt(argv[limitIdx + 1], 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`--limit expects a positive integer (got ${argv[limitIdx + 1]})`);
    }
    opts.limit = n;
  }
  const tblIdx = argv.indexOf("--table");
  if (tblIdx >= 0 && argv[tblIdx + 1]) {
    const v = argv[tblIdx + 1];
    if (v !== "fare_imports" && v !== "route_demand_signals" && v !== "both") {
      throw new Error(
        `--table expects fare_imports|route_demand_signals|both (got ${v})`,
      );
    }
    opts.table = v;
  }
  const thrIdx = argv.indexOf("--threshold");
  if (thrIdx >= 0 && argv[thrIdx + 1]) {
    const n = Number.parseFloat(argv[thrIdx + 1]);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      throw new Error(`--threshold expects 0..1 (got ${argv[thrIdx + 1]})`);
    }
    opts.threshold = n;
  }
  return opts;
}

interface Counters {
  processed: number;
  destMatched: number;
  destOrphan: number;
  originMatched: number;
  originOrphan: number;
  promoted: number;
  orphaned: number;
}

function newCounters(): Counters {
  return {
    processed: 0,
    destMatched: 0,
    destOrphan: 0,
    originMatched: 0,
    originOrphan: 0,
    promoted: 0,
    orphaned: 0,
  };
}

async function loadGazetteer(): Promise<GazetteerEntry[]> {
  const { db } = await import("../../server/db");
  const { taxiLocations } = await import("../../shared/schema");
  const rows = await db
    .select({ id: taxiLocations.id, name: taxiLocations.name })
    .from(taxiLocations)
    .where(eq(taxiLocations.isActive, true));
  return rows;
}

async function canonicalizeFareImports(
  gazetteer: GazetteerEntry[],
  opts: CanonicalizeOptions,
): Promise<Counters> {
  const { db } = await import("../../server/db");
  const { fareImports } = await import("../../shared/schema");
  const c = newCounters();

  const pending = await db
    .select()
    .from(fareImports)
    .where(eq(fareImports.status, "pending_canonicalization"))
    .limit(opts.limit ?? 10_000);

  console.log(`[canonicalize] fare_imports: ${pending.length} pending rows`);

  for (const row of pending) {
    c.processed++;
    const originMatch = findBestMatch(row.originRaw, gazetteer, {
      threshold: opts.threshold,
    });
    const destMatch = findBestMatch(row.destinationRaw, gazetteer, {
      threshold: opts.threshold,
    });
    tallyMatch(destMatch, c, "destination");
    tallyMatch(originMatch, c, "origin");

    const nextStatus = destMatch.rankId
      ? "pending_review"
      : "orphan";

    if (destMatch.rankId) c.promoted++;
    else c.orphaned++;

    console.log(
      `  [${row.id.slice(0, 8)}] ` +
        `origin="${row.originRaw ?? ""}" → ${fmtMatch(originMatch)}  ` +
        `dest="${row.destinationRaw}" → ${fmtMatch(destMatch)}  ` +
        `=> ${nextStatus}`,
    );

    if (!opts.dryRun) {
      await db
        .update(fareImports)
        .set({
          originRankId: originMatch.rankId,
          destinationRankId: destMatch.rankId,
          originMatchScore: originMatch.score,
          destinationMatchScore: destMatch.score,
          canonicalizationMethod: combineMethods(originMatch, destMatch),
          canonicalizedAt: new Date(),
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(fareImports.id, row.id));
    }
  }

  return c;
}

async function canonicalizeDemandSignals(
  gazetteer: GazetteerEntry[],
  opts: CanonicalizeOptions,
): Promise<Counters> {
  const { db } = await import("../../server/db");
  const { routeDemandSignals } = await import("../../shared/schema");
  const c = newCounters();

  const pending = await db
    .select()
    .from(routeDemandSignals)
    .where(eq(routeDemandSignals.status, "pending_canonicalization"))
    .limit(opts.limit ?? 10_000);

  console.log(
    `[canonicalize] route_demand_signals: ${pending.length} pending rows`,
  );

  for (const row of pending) {
    c.processed++;
    const originMatch = findBestMatch(row.originRaw, gazetteer, {
      threshold: opts.threshold,
    });
    const destMatch = findBestMatch(row.destinationRaw, gazetteer, {
      threshold: opts.threshold,
    });
    tallyMatch(destMatch, c, "destination");
    tallyMatch(originMatch, c, "origin");

    const nextStatus = destMatch.rankId ? "canonicalized" : "orphan";
    if (destMatch.rankId) c.promoted++;
    else c.orphaned++;

    console.log(
      `  [${row.id.slice(0, 8)}] ` +
        `origin="${row.originRaw ?? ""}" → ${fmtMatch(originMatch)}  ` +
        `dest="${row.destinationRaw}" → ${fmtMatch(destMatch)}  ` +
        `=> ${nextStatus}`,
    );

    if (!opts.dryRun) {
      await db
        .update(routeDemandSignals)
        .set({
          originRankId: originMatch.rankId,
          destinationRankId: destMatch.rankId,
          originMatchScore: originMatch.score,
          destinationMatchScore: destMatch.score,
          canonicalizationMethod: combineMethods(originMatch, destMatch),
          canonicalizedAt: new Date(),
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(routeDemandSignals.id, row.id));
    }
  }

  return c;
}

function tallyMatch(
  m: MatchResult,
  c: Counters,
  field: "origin" | "destination",
): void {
  if (m.method === "empty") return;
  if (field === "destination") {
    if (m.rankId) c.destMatched++;
    else c.destOrphan++;
  } else {
    if (m.rankId) c.originMatched++;
    else c.originOrphan++;
  }
}

function fmtMatch(m: MatchResult): string {
  if (m.method === "empty") return "(empty)";
  const score = m.score === null ? "- " : m.score.toFixed(2);
  return m.rankId
    ? `${m.matchedName} [${m.method}/${score}]`
    : `(orphan, best=${m.matchedName ?? "-"}/${score})`;
}

function combineMethods(a: MatchResult, b: MatchResult): string {
  // e.g. "trigram+exact", "contains+orphan". Most specific method wins
  // when both fields agree; reviewers mostly care about the lower-
  // confidence side.
  const methods = [a.method, b.method].filter((m) => m !== "empty");
  if (methods.length === 0) return "empty";
  return methods.join("+");
}

function logTotals(label: string, c: Counters): void {
  console.log(
    `[canonicalize] ${label}: processed=${c.processed} ` +
      `dest(matched=${c.destMatched},orphan=${c.destOrphan}) ` +
      `origin(matched=${c.originMatched},orphan=${c.originOrphan}) ` +
      `→ promoted=${c.promoted} orphaned=${c.orphaned}`,
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    `[canonicalize] table=${opts.table} dryRun=${opts.dryRun} ` +
      `threshold=${opts.threshold}` +
      (opts.limit ? ` limit=${opts.limit}` : ""),
  );

  const gazetteer = await loadGazetteer();
  console.log(`[canonicalize] gazetteer: ${gazetteer.length} active ranks`);

  if (opts.table === "fare_imports" || opts.table === "both") {
    const c = await canonicalizeFareImports(gazetteer, opts);
    logTotals("fare_imports", c);
  }
  if (opts.table === "route_demand_signals" || opts.table === "both") {
    const c = await canonicalizeDemandSignals(gazetteer, opts);
    logTotals("route_demand_signals", c);
  }

  if (opts.dryRun) {
    console.log("[canonicalize] dry-run complete — no rows updated");
  }
}

main().catch((err) => {
  console.error("[canonicalize] fatal:", err);
  process.exit(1);
});
