-- Store the anon key in app_config so cron helper functions can use it
INSERT INTO app_config (key, value)
VALUES ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbmxsbW94bHhnYWhud3BqeGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI3NDAsImV4cCI6MjA5MDcyODc0MH0.2VPGaHvRtEPD2M1sXyw70k6GcEOTQ1i8G7Bk-DmtN0E')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Helper function: returns the anon key from config
CREATE OR REPLACE FUNCTION public.get_anon_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM app_config WHERE key = 'anon_key';
$$;

REVOKE EXECUTE ON FUNCTION public.get_anon_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_anon_key() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_anon_key() TO authenticated;

-- Update call_edge_function to read the anon key from config
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
      'Authorization', 'Bearer ' || public.get_anon_key()
    ),
    body    := req_body,
    timeout_milliseconds := timeout_ms
  );
$$;

REVOKE EXECUTE ON FUNCTION public.call_edge_function(func_name text, req_body jsonb, timeout_ms int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_edge_function(func_name text, req_body jsonb, timeout_ms int) FROM anon;
GRANT EXECUTE ON FUNCTION public.call_edge_function(func_name text, req_body jsonb, timeout_ms int) TO authenticated;
