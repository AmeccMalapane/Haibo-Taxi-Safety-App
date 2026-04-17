/**
 * scripts/fare-sync/extractor.ts
 *
 * Calls the Anthropic Messages API with the fare-extractor prompt and
 * parses the JSON response into typed records. The prompt itself lives
 * in `extractor-prompt.md` — this module is the thin code wrapper that
 * turns one {post, comments[]} tuple into {fare_imports[], route_demand_signals[]}.
 *
 * Version discipline: we parse the `Version:` line at the top of the
 * prompt MD file and stamp it on every emitted record. Bump the version
 * in the MD file whenever the prompt or target model changes; the
 * harvester will then insert new rows instead of overwriting old ones.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { FacebookComment, FacebookPost } from "./apify-client";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

/** Default model. The prompt is tuned for haiku — keep them in sync. */
export const DEFAULT_EXTRACTOR_MODEL = "claude-haiku-4-5";

export interface ExtractorPromptSpec {
  /** e.g. "v0.2.0-qa-facebook-2026-04-17" */
  version: string;
  /** Target model string (from the prompt header). */
  targetModel: string;
  /** The blockquoted system message. */
  systemMessage: string;
  /** Raw user-message template text (with `{post_text}` etc. placeholders). */
  userTemplate: string;
}

/** Load and parse `extractor-prompt.md`. Throws on malformed input. */
export function loadPromptSpec(promptPath?: string): ExtractorPromptSpec {
  const filePath = promptPath ?? path.join(__dirname, "extractor-prompt.md");
  const raw = fs.readFileSync(filePath, "utf8");

  const version = matchLine(raw, /\*\*Version:\*\*\s*`([^`]+)`/);
  const targetModel = matchLine(raw, /\*\*Target model:\*\*\s*`([^`]+)`/);

  // System message: contents of the blockquote under `## System message`.
  const sysBlock = section(raw, "## System message", "## User message template");
  // Strip leading `> ` from each line.
  const systemMessage = sysBlock
    .split("\n")
    .map((ln) => ln.replace(/^>\s?/, ""))
    .join("\n")
    .trim();

  // User template: the first fenced code block under `## User message template`.
  const tplSection = section(raw, "## User message template", "## Output schema");
  const tplMatch = tplSection.match(/```([\s\S]*?)```/);
  if (!tplMatch) {
    throw new Error(
      `extractor-prompt.md: couldn't find fenced user-template block (looked in section under "## User message template").`,
    );
  }
  const userTemplate = tplMatch[1].replace(/^\w*\n/, "").trim();

  return { version, targetModel, systemMessage, userTemplate };
}

function matchLine(haystack: string, re: RegExp): string {
  const m = haystack.match(re);
  if (!m) {
    throw new Error(
      `extractor-prompt.md: expected header matching ${re.toString()} not found`,
    );
  }
  return m[1];
}

function section(haystack: string, start: string, end: string): string {
  const i = haystack.indexOf(start);
  if (i < 0) {
    throw new Error(`extractor-prompt.md: missing section "${start}"`);
  }
  const j = haystack.indexOf(end, i + start.length);
  if (j < 0) {
    throw new Error(
      `extractor-prompt.md: missing terminator "${end}" after "${start}"`,
    );
  }
  return haystack.slice(i + start.length, j);
}

// --- Extraction output types ---

export type FareConfidence = "high" | "medium" | "low";
export type FareStatusHint = "pending_canonicalization" | "rejected";

export interface ExtractedFare {
  source_comment_id: string | null;
  origin_raw: string | null;
  destination_raw: string;
  fare_zar: number | null;
  metro_hint: string | null;
  confidence: FareConfidence;
  evidence_quote: string;
  extraction_notes: string;
  status_hint: FareStatusHint;
  rejection_reason: string | null;
}

export interface ExtractedDemandSignal {
  origin_raw: string | null;
  destination_raw: string;
  metro_hint: string | null;
  confidence: FareConfidence;
  evidence_quote: string;
  extraction_notes: string;
}

