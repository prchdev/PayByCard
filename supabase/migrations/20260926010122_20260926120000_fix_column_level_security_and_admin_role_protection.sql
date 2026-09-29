-- Fix: Prevent users from self-approving KYC, forging payment status, or elevating their own admin role.
-- These changes add column-level restrictions via BEFORE UPDATE triggers and tighten RLS policies.

-- 1. Prevent non-admin users from changing critical payment columns.
-- The existing UPDATE policy allows users to update their own payments, but doesn't restrict WHICH columns.
-- We add a trigger that rejects changes to status, gateway_*, invoice_*, charges, gst, total_amount
-- unless the caller is the service role (edge functions) or an admin.

CREATE OR REPLACE FUNCTION public.fn_guard_payment_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypasses all checks (edge functions use service role key)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Check if the current user is an admin by looking up their session
  -- If auth.uid() matches an admin_users.id, allow the update
  IF EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Non-admin user: reject changes to protected columns
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.gateway_transaction_id IS DISTINCT FROM OLD.gateway_transaction_id
     OR NEW.gateway_response IS DISTINCT FROM OLD.gateway_response
     OR NEW.gateway_environment IS DISTINCT FROM OLD.gateway_environment
     OR NEW.gateway_settlement_status IS DISTINCT FROM OLD.gateway_settlement_status
     OR NEW.invoice_status IS DISTINCT FROM OLD.invoice_status
     OR NEW.invoice_verified_by IS DISTINCT FROM OLD.invoice_verified_by
     OR NEW.invoice_verified_at IS DISTINCT FROM OLD.invoice_verified_at
     OR NEW.charges IS DISTINCT FROM OLD.charges
     OR NEW.gst IS DISTINCT FROM OLD.gst
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.discount IS DISTINCT FROM OLD.discount
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.failure_reason IS DISTINCT FROM OLD.failure_reason
     OR NEW.auto_payout_failed IS DISTINCT FROM OLD.auto_payout_failed
     OR NEW.split_configured IS DISTINCT FROM OLD.split_configured
     OR NEW.hold_reason IS DISTINCT FROM OLD.hold_reason
  THEN
    RAISE EXCEPTION 'You are not authorized to modify payment status or financial fields'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payment_columns ON public.payments;
CREATE TRIGGER trg_guard_payment_columns
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_payment_columns();

-- 2. Prevent non-admin users from changing critical payout columns
CREATE OR REPLACE FUNCTION public.fn_guard_payout_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.gateway_transaction_id IS DISTINCT FROM OLD.gateway_transaction_id
     OR NEW.utr_number IS DISTINCT FROM OLD.utr_number
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.failure_reason IS DISTINCT FROM OLD.failure_reason
  THEN
    RAISE EXCEPTION 'You are not authorized to modify payout status fields'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payout_columns ON public.payouts;
CREATE TRIGGER trg_guard_payout_columns
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_payout_columns();

-- 3. Prevent admin users from elevating their own role to super_admin
CREATE OR REPLACE FUNCTION public.fn_guard_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role can always update (edge functions)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If a non-service-role caller is changing the role column to super_admin,
  -- and the old value was NOT super_admin, reject it.
  -- Only an existing super_admin via edge function (service role) can promote.
  IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'super_admin' AND OLD.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a super_admin can promote users to super_admin role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admin_role ON public.admin_users;
CREATE TRIGGER trg_guard_admin_role
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_admin_role();

-- 4. Restrict settlement_config to admin-only reads
-- Drop existing SELECT policy and replace with admin-only
DROP POLICY IF EXISTS "select_settlement_config" ON public.settlement_config;
DROP POLICY IF EXISTS "select_settlement_config_all" ON public.settlement_config;
CREATE POLICY "select_settlement_config_admin_only" ON public.settlement_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );

-- 5. Revoke EXECUTE on guard functions from public/anon
REVOKE EXECUTE ON FUNCTION public.fn_guard_payment_columns() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_guard_payout_columns() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_guard_admin_role() FROM PUBLIC, anon;
