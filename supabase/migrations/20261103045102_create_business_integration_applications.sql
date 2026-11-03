/*
# Create business_integration_applications table

1. New Tables
- `business_integration_applications`
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to users, NOT NULL) — the applicant
  - `company_type` (text) — Sole Proprietorship, LLP, etc.
  - `business_name` (text)
  - `incorporation_number` (text)
  - `business_pan` (text)
  - `gst_number` (text, nullable)
  - `business_address` (text)
  - `business_email` (text)
  - `business_phone` (text)
  - `incorporation_certificate_url` (text, nullable)
  - `company_pan_photo_url` (text, nullable)
  - `gst_certificate_url` (text, nullable)
  - `loa_url` (text, nullable)
  - `status` (text, default 'pending') — pending | in_review | approved | rejected
  - `rejection_reason` (text, nullable)
  - `reviewed_by_admin_id` (uuid, nullable, FK to admin_users)
  - `reviewed_at` (timestamptz, nullable)
  - `submitted_at` (timestamptz, default now())
  - `created_at` / `updated_at` (timestamptz)

2. Security
- Enable RLS.
- Grant CRUD to `authenticated` + `service_role`.
- Owner-scoped SELECT/INSERT/UPDATE policies (user can only see/edit their own application).
*/

CREATE TABLE IF NOT EXISTS business_integration_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_type text NOT NULL,
  business_name text NOT NULL,
  incorporation_number text NOT NULL,
  business_pan text NOT NULL,
  gst_number text DEFAULT '',
  business_address text NOT NULL,
  business_email text NOT NULL,
  business_phone text NOT NULL,
  incorporation_certificate_url text,
  company_pan_photo_url text,
  gst_certificate_url text,
  loa_url text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_integration_applications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON business_integration_applications TO authenticated, service_role;

DROP POLICY IF EXISTS "select_own_biz_integration" ON business_integration_applications;
CREATE POLICY "select_own_biz_integration"
  ON business_integration_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_biz_integration" ON business_integration_applications;
CREATE POLICY "insert_own_biz_integration"
  ON business_integration_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_biz_integration" ON business_integration_applications;
CREATE POLICY "update_own_biz_integration"
  ON business_integration_applications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_biz_integration" ON business_integration_applications;
CREATE POLICY "delete_own_biz_integration"
  ON business_integration_applications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_biz_integration_user_id ON business_integration_applications(user_id);
