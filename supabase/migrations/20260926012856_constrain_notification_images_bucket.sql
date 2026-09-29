/*
  # Bound anonymous uploads to the public notification image bucket

  1. Problem
     - `anon_upload_notification_images` lets the unauthenticated role insert objects
       of any size and any content type into the public `notification-images` bucket.
     - The only size and type checks live in the admin page in the browser, which an
       attacker simply does not run.

  2. Change
     - Enforce the same limits at the storage layer: images only, 5 MB maximum.
     - The policy is kept because this application has no Supabase Auth, so its own
       admin uploader acts as the `anon` role and would otherwise break.

  3. Safety
     - Existing objects are untouched; only future uploads are constrained.
*/

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
WHERE id = 'notification-images';
