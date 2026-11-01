/*
# Credit Card Verification System

## Purpose
Creates the database infrastructure for capturing, verifying, and managing
credit/debit card details used in payment transactions. Supports AI-based
verification of card last-4 digits and name-on-card match with KYC name,
with admin review fallback and third-party card flagging.

## New Tables

### 1. user_cards
Stores unique cards per user (deduplicated by last 4 digits + card network).
- `id` (uuid, PK)
- `user_id` (uuid, FK to users, NOT NULL) — owner
- `card_last_four` (text, NOT NULL) — last 4 digits of card number
- `card_network` (text) — visa, mastercard, rupay, amex, etc.
- `card_type` (text) — credit_card, debit_card, etc.
- `bank_name` (text) — issuing bank name
- `name_on_card` (text) — name printed on the card (from photo upload)
- `card_id` (text) — gateway-provided card token/ID (if available)
- `auth_code` (text) — gateway-provided auth code (if available)
- `front_photo_url` (text) — storage URL for masked front photo
- `back_photo_url` (text) — storage URL for masked back photo
- `status` (text, NOT NULL, DEFAULT 'not_submitted') — one of:
    not_submitted, submitted, verified, third_party, rejected
- `ai_verification_result` (jsonb) — AI verification details (match scores)
- `admin_verified_by` (uuid, FK to admin_users) — admin who reviewed
- `admin_verified_at` (timestamptz) — when admin reviewed
- `admin_rejection_reason` (text) — reason if rejected
- `card_verification_deadline` (timestamptz) — 12h deadline for submission
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

### 2. card_payment_links
Links payments to user_cards — tracks which card was used for which payment
and the card verification status at the time of the payment check.
- `id` (uuid, PK)
- `payment_id` (uuid, FK to payments, NOT NULL)
- `user_card_id` (uuid, FK to user_cards, NOT NULL)
- `user_id` (uuid, FK to users, NOT NULL)
- `verification_status` (text, NOT NULL) — status of card at payment time
- `created_at` (timestamptz, DEFAULT now())

## Modified Tables

### payments
Added columns to capture card details from gateway transaction status:
- `card_network` (text) — visa, mastercard, rupay, etc.
- `card_bank_name` (text) — issuing bank
- `card_id` (text) — gateway card token
- `card_auth_code` (text) — gateway auth code
- `card_name_on_card` (text) — name on card from gateway (if available)
- `card_verification_status` (text) — tracks verification state in poll flow

## Storage
- Creates `card-photos` bucket (private) for masked card photo uploads.

## Admin Pages
- Adds `verify-cards` page to admin_pages table.
- Adds role_permissions entries for super_admin and admin (view + edit).
- Adds role_permissions entry for moderator (view only).

## Security
- RLS enabled on user_cards with owner-scoped policies (auth.uid() = user_id).
- RLS enabled on card_payment_links with owner-scoped policies.
- Grants to authenticated and service_role.
- Storage bucket is private with authenticated-only upload policy.
*/

-- ─── New columns on payments ────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_network') THEN
    ALTER TABLE payments ADD COLUMN card_network text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_bank_name') THEN
    ALTER TABLE payments ADD COLUMN card_bank_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_id') THEN
    ALTER TABLE payments ADD COLUMN card_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_auth_code') THEN
    ALTER TABLE payments ADD COLUMN card_auth_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_name_on_card') THEN
    ALTER TABLE payments ADD COLUMN card_name_on_card text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_verification_status') THEN
    ALTER TABLE payments ADD COLUMN card_verification_status text;
  END IF;
END $$;

-- ─── user_cards table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_last_four text NOT NULL,
  card_network text,
  card_type text,
  bank_name text,
  name_on_card text,
  card_id text,
  auth_code text,
  front_photo_url text,
  back_photo_url text,
  status text NOT NULL DEFAULT 'not_submitted',
  ai_verification_result jsonb,
  admin_verified_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_verified_at timestamptz,
  admin_rejection_reason text,
  card_verification_deadline timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON user_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_cards TO service_role;

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_status ON user_cards(status);
CREATE INDEX IF NOT EXISTS idx_user_cards_user_last4 ON user_cards(user_id, card_last_four);

DROP POLICY IF EXISTS "Users can view own cards" ON user_cards;
CREATE POLICY "Users can view own cards"
  ON user_cards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own cards" ON user_cards;
CREATE POLICY "Users can insert own cards"
  ON user_cards FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own cards" ON user_cards;
CREATE POLICY "Users can update own cards"
  ON user_cards FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own cards" ON user_cards;
CREATE POLICY "Users can delete own cards"
  ON user_cards FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── card_payment_links table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS card_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_card_id uuid NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE card_payment_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON card_payment_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON card_payment_links TO service_role;

CREATE INDEX IF NOT EXISTS idx_card_payment_links_payment ON card_payment_links(payment_id);
CREATE INDEX IF NOT EXISTS idx_card_payment_links_card ON card_payment_links(user_card_id);
CREATE INDEX IF NOT EXISTS idx_card_payment_links_user ON card_payment_links(user_id);

DROP POLICY IF EXISTS "Users can view own card payment links" ON card_payment_links;
CREATE POLICY "Users can view own card payment links"
  ON card_payment_links FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own card payment links" ON card_payment_links;
CREATE POLICY "Users can insert own card payment links"
  ON card_payment_links FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own card payment links" ON card_payment_links;
CREATE POLICY "Users can update own card payment links"
  ON card_payment_links FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own card payment links" ON card_payment_links;
CREATE POLICY "Users can delete own card payment links"
  ON card_payment_links FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── Storage bucket for card photos ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('card-photos', 'card-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated can upload card photos" ON storage.objects;
CREATE POLICY "Authenticated can upload card photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-photos');

DROP POLICY IF EXISTS "Authenticated can read own card photos" ON storage.objects;
CREATE POLICY "Authenticated can read own card photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'card-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "Authenticated can delete own card photos" ON storage.objects;
CREATE POLICY "Authenticated can delete own card photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'card-photos' AND owner = auth.uid());

-- ─── Admin page entry ───────────────────────────────────────────────────────

INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order, is_active)
VALUES (
  'verify-cards',
  'Verify Cards',
  '/admin/verify-cards',
  'Review and verify user credit/debit card submissions',
  'CreditCard',
  8,
  true
)
ON CONFLICT (page_key) DO NOTHING;

-- ─── Role permissions for verify-cards page ─────────────────────────────────

DO $$
DECLARE
  v_page_id uuid;
  v_super_admin_id uuid;
  v_admin_id uuid;
  v_moderator_id uuid;
BEGIN
  SELECT id INTO v_page_id FROM admin_pages WHERE page_key = 'verify-cards';
  IF v_page_id IS NULL THEN RETURN; END IF;

  -- super_admin: full access
  SELECT id INTO v_super_admin_id FROM role_permissions
    WHERE role = 'super_admin' AND page_id = v_page_id LIMIT 1;
  IF v_super_admin_id IS NULL THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit)
    VALUES ('super_admin', v_page_id, true, true);
  END IF;

  -- admin: full access
  SELECT id INTO v_admin_id FROM role_permissions
    WHERE role = 'admin' AND page_id = v_page_id LIMIT 1;
  IF v_admin_id IS NULL THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit)
    VALUES ('admin', v_page_id, true, true);
  END IF;

  -- moderator: view only
  SELECT id INTO v_moderator_id FROM role_permissions
    WHERE role = 'moderator' AND page_id = v_page_id LIMIT 1;
  IF v_moderator_id IS NULL THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit)
    VALUES ('moderator', v_page_id, true, false);
  END IF;
END $$;
