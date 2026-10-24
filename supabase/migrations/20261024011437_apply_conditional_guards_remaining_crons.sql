
-- ════════════════════════════════════════════════════════════════════════════
-- Apply conditional guards to remaining cron jobs
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- on-demand-settlement (job 17): update guard to check for settlement_pending
--   payments instead of just gateway_settlement_settings flag
-- ──────────────────────────────────────────────────────────────────────────────
SELECT cron.alter_job(
  job_id := 17,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM payments
        WHERE status = 'settlement_pending'
        LIMIT 1
      ),
      'on-demand-settlement',
      '{}'::jsonb,
      55000
    );
  $$
);

-- ──────────────────────────────────────────────────────────────────────────────
-- process-scheduled-bulk-campaigns (job 14): only fire if there are active
--   bulk email or SMS campaigns with pending recipients still to send
-- ──────────────────────────────────────────────────────────────────────────────
SELECT cron.alter_job(
  job_id := 14,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM bulk_email_campaigns
        WHERE status = 'scheduled'
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
        WHERE status = 'scheduled'
          AND sent_count < total_recipients
        LIMIT 1
      ),
      'admin-bulk-sms',
      '{"action":"process_scheduled"}'::jsonb,
      55000
    );
  $$
);

-- ──────────────────────────────────────────────────────────────────────────────
-- auto-payout (job 11): only fire if payout_mode is not 'manual' AND there
--   are payments in settlement_pending status
-- ──────────────────────────────────────────────────────────────────────────────
SELECT cron.alter_job(
  job_id := 11,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM payments
        WHERE status = 'settlement_pending'
          AND (payout_mode IS NULL OR payout_mode != 'manual')
          AND auto_payout_failed = false
        LIMIT 1
      ),
      'auto-payout',
      '{}'::jsonb,
      55000
    );
  $$
);

-- ──────────────────────────────────────────────────────────────────────────────
-- auto-refund-kyc-expired (job 12): change schedule to every 1 hour
--   (was every 10 min). No data guard needed — the edge function itself
--   checks for expired KYC records.
-- ──────────────────────────────────────────────────────────────────────────────
SELECT cron.alter_job(
  job_id := 12,
  schedule := '0 * * * *'
);

-- ──────────────────────────────────────────────────────────────────────────────
-- send-push-notifications (job 15): only fire if there are active notification
--   campaigns with push_enabled that haven't ended and are within their date range
-- ──────────────────────────────────────────────────────────────────────────────
SELECT cron.alter_job(
  job_id := 15,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM mobile_notification_campaigns
        WHERE status = 'active'
          AND push_enabled = true
          AND ended_at IS NULL
          AND start_date <= CURRENT_DATE
          AND end_date >= CURRENT_DATE
        LIMIT 1
      ),
      'send-push-notification',
      '{}'::jsonb,
      30000
    );
  $$
);
