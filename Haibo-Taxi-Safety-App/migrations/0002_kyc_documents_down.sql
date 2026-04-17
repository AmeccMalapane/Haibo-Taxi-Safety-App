-- Rollback for 0002: drops the kyc_documents columns. Any uploaded
-- document URLs are lost — the referenced objects in storage remain
-- and must be cleaned up separately if you want to free that space.

BEGIN;

ALTER TABLE owner_profiles DROP COLUMN IF EXISTS kyc_documents;
ALTER TABLE vendor_profiles DROP COLUMN IF EXISTS kyc_documents;

COMMIT;
