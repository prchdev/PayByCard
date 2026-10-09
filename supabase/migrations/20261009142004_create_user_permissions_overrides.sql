/*
# Create user_permissions table for per-user permission overrides

## Purpose
Currently admin dashboard page access is controlled solely by role (super_admin / admin / moderator)
via the `role_permissions` table. This migration adds a `user_permissions` table that allows
super_admins to customize individual users' page access on top of their role defaults.

## How it works
- Each row in `user_permissions` represents a per-user override for a specific admin page.
- When `get-user-permissions` runs, it first loads the user's role-based permissions,
  then applies any per-user overrides (which can only restrict, never expand beyond what the role grants).
- If a user has no overrides, they get exactly their role's defaults.
- Overrides can only REMOVE access (set can_view=false) or remove edit capability (set can_edit=false).
  They cannot GRANT access to a page the user's role doesn't allow — this preserves the role hierarchy.

## New Tables
- `user_permissions`
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to admin_users.id ON DELETE CASCADE) — which admin user this override applies to
  - `page_id` (uuid, FK to admin_pages.id ON DELETE CASCADE) — which page is being overridden
  - `can_view` (boolean, default true) — overridden view permission
  - `can_edit` (boolean, default false) — overridden edit permission
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - Unique constraint on (user_id, page_id) — one override per user per page

## Security
- RLS enabled on `user_permissions`.
- SELECT: any active admin user can read (needed for get-user-permissions to check own overrides).
- INSERT/UPDATE/DELETE: only super_admin can modify user permission overrides.
*/

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES admin_pages(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, page_id)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT: active admin users can read permissions (needed for get-user-permissions)
DROP POLICY IF EXISTS "select_user_permissions" ON user_permissions;
CREATE POLICY "select_user_permissions"
ON user_permissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- INSERT: only super_admin
DROP POLICY IF EXISTS "insert_user_permissions" ON user_permissions;
CREATE POLICY "insert_user_permissions"
ON user_permissions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.is_active = true
    AND admin_users.role = 'super_admin'
  )
);

-- UPDATE: only super_admin
DROP POLICY IF EXISTS "update_user_permissions" ON user_permissions;
CREATE POLICY "update_user_permissions"
ON user_permissions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.is_active = true
    AND admin_users.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.is_active = true
    AND admin_users.role = 'super_admin'
  )
);

-- DELETE: only super_admin
DROP POLICY IF EXISTS "delete_user_permissions" ON user_permissions;
CREATE POLICY "delete_user_permissions"
ON user_permissions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.is_active = true
    AND admin_users.role = 'super_admin'
  )
);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
