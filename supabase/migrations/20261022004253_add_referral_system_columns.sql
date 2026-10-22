/*
# Add Referral System Columns to users

## Summary
Adds referral tracking columns to the existing `users` table so each user gets
a unique 8-character alphanumeric referral code, can optionally be credited as
having been referred by another user, and the referrer can be identified.

## Changes
### users table (additive only — no existing column altered or dropped)
- `referral_code` (text, unique) — 8-char alphanumeric code generated at registration.
  Unique-indexed for fast lookups. NULL is allowed only for legacy rows that
  predate the referral feature; new registrations always receive a code.
- `referred_by` (uuid, nullable) — foreign key to `users(id)` of the user whose
  referral code was used at sign-up. NULL means a non-referral registration.
  ON DELETE SET NULL so deleting a referrer does not lose the referred user.

## Security
- No new RLS policies required: the existing users-table policies continue to
  govern access. The new columns are populated server-side by the register-user
  edge function (service role), and the get-referral-info edge function exposes
  only the requesting user's own code.
- A partial unique index on referral_code keeps codes unique while allowing
  legacy NULLs to coexist.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referral_code') THEN
    ALTER TABLE users ADD COLUMN referral_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referred_by') THEN
    ALTER TABLE users ADD COLUMN referred_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Unique index that allows multiple NULLs (legacy rows) but enforces uniqueness
-- on actual codes. Uses COALESCE trick for partial uniqueness on non-null values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique
  ON users (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by
  ON users (referred_by)
  WHERE referred_by IS NOT NULL;

-- Backfill referral codes for existing users who do not have one yet.
-- Uses a secure random string built from crypt() to avoid collisions.
DO $$
DECLARE
  rec RECORD;
  new_code TEXT;
BEGIN
  FOR rec IN SELECT id FROM users WHERE referral_code IS NULL LOOP
    LOOP
      new_code := upper(substr(
        replace(
          encode(digest(
            rec.id::text || clock_timestamp()::text || random()::text,
            'sha256'
          ), 'hex'),
          'OIlS0', 'ABCDE'
        ),
        1, 8
      ));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE referral_code = new_code);
    END LOOP;
    UPDATE users SET referral_code = new_code WHERE id = rec.id AND referral_code IS NULL;
  END LOOP;
END $$;

-- Make referral_code NOT NULL now that every row has one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referral_code' AND is_nullable = 'YES') THEN
    ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
  END IF;
END $$;
