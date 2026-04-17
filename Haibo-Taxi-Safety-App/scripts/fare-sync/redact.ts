/**
 * scripts/fare-sync/redact.ts
 *
 * PII scrubbing + content hashing for the fare-imports harvest pipeline.
 *
 * We store two text values per row: `raw_text_redacted` (human-readable,
 * PII-masked) and `raw_text_hash` (SHA-256 of the *unredacted* original,
 * used as a dedupe fingerprint). The hash is computed before redaction
 * so that identical posts produce identical hashes regardless of how the
 * redaction strategy evolves.
 *
 * POPIA: raw unredacted text never leaves this module. Callers receive
 * only the redacted string + the hash + boolean flags.
 */

import { createHash } from "node:crypto";

// SA phone number patterns — generous enough to catch the common formats
// we see in the Facebook group ("Call 0821234567", "+27 72 123 4567",
// "072-123-4567"). We don't try to be strict about carrier codes because
// the goal is redaction, not validation.
const SA_PHONE_RE =
  /(?:(?:\+?27)|0)[\s\-()]?[6-8][0-9][\s\-()]?[0-9]{3}[\s\-()]?[0-9]{4}\b/g;

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export interface RedactedContent {
  /** PII-masked text safe to store in `raw_text_redacted`. */
  redactedText: string;
  /** SHA-256 hex digest of the *original* (unredacted) text. */
  hash: string;
  containsPhoneNumber: boolean;
  containsEmail: boolean;
}

export function redact(text: string): RedactedContent {
  // Hash the original first so the fingerprint is stable regardless of
  // the redaction strategy we ship today.
  const hash = createHash("sha256").update(text, "utf8").digest("hex");

  const containsPhoneNumber = SA_PHONE_RE.test(text);
  const containsEmail = EMAIL_RE.test(text);
  // Reset regex state — the /g flag makes test() stateful.
  SA_PHONE_RE.lastIndex = 0;
  EMAIL_RE.lastIndex = 0;

  const redactedText = text
    .replace(SA_PHONE_RE, "[REDACTED_PHONE]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]");

  return { redactedText, hash, containsPhoneNumber, containsEmail };
}

/**
 * Hash alone, without redaction. Useful when we just need a fingerprint
 * (e.g. to dedupe demand signals before we've done any PII work).
 */
export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
