-- Mark KYC as verification_pending for DigiLocker-verified users whose document files
-- were never stored (pan_photo_url or front_photo_url is NULL due to MIME type restriction
-- that blocked XML/JSON uploads to the kyc-documents bucket).
-- This allows the user to re-run the DigiLocker flow and restore document links.

UPDATE kyc_pan_verification p
SET 
  status = 'verification_pending',
  updated_at = now()
FROM kyc_address_proof a
WHERE a.user_id = p.user_id
  AND p.digilocker_verified = true
  AND (p.pan_photo_url IS NULL OR a.front_photo_url IS NULL)
  AND p.status = 'verified';

UPDATE kyc_address_proof a
SET 
  status = 'verification_pending',
  updated_at = now()
FROM kyc_pan_verification p
WHERE p.user_id = a.user_id
  AND a.digilocker_verified = true
  AND (p.pan_photo_url IS NULL OR a.front_photo_url IS NULL)
  AND a.status = 'verified';
