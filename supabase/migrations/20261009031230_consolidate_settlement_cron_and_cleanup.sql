/*
# Consolidate settlement cron jobs and clean up unsupported gateway settings

1. Removes the separate `track-settlement-status` cron job — its logic is now
   merged into the `on-demand-settlement` edge function (Phase 1: status tracking,
   Phase 2: settlement initiation). Both run every 5 minutes in a single call.

2. Disables on_demand_settlement_enabled for gateways that don't support
   on-demand settlement APIs (only Razorpay and Cashfree are supported).
   This prevents the UI from showing unsupported gateways as having
   on-demand settlement active.
*/

-- Remove the now-merged track-settlement-status cron job
SELECT cron.unschedule('track-settlement-status');

-- Disable on-demand settlement for unsupported gateways
UPDATE gateway_settlement_settings
SET on_demand_settlement_enabled = false,
    updated_at = now()
WHERE gateway_name NOT ILIKE '%razorpay%'
  AND gateway_name NOT ILIKE '%cashfree%';
