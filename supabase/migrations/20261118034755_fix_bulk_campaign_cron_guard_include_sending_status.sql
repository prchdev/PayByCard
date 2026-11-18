-- Fix: The cron guard for bulk email/SMS campaigns only checked for
-- status = 'scheduled', but "Send Now" campaigns start as 'sending'
-- and scheduled campaigns transition to 'sending' after the first batch.
-- This meant the cron never fired for campaigns actively being sent,
-- leaving them stuck in 'sending' with 0 emails dispatched.

SELECT cron.alter_job(
  job_id := 14,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM bulk_email_campaigns
        WHERE status IN ('scheduled', 'sending')
          AND sent_count < total_recipients
        LIMIT 1
      ),
      'admin-bulk-email',
      '{"action":"process_scheduled"}'::jsonb,
      55000
    );
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM bulk_sms_campaigns
        WHERE status IN ('scheduled', 'sending')
          AND sent_count < total_recipients
        LIMIT 1
      ),
      'admin-bulk-sms',
      '{"action":"process_scheduled"}'::jsonb,
      55000
    );
  $$
);
