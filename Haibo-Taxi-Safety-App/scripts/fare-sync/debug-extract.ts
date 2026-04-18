/**
 * One-shot diagnostic: loads qa_rows[0] from the trial fixture, normalizes
 * it into a FacebookPost, renders the exact user message the extractor
 * would send to Claude, prints it, calls the API, and prints the raw
 * response body. Use this when the harvester returns fares=0 across the
 * board — isolates whether the problem is prompt-rendering vs. model
 * behavior vs. response parsing.
 *
 *   tsx scripts/fare-sync/debug-extract.ts              # row 0
 *   tsx scripts/fare-sync/debug-extract.ts 3            # row 3
 *
 * No DB, no Apify. Requires ANTHROPIC_API_KEY.
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadPromptSpec, DEFAULT_EXTRACTOR_MODEL } from "./extractor";
import type { FacebookPost, FacebookComment } from "./apify-client";

interface QaRowComment {
  comment_id?: string;
  comment_url?: string;
  date?: string;
  author?: string;
  text?: string;
}
interface QaRow {
  post_id?: string;
  post_url?: string;
  post_time?: string;
  post_author?: string;
  post_text?: string;
  top_comments?: QaRowComment[];
}

function normalizeQaRow(row: QaRow): FacebookPost {
  const topComments: FacebookComment[] = (row.top_comments ?? []).map((c) => ({
    id: c.comment_id ?? "",
    text: c.text,
    time: c.date,
    url: c.comment_url,
    user: c.author ? { name: c.author } : undefined,
  }));
  return {
    postId: row.post_id ?? "",
    url: row.post_url ?? "",
    time: row.post_time,
    text: row.post_text,
    user: row.post_author ? { name: row.post_author } : undefined,
    topComments,
  };
}

function renderUserMessage(
  userTemplate: string,
  post: FacebookPost,
  metroHint: string | null,
): string {
  const commentsBlock = (post.topComments ?? [])
    .map((c) => {
      const when = c.time ?? "";
      const who = c.user?.name ?? "user";
      const txt = c.text ?? "";
      return `[${c.id}] (${who} @ ${when}): ${txt}`;
    })
    .join("\n");
  return userTemplate
    .replace("{post_text}", post.text ?? "")
    .replace("{metro_hint_or_null}", metroHint ?? "null")
    .replace(/\{for each comment\}[\s\S]*?\{end for\}/, commentsBlock);
}

async function main() {
  const idx = Number.parseInt(process.argv[2] ?? "0", 10);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set. Source .env first.");
    process.exit(1);
  }

  const fixturePath = path.join(
    __dirname,
    "trial-data",
    "fare-imports-trial-50.json",
  );
  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    qa_rows: QaRow[];
  };
  const row = raw.qa_rows[idx];
  if (!row) {
    console.error(`qa_rows[${idx}] not found (have ${raw.qa_rows.length})`);
    process.exit(1);
  }

  const post = normalizeQaRow(row);
  const spec = loadPromptSpec();
  const userMessage = renderUserMessage(spec.userTemplate, post, null);

  console.log("=== PROMPT VERSION ===");
  console.log(spec.version);
  console.log("=== MODEL ===");
  console.log(DEFAULT_EXTRACTOR_MODEL);
  console.log("=== SYSTEM MESSAGE (first 400 chars) ===");
  console.log(spec.systemMessage.slice(0, 400));
  console.log("=== RENDERED USER MESSAGE ===");
  console.log(userMessage);
  console.log("=== SENDING TO ANTHROPIC ===");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_EXTRACTOR_MODEL,
      max_tokens: 2048,
      system: spec.systemMessage,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  console.log(`HTTP ${res.status} ${res.statusText}`);
  const body = await res.text();
  console.log("=== RAW RESPONSE BODY ===");
  console.log(body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
