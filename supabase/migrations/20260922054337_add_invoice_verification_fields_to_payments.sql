/*
# Add invoice verification fields to payments table

1. New Columns on payments:
- invoice_status (text, default 'not_required') — tracks the invoice/bill verification state.
  Values: 'not_required', 'pending_verification', 'verified', 'rejected'
- invoice_verified_at (timestamptz) — when admin verified/rejected the invoice
- invoice_verified_by (uuid) — admin who verified/rejected
- invoice_rejection_reason (text) — reason if rejected
- invoice_confirmed_at (timestamptz) — when the invoice was confirmed/verified (for frequency tracking)

2. Security
- No RLS changes needed; existing payments policies cover the new columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'invoice_status'
  ) THEN
    ALTER TABLE payments ADD COLUMN invoice_status text NOT NULL DEFAULT 'not_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'invoice_verified_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN invoice_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'invoice_verified_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN invoice_verified_by uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'invoice_rejection_reason'
  ) THEN
    ALTER TABLE payments ADD COLUMN invoice_rejection_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'invoice_confirmed_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN invoice_confirmed_at timestamptz;
  END IF;
END $$;

-- Add index for querying invoice status by beneficiary + category
CREATE INDEX IF NOT EXISTS idx_payments_invoice_beneficiary_category
  ON payments (beneficiary_id, business_category_id, invoice_status, invoice_confirmed_at);
