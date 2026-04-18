-- Migration 0005: fare_imports + route_demand_signals
--
-- Landing tables for the fare-sync pipeline (scripts/fare-sync/*).
--
--   fare_imports        — candidate fares harvested from external sources
--                         (initially the "Where can I get a taxi to ?"
--                         Facebook group). Approve-gated: rows here do
--                         NOT appear in the rider app until an admin
--                         reviews them in the Command Center. Deliberate
--                         divergence from the reactive-moderation norm
--                         because a wrong R80 fare causes rank arguments,
--                         so the small review cost is warranted.
--
--   route_demand_signals — companion table capturing the *route intent*
--                         of every fare-question post, regardless of
--                         whether any comment supplied a price. Feeds
--                         the city-explorer "most-asked routes" feature.
--                         NOT approve-gated — aggregated counts, not
--                         individually shown.
--
-- Canonicalizer (scripts/fare-sync/canonicalize.ts) matches the raw
-- origin/destination strings against taxi_locations via trigram
-- similarity after insert. origin_rank_id / destination_rank_id are
-- opportunistic FKs (many community posts reference informal pickup
-- points with no rank row) — no REFERENCES constraint, matching the
-- convention used by taxi_fares above.
--
-- POPIA:
--   * raw_text_redacted has SA phones + emails stripped before insert
--     (scripts/fare-sync/redact.ts). Original text never persists.
--   * raw_text_hash is sha256 of the original pre-redaction text — used
--     to detect edits to posts we've already ingested without retaining
--     the PII.
--   * raw_text_redacted should be nulled once status reaches a terminal
--     state (approved/rejected/duplicate). Handled by the approve flow,
--     not a DB constraint.
--
-- Dedupe key for fare_imports: (source, source_ref, source_post_id,
--   source_comment_id, extractor_version). A single post can legitimately
--   produce multiple rows when multiple comments each answer with a
--   different rank+fare. Re-harvesting under the same extractor version
--   is a no-op; re-extracting with a new version inserts fresh rows and
--   supersedes the old ones (never mutate in place).
--
-- Dedupe key for route_demand_signals: (source, source_ref,
--   source_post_id, extractor_version). Keyed at post level, not comment.
--
-- Safe on live data: two new tables, no FKs or backfills, indexes
-- created inline. No impact on existing traffic — the fare-sync
-- harvester is the only writer and is not yet scheduled.
-- Rollback: see `0005_fare_imports_down.sql`.

BEGIN;

-- ------------------------------------------------------------------
-- fare_imports
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fare_imports (
  id                        varchar       PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provenance
  source                    text          NOT NULL,
  source_ref                text          NOT NULL,
  source_post_id            text          NOT NULL,
  source_post_url           text,
  source_comment_id         text,
  source_comment_url        text,
  post_timestamp            timestamp,
  harvested_at              timestamp     NOT NULL DEFAULT NOW(),
  harvester_run_id          varchar,
  harvester_tool            text,

  -- Raw content (POPIA-sensitive, short retention)
  raw_text_redacted         text,
  raw_text_hash             text          NOT NULL,
  contains_phone_number     boolean       DEFAULT FALSE,
  contains_email            boolean       DEFAULT FALSE,
  language_detected         text,

  -- Extraction (LLM pass output)
  extractor_version         text          NOT NULL,
  extractor_model           text,
  extracted_at              timestamp,
  origin_raw                text,
  destination_raw           text,
  fare_zar                  real,
  metro_hint                text,
  confidence                text,
  evidence_quote            text,
  extraction_notes          text,

  -- Canonicalization (match to taxi_locations gazetteer)
  canonicalized_at          timestamp,
  origin_rank_id            varchar,
  destination_rank_id       varchar,
  origin_match_score        real,
  destination_match_score   real,
  canonicalization_method   text,

  -- Review state machine:
  --   pending_extraction → pending_canonicalization → pending_review →
  --     approved | rejected | duplicate | superseded
  status                    text          NOT NULL DEFAULT 'pending_extraction',
  reviewed_by               varchar,
  reviewed_at               timestamp,
  review_notes              text,
  rejection_reason          text,
  taxi_fare_id              varchar,

  created_at                timestamp     DEFAULT NOW(),
  updated_at                timestamp     DEFAULT NOW()
);

-- Dedupe lookup: one row per (post, comment, extractor_version).
CREATE INDEX IF NOT EXISTS idx_fare_imports_post_version
  ON fare_imports (source, source_ref, source_post_id, source_comment_id, extractor_version);

-- Admin queue lookups ("give me everything pending_review").
CREATE INDEX IF NOT EXISTS idx_fare_imports_status
  ON fare_imports (status);

-- Time-windowed dashboards ("what did last night's run yield?").
CREATE INDEX IF NOT EXISTS idx_fare_imports_harvested_at
  ON fare_imports (harvested_at);

-- Canonical-pair lookup ("is there already an approved fare for this route?").
CREATE INDEX IF NOT EXISTS idx_fare_imports_canonical_pair
  ON fare_imports (origin_rank_id, destination_rank_id);


-- ------------------------------------------------------------------
-- route_demand_signals
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_demand_signals (
  id                        varchar       PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provenance (mirrors fare_imports; no comment_id because signals are
  -- keyed at post level).
  source                    text          NOT NULL,
  source_ref                text          NOT NULL,
  source_post_id            text          NOT NULL,
  source_post_url           text,
  post_timestamp            timestamp,
  harvested_at              timestamp     NOT NULL DEFAULT NOW(),
  harvester_run_id          varchar,
  harvester_tool            text,

  -- Raw content (shorter retention than fare_imports)
  raw_text_redacted         text,
  raw_text_hash             text          NOT NULL,
  language_detected         text,

  -- Extraction (LLM pass output)
  extractor_version         text          NOT NULL,
  extractor_model           text,
  extracted_at              timestamp,
  origin_raw                text,          -- nullable: posts often name only destination
  destination_raw           text          NOT NULL,  -- required: aggregation key
  metro_hint                text,
  confidence                text,
  evidence_quote            text,
  extraction_notes          text,

  -- Canonicalization
  canonicalized_at          timestamp,
  origin_rank_id            varchar,
  destination_rank_id       varchar,
  origin_match_score        real,
  destination_match_score   real,
  canonicalization_method   text,

  -- "pending_canonicalization" | "canonicalized" | "orphan"
  status                    text          NOT NULL DEFAULT 'pending_canonicalization',

  created_at                timestamp     DEFAULT NOW(),
  updated_at                timestamp     DEFAULT NOW()
);

-- One demand signal per (post, extractor_version).
CREATE INDEX IF NOT EXISTS idx_rds_post_version
  ON route_demand_signals (source, source_ref, source_post_id, extractor_version);

-- Aggregation lookup for city-explorer: "signals for origin → destination".
CREATE INDEX IF NOT EXISTS idx_rds_canonical_pair
  ON route_demand_signals (origin_rank_id, destination_rank_id);

-- Metro-scoped aggregation: "top-asked routes in JHB".
CREATE INDEX IF NOT EXISTS idx_rds_metro
  ON route_demand_signals (metro_hint);

-- Time-windowed queries for city-explorer charts.
CREATE INDEX IF NOT EXISTS idx_rds_harvested_at
  ON route_demand_signals (harvested_at);

COMMIT;
