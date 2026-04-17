-- Migration 0003: Paystack transfer integration on withdrawals
--
-- Adds two nullable columns to withdrawal_requests:
--   • paystack_transfer_code — the "TRF_..." code returned by POST
--     /transfer. Used by the webhook handler to find the row when
--     transfer.success / transfer.failed fires.
--   • failure_reason — populated on transfer.failed so ops can tell
--     "admin rejected this" (rejection_reason) from "Paystack couldn't
--     deliver this" (failure_reason). Keeps the audit trail crisp.
--
-- Status state machine after this migration:
--   pending → approved  (admin flipped it, /transfer not yet called)
--   approved → processing (Paystack accepted the transfer)
--   processing → completed (webhook confirmed)
--   processing → failed    (webhook rejected; balance refunded)
--   pending → rejected     (admin refused)
--
-- Safe on live data: both columns are nullable, no existing rows mutated.
-- Rollback: see `0003_paystack_transfers_down.sql`.

BEGIN;

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS paystack_transfer_code text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- Index on transfer_code so the webhook lookup (by transfer_code) is O(log n)
-- rather than a full-table scan. Partial index keeps it tiny — most rows are
-- historical pending/rejected with no transfer code.
CREATE INDEX IF NOT EXISTS withdrawal_requests_paystack_transfer_code_idx
  ON withdrawal_requests (paystack_transfer_code)
  WHERE paystack_transfer_code IS NOT NULL;

COMMIT;
