/*
# Add Company Bank Details columns to business_integration_applications

1. Modified Tables
- `business_integration_applications`
  - `bank_account_name` (text, nullable) — Name on the company bank account
  - `bank_ifsc` (text, nullable) — IFSC code of the bank branch
  - `bank_account_number` (text, nullable) — Company bank account number
  - `bank_account_type` (text, nullable) — Type: Saving / Current / NRE / NRO
  - `cancel_cheque_url` (text, nullable) — URL to uploaded cancelled cheque image/PDF
  - `bank_statement_url` (text, nullable) — URL to uploaded bank statement PDF

2. Security
- No RLS policy changes — existing owner-scoped policies already cover these new columns.
- No grant changes needed — existing table-level grants apply to all columns.
*/

ALTER TABLE business_integration_applications
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS cancel_cheque_url text,
  ADD COLUMN IF NOT EXISTS bank_statement_url text;