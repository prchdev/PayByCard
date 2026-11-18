/*
# Revert auto-refund cron from every 1 minute back to every 1 hour

## Summary
Reverts the earlier change that set the auto-refund-kyc-expired cron to every 1 minute.
Restores the original hourly schedule with the conditional guard intact.

## Changes
- Cron job 12 schedule: `* * * * *` (every minute) → `0 * * * *` (every hour)
- Command remains the same conditional guard using call_edge_function_if
*/

SELECT cron.alter_job(
  job_id := 12,
  schedule := '0 * * * *',
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM payments p
        WHERE p.status = 'kyc_pending'
          AND (p.category_details->>'refund_after_hours') IS NOT NULL
          AND CAST(p.category_details->>'refund_after_hours' AS integer) > 0
          AND p.created_at + (CAST(p.category_details->>'refund_after_hours' AS integer) || ' hours')::interval <= now()
          AND (
            p.payout_locked_at IS NULL
            OR p.payout_locked_at < now() - interval '5 minutes'
          )
        LIMIT 1
      ),
      'auto-refund-kyc-expired',
      '{}'::jsonb,
      55000
    );
  $$
);
