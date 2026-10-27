/*
# Add Payment Restrictions toggles to master_settings

1. New Columns
- `allow_self_transfer` (boolean, default false) — when true, users may add their own
  bank account as a beneficiary, send payments to themselves, and complete merchant
  KYC using their own PAN/KYC details.
- `allow_credit_card_payment` (boolean, default false) — when true, users may add a
  credit card number as a beneficiary bank account (for credit-card bill payments).

2. Modified Tables
- `master_settings` — two new boolean columns added with safe defaults.

3. Security
- No RLS or policy changes. master_settings is already restricted to service_role /
  admin-only access. The new columns inherit the same grants as the existing columns.

4. Important Notes
- Both flags default to FALSE so existing behavior (self-transfer blocked, credit-card
  beneficiary blocked) is preserved until an admin explicitly enables them in the
  Master Settings page.
- The mobile app reads these flags via the get-company-settings edge function, which
  is updated to expose them so native clients honour the same toggles.
*/

ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS allow_self_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_credit_card_payment boolean NOT NULL DEFAULT false;
