/*
  # Remove blanket client access to Razorpay payment routing

  1. Problem
     - All four policies on `razorpay_payment_configs` used a `true` predicate for the
       `authenticated` role, so any signed-in caller could read, add, change or delete
       the routing rows that decide how customer payments are processed.

  2. Change
     - Drop the four permissive policies. RLS stays enabled, so the table is deny-all
       for `anon` and `authenticated`.

  3. Safety
     - No browser code queries this table directly; the `razorpay-payment-configs`
       edge function manages it with the service role. No data is altered.
*/

DROP POLICY IF EXISTS "select_razorpay_configs_admin" ON public.razorpay_payment_configs;
DROP POLICY IF EXISTS "insert_razorpay_configs_admin" ON public.razorpay_payment_configs;
DROP POLICY IF EXISTS "update_razorpay_configs_admin" ON public.razorpay_payment_configs;
DROP POLICY IF EXISTS "delete_razorpay_configs_admin" ON public.razorpay_payment_configs;
