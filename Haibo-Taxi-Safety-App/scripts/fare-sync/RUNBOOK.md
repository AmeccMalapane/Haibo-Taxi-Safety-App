# fare-sync — end-to-end smoke-test runbook

Goal: walk the entire pipeline in one sitting, against real Apify data but
with every stop-gate intact, and confirm nothing regressed. Use this before
every production harvest and whenever the extractor prompt is bumped.

Total time: ~25 minutes on the happy path. Budget another 30 minutes if
anything drifts and you need to re-iterate the prompt.

## 0. Prerequisites

You should already have:

- a working local checkout with `pnpm install` (or `npm install`) run
- Postgres running and `DATABASE_URL` set — Drizzle migrations already
  applied (`pnpm drizzle:push` or the equivalent)
- the three secrets listed in `scripts/fare-sync/README.md` set in `.env`:
  `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `DATABASE_URL`
- admin login to the Command Center (`pnpm --filter haibo-command-center
  dev` on :5173) with an admin-role account

Quick check:

```bash
# Confirm Postgres is reachable and fare_imports exists.
psql "$DATABASE_URL" -c "\\d fare_imports" | head -5

# Confirm Claude key works.
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' \
  | head -1
```

If either of those fails — stop here and fix the env before spending
Apify quota.

## 1. Extractor dry-run against saved trial data

This burns zero Apify quota. It re-reads `trial-data/*.json` from disk,
sends each post to Claude, and prints the structured extraction. Any
hallucination or prompt regression surfaces here before you touch live data.

```bash
tsx scripts/fare-sync/harvest.ts --trial --dry-run
```

Expected: one JSON block per trial post, with `fares[]` and
`demandSignals[]` arrays. If any of the 5 known fares are missing from the
output, **do not proceed** — the prompt regressed. Iterate on
`extractor-prompt.md`, bump its `Version:` header, and rerun.

Pass criteria:
- at least 5 fare rows extracted across the trial fixtures
- each fare has a non-empty `evidenceQuote` that appears verbatim in the source post or one of its comments
- no `originRaw` or `destinationRaw` contains a phone number, email, or personal name (the extractor's guardrail — if these leak, the prompt's redaction instructions drifted)

## 2. Canonicalizer dry-run

The canonicalizer reads the `pending_canonicalization` rows and matches
their raw origin/destination strings against `taxi_locations` using
trigram similarity. Dry-run mode prints the matches without writing:

```bash
tsx scripts/fare-sync/canonicalize.ts --dry-run
```

This only makes sense after step 3+ has actually inserted rows. On a
greenfield DB it's a no-op. Skip to step 3.

## 3. Live Apify harvest (dry-run on the DB side)

This pulls fresh posts from the Facebook group through Apify but does
NOT insert into Postgres. It's the best single integration test:

```bash
tsx scripts/fare-sync/harvest.ts --dry-run
```

Budget: ~3 minutes, ~$0.30 of Apify compute, ~$0.05 of Claude.

Pass criteria:
- harvest completes without errors
- at least one `fares[]` extraction surfaces in the log
- PII redactor log line shows `phoneMatches: N, emailMatches: M` counts (not an error)

## 4. Live harvest — commit to DB

```bash
tsx scripts/fare-sync/harvest.ts
```

Same as step 3 but with writes enabled. New rows land in:
- `fare_imports` with status `pending_canonicalization`
- `route_demand_signals` with status `pending_canonicalization`

Verify:

```bash
psql "$DATABASE_URL" -c "
  SELECT status, count(*) FROM fare_imports GROUP BY status;
  SELECT status, count(*) FROM route_demand_signals GROUP BY status;
"
```

Both should show the fresh batch under `pending_canonicalization`.

## 5. Canonicalize

```bash
tsx scripts/fare-sync/canonicalize.ts --dry-run   # preview matches
tsx scripts/fare-sync/canonicalize.ts             # commit
```

After it runs, `fare_imports.status` transitions to either:
- `pending_review` — both origin and destination matched a known rank
- `orphan` — destination never matched (admin decides: override or reject)

```bash
psql "$DATABASE_URL" -c "
  SELECT status, count(*) FROM fare_imports GROUP BY status;
"
```

## 6. Admin review in the Command Center

```bash
pnpm --filter haibo-command-center dev
```

Open http://localhost:5173/admin and sign in. Navigate to
**Moderation → Fare imports**. You should see:
- the pending_review rows in the default tab
- a bucket count badge on each tab
- a source `post` / `comment` link on each row that opens the Facebook thread

Spot-check at least 3 rows:
1. Click **Approve** — confirm the approve drawer shows the evidence quote, amount override pre-filled from extraction, and that submitting writes a fresh `taxi_fares` row. Verify the taxi_fares row appears in `/admin/fares`.
2. Click **Reject** on another row with an obvious extractor hallucination. Reason lands in `fare_imports.rejection_reason` and the audit log.
3. Click **Dupe** on a row that restates an already-approved fare.

## 7. Demand-signal aggregation

The aggregation endpoint is wired to
`GET /api/admin/demand-signals?metro=JHB&windowDays=30`. Quick curl:

```bash
curl -s \
  -H "Authorization: Bearer $CC_TOKEN" \
  "$API_URL/api/admin/demand-signals?windowDays=30&limit=20" \
  | jq '.data[0:5]'
```

Where `$CC_TOKEN` is the admin JWT (pull it from localStorage
`haibo_cc_token` on the Command Center tab). Expected: one row per
(origin, destination, metro) tuple with a `count`, `lastSeenAt`, and
sample `evidenceQuote`.

## 8. Rollback

If something goes sideways mid-run:

```sql
-- Quick visibility into what's outstanding
SELECT status, count(*) FROM fare_imports GROUP BY status;

-- Hard reset of a single run (e.g. harvester_run_id from the log)
UPDATE fare_imports SET status = 'rejected', rejection_reason = 'smoke-test rollback'
WHERE harvester_run_id = 'RUN_ID_HERE' AND status IN ('pending_review', 'orphan', 'pending_canonicalization');
```

Never `DELETE` — the POPIA retention audit trail assumes we soft-transition
to a terminal status instead.

## 9. Post-run checklist

- [ ] No rows stuck in `pending_extraction` (retry manually if so)
- [ ] `rawTextRedacted` column has no phone numbers or emails in any new row — spot-check three
- [ ] At least 70% of extracted fares canonicalized (pending_review), not orphaned
- [ ] Command Center admin review loads without errors
- [ ] `taxi_fares` table actually grew by the number of approved rows
