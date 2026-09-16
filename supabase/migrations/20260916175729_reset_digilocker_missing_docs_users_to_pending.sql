-- Delete KYC records for DigiLocker-verified users whose document files were never stored.
-- This resets them to the initial "KYC not submitted" state so they can re-run the flow cleanly.

-- First, identify the affected users
WITH affected_users AS (
  SELECT user_id FROM kyc_pan_verification
  WHERE digilocker_verified = true AND pan_photo_url IS NULL
)
-- Delete address proof records
DELETE FROM kyc_address_proof
WHERE user_id IN (SELECT user_id FROM affected_users);

-- Delete business info records (if any)
DELETE FROM kyc_business_info
WHERE user_id IN (
  SELECT user_id FROM kyc_pan_verification
  WHERE digilocker_verified = true AND pan_photo_url IS NULL
);

-- Delete PAN verification records
DELETE FROM kyc_pan_verification
WHERE digilocker_verified = true AND pan_photo_url IS NULL;

-- Reset kyc_completed flag on users table
UPDATE users
SET kyc_completed = false
WHERE id IN (
  SELECT id FROM users
  WHERE id IN (
    SELECT user_id FROM kyc_pan_verification
    WHERE digilocker_verified = true AND pan_photo_url IS NULL
  )
);
