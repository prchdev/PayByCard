/*
# Add referral message column to master_settings

## Description
Adds a `referral_message` text column to the `master_settings` table so admins
can configure a custom message that gets appended to referral share/copy text
on the user Dashboard. The message supports all Unicode characters including
emoji and special symbols.

## Changes
- New column: `master_settings.referral_message` (text, nullable, default NULL)
  - Stores the admin-configured referral message text
  - Inserted between the existing referral share message and the referral link
  - Accepts all symbols, emoji, and special characters

## Security
- No RLS policy changes needed; existing master_settings policies already
  restrict access to admin users only.
*/

ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS referral_message text;
