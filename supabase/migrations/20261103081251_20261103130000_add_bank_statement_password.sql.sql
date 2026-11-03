/*
# Add bank_statement_password column to business_integration_applications

1. Modified Tables
- `business_integration_applications`
  - `bank_statement_password` (text, nullable) — Optional password for password-protected bank statement PDFs

2. Security
- No RLS policy changes — existing owner-scoped policies already cover this column.
*/

ALTER TABLE business_integration_applications
  ADD COLUMN IF NOT EXISTS bank_statement_password text;