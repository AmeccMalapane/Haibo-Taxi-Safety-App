-- Migration 0004: Vendor KYC rejection reason
--
-- owner_profiles already has kyc_rejection_reason — vendor_profiles was
-- missing the equivalent. Needed so the admin KYC review queue can store
-- "why did you reject this submission" without stuffing it into a JSONB
-- blob alongside the user's uploaded docs.
--
-- Status state machine for vendor_profiles.status (text, so no ALTER TYPE):
--   pending  → verified    (admin approved KYC)
--   pending  → rejected    (admin rejected KYC; user may re-submit)
--   verified → suspended   (admin banned an already-verified vendor)
--
-- Safe on live data: nullable column, no backfill, no index.
-- Rollback: see `0004_vendor_kyc_rejection_reason_down.sql`.

BEGIN;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text;

COMMIT;
