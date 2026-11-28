/*
# Add 'on_hold' to payments status CHECK constraint

## What this does
The admin dashboard has a "Hold" button on transaction records that sets the payment
status to 'on_hold' (and restores the original status when unheld). The `payments.status`
column has a CHECK constraint that restricts allowed values, but 'on_hold' was never
added to that list. This caused every hold attempt to fail with a constraint violation,
surfacing to the admin as "An unexpected error occurred."

## Changes
1. Drop the existing CHECK constraint on `payments.status`.
2. Recreate it with the same allowed values PLUS 'on_hold'.

## Affected tables
- `payments` — status column CHECK constraint updated only; no data changes.

## Security
- No RLS, policy, or grant changes.
- No new tables or columns.

## Important notes
1. This is safe to re-run — the DROP uses IF EXISTS.
2. No existing data is modified — only the constraint definition changes.
3. The full list of allowed statuses after this migration:
   pending, processing, completed, failed, refunded, cancelled,
   kyc_pending, settlement_pending, settlement_in_progress,
   refund_pending, merchant_kyc_review, on_hold
*/

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments ADD CONSTRAINT payments_status_check
CHECK (status = ANY (ARRAY[
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'cancelled',
  'kyc_pending',
  'settlement_pending',
  'settlement_in_progress',
  'refund_pending',
  'merchant_kyc_review',
  'on_hold'
]));
