/*
# Fix auto-refund cron guard to use correct column name

## Summary
The previous migration (make_auto_refund_instant_every_minute) referenced
`refund_locked_at` which doesn't exist on the payments table. The actual
locking column used by `fn_try_claim_for_refund` is `payout_locked_at`
with a 5-minute stale lock window. This migration fixes the guard query
to use the correct column and interval.

## Changes
- Cron job 12 guard: `refund_locked_at` → `payout_locked_at`
- Stale lock window: 30 minutes → 5 minutes (matches fn_try_claim_for_refund)
- Everything else stays the same: every 1 minute schedule, conditional guard
  checking for kyc_pending payments past their refund_after_hours threshold.
*/

SELECT cron.alter_job(
  job_id := 12,
  schedule := '* * * * *',
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
