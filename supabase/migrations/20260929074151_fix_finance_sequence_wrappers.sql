-- The edge functions call nextval() via Supabase RPC with a named parameter,
-- but Postgres's built-in nextval() takes a positional regclass argument.
-- This causes the RPC to fail silently, returning null, so the fallback
-- "seqData || 1" always produces code 000001 — colliding on every insert.
-- Fix: create zero-arg wrapper functions that the edge functions can call.

CREATE OR REPLACE FUNCTION next_vendor_code()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT nextval('finance_vendor_code_seq'); $$;

CREATE OR REPLACE FUNCTION next_invoice_code()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT nextval('finance_invoice_code_seq'); $$;

CREATE OR REPLACE FUNCTION next_payment_code()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT nextval('finance_payment_code_seq'); $$;

-- Sync sequences to match existing data so the next call produces a fresh code.
-- One vendor exists with VND-000001, so set the sequence to 1 (next call → 2).
SELECT setval('finance_vendor_code_seq',
  COALESCE((SELECT 1 FROM finance_vendors WHERE vendor_code = 'VND-000001' LIMIT 1), 0),
  (SELECT COUNT(*) > 0 FROM finance_vendors)
);

-- Invoice and payment sequences: sync to max existing numeric suffix if any.
SELECT setval('finance_invoice_code_seq',
  COALESCE((SELECT MAX(CAST(SUBSTRING(invoice_id_code FROM 5) AS bigint)) FROM finance_invoices WHERE invoice_id_code LIKE 'INV-%'), 0),
  (SELECT COUNT(*) > 0 FROM finance_invoices WHERE invoice_id_code LIKE 'INV-%')
);

SELECT setval('finance_payment_code_seq',
  COALESCE((SELECT MAX(CAST(SUBSTRING(payment_id_code FROM 5) AS bigint)) FROM finance_invoice_payments WHERE payment_id_code LIKE 'PAY-%'), 0),
  (SELECT COUNT(*) > 0 FROM finance_invoice_payments WHERE payment_id_code LIKE 'PAY-%')
);

-- Revoke execute from public/anon/authenticated — service role only.
REVOKE EXECUTE ON FUNCTION next_vendor_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION next_invoice_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION next_payment_code() FROM PUBLIC, anon, authenticated;
