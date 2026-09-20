/*
# Add KYC Reminder Tracking to Merchant Onboarding

1. Modified Tables
   - `merchant_onboarding`
     - `last_reminder_sent_at` (timestamptz, nullable) — Timestamp of the last
       6-hourly KYC pending reminder email sent to the merchant/beneficiary.
       Used by the `send-kyc-reminder` cron edge function to avoid sending
       duplicate reminders within the 6-hour window.

2. Security
   - No RLS policy changes. The table already has service-role-only access.
   - The new column is purely for internal tracking by background jobs.

3. Important Notes
   - This column is nullable so existing rows are unaffected.
   - The `send-kyc-reminder` edge function sets this column after
     successfully sending both the merchant and sender reminder emails.
   - If the merchant completes KYC (status changes from 'pending'), no
     further reminders are sent.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchant_onboarding'
      AND column_name = 'last_reminder_sent_at'
  ) THEN
    ALTER TABLE merchant_onboarding ADD COLUMN last_reminder_sent_at timestamptz;
  END IF;
END $$;
