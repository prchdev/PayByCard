/*
# Add mobile app version fields to master_settings

1. Modified Tables
- `master_settings`: adds four columns for enforcing minimum mobile app versions:
  - `android_min_version` (text) — minimum Android app version (e.g. "1.2.0")
  - `android_min_build` (text) — minimum Android build number (e.g. "42")
  - `ios_min_version` (text) — minimum iOS app version
  - `ios_min_build` (text) — minimum iOS build number
2. Security
- No RLS changes — master_settings remains admin-only via edge functions.
3. Notes
- All columns default to empty string so existing behavior is unchanged until an admin sets values.
*/

ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS android_min_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS android_min_build text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ios_min_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ios_min_build text NOT NULL DEFAULT '';
