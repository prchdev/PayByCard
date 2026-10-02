-- Update all cron jobs to use the centralized call_edge_function helper
-- This avoids hardcoding URLs and anon keys in each job

SELECT cron.alter_job(job_id := 10, command := 'SELECT public.call_edge_function(''poll-stale-payments'', ''{}''::jsonb, 30000);');

SELECT cron.alter_job(job_id := 11, command := 'SELECT public.call_edge_function(''auto-payout'', ''{}''::jsonb, 55000);');

SELECT cron.alter_job(job_id := 12, command := 'SELECT public.call_edge_function(''auto-refund-kyc-expired'', ''{}''::jsonb, 55000);');

SELECT cron.alter_job(job_id := 13, command := 'SELECT public.call_edge_function(''check-settlement-status'', ''{}''::jsonb, 55000);');

SELECT cron.alter_job(job_id := 14, command := 'SELECT public.call_edge_function(''admin-bulk-email'', ''{"action":"process_scheduled"}''::jsonb, 55000); SELECT public.call_edge_function(''admin-bulk-sms'', ''{"action":"process_scheduled"}''::jsonb, 55000);');

SELECT cron.alter_job(job_id := 15, command := 'SELECT public.call_edge_function(''send-push-notification'', ''{}''::jsonb, 30000);');

SELECT cron.alter_job(job_id := 16, command := 'SELECT public.call_edge_function(''send-kyc-reminder'', ''{}''::jsonb);');
