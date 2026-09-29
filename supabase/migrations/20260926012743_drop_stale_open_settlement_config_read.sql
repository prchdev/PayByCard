/*
  # Remove the stale open read policy on settlement_config

  1. Problem
     - An earlier hardening migration added `select_settlement_config_admin_only` but
       left the original `Anyone can view settlement config` policy in place.
     - RLS policies are OR-combined, so every `authenticated` caller could still read
       the IMPS threshold, settlement delay and auto-payout flag.

  2. Change
     - Drop the stale permissive policy, leaving only the admin-scoped one.

  3. Safety
     - No browser code queries `settlement_config` directly; the edge functions use
       the service role. No data is altered.
*/

DROP POLICY IF EXISTS "Anyone can view settlement config" ON public.settlement_config;
