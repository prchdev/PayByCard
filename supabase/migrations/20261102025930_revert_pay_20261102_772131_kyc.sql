-- Revert PAY-20261102-772131: KYC was completed by sender instead of beneficiary
-- The beneficiary name (Shraddha Pravin Chalke) did not match the KYC name (PRAVIN PRABHAKAR CHALKE)
-- We need to reset both merchant_onboarding and payment records

-- Step 1: Temporarily disable the guard trigger
ALTER TABLE payments DISABLE TRIGGER trg_guard_payment_columns;

-- Step 2: Reset merchant_onboarding record back to pending, clear KYC data
UPDATE merchant_onboarding
SET
  status = 'pending',
  full_name = 'Shraddha Pravin Chalke',
  pan_number = NULL,
  pan_photo_url = NULL,
  dob = NULL,
  id_number = NULL,
  address = NULL,
  city = NULL,
  state = NULL,
  pincode = NULL,
  digilocker_verified = FALSE,
  digilocker_provider = NULL,
  kyc_method = NULL,
  kyc_completed_at = NULL,
  verified_at = NULL,
  aadhaar_front_url = NULL,
  aadhaar_back_url = NULL,
  rejection_reason = NULL,
  updated_at = NOW()
WHERE id = '8635cdd0-99d8-42ee-b229-4443483fff21';

-- Step 3: Reset payment status to kyc_pending
UPDATE payments
SET
  status = 'kyc_pending',
  updated_at = NOW()
WHERE payment_reference = 'PAY-20261102-772131';

-- Step 4: Re-enable the guard trigger
ALTER TABLE payments ENABLE TRIGGER trg_guard_payment_columns;
