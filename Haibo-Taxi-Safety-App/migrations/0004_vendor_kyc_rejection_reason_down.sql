-- Rollback for 0004: drops the kyc_rejection_reason column.
-- Any stored rejection reasons are lost — if vendors need to see why
-- their KYC was rejected, restore from backup or re-notify them.

BEGIN;

ALTER TABLE vendor_profiles
  DROP COLUMN IF EXISTS kyc_rejection_reason;

COMMIT;
