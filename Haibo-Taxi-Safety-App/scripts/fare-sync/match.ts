/**
 * scripts/fare-sync/match.ts
 *
 * Pure-JS trigram similarity for canonicalizing extracted rank names
 * ("Bosman rank", "Germiston taxi rank") against the `taxi_locations`
 * gazetteer. Mirrors Postgres `pg_trgm`'s algorithm well enough that we
 * can run it in-memory without relying on the extension being enabled
 * on managed Postgres.
 *
 * Matching strategy, in order:
 *   1. Normalize both strings: lowercase, strip punctuation, collapse
 *      whitespace, drop common suffixes like "taxi rank" / "station".
 *   2. Exact match on normalized form → similarity 1.0.
 *   3. Substring containment → 0.9 (one side is a clean prefix/suffix
 *      of the other — e.g. "Bree" ⊂ "Bree Street Taxi Rank").
 *   4. Trigram Jaccard on padded, normalized strings.
 */

const NOISE_WORDS = new Set([
  "taxi",
  "rank",
  "main",
  "station",
  "terminus",
  "mall",
  "cbd",
  "the",
  "at",
  "of",
]);

/** Lowercase + strip non-alphanumerics + collapse whitespace. */
export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    // strip combining marks (accents) so "é" → "e"
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Drop the NOISE_WORDS so "Bree Street Taxi Rank" ~ "Bree Street". */
export function stripNoise(raw: string): string {
  const words = normalize(raw).split(" ").filter(Boolean);
  const kept = words.filter((w) => !NOISE_WORDS.has(w));
  // If we stripped everything (e.g. "Taxi Rank" alone), keep the
  // original words so we don't produce an empty key.
  return kept.length > 0 ? kept.join(" ") : words.join(" ");
}

/**
 * Build the trigram set for a string. Pads with two leading and one
 * trailing space, matching pg_trgm's convention so "bree" and "a bree"
 * share boundary trigrams.
 */
export function trigrams(text: string): Set<string> {
  const padded = `  ${text} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Jaccard similarity over trigram sets: |A∩B| / |A∪B|. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const g of ta) if (tb.has(g)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface GazetteerEntry {
  id: string;
  name: string;
}

export interface MatchResult {
  /** Best-matching gazetteer id, or null if below threshold. */
  rankId: string | null;
  /** 0..1 score. Null when no entries were searched. */
  score: number | null;
  /** "exact" | "contains" | "trigram" | "orphan" | "empty" */
  method: "exact" | "contains" | "trigram" | "orphan" | "empty";
  /** Name of the matched entry — handy for logs. */
  matchedName: string | null;
}

export interface MatchOptions {
  /** Score below which we call it orphan. Default 0.35 — tuned for the 264-row SA gazetteer. */
  threshold?: number;
}

const DEFAULT_THRESHOLD = 0.35;

/**
 * Find the best gazetteer match for a raw rank/locality string. Returns
 * an orphan result (rankId=null, method="orphan") when the top score
 * falls below `threshold` so the caller can still store the raw string
 * for admin review.
 */
export function findBestMatch(
  raw: string | null | undefined,
  gazetteer: GazetteerEntry[],
  opts: MatchOptions = {},
): MatchResult {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  if (!raw || !raw.trim()) {
    return { rankId: null, score: null, method: "empty", matchedName: null };
  }
  if (gazetteer.length === 0) {
    return { rankId: null, score: null, method: "empty", matchedName: null };
  }

  const rawStripped = stripNoise(raw);
  const rawNormal = normalize(raw);

  // Pass 1: exact match on stripped form.
  for (const entry of gazetteer) {
    if (stripNoise(entry.name) === rawStripped && rawStripped.length > 0) {
      return {
        rankId: entry.id,
        score: 1.0,
        method: "exact",
        matchedName: entry.name,
      };
    }
  }

  // Pass 2: substring containment on stripped form. Requires the
  // shorter side to be at least 3 characters so "at" / "of" don't
  // trigger false positives.
  for (const entry of gazetteer) {
    const entryStripped = stripNoise(entry.name);
    if (entryStripped.length < 3 || rawStripped.length < 3) continue;
    if (
      entryStripped.includes(rawStripped) ||
      rawStripped.includes(entryStripped)
    ) {
      return {
        rankId: entry.id,
        score: 0.9,
        method: "contains",
        matchedName: entry.name,
      };
    }
  }

  // Pass 3: trigram Jaccard — compare *both* the stripped and full
  // normalized forms and take the max. This handles cases where the
  // noise-stripping hurts ("MTN" alone has no trigrams against
  // "MTN Taxi Rank" after stripping).
  let bestScore = 0;
  let bestEntry: GazetteerEntry | null = null;
  for (const entry of gazetteer) {
    const entryStripped = stripNoise(entry.name);
    const entryNormal = normalize(entry.name);
    const score = Math.max(
      trigramSimilarity(rawStripped, entryStripped),
      trigramSimilarity(rawNormal, entryNormal),
    );
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= threshold) {
    return {
      rankId: bestEntry.id,
      score: bestScore,
      method: "trigram",
      matchedName: bestEntry.name,
    };
  }

  return {
    rankId: null,
    score: bestScore,
    method: "orphan",
    matchedName: bestEntry?.name ?? null,
  };
}
