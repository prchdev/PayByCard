/*
  # Remove blanket client access to payout gateway credentials

  1. Problem
     - `payout_settings` holds live Cashfree / Razorpay / Axis payout API secrets and
       virtual account numbers.
     - Four policies granted SELECT, INSERT, UPDATE and DELETE to the `authenticated`
       role with a `true` predicate, so any holder of an `authenticated` JWT could read
       the secrets and repoint payouts at their own account.

  2. Change
     - Drop all four permissive policies. RLS stays enabled, so the table becomes
       deny-all for `anon` and `authenticated`.

  3. Safety
     - No browser code queries this table directly; the `get-payout-settings` and
       `save-payout-settings` edge functions reach it with the service role, which
       bypasses RLS. No data is altered.
*/

DROP POLICY IF EXISTS "select_payout_settings" ON public.payout_settings;
DROP POLICY IF EXISTS "insert_payout_settings" ON public.payout_settings;
DROP POLICY IF EXISTS "update_payout_settings" ON public.payout_settings;
DROP POLICY IF EXISTS "delete_payout_settings" ON public.payout_settings;
