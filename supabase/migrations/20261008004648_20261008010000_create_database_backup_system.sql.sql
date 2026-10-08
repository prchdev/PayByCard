/*
# Create Database Backup System

## Purpose
Provides admin users the ability to create and download database backups from the Admin Dashboard.
This migration creates:
1. A `backup_history` table to track all backups created by admins
2. A storage bucket `database-backups` for storing backup files
3. RLS policies for the backup_history table (admin-only access)
4. An entry in the `admin_pages` table for role-based permission management

## Changes
### New Tables
- `backup_history`: Records each backup operation with metadata
  - id (uuid, PK)
  - backup_type (text): Type of backup (full, schema_data, data_only, schema_only, roles, linked, pg_dump, storage, edge_functions, cron_jobs, auth_users, project_config)
  - backup_label (text): Human-readable label for the backup type
  - status (text): pending, in_progress, completed, failed
  - file_path (text): Path in the storage bucket where the backup file is stored
  - file_name (text): Name of the backup file
  - file_size_bytes (bigint): Size of the backup file
  - file_count (int): Number of files in this backup (for multi-file backups)
  - storage_bucket (text): Storage bucket name
  - created_by_admin_id (uuid): Admin who created the backup
  - created_by_admin_name (text): Admin's display name
  - created_at (timestamptz): When the backup was initiated
  - completed_at (timestamptz): When the backup finished
  - error_message (text): Error details if the backup failed
  - is_deleted (boolean): Soft-delete flag — when true, the backup files have been removed and the download link is disabled

### Storage
- New bucket `database-backups` (private, admin-only)

### Security
- RLS enabled on `backup_history` (admin access only via service role from edge functions)
- Storage bucket policies restrict access to authenticated admins

### Admin Pages
- New entry in `admin_pages` for `database-backup` page with role permissions
*/

-- Create backup_history table
CREATE TABLE IF NOT EXISTS backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL,
  backup_label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  file_path text,
  file_name text,
  file_size_bytes bigint DEFAULT 0,
  file_count int DEFAULT 0,
  storage_bucket text DEFAULT 'database-backups',
  created_by_admin_id uuid,
  created_by_admin_name text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  is_deleted boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- Deny all access from anon/authenticated roles (edge functions use service role which bypasses RLS)
DROP POLICY IF EXISTS "deny_anon_backup_history" ON backup_history;
CREATE POLICY "deny_anon_backup_history"
ON backup_history FOR SELECT
TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "deny_anon_insert_backup_history" ON backup_history;
CREATE POLICY "deny_anon_insert_backup_history"
ON backup_history FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_update_backup_history" ON backup_history;
CREATE POLICY "deny_anon_update_backup_history"
ON backup_history FOR UPDATE
TO anon, authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_delete_backup_history" ON backup_history;
CREATE POLICY "deny_anon_delete_backup_history"
ON backup_history FOR DELETE
TO anon, authenticated
USING (false);

-- Create storage bucket for database backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('database-backups', 'database-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: deny public access to database-backups bucket
DROP POLICY IF EXISTS "deny_anon_read_database_backups" ON storage.objects;
CREATE POLICY "deny_anon_read_database_backups"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'database-backups' AND false);

DROP POLICY IF EXISTS "deny_anon_write_database_backups" ON storage.objects;
CREATE POLICY "deny_anon_write_database_backups"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'database-backups' AND false);

DROP POLICY IF EXISTS "deny_anon_update_database_backups" ON storage.objects;
CREATE POLICY "deny_anon_update_database_backups"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'database-backups' AND false) WITH CHECK (bucket_id = 'database-backups' AND false);

DROP POLICY IF EXISTS "deny_anon_delete_database_backups" ON storage.objects;
CREATE POLICY "deny_anon_delete_database_backups"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'database-backups' AND false);

-- Add admin page entry for database-backup
INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order, is_active)
SELECT 'database-backup', 'Database Backup', '/admin/database-backup', 'Download database backups and view backup history', 'DatabaseBackup', 220, true
WHERE NOT EXISTS (SELECT 1 FROM admin_pages WHERE page_key = 'database-backup');

-- Grant default permissions for super_admin (full access) and admin (view only)
INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'super_admin', ap.id, true, true
FROM admin_pages ap
WHERE ap.page_key = 'database-backup'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.page_id = ap.id AND rp.role = 'super_admin'
);

INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'admin', ap.id, true, false
FROM admin_pages ap
WHERE ap.page_key = 'database-backup'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.page_id = ap.id AND rp.role = 'admin'
);
