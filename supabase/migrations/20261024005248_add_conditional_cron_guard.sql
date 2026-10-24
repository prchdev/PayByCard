
-- Add a conditional wrapper for edge function calls.
-- Only invokes the edge function when the guard condition is true,
-- skipping the HTTP request entirely when there's nothing to do.

CREATE OR REPLACE FUNCTION public.call_edge_function_if(
  should_run boolean,
  func_name text,
  req_body jsonb DEFAULT '{}'::jsonb,
  timeout_ms int DEFAULT 55000
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    CASE
      WHEN should_run THEN
        net.http_post(
          url     := public.get_project_url() || '/functions/v1/' || func_name,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
          ),
          body    := req_body,
          timeout_milliseconds := timeout_ms
        )
      ELSE NULL
    END
$$;

REVOKE EXECUTE ON FUNCTION public.call_edge_function_if(boolean, text, jsonb, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_edge_function_if(boolean, text, jsonb, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.call_edge_function_if(boolean, text, jsonb, int) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- Update cron jobs to only fire when there's actual work to do
-- ──────────────────────────────────────────────────────────────────────────────

-- poll-stale-payments: only fire if there are pending/processing payments
--   that haven't exceeded the poll cap and weren't recently polled
SELECT cron.alter_job(
  job_id := 10,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM payments
        WHERE status IN ('pending', 'processing')
          AND poll_count < 20
          AND (last_polled_at IS NULL
               OR last_polled_at < now() - interval '4 minutes')
        LIMIT 1
      ),
      'poll-stale-payments',
      '{}'::jsonb,
      30000
    );
  $$
);

-- check-settlement-status: only fire if there are in-flight payments
--   with non-terminal settlement status
SELECT cron.alter_job(
  job_id := 13,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM payments
        WHERE status IN ('settlement_pending', 'kyc_pending', 'merchant_kyc_review', 'processing')
          AND (gateway_settlement_status IS NULL
               OR gateway_settlement_status NOT IN ('settled', 'refunded', 'not_applicable'))
        LIMIT 1
      ),
      'check-settlement-status',
      '{}'::jsonb,
      55000
    );
  $$
);

-- on-demand-settlement: only fire if on-demand settlement is enabled
--   for at least one gateway
SELECT cron.alter_job(
  job_id := 17,
  command := $$
    SELECT public.call_edge_function_if(
      EXISTS(
        SELECT 1 FROM gateway_settlement_settings
        WHERE on_demand_settlement_enabled = true
        LIMIT 1
      ),
      'on-demand-settlement',
      '{}'::jsonb,
      55000
    );
  $$
);
