/*
# Add Hold/Unhold Support for Transactions

1. Purpose
   - Allows admins to temporarily "hold" a suspicious transaction, pausing all
     background processing (auto-payout, poll-stale-payments, auto-refund-kyc-expired).
   - When held, the current status is saved in `pre_hold_status` and the payment
     status is set to 'on_hold'.
   - When unheld, the original status is restored from `pre_hold_status` and
     `pre_hold_status` is cleared, so the transaction resumes its normal flow.

2. Changes
   - Add column `pre_hold_status` (text, nullable) to `payments` table.
   - No RLS changes needed — the column is only modified by the service role
     (edge functions). Existing RLS policies on `payments` remain unchanged.

3. Background Job Safety
   - auto-payout selects status IN ('settlement_pending', 'settlement_in_progress') — on_hold excluded
   - poll-stale-payments selects status IN ('pending', 'processing') — on_hold excluded
   - auto-refund-kyc-expired selects status = 'kyc_pending' — on_hold excluded
   - No changes needed to those functions; 'on_hold' is simply not in any of their filters.
*/

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS pre_hold_status text;
