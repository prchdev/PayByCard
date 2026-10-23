-- Update cron schedules:
--   poll-stale-payments:     every 5 min → every 1 min
--   check-settlement-status: every 30 min → every 5 min
--   on-demand-settlement:    every 5 min → every 1 min

-- poll-stale-payments: job_id 10, was */5 * * * *
SELECT cron.alter_job(job_id := 10, schedule := '* * * * *');

-- check-settlement-status: job_id 13, was 7,37 * * * *
SELECT cron.alter_job(job_id := 13, schedule := '*/5 * * * *');

-- on-demand-settlement: job_id 17, was */5 * * * *
SELECT cron.alter_job(job_id := 17, schedule := '* * * * *');
