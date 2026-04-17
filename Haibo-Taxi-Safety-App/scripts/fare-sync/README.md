# fare-sync — community taxi-fare harvester

Pulls posts from the public SA Facebook group
**"Where can I get a taxi to ?"** (group id `1034488700317989`), extracts
rank-to-rank fares and route-demand signals using Claude, and writes them
to Postgres for the admin review queue and the city-explorer feature.

Pipeline:

```
apify-client.ts  ──▶  extractor.ts  ──▶  redact.ts  ──▶  Postgres
  (Facebook           (Claude Haiku        (PII + hash)       │
   groups scraper)     + prompt MD)                            ├── fare_imports
                                                               └── route_demand_signals
```

Source of truth for the prompt: [`extractor-prompt.md`](./extractor-prompt.md).
Bump its `Version:` header whenever the prompt or target model changes —
the harvester stamps that version on every row, and the dedupe index
includes it so new versions insert fresh rows (never mutate in place).

## Required env vars

All server-side secrets; do **not** prefix with `EXPO_PUBLIC_`.

| Var | Purpose | Required for |
|---|---|---|
| `APIFY_TOKEN` | Calls Apify's `apify/facebook-groups-scraper` actor | live runs |
| `ANTHROPIC_API_KEY` | Calls the Messages API for extraction | all runs except `--trial --dry-run` that skip extraction |
| `DATABASE_URL` | Postgres connection for insert | live runs (not needed with `--dry-run`) |

See [`.env.example`](../../.env.example) for the placeholders.

## Running a harvest

```bash
# Live run: scrape → extract → insert.
tsx scripts/fare-sync/harvest.ts

# Dry run: scrape + extract, skip DB writes (sanity check before a live run).
tsx scripts/fare-sync/harvest.ts --dry-run

# Use a saved trial dataset (scripts/fare-sync/trial-data/...) instead of Apify.
# Great for iterating on the prompt without burning Apify + Anthropic quota.
tsx scripts/fare-sync/harvest.ts --trial --dry-run

# Cap posts processed (first N).
tsx scripts/fare-sync/harvest.ts --trial --limit 5
```

The harvester logs one line per post:

```
[harvest] 3/50 post=1234567890 fares=2 rejected=0 signals=1
```

and a totals line at the end:

```
[harvest] done runId=<uuid> fares=7 rejected=3 signals=42 skipped=1/50
```

## Trial data

Raw Apify output contains unredacted user names + post text and is
**POPIA-sensitive**. It is git-ignored (`scripts/fare-sync/trial-data/`).
A 50-post sample from Apify run `Qpp2sp6VTVmtWxxVY` (dataset
`KpVyuwGsRwMZqYhVB`) is saved at
`trial-data/fare-imports-trial-50.json` for local prompt tuning.

To refresh it: run the Apify actor once, save the dataset JSON there,
and re-run `harvest.ts --trial --dry-run` to verify yields.

## Yield targets (from v0.2 dry run)

- **Fares recall:** 5/5 on the known Q+A fares in the trial batch.
- **Demand signals:** ~49/50 posts in the trial batch (nearly every post
  is a route question; only event announcements + group-management posts
  should produce zero signals).

If a prompt revision drops below those targets the dry-run should fail
loud before you write rows to prod.

## Bumping the extractor version

1. Edit `extractor-prompt.md` — change rules, examples, target model.
2. Update the `**Version:**` line at the top (semver-ish, date-suffixed).
3. Run `tsx scripts/fare-sync/harvest.ts --trial --dry-run` and confirm
   yields still hit target.
4. On the next live run the harvester reads the new version string,
   stamps it on every row, and existing rows remain pinned to their
   old version — no rewrites, clean audit trail.

## Scheduling

Nightly cron (host side, not in-repo yet):

```
0 2 * * *  cd /srv/haibo && tsx scripts/fare-sync/harvest.ts >> /var/log/haibo/harvest.log 2>&1
```

Out of scope for this module: the canonicalizer pass (matches
`origin_raw`/`destination_raw` to the `taxi_locations` gazetteer) and
the admin review UI — both land separately.
