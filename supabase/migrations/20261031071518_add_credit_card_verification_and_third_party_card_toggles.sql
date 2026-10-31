/*
# Add Credit Card Verification and Third Party Card Usage toggles to master_settings

1. New Columns
- `enable_credit_card_verification` (boolean, default false) — when true, the system
  will perform credit card verification before allowing transactions. When false,
  credit card verification is skipped/disabled.
- `enable_third_party_card_usage` (boolean, default false) — when true, users are
  allowed to use credit cards that do not belong to them (third-party cards). When
  false, only the user's own cards may be used.

2. Modified Tables
- `master_settings` — two new boolean columns added with safe defaults.

3. Security
- No RLS or policy changes. master_settings is already restricted to service_role /
  admin-only access. The new columns inherit the same grants as the existing columns.

4. Important Notes
- Both flags default to FALSE so existing behavior is preserved until an admin
  explicitly enables them in the Master Settings page.
- The mobile app reads these flags via the get-company-settings edge function, which
  is updated to expose them so native clients honour the same toggles.
*/

ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS enable_credit_card_verification boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_third_party_card_usage boolean NOT NULL DEFAULT false;