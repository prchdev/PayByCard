/*
# Add indexes for KYC tables user_id lookups

## Purpose
The admin KYC list edge function queries kyc_pan_verification, kyc_address_proof,
and kyc_business_info filtered by user_id (IN batch). These indexes speed up
those lookups significantly.

## Changes
- Creates indexes on user_id for the 3 KYC tables if they don't already exist
- Uses IF NOT EXISTS for idempotency
*/

CREATE INDEX IF NOT EXISTS idx_kyc_pan_verification_user_id ON kyc_pan_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_address_proof_user_id ON kyc_address_proof(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_business_info_user_id ON kyc_business_info(user_id);
