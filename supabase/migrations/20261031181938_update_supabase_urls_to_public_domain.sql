/*
# Replace internal Supabase URLs with public domain in stored data

## Summary
The project now uses the custom domain `api.paybycard.in` instead of the
internal Supabase URL `https://vinllmoxlxgahnwpjxea.supabase.co`. Many
existing rows in KYC, merchant onboarding, master settings, and payments
tables still contain the old internal URL in document/logo/file path
columns. This migration rewrites the host portion of those URLs from the
internal Supabase host to the public-facing domain.

## What changes
- All text columns containing `https://vinllmoxlxgahnwpjxea.supabase.co`
  are updated to `https://api.paybycard.in` via `REPLACE()`.
- Only the host changes; the path and query string are preserved.

## Tables and columns affected
- `kyc_pan_verification.pan_photo_url`
- `kyc_address_proof.front_photo_url`, `kyc_address_proof.back_photo_url`
- `kyc_business_info`: `aoa_url`, `company_pan_photo_url`, `gst_certificate_url`,
  `incorporation_certificate_url`, `loa_url`, `moa_url`
- `master_settings.company_logo_url`
- `merchant_onboarding`: `aadhaar_front_url`, `aadhaar_back_url`, `pan_photo_url`
- `payments`: `bill_file_url`

## Security
- No RLS or policy changes.
- No schema changes.
- No data loss — only string replacement in existing text values.
*/

UPDATE kyc_pan_verification
  SET pan_photo_url = REPLACE(pan_photo_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE pan_photo_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_address_proof
  SET front_photo_url = REPLACE(front_photo_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE front_photo_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_address_proof
  SET back_photo_url = REPLACE(back_photo_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE back_photo_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_business_info
  SET aoa_url = REPLACE(aoa_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE aoa_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_business_info
  SET company_pan_photo_url = REPLACE(company_pan_photo_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE company_pan_photo_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_business_info
  SET gst_certificate_url = REPLACE(gst_certificate_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE gst_certificate_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_business_info
  SET incorporation_certificate_url = REPLACE(incorporation_certificate_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE incorporation_certificate_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_business_info
  SET loa_url = REPLACE(loa_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE loa_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE kyc_business_info
  SET moa_url = REPLACE(moa_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE moa_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE master_settings
  SET company_logo_url = REPLACE(company_logo_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE company_logo_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE merchant_onboarding
  SET aadhaar_front_url = REPLACE(aadhaar_front_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE aadhaar_front_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE merchant_onboarding
  SET aadhaar_back_url = REPLACE(aadhaar_back_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE aadhaar_back_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE merchant_onboarding
  SET pan_photo_url = REPLACE(pan_photo_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE pan_photo_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';

UPDATE payments
  SET bill_file_url = REPLACE(bill_file_url,
    'https://vinllmoxlxgahnwpjxea.supabase.co', 'https://api.paybycard.in')
  WHERE bill_file_url LIKE '%vinllmoxlxgahnwpjxea.supabase.co%';
