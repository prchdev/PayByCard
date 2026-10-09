/*
# Payment Gateway Settlement — settings table, admin page, cron jobs

1. New Tables
- `gateway_settlement_settings`
  - `id` (uuid, primary key)
  - `gateway_name` (text, unique, references payment_gateway_settings.gateway_name)
  - `on_demand_settlement_enabled` (boolean, default false)
  - `minimum_settlement_amount` (numeric, default 0)
  - `settlement_trigger_minutes` (integer, default 60)
  - `last_settlement_at` (timestamptz, nullable — last time on-demand settlement was triggered for this gateway)
  - `last_settlement_status` (text, nullable — last settlement result: initiated/onhold/settled/failed)
  - `last_settlement_amount` (numeric, nullable — amount attempted in last on-demand settlement)
  - `created_by` (uuid, nullable)
  - `updated_by` (uuid, nullable)
  - `updated_by_ip` (text, nullable)
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Seed data
- Inserts a row for each existing gateway in payment_gateway_settings
  (CashFree, CCAvenue, EaseBuzz, EnKash, PayU, PhonePe, RazorPay, ZaakPay)
  with on-demand disabled, minimum 0, trigger 60 mins.

3. Admin page registration
- Adds `gateway-settlement` to admin_pages (icon = Landmark, display_order = 13).
- Grants role_permissions: super_admin + admin get view+edit, moderator gets view-only.

4. Cron jobs
- `on-demand-settlement` — every 5 minutes, calls the `on-demand-settlement` edge function.
  The function itself checks each enabled gateway's trigger interval and minimum amount
  before initiating settlement, so a frequent schedule is safe.
- `track-settlement-status` — every 30 minutes, calls the `track-settlement-status`
  edge function which checks settlement responses for onhold status and disables
  affected payment options.

5. Security
- Enables RLS on `gateway_settlement_settings`.
- Service role (used by edge functions) bypasses RLS.
- No direct client access — all reads/writes go through admin edge functions
  which use the service role key internally.

6. Notes
- The existing `check-settlement-status` cron job continues to run as-is; it
  tracks per-payment settlement status. The new `track-settlement-status` job
  specifically monitors on-demand settlement responses for onhold conditions
  and disables payment options linked to the affected gateway.
- Payment options are disabled by setting `is_enabled = false` on
  `payment_options` rows whose `gateway_id` matches the onhold gateway.
*/

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gateway_settlement_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name                text UNIQUE NOT NULL REFERENCES payment_gateway_settings(gateway_name) ON DELETE CASCADE,
  on_demand_settlement_enabled boolean NOT NULL DEFAULT false,
  minimum_settlement_amount   numeric(14,2) NOT NULL DEFAULT 0,
  settlement_trigger_minutes  integer NOT NULL DEFAULT 60 CHECK (settlement_trigger_minutes >= 1),
  last_settlement_at          timestamptz,
  last_settlement_status      text,
  last_settlement_amount      numeric(14,2),
  created_by                  uuid,
  updated_by                  uuid,
  updated_by_ip               text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gateway_settlement_settings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; edge functions use the service role key.
-- No direct anon/authenticated policies needed — all access is via edge functions.

-- ─── Seed default rows for every existing gateway ─────────────────────────────

INSERT INTO gateway_settlement_settings (gateway_name)
SELECT gateway_name FROM payment_gateway_settings
WHERE gateway_name NOT IN (SELECT gateway_name FROM gateway_settlement_settings)
ON CONFLICT (gateway_name) DO NOTHING;

-- ─── Admin page registration ─────────────────────────────────────────────────

INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order, is_active)
VALUES (
  'gateway-settlement',
  'Payment Gateway Settlement',
  '/admin/gateway-settlement',
  'Configure on-demand settlement for each payment gateway — toggle, minimum amount, trigger interval.',
  'Landmark',
  13,
  true
)
ON CONFLICT (page_key) DO NOTHING;

-- Grant permissions to all existing roles:
--   super_admin + admin → view + edit
--   moderator          → view only
DO $$
DECLARE
  v_page_id uuid;
  r_rec RECORD;
BEGIN
  SELECT id INTO v_page_id FROM admin_pages WHERE page_key = 'gateway-settlement';
  IF v_page_id IS NULL THEN RETURN; END IF;

  FOR r_rec IN SELECT DISTINCT role FROM role_permissions LOOP
    IF r_rec.role = 'moderator' THEN
      INSERT INTO role_permissions (role, page_id, can_view, can_edit)
      VALUES (r_rec.role, v_page_id, true, false)
      ON CONFLICT (role, page_id) DO UPDATE SET can_view = true, can_edit = false;
    ELSE
      INSERT INTO role_permissions (role, page_id, can_view, can_edit)
      VALUES (r_rec.role, v_page_id, true, true)
      ON CONFLICT (role, page_id) DO UPDATE SET can_view = true, can_edit = true;
    END IF;
  END LOOP;
END $$;

-- ─── Cron jobs ───────────────────────────────────────────────────────────────

-- On-demand settlement: runs every 5 minutes. The edge function checks each
-- enabled gateway's trigger_minutes + minimum_settlement_amount before acting.
SELECT cron.schedule(
  'on-demand-settlement',
  '*/5 * * * *',
  $$SELECT public.call_edge_function('on-demand-settlement', '{}'::jsonb, 55000);$$
);

-- Settlement status tracking: runs every 30 minutes. Checks on-demand settlement
-- responses for onhold status and disables affected payment options.
SELECT cron.schedule(
  'track-settlement-status',
  '17,47 * * * *',
  $$SELECT public.call_edge_function('track-settlement-status', '{}'::jsonb, 55000);$$
);
