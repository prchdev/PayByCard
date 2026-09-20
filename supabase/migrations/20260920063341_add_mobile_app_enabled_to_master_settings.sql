/*
# Add mobile_app_enabled toggle to master_settings

1. Modified Tables
- `master_settings`: adds `mobile_app_enabled` boolean column, default true.
  This is a Yes/No toggle that controls whether the mobile application is enabled.
2. Security
- No RLS changes — master_settings is already admin-only via edge functions using the service role key.
3. Notes
- Defaults to true so existing behavior is unchanged until an admin explicitly disables it.
*/

ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS mobile_app_enabled boolean NOT NULL DEFAULT true;
