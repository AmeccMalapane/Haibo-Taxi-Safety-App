/**
 * scripts/fare-sync/apify-client.ts
 *
 * Thin wrapper around the Apify REST API for the
 * `apify/facebook-groups-scraper` actor.
 *
 * We deliberately use `fetch` (Node 20+) and skip the official
 * `apify-client` package — this keeps the server bundle light and the
 * surface area we touch tiny (start run → poll → fetch items).
 *
 * Secrets: requires APIFY_TOKEN in the environment. Server-only; the
 * caller is responsible for loading .env before constructing the client.
 */

const APIFY_API_BASE = "https://api.apify.com/v2";
// Actor slug uses `~` in the URL path, not `/`.
const ACTOR_SLUG = "apify~facebook-groups-scraper";

/** Shape of a single post in the scraper's dataset output. */
export interface FacebookPost {
  /** Unique post id within the group (URL path segment). */
  postId: string;
  /** Permanent URL to the post. */
  url: string;
  /** ISO timestamp string. */
  time?: string;
  /** Post body. */
  text?: string;
  /** Author name — retained only in memory, never written to the DB raw. */
  user?: { id?: string; name?: string };
  /** Top-level comments on the post. */
  topComments?: FacebookComment[];
  /** Facebook group id (should match the group we scraped). */
  groupId?: string;
  [key: string]: unknown;
}

export interface FacebookComment {
  /** Comment id. For the extractor's `source_comment_id`. */
  id: string;
  text?: string;
  time?: string;
  user?: { id?: string; name?: string };
  /** Permalink to the comment itself, if scraped. */
  url?: string;
  [key: string]: unknown;
}

export interface ApifyRunInput {
  /** Facebook group URLs to scrape. */
  startUrls: Array<{ url: string }>;
  /** Max posts per run (bounded to stay under Apify's daily quota). */
  resultsLimit?: number;
  /** Max comments per post. */
  commentsPerPost?: number;
}

export interface ApifyClientOptions {
  token: string;
  /** Override for testing. Defaults to Apify prod. */
  apiBase?: string;
}

export class ApifyClient {
  private readonly token: string;
  private readonly apiBase: string;

  constructor(opts: ApifyClientOptions) {
    if (!opts.token) {
      throw new Error("ApifyClient: token required");
    }
    this.token = opts.token;
    this.apiBase = opts.apiBase ?? APIFY_API_BASE;
  }

  /**
   * Run the scraper synchronously and return the dataset items once the
   * run completes. Blocks for up to ~5 minutes (Apify default) — fine
   * for a nightly cron; for longer runs we'd switch to start+poll.
   */
  async runSync(input: ApifyRunInput): Promise<FacebookPost[]> {
    const url = `${this.apiBase}/acts/${ACTOR_SLUG}/run-sync-get-dataset-items?token=${encodeURIComponent(this.token)}&format=json`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Apify run-sync failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`,
      );
    }
    const items = (await res.json()) as FacebookPost[];
    if (!Array.isArray(items)) {
      throw new Error(
        `Apify run-sync returned non-array payload (got ${typeof items})`,
      );
    }
    return items;
  }

  /**
   * Fetch items from a known dataset id — used for re-ingesting a prior
   * run without paying for the scrape again. Useful during trial-data
   * iteration and for backfills.
   */
  async fetchDataset(datasetId: string): Promise<FacebookPost[]> {
    const url = `${this.apiBase}/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(this.token)}&format=json&clean=true`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Apify fetchDataset failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`,
      );
    }
    const items = (await res.json()) as FacebookPost[];
    if (!Array.isArray(items)) {
      throw new Error(
        `Apify fetchDataset returned non-array payload (got ${typeof items})`,
      );
    }
    return items;
  }
}

/**
 * Convenience factory: reads APIFY_TOKEN from the environment and
 * throws if missing. Intended entry point for the harvester.
 */
export function apifyClientFromEnv(): ApifyClient {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error(
      "APIFY_TOKEN missing — set it in .env (see .env.example). " +
        "Server-only secret; do NOT prefix with EXPO_PUBLIC_.",
    );
  }
  return new ApifyClient({ token });
}
