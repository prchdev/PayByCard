-- Schedule push notification delivery every 15 minutes
-- Runs at minutes 3, 18, 33, 48 to avoid conflicts with other cron jobs
SELECT cron.schedule(
  'send-push-notifications',
  '3,18,33,48 * * * *',
  $$
  SELECT net.http_post(
    url                  := 'https://vinllmoxlxgahnwpjxea.supabase.co/functions/v1/send-push-notification',
    headers              := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbmxsbW94bHhnYWhud3BqeGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI3NDAsImV4cCI6MjA5MDcyODc0MH0.2VPGaHvRtEPD2M1sXyw70k6GcEOTQ1i8G7Bk-DmtN0E"}'::jsonb,
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
