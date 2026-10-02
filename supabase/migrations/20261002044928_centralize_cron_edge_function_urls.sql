-- Create a config table to store the project base URL in one place
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_app_config" ON app_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_app_config" ON app_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_app_config" ON app_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_app_config" ON app_config FOR DELETE TO authenticated USING (true);

-- Store the base URL (custom domain)
INSERT INTO app_config (key, value) VALUES ('project_url', 'https://api.paybycard.in')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Helper function: returns the project base URL
CREATE OR REPLACE FUNCTION public.get_project_url()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM app_config WHERE key = 'project_url';
$$;

-- Helper function: calls an edge function by name, using the centralized URL
-- Usage: SELECT call_edge_function('auto-payout', '{}'::jsonb, 55000);
CREATE OR REPLACE FUNCTION public.call_edge_function(
  func_name text,
  req_body jsonb DEFAULT '{}'::jsonb,
  timeout_ms int DEFAULT 55000
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT net.http_post(
    url     := public.get_project_url() || '/functions/v1/' || func_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
    ),
    body    := req_body,
    timeout_milliseconds := timeout_ms
  );
$$;

-- Grant execute only to authenticated (not anon)
REVOKE EXECUTE ON FUNCTION public.get_project_url() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_project_url() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_url() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.call_edge_function(func_name text, req_body jsonb, timeout_ms int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_edge_function(func_name text, req_body jsonb, timeout_ms int) FROM anon;
GRANT EXECUTE ON FUNCTION public.call_edge_function(func_name text, req_body jsonb, timeout_ms int) TO authenticated;
