/*
# Create Offers table and register admin page

1. New Tables
- `offers`: stores promotional offers published by admin
  - id (uuid PK)
  - offer_name (text, not null) - display title of the offer
  - start_date (date, not null) - when the offer becomes active
  - end_date (date, not null) - when the offer expires
  - offer_details (text) - rich HTML content with formatting, hyperlinks, images
  - is_active (boolean, default true) - admin can disable an offer without deleting
  - created_by (uuid, references admin_users) - which admin created the offer
  - created_at (timestamptz)
  - updated_at (timestamptz)
  - slug (text, unique) - URL-friendly slug for SEO

2. Security (RLS)
- Public (anon + authenticated) can SELECT active offers where current date is within start/end range
- Admin operations go through edge functions using service role key (bypasses RLS)

3. Admin page registration
- Adds 'offers' page to admin_pages table
- Grants view+edit to super_admin and admin roles, view-only to moderator

4. Indexes
- Index on (is_active, start_date, end_date) for efficient public queries
- Index on created_at for admin listing sorted by latest
*/

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_name text NOT NULL,
  slug text UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  offer_details text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Public can view active offers within their date range
DROP POLICY IF EXISTS "public_select_active_offers" ON offers;
CREATE POLICY "public_select_active_offers"
ON offers FOR SELECT
TO anon, authenticated
USING (is_active = true AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE);

-- Admins manage offers through service role (edge functions), no direct RLS needed for writes
-- Service role bypasses RLS, so no INSERT/UPDATE/DELETE policies needed

CREATE INDEX IF NOT EXISTS idx_offers_active_dates ON offers (is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON offers (created_at DESC);

-- Register admin page
INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order, is_active)
VALUES ('offers', 'Offers', '/admin/offers', 'Create and manage promotional offers', 'Tag', 28, true)
ON CONFLICT (page_key) DO NOTHING;

-- Grant permissions
INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'super_admin', id, true, true FROM admin_pages WHERE page_key = 'offers'
ON CONFLICT (role, page_id) DO NOTHING;

INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'admin', id, true, true FROM admin_pages WHERE page_key = 'offers'
ON CONFLICT (role, page_id) DO NOTHING;

INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'moderator', id, true, false FROM admin_pages WHERE page_key = 'offers'
ON CONFLICT (role, page_id) DO NOTHING;