export interface ExtractionResult {
  fare_imports: ExtractedFare[];
  route_demand_signals: ExtractedDemandSignal[];
}

// --- Extractor client ---

export interface ExtractorOptions {
  apiKey: string;
  model?: string;
  promptSpec: ExtractorPromptSpec;
  /** Upper bound on output tokens per call. 2k is plenty for the shape. */
  maxTokens?: number;
  /** Override for tests. */
  apiUrl?: string;
}

export class FareExtractor {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly apiUrl: string;
  readonly promptSpec: ExtractorPromptSpec;

  constructor(opts: ExtractorOptions) {
    if (!opts.apiKey) {
      throw new Error("FareExtractor: apiKey required");
    }
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_EXTRACTOR_MODEL;
    this.maxTokens = opts.maxTokens ?? 2048;
    this.apiUrl = opts.apiUrl ?? ANTHROPIC_API_URL;
    this.promptSpec = opts.promptSpec;
  }

  /** Format the user message for a single post. */
  private renderUserMessage(
    post: FacebookPost,
    metroHint: string | null,
  ): string {
    const commentsBlock = (post.topComments ?? [])
      .map((c) => formatComment(c))
      .join("\n");

    return this.promptSpec.userTemplate
      .replace("{post_text}", post.text ?? "")
      .replace("{metro_hint_or_null}", metroHint ?? "null")
      .replace(/\{for each comment\}[\s\S]*?\{end for\}/, commentsBlock);
  }

  /**
   * Extract structured output for one post. Returns empty arrays on a
   * non-extractable post; throws on API/parse errors so the caller
   * can decide whether to skip or abort the batch.
   */
  async extract(
    post: FacebookPost,
    opts: { metroHint?: string | null } = {},
  ): Promise<ExtractionResult> {
    const userMessage = this.renderUserMessage(post, opts.metroHint ?? null);

    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.promptSpec.systemMessage,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Anthropic API error: ${res.status} ${res.statusText} ${body.slice(0, 500)}`,
      );
    }

    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (payload.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!)
      .join("")
      .trim();

    if (!text) {
      throw new Error("Anthropic API returned no text content");
    }

    return parseExtractorOutput(text);
  }
}

/**
 * Parse the extractor's JSON response. The prompt asks the model to
 * emit a JSON object with `fare_imports` and `route_demand_signals`
 * arrays. We strip any accidental prose/fencing and validate shape.
 */
export function parseExtractorOutput(raw: string): ExtractionResult {
  // The prompt forbids fences but models slip sometimes — unwrap if present.
  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch (err) {
    throw new Error(
      `Extractor output was not valid JSON: ${(err as Error).message}\n---\n${unfenced.slice(0, 500)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      `Extractor output must be an object with fare_imports + route_demand_signals arrays (got ${typeof parsed})`,
    );
  }

  const obj = parsed as Record<string, unknown>;
  const fare_imports = Array.isArray(obj.fare_imports)
    ? (obj.fare_imports as ExtractedFare[])
    : [];
  const route_demand_signals = Array.isArray(obj.route_demand_signals)
    ? (obj.route_demand_signals as ExtractedDemandSignal[])
    : [];
  return { fare_imports, route_demand_signals };
}

function formatComment(c: FacebookComment): string {
  const when = c.time ?? "";
  const who = c.user?.name ?? "user";
  const txt = c.text ?? "";
  return `[${c.id}] (${who} @ ${when}): ${txt}`;
}

/**
 * Convenience: construct an extractor from environment variables.
 * Throws loudly if either ANTHROPIC_API_KEY or the prompt file is
 * missing so launch-day typos don't silently degrade to empty batches.
 */
export function extractorFromEnv(
  overrides: Partial<ExtractorOptions> = {},
): FareExtractor {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY missing — set it in .env (see .env.example). " +
        "Server-only secret; do NOT prefix with EXPO_PUBLIC_.",
    );
  }
  const promptSpec = overrides.promptSpec ?? loadPromptSpec();
  return new FareExtractor({ apiKey, promptSpec, ...overrides });
}
