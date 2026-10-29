/*
# Clear Manual KYC for Users with Zero Transactions

## Purpose
One-time cleanup operation that clears KYC records for users who:
1. Performed KYC using the manual method (digilocker_verified = false)
2. Have verified KYC status in both pan and address proof tables
3. Have zero transactions in the payments table

## What This Migration Does
- Identifies qualifying users via a CTE using NOT EXISTS on payments
- Deletes their KYC rows from kyc_pan_verification, kyc_address_proof, and kyc_business_info
- Sets kyc_completed = false on the users table for these users
- Reports the count of affected users

## Data Safety
- Only affects users with manual KYC (digilocker_verified=false) and verified status
- Only affects users with ZERO payments (NOT EXISTS check)
- Does NOT affect digilocker-verified users
- Does NOT affect users with any transaction history
- The kyc_completed flag is reset to false so users can re-submit KYC

## Storage Note
KYC document files in the kyc-documents storage bucket for these users are not
removed by this migration (storage cleanup requires the Storage API, not SQL).
The orphaned files are harmless — they are no longer referenced by any KYC record.
*/

WITH qualifying_users AS (
  SELECT kp.user_id
  FROM kyc_pan_verification kp
  WHERE kp.digilocker_verified = false
    AND kp.status = 'verified'
    AND EXISTS (
      SELECT 1 FROM kyc_address_proof ka
      WHERE ka.user_id = kp.user_id
        AND ka.digilocker_verified = false
        AND ka.status = 'verified'
    )
    AND NOT EXISTS (
      SELECT 1 FROM payments p WHERE p.user_id = kp.user_id
    )
),
deleted_pan AS (
  DELETE FROM kyc_pan_verification
  WHERE user_id IN (SELECT user_id FROM qualifying_users)
  RETURNING user_id
),
deleted_address AS (
  DELETE FROM kyc_address_proof
  WHERE user_id IN (SELECT user_id FROM qualifying_users)
  RETURNING user_id
),
deleted_business AS (
  DELETE FROM kyc_business_info
  WHERE user_id IN (SELECT user_id FROM qualifying_users)
  RETURNING user_id
),
reset_users AS (
  UPDATE users
  SET kyc_completed = false, updated_at = now()
  WHERE id IN (SELECT user_id FROM qualifying_users)
  RETURNING id
)
SELECT
  (SELECT count(*) FROM qualifying_users) AS total_qualifying_users,
  (SELECT count(*) FROM deleted_pan) AS deleted_pan_records,
  (SELECT count(*) FROM deleted_address) AS deleted_address_records,
  (SELECT count(*) FROM deleted_business) AS deleted_business_records,
  (SELECT count(*) FROM reset_users) AS reset_users;
