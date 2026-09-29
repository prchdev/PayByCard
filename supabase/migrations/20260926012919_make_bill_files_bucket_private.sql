/*
  # Make the bill file bucket private

  1. Problem
     - The `bill-files` bucket is marked public, so any object placed in it would be
       readable by anyone who learns or guesses its path. Payment bills are customer
       financial documents.

  2. Change
     - Flip the bucket to private. Access from server code continues to work through
       the service role and signed URLs.

  3. Safety
     - The bucket currently holds no objects and is referenced by no code, so this
       cannot break an existing feature.
*/

UPDATE storage.buckets SET public = false WHERE id = 'bill-files';
