/*
# Add Invoice/Bill Required fields to Payment Categories

## Purpose
Adds three new columns to the `payment_categories` table so admins can
configure whether an invoice or bill is required for payments in a given
category, how frequently the invoice should be requested, and the minimum
amount above which the invoice is required.

## Changes
1. `invoice_required` (boolean, default false) — When true, users must
   upload an invoice/bill for payments in this category.
2. `invoice_frequency_months` (integer, default 0) — If invoice_required
   is true, the invoice should be requested every X months. 0 means
   every payment requires an invoice.
3. `invoice_min_amount` (numeric, default 0) — The invoice is only
   required if the payment amount is greater than this value. 0 means
   the invoice is required for all amounts.

## Security
- No RLS policy changes. The table is already service-role only.
- New columns are nullable-safe with sensible defaults.

## Notes
- All three columns are additive and do not affect existing rows.
- The admin UI will show these fields conditionally based on
  `invoice_required` being checked.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_categories'
      AND column_name = 'invoice_required'
  ) THEN
    ALTER TABLE payment_categories ADD COLUMN invoice_required boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_categories'
      AND column_name = 'invoice_frequency_months'
  ) THEN
    ALTER TABLE payment_categories ADD COLUMN invoice_frequency_months integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_categories'
      AND column_name = 'invoice_min_amount'
  ) THEN
    ALTER TABLE payment_categories ADD COLUMN invoice_min_amount numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
