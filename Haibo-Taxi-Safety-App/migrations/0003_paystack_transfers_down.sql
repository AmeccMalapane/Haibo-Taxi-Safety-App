-- Rollback for 0003: drops the transfer tracking columns.
-- Any in-flight Paystack transfers whose webhook hasn't fired yet will
-- lose the transfer_code link — admins would need to reconcile manually
-- via the Paystack dashboard. Don't roll back if there are rows with
-- status='processing'.

BEGIN;

DROP INDEX IF EXISTS withdrawal_requests_paystack_transfer_code_idx;

ALTER TABLE withdrawal_requests
  DROP COLUMN IF EXISTS paystack_transfer_code,
  DROP COLUMN IF EXISTS failure_reason;

COMMIT;
