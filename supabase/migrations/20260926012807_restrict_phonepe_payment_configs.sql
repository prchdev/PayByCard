/*
  # Remove blanket client access to PhonePe payment routing

  1. Problem
     - Despite their `_admin` names, all four policies on `phonepe_payment_configs`
       used a `true` predicate for the `authenticated` role, so any signed-in caller
       could read, add, change or delete the card-type / network routing rows that
       decide how customer payments are processed.

  2. Change
     - Drop the four permissive policies. RLS stays enabled, so the table is deny-all
       for `anon` and `authenticated`.

  3. Safety
     - No browser code queries this table directly; the `phonepe-payment-configs`
       edge function manages it with the service role. No data is altered.
*/

DROP POLICY IF EXISTS "select_phonepe_configs_admin" ON public.phonepe_payment_configs;
DROP POLICY IF EXISTS "insert_phonepe_configs_admin" ON public.phonepe_payment_configs;
DROP POLICY IF EXISTS "update_phonepe_configs_admin" ON public.phonepe_payment_configs;
DROP POLICY IF EXISTS "delete_phonepe_configs_admin" ON public.phonepe_payment_configs;
