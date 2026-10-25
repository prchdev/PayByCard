/*
# Add ondemand_settlement_included_at column to payments

## Purpose
Tracks which settlement_pending payments have already been included in an
on-demand settlement request. The on-demand-settlement edge function sets this
timestamp when it calculates a payment's net amount into a gateway's withdrawal
request. Subsequent runs skip payments where this column is NOT NULL and
gateway_settlement_status is still settlement_pending (i.e. the settlement
hasn't settled or failed yet), preventing double-counting.

The column is cleared (set back to NULL) by check-settlement-status when the
gateway reports a terminal settlement status (settled/failed/refunded), so
the payment lifecycle remains clean.

## Changes
- payments table: new column `ondemand_settlement_included_at` (timestamptz, nullable)
- Index on (status, ondemand_settlement_included_at) for efficient filtering

## Security
No RLS or policy changes — this column is only written by the service_role
from edge functions. No additional grants needed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
    AND column_name = 'ondemand_settlement_included_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN ondemand_settlement_included_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_ondemand_settlement
  ON payments (status, ondemand_settlement_included_at)
  WHERE status = 'settlement_pending';
