/*
# Create Business Settings table and admin page registration

## Purpose
Admin Dashboard → Regular Usage → Business Settings page.
Shows all Business-KYCed users with company name search. Clicking a user opens a modal with 3 tabs:
1. Company Details — business KYC info + contact person + editable company bank details
2. Enable Services — payout service toggle + min/max transaction amounts + charges + GST + deduction mode
3. Payouts — paginated list of payout transactions for that user with CSV export

## New Tables
- `business_settings` — per-user business service configuration
  - `id` uuid PK
  - `user_id` uuid NOT NULL REFERENCES users(id) — the business user
  - `payout_enabled` boolean default false — whether payout service is enabled
  - `min_transaction_amount` numeric default 0
  - `max_transaction_amount` numeric default 0
  - `charges_percentage` numeric default 0
  - `min_charges_inr` numeric default 0
  - `max_charges_inr` numeric default 0
  - `gst_percentage` numeric default 0
  - `charges_deduction_mode` text default 'additional' — 'from_amount' or 'additional'
  - `account_holder_name` text — company bank account holder name
  - `ifsc_code` text — company bank IFSC
  - `account_number` text — company bank account number
  - `account_type` text — type of account (savings/current/etc.)
  - `created_at` timestamptz
  - `updated_at` timestamptz

## Modified Tables
- `admin_pages` — insert new page 'business-settings' with display_order 14
- `role_permissions` — grant view+edit to super_admin, view to admin, view to moderator

## Security
- RLS enabled on `business_settings`
- Service role full access (edge functions use service role key)
- No direct anon/authenticated access — all access goes through admin edge functions with session verification
*/

CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payout_enabled boolean NOT NULL DEFAULT false,
  min_transaction_amount numeric NOT NULL DEFAULT 0,
  max_transaction_amount numeric NOT NULL DEFAULT 0,
  charges_percentage numeric NOT NULL DEFAULT 0,
  min_charges_inr numeric NOT NULL DEFAULT 0,
  max_charges_inr numeric NOT NULL DEFAULT 0,
  gst_percentage numeric NOT NULL DEFAULT 0,
  charges_deduction_mode text NOT NULL DEFAULT 'additional',
  account_holder_name text,
  ifsc_code text,
  account_number text,
  account_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON business_settings TO service_role;

-- Create unique index for fast user_id lookups
CREATE UNIQUE INDEX IF NOT EXISTS business_settings_user_id_idx ON business_settings(user_id);

-- Register admin page
DO $$
DECLARE
  v_page_id uuid;
BEGIN
  SELECT id INTO v_page_id FROM admin_pages WHERE page_key = 'business-settings';
  IF v_page_id IS NULL THEN
    INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order, is_active)
    VALUES ('business-settings', 'Business Settings', '/admin/business-settings', 'Manage business KYCed users, enable services, and view payouts', 'Building2', 14, true)
    RETURNING id INTO v_page_id;
  END IF;

  -- Grant default permissions: super_admin full, admin view+edit, moderator view
  IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'super_admin' AND page_id = v_page_id) THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit) VALUES ('super_admin', v_page_id, true, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'admin' AND page_id = v_page_id) THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit) VALUES ('admin', v_page_id, true, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'moderator' AND page_id = v_page_id) THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit) VALUES ('moderator', v_page_id, true, false);
  END IF;
END $$;
