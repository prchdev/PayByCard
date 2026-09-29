/*
  # Revoke client EXECUTE on the column-guard trigger functions

  1. Problem
     - The guard trigger functions were created with a default PUBLIC execute grant,
       so the anon and authenticated roles can call them directly. They are trigger
       functions and only meaningful inside a trigger, but no client should be able
       to invoke them.

  2. Change
     - Revoke EXECUTE from PUBLIC, anon and authenticated. Triggers run as the table
       owner and are unaffected.
*/

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_guard_payment_columns', 'fn_guard_payout_columns', 'fn_guard_admin_role')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn.sig);
  END LOOP;
END $$;
