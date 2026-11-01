/*
# Fix critical security issues: column-level security, app_config lockdown, SECURITY DEFINER function access

## Summary

This migration closes several critical security gaps that allowed authenticated users
to modify data they should not control, or to call privileged database functions.

## Problems fixed

1. **payments table (CRITICAL)**: Authenticated users had INSERT/UPDATE/DELETE grants on ALL
   columns. A user could directly insert a fake payment record with any status, or update
   their own payment's status/amount/gateway_transaction_id via the Data API, bypassing
   edge functions entirely. Fix: revoke INSERT/UPDATE/DELETE from authenticated; keep
   SELECT only. All payment writes go through edge functions using the service_role key.

2. **users table (CRITICAL)**: Authenticated users could UPDATE every column including
   is_disabled, is_restricted, kyc_completed, password_hash, failed_login_attempts,
   locked_until. A user could un-disable their own account, mark KYC as completed, or
   reset their own login attempt counter. Fix: revoke broad UPDATE grant; grant UPDATE
   only on safe columns (first_name, last_name, middle_name, full_name, email,
   mobile_number, updated_at). Also restrict SELECT to exclude password_hash.

3. **app_config table (HIGH)**: All authenticated users could SELECT, INSERT, UPDATE,
   DELETE any row (USING(true) on all policies). This table stores project_url and
   anon_key. While these values are semi-public, a malicious user could modify
   project_url to redirect API calls. Fix: revoke all grants from anon and
   authenticated; restrict to service_role only.

4. **SECURITY DEFINER functions (HIGH)**: get_anon_key(), get_project_url(),
   call_edge_function(), and call_edge_function_if() were executable by the
   authenticated role. call_edge_function is especially dangerous as it can invoke
   any edge function from the database with service-role privileges. Fix: revoke
   EXECUTE from authenticated on all four functions.

## Security changes

- Revoke INSERT, UPDATE, DELETE on payments FROM authenticated (keep SELECT).
- Revoke UPDATE (all columns) on users FROM authenticated; grant UPDATE only on
  safe columns. Revoke SELECT on password_hash FROM authenticated and anon.
- Revoke ALL on app_config FROM anon, authenticated; grant ALL to service_role only.
- Drop existing app_config policies (no longer needed — service_role bypasses RLS).
- Revoke EXECUTE on call_edge_function, call_edge_function_if, get_anon_key,
  get_project_url FROM authenticated.
*/

-- ─────────────────────────────────────────────────────────────
-- 1. payments table: restrict authenticated to SELECT only
-- ─────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON payments FROM anon;

-- Drop the now-unnecessary INSERT/UPDATE policies for authenticated
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;

-- ─────────────────────────────────────────────────────────────
-- 2. users table: column-level security for UPDATE, hide password_hash
-- ─────────────────────────────────────────────────────────────
-- Revoke broad grants and re-grant with column restrictions
REVOKE UPDATE ON users FROM authenticated;
REVOKE SELECT ON users FROM authenticated;
REVOKE SELECT ON users FROM anon;

-- Allow authenticated users to SELECT their own row EXCEPT password_hash
GRANT SELECT (
  id, first_name, middle_name, last_name, full_name, mobile_number, email,
  is_mobile_verified, is_email_verified, kyc_completed, created_at, updated_at,
  last_login_at, last_login_ip, referral_code, referred_by
) ON users TO authenticated;

-- Allow anon to SELECT only minimal columns needed for registration check
GRANT SELECT (id, mobile_number, email) ON users TO anon;

-- Allow authenticated users to UPDATE only safe profile columns
GRANT UPDATE (
  first_name, middle_name, last_name, full_name, email, mobile_number, updated_at
) ON users TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. app_config table: lock to service_role only
-- ─────────────────────────────────────────────────────────────
REVOKE SELECT, INSERT, UPDATE, DELETE ON app_config FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON app_config FROM authenticated;

-- Drop existing open policies — service_role bypasses RLS so no policies needed
DROP POLICY IF EXISTS "select_app_config" ON app_config;
DROP POLICY IF EXISTS "insert_app_config" ON app_config;
DROP POLICY IF EXISTS "update_app_config" ON app_config;
DROP POLICY IF EXISTS "delete_app_config" ON app_config;

-- Ensure service_role has full access (it bypasses RLS but needs the grant)
GRANT SELECT, INSERT, UPDATE, DELETE ON app_config TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. SECURITY DEFINER functions: revoke EXECUTE from authenticated
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.call_edge_function(text, jsonb, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.call_edge_function_if(boolean, text, jsonb, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_anon_key() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_project_url() FROM authenticated;

-- Also revoke from anon for completeness
REVOKE EXECUTE ON FUNCTION public.call_edge_function(text, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.call_edge_function_if(boolean, text, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_anon_key() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_project_url() FROM anon;
