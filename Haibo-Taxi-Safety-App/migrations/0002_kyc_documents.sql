-- Migration 0002: KYC document storage (Phase F)
--
-- Adds a kyc_documents JSONB column to owner_profiles and vendor_profiles
-- so the mobile KYC upload flow has somewhere to persist the URLs that
-- come back from /api/uploads/image. Admin review (in command-center)
-- reads these URLs, flips kyc_status / status to 'verified' or 'rejected'.
--
-- Safe on live data:
--   • New column is nullable — existing profile rows stay untouched.
--   • No ALTER TYPE, no backfill, no index.
--
-- Rollback: see `0002_kyc_documents_down.sql`.

BEGIN;

ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS kyc_documents jsonb;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS kyc_documents jsonb;

COMMIT;
