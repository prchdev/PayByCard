/*
# Create Coupons table and register admin page

1. New Tables
- `coupons`: stores discount coupon codes for payments
  - id (uuid PK)
  - coupon_code (text, unique, not null) - the code users enter
  - minimum_total (numeric, default 0) - minimum bill value for coupon to apply
  - discount_type (text, not null) - 'flat' or 'percentage'
  - discount_value (numeric, not null) - flat amount or percentage depending on type
  - per_account_limit (integer, default 1) - max times a single user/account can use this coupon
  - applicable_to (text, not null, default 'all') - 'first_transaction', 'non_first_transaction', or 'all'
  - total_usage_limit (integer) - max total usage across all accounts (null = unlimited)
  - total_usage_count (integer, default 0) - running count of times used
  - start_date (date, not null) - when coupon becomes valid
  - end_date (date, not null) - when coupon expires
  - is_active (boolean, default true) - admin can disable without deleting
  - is_deleted (boolean, default false) - soft delete
  - created_by (uuid, references admin_users) - which admin created the coupon
  - created_at (timestamptz)
  - updated_at (timestamptz)

- `coupon_usages`: tracks each individual coupon usage per account
  - id (uuid PK)
  - coupon_id (uuid, references coupons, ON DELETE CASCADE)
  - user_id (uuid, not null) - which user used the coupon
  - payment_id (uuid) - optional link to the payment
  - used_at (timestamptz)
  - discount_amount (numeric) - actual discount applied

2. Security (RLS)
- Service role bypasses RLS for all admin operations (edge functions use service role key)
- No direct public access — coupon validation will go through edge functions
- RLS enabled on both tables as deny-by-default

3. Admin page registration
- Adds 'coupons' page to admin_pages table under Marketing section
- Grants view+edit to super_admin and admin roles, view-only to moderator

4. Indexes
- Index on coupon_code for fast lookups
- Index on (is_active, is_deleted, start_date, end_date) for valid coupon queries
- Index on coupon_usages (coupon_id, user_id) for per-account usage checks
*/

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text UNIQUE NOT NULL,
  minimum_total numeric NOT NULL DEFAULT 0,
  discount_type text NOT NULL CHECK (discount_type IN ('flat', 'percentage')),
  discount_value numeric NOT NULL,
  per_account_limit integer NOT NULL DEFAULT 1,
  applicable_to text NOT NULL DEFAULT 'all' CHECK (applicable_to IN ('first_transaction', 'non_first_transaction', 'all')),
  total_usage_limit integer,
  total_usage_count integer NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Admin operations go through service role (edge functions), no direct RLS needed
-- Service role bypasses RLS, so no policies needed for admin operations

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupons_active_dates ON coupons (is_active, is_deleted, start_date, end_date);

CREATE TABLE IF NOT EXISTS coupon_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payment_id uuid,
  used_at timestamptz NOT NULL DEFAULT now(),
  discount_amount numeric
);

ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user ON coupon_usages (coupon_id, user_id);

-- Register admin page
DO $$
DECLARE
  v_page_id uuid;
BEGIN
  INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order, is_active)
  VALUES ('coupons', 'Coupons', '/admin/coupons', 'Create and manage discount coupon codes', 'Ticket', 29, true)
  ON CONFLICT (page_key) DO UPDATE SET
    page_name = EXCLUDED.page_name,
    page_path = EXCLUDED.page_path,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active
  RETURNING id INTO v_page_id;

  IF v_page_id IS NOT NULL THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit)
    VALUES
      ('super_admin', v_page_id, true, true),
      ('admin', v_page_id, true, true),
      ('moderator', v_page_id, true, false)
    ON CONFLICT (role, page_id) DO UPDATE SET
      can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit;
  END IF;
END $$;
