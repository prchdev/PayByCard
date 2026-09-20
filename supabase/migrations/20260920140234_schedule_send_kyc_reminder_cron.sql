/*
# Schedule send-kyc-reminder cron job every 6 hours

## Purpose
Uses pg_cron + pg_net to call the `send-kyc-reminder` edge function every
6 hours. It finds merchant_onboarding records with status = 'pending' where
the KYC link has not expired and no reminder has been sent in the last 6
hours, then sends:
  1. A reminder email to the merchant/beneficiary with the KYC link,
     payment details, and expiry date/time.
  2. An email to the sender user informing them that merchant KYC is
     pending, with the expiry date/time.

## Changes
1. Removes any existing version of the job (idempotent).
2. Schedules a new cron job named "send-kyc-reminder" firing every 6 hours
   at minute 0 (00:00, 06:00, 12:00, 18:00 UTC).

## Notes
- Uses the anon key; the function is deployed with verify_jwt=false.
- The function itself uses SUPABASE_SERVICE_ROLE_KEY internally for DB writes.
- This only sends emails and updates last_reminder_sent_at — it does NOT
  modify payment status or merchant_onboarding status.
- Staggered to run 5 minutes after the hour to avoid conflicts with other
  cron jobs that fire on the hour.
*/

SELECT cron.unschedule('send-kyc-reminder')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-kyc-reminder'
);

SELECT cron.schedule(
  'send-kyc-reminder',
  '5 */6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://vinllmoxlxgahnwpjxea.supabase.co/functions/v1/send-kyc-reminder',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbmxsbW94bHhnYWhud3BqeGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI3NDAsImV4cCI6MjA5MDcyODc0MH0.2VPGaHvRtEPD2M1sXyw70k6GcEOTQ1i8G7Bk-DmtN0E"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
