-- The admin dashboard uploads notification campaign images directly from the browser
-- using the anon key (session-based admin auth, not Supabase Auth). The existing
-- INSERT policy only grants `authenticated`, so anon-key uploads fail with
-- "new row violates row-level security policy".
-- The bucket already enforces 5MB size limit and image-only mime types,
-- so allowing anon INSERT is safe.

DROP POLICY IF EXISTS "anon_upload_notification_images" ON storage.objects;
CREATE POLICY "anon_upload_notification_images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'notification-images');
