-- Rollback for migration 0001: Role system foundation
--
-- Drops everything added in 0001_role_system_foundation.sql.
-- DESTRUCTIVE — run only if you're OK losing:
--   • driver ↔ owner linkages
--   • all owner profiles
--   • all driver-owner invitations
--   • driver fareBalance amounts
--   • withdrawal routing info on any in-flight withdrawals
--
-- Prefer amending forward-migrations for production rollbacks.

BEGIN;

-- ─── withdrawal_requests ───────────────────────────────────────────────
DROP INDEX IF EXISTS withdrawal_requests_route_to_idx;
ALTER TABLE withdrawal_requests
  DROP COLUMN IF EXISTS route_to_user_id,
  DROP COLUMN IF EXISTS balance_type;

-- ─── wallet_transactions ───────────────────────────────────────────────
DROP INDEX IF EXISTS wallet_transactions_parent_idx;
ALTER TABLE wallet_transactions
  DROP COLUMN IF EXISTS balance_affected,
  DROP COLUMN IF EXISTS parent_transaction_id;

-- ─── vendor_profiles ───────────────────────────────────────────────────
ALTER TABLE vendor_profiles
  DROP COLUMN IF EXISTS bank_code,
  DROP COLUMN IF EXISTS account_number,
  DROP COLUMN IF EXISTS account_name,
  DROP COLUMN IF EXISTS paystack_subaccount_code,
  DROP COLUMN IF EXISTS paystack_recipient_code;

-- ─── driver_owner_invitations ──────────────────────────────────────────
DROP INDEX IF EXISTS driver_owner_invitations_owner_id_idx;
DROP TABLE IF EXISTS driver_owner_invitations;

-- ─── owner_profiles ────────────────────────────────────────────────────
DROP TABLE IF EXISTS owner_profiles;

-- ─── driver_profiles ───────────────────────────────────────────────────
DROP INDEX IF EXISTS driver_profiles_owner_id_idx;
ALTER TABLE driver_profiles
  DROP COLUMN IF EXISTS owner_id,
  DROP COLUMN IF EXISTS split_percent_fare,
  DROP COLUMN IF EXISTS link_status,
  DROP COLUMN IF EXISTS linked_at;

-- ─── users ─────────────────────────────────────────────────────────────
ALTER TABLE users
  DROP COLUMN IF EXISTS fare_balance;

COMMIT;
