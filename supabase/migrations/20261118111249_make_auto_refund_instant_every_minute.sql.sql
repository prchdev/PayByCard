/*
# Make auto-refund instant (every 1 minute with conditional guard)

## Summary
Changes the `auto-refund-kyc-expired` cron job from every 1 hour to every 1 minute,
and adds a conditional guard so the edge function is only called when there are
eligible kyc_pending payments whose refund_after_hours threshold has elapsed.
This makes refunds process within ~1 minute of becoming eligible instead of
waiting up to 1 hour for the next cron tick.

## Changes
1. Cron job 12 (`auto-refund-kyc-expired`):
   - Schedule: `0 * * * *` (every hour) → `* * * * *` (every minute)
   - Command: plain call → `call_edge_function_if` with eligibility guard
2. The guard checks:
   - `payments.status = 'kyc_pending'`
   - `category_details->>'refund_after_hours'` exists and is > 0
   - `created_at + refund_after_hours hours <= now()` (threshold elapsed)
   - `refund_locked_at IS NULL OR refund_locked_at < now() - 30 minutes` (not already being processed)
3. The edge function itself is unchanged — it already processes refunds immediately
   when it finds eligible payments, with pessimistic locking via `fn_try_claim_for_refund`
   to prevent concurrent runs from double-processing.

## Security
No new tables, no RLS changes, no grants. Only cron schedule + command altered.

## Notes
- The pessimistic lock (`fn_try_claim_for_refund`) ensures concurrent runs are safe
  — the second run simply finds no unclaimed payments.
- The 55-second timeout in `call_edge_function_if` is within the 60-second cron
  interval, preventing overlap.
- Admin-initiated refunds (`admin-gateway-refund`) were already instant and are
  unaffected by this change.
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
            p.refund_locked_at IS NULL
            OR p.refund_locked_at < now() - interval '30 minutes'
          )
        LIMIT 1
      ),
      'auto-refund-kyc-expired',
      '{}'::jsonb,
      55000
    );
  $$
);
