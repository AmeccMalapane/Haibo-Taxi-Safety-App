-- Migration 0001: Role system foundation (Phase A)
--
-- Adds the schema scaffolding for role-based dashboards:
--   • new role: vendor (joins existing commuter/driver/owner/association/admin)
--   • driver fareBalance sub-balance (owner's money, routed on withdrawal)
--   • owner_profiles, driver_owner_invitations (new tables)
--   • driverProfiles.ownerId + linkStatus + splitPercentFare
--   • vendorProfiles payout bank + Paystack subaccount fields
--   • walletTransactions.balanceAffected + parentTransactionId
--   • withdrawalRequests.routeToUserId + balanceType
--
-- Safe on live data:
--   • Every added column is nullable or has a default matching legacy semantics.
--   • No existing rows are mutated.
--   • `role` column is text (not a DB enum), so "add value 'vendor'" is a
--     comment-only change — no ALTER TYPE needed.
--
-- Rollback: see `0001_role_system_foundation_down.sql` alongside.

BEGIN;

-- ─── users ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS fare_balance real DEFAULT 0;

-- ─── driver_profiles ───────────────────────────────────────────────────
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS owner_id varchar,
  ADD COLUMN IF NOT EXISTS split_percent_fare integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS linked_at timestamp;

-- Drivers who existed before this migration keep linkStatus='pending' by
-- default. Operationally this means they can earn but not withdraw until
-- an owner invitation is redeemed. Uncomment the UPDATE below if you want
-- to auto-approve existing drivers as "active" (requires data review
-- first — don't run blindly on prod).
--
-- UPDATE driver_profiles SET link_status = 'active' WHERE link_status = 'pending';

CREATE INDEX IF NOT EXISTS driver_profiles_owner_id_idx
  ON driver_profiles (owner_id);

-- ─── owner_profiles (new) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owner_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE,
  company_name text,
  bank_code text,
  account_number text,
  account_name text,
  paystack_recipient_code text,
  kyc_status text DEFAULT 'unverified',
  kyc_reviewed_at timestamp,
  kyc_reviewed_by varchar,
  kyc_rejection_reason text,
  company_reg_number text,
  vat_number text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- ─── driver_owner_invitations (new) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_owner_invitations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL,
  code text NOT NULL UNIQUE,
  label text,
  used_by_user_id varchar,
  used_at timestamp,
  expires_at timestamp,
  status text DEFAULT 'pending',
  revoked_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_owner_invitations_owner_id_idx
  ON driver_owner_invitations (owner_id);

-- ─── vendor_profiles extensions ────────────────────────────────────────
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code text;

-- ─── wallet_transactions extensions ────────────────────────────────────
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS balance_affected text DEFAULT 'wallet',
  ADD COLUMN IF NOT EXISTS parent_transaction_id varchar;

CREATE INDEX IF NOT EXISTS wallet_transactions_parent_idx
  ON wallet_transactions (parent_transaction_id);

-- ─── withdrawal_requests extensions ────────────────────────────────────
ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS route_to_user_id varchar,
  ADD COLUMN IF NOT EXISTS balance_type text DEFAULT 'wallet';

CREATE INDEX IF NOT EXISTS withdrawal_requests_route_to_idx
  ON withdrawal_requests (route_to_user_id);

COMMIT;

-- Smoke check (run manually after apply):
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('users','driver_profiles','vendor_profiles',
--                        'wallet_transactions','withdrawal_requests')
--     AND column_name IN ('fare_balance','owner_id','link_status',
--                         'split_percent_fare','paystack_subaccount_code',
--                         'balance_affected','parent_transaction_id',
--                         'route_to_user_id','balance_type');
