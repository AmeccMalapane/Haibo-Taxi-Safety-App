/**
 * scripts/fare-sync/harvest.ts
 *
 * Main orchestrator for the fare-imports pipeline.
 *
 *   Apify (Facebook group scrape) -> Claude extractor -> Postgres
 *
 * Two output tables:
 *   - `fare_imports`         — one row per fare-bearing comment, reviewed.
 *   - `route_demand_signals` — one row per route-question post, aggregated.
 *
 * Usage:
 *   tsx scripts/fare-sync/harvest.ts             # run live against Apify
 *   tsx scripts/fare-sync/harvest.ts --dry-run   # call extractor, skip DB writes
 *   tsx scripts/fare-sync/harvest.ts --trial     # use trial-data/*.json, no Apify
 *   tsx scripts/fare-sync/harvest.ts --limit 5   # cap posts processed
 *
 * Secrets required in .env: APIFY_TOKEN, ANTHROPIC_API_KEY, DATABASE_URL.
 * In --dry-run or --trial mode, DATABASE_URL is not required.
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

import {
  apifyClientFromEnv,
  type FacebookPost,
  type FacebookComment,
} from "./apify-client";
import {
  extractorFromEnv,
  DEFAULT_EXTRACTOR_MODEL,
  type ExtractionResult,
  type FareExtractor,
} from "./extractor";
import { redact } from "./redact";

// Kept in sync with the group id referenced by scripts/fb-sync + schema docs.
const GROUP_ID = "1034488700317989";
const GROUP_URL = `https://www.facebook.com/groups/${GROUP_ID}`;

interface HarvestOptions {
  dryRun: boolean;
  trial: boolean;
  limit: number | null;
  trialDataPath: string;
}

function parseArgs(argv: string[]): HarvestOptions {
  const opts: HarvestOptions = {
    dryRun: argv.includes("--dry-run"),
    trial: argv.includes("--trial"),
    limit: null,
    trialDataPath: path.join(
      __dirname,
      "trial-data",
      "fare-imports-trial-50.json",
    ),
  };
  const limitIdx = argv.indexOf("--limit");
  if (limitIdx >= 0 && argv[limitIdx + 1]) {
    const n = Number.parseInt(argv[limitIdx + 1], 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`--limit expects a positive integer (got ${argv[limitIdx + 1]})`);
    }
    opts.limit = n;
  }
  return opts;
}

// --- Trial-fixture normalization -------------------------------------------
// The curated trial dataset stores two slices with different field shapes
// from what the extractor expects:
//  - all_posts: Apify-raw posts (id, text, …) with no nested comments
//  - qa_rows:   Q+A threads in snake_case (post_id, top_comments[].author, …)
// We normalize both into FacebookPost so the rest of the pipeline sees the
// same contract regardless of source.

interface QaRowComment {
  comment_id?: string;
  comment_url?: string;
  date?: string;
  author?: string;
  text?: string;
  likes?: number;
  threading_depth?: number;
}

interface QaRow {
  post_id?: string;
  post_legacy_id?: string;
  post_url?: string;
  post_time?: string;
  post_author?: string;
  post_text?: string;
  comments_count?: number;
  top_comments?: QaRowComment[];
}

interface ApifyRawPost {
  id?: string;
  legacyId?: string;
  feedbackId?: string;
  url?: string;
  facebookUrl?: string;
  time?: string;
  text?: string;
  user?: { id?: string; name?: string };
}

function normalizeQaRow(row: QaRow): FacebookPost {
  const topComments: FacebookComment[] = (row.top_comments ?? []).map(
    (c) => ({
      id: c.comment_id ?? "",
      text: c.text,
      time: c.date,
      url: c.comment_url,
      user: c.author ? { name: c.author } : undefined,
    }),
  );
  return {
    postId: row.post_id ?? row.post_legacy_id ?? "",
    url: row.post_url ?? "",
    time: row.post_time,
    text: row.post_text,
    user: row.post_author ? { name: row.post_author } : undefined,
    topComments,
  };
}

function normalizeApifyRawPost(raw: ApifyRawPost): FacebookPost {
  return {
    postId: raw.id ?? raw.legacyId ?? raw.feedbackId ?? "",
    url: raw.url ?? raw.facebookUrl ?? "",
    time: raw.time,
    text: raw.text,
    user: raw.user,
    topComments: [],
  };
}

async function loadPosts(opts: HarvestOptions): Promise<FacebookPost[]> {
  if (opts.trial) {
    if (!fs.existsSync(opts.trialDataPath)) {
      throw new Error(
        `--trial mode: trial data not found at ${opts.trialDataPath}. ` +
          `Run the Apify actor once and save the dataset there.`,
      );
    }
    const raw = fs.readFileSync(opts.trialDataPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    // The trial file can be:
    //  - a bare array of already-shaped FacebookPost objects
    //  - {posts: [...]} — already-shaped
    //  - {qa_rows: [...]} — the curated Q+A ground-truth set with
    //    snake_case field names (post_id, post_text, top_comments[], …).
    //    This is the primary smoke-test input: 14 hand-picked threads
    //    that exercise the comment-answered-fare extraction path.
    //  - {all_posts: [...]} — the full 50-post dump in Apify's raw shape
    //    (id, text, user, but NO nested comments). Falls through as a
    //    last resort when qa_rows is absent; won't exercise Q+A logic
    //    but will at least validate post-body extraction and PII redaction.
    const parsedObj = parsed as {
      posts?: FacebookPost[];
      qa_rows?: QaRow[];
      all_posts?: ApifyRawPost[];
    };
    if (Array.isArray(parsed)) return parsed as FacebookPost[];
    if (parsedObj.posts && parsedObj.posts.length) return parsedObj.posts;
    if (parsedObj.qa_rows && parsedObj.qa_rows.length) {
      return parsedObj.qa_rows.map(normalizeQaRow);
    }
    if (parsedObj.all_posts && parsedObj.all_posts.length) {
      return parsedObj.all_posts.map(normalizeApifyRawPost);
    }
    return [];
  }
  const apify = apifyClientFromEnv();
  return apify.runSync({
    startUrls: [{ url: GROUP_URL }],
    resultsLimit: 50,
    commentsPerPost: 20,
  });
}

interface PostOutcome {
  postId: string;
  fares: number;
  rejected: number;
  demandSignals: number;
  skipped: boolean;
  reason?: string;
}

async function processPost(
  post: FacebookPost,
  extractor: FareExtractor,
  runId: string,
  opts: HarvestOptions,
): Promise<PostOutcome> {
  if (!post.postId || !post.text) {
    return {
      postId: post.postId ?? "?",
      fares: 0,
      rejected: 0,
      demandSignals: 0,
      skipped: true,
      reason: "missing postId or text",
    };
  }

  let result: ExtractionResult;
  try {
    result = await extractor.extract(post);
  } catch (err) {
    return {
      postId: post.postId,
      fares: 0,
      rejected: 0,
      demandSignals: 0,
      skipped: true,
      reason: `extractor error: ${(err as Error).message}`,
    };
  }

  const fares = result.fare_imports.filter(
    (f) => f.status_hint === "pending_canonicalization",
  ).length;
  const rejected = result.fare_imports.filter(
    (f) => f.status_hint === "rejected",
  ).length;
  const demandSignals = result.route_demand_signals.length;

  if (!opts.dryRun) {
    await writeRows(post, result, extractor, runId);
  }

  return {
    postId: post.postId,
    fares,
    rejected,
    demandSignals,
    skipped: false,
  };
}

async function writeRows(
  post: FacebookPost,
  result: ExtractionResult,
  extractor: FareExtractor,
  runId: string,
): Promise<void> {
  // Lazy-import DB to keep --dry-run and --trial modes from requiring
  // DATABASE_URL or loading pg until we actually need to write.
  const { db } = await import("../../server/db");
  const { fareImports, routeDemandSignals } = await import(
    "../../shared/schema"
  );

  const postText = post.text ?? "";
  const { redactedText, hash, containsPhoneNumber, containsEmail } =
    redact(postText);
  const extractorVersion = extractor.promptSpec.version;
  const now = new Date();

  // One fare row per emitted fare record. Use the comment id as part of
  // the dedupe tuple so two commenters on the same post → two rows.
  for (const f of result.fare_imports) {
    const status =
      f.status_hint === "rejected" ? "rejected" : "pending_canonicalization";
    await db
      .insert(fareImports)
      .values({
        source: "facebook_group",
        sourceRef: GROUP_ID,
        sourcePostId: post.postId,
        sourcePostUrl: post.url ?? null,
        sourceCommentId: f.source_comment_id ?? null,
        sourceCommentUrl: commentUrl(post, f.source_comment_id),
        postTimestamp: post.time ? new Date(post.time) : null,
        harvesterRunId: runId,
        harvesterTool: "apify",
        rawTextRedacted: redactedText,
        rawTextHash: hash,
        containsPhoneNumber,
        containsEmail,
        languageDetected: null,
        extractorVersion,
        extractorModel: DEFAULT_EXTRACTOR_MODEL,
        extractedAt: now,
        originRaw: f.origin_raw,
        destinationRaw: f.destination_raw,
        fareZar: f.fare_zar,
        metroHint: f.metro_hint,
        confidence: f.confidence,
        evidenceQuote: f.evidence_quote,
        extractionNotes: f.extraction_notes,
        status,
        rejectionReason: f.rejection_reason,
      })
      .onConflictDoNothing();
  }

  // At most one demand signal per post. Re-harvesting same post under
  // same extractor version is a no-op (index handles it).
  for (const d of result.route_demand_signals) {
    await db
      .insert(routeDemandSignals)
      .values({
        source: "facebook_group",
        sourceRef: GROUP_ID,
        sourcePostId: post.postId,
        sourcePostUrl: post.url ?? null,
        postTimestamp: post.time ? new Date(post.time) : null,
        harvesterRunId: runId,
        harvesterTool: "apify",
        rawTextRedacted: redactedText,
        rawTextHash: hash,
        languageDetected: null,
        extractorVersion,
        extractorModel: DEFAULT_EXTRACTOR_MODEL,
        extractedAt: now,
        originRaw: d.origin_raw,
        destinationRaw: d.destination_raw,
        metroHint: d.metro_hint,
        confidence: d.confidence,
        evidenceQuote: d.evidence_quote,
        extractionNotes: d.extraction_notes,
        status: "pending_canonicalization",
      })
      .onConflictDoNothing();
  }
}

function commentUrl(post: FacebookPost, commentId: string | null): string | null {
  if (!commentId || !post.url) return null;
  const c = post.topComments?.find((x) => x.id === commentId);
  return c?.url ?? null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const runId = randomUUID();

  console.log(
    `[harvest] runId=${runId} dryRun=${opts.dryRun} trial=${opts.trial}` +
      (opts.limit ? ` limit=${opts.limit}` : ""),
  );

  let posts = await loadPosts(opts);
  if (opts.limit) posts = posts.slice(0, opts.limit);
  console.log(`[harvest] loaded ${posts.length} posts`);

  const extractor = extractorFromEnv();
  console.log(
    `[harvest] extractor v=${extractor.promptSpec.version} model=${DEFAULT_EXTRACTOR_MODEL}`,
  );

  const outcomes: PostOutcome[] = [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const outcome = await processPost(post, extractor, runId, opts);
    outcomes.push(outcome);
    console.log(
      `[harvest] ${i + 1}/${posts.length} post=${outcome.postId} ` +
        `fares=${outcome.fares} rejected=${outcome.rejected} ` +
        `signals=${outcome.demandSignals}` +
        (outcome.skipped ? ` SKIPPED (${outcome.reason})` : ""),
    );
  }

  const totals = outcomes.reduce(
    (acc, o) => ({
      fares: acc.fares + o.fares,
      rejected: acc.rejected + o.rejected,
      signals: acc.signals + o.demandSignals,
      skipped: acc.skipped + (o.skipped ? 1 : 0),
    }),
    { fares: 0, rejected: 0, signals: 0, skipped: 0 },
  );

  console.log(
    `[harvest] done runId=${runId} ` +
      `fares=${totals.fares} rejected=${totals.rejected} ` +
      `signals=${totals.signals} skipped=${totals.skipped}/${posts.length}` +
      (opts.dryRun ? " (dry-run, nothing written)" : ""),
  );
}

main().catch((err) => {
  console.error("[harvest] fatal:", err);
  process.exit(1);
});
