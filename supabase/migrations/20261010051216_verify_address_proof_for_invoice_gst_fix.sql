UPDATE kyc_address_proof
SET status = 'verified',
    updated_at = now()
WHERE user_id = '2d92b650-e6c7-4bf2-8b51-048b2eae4d7c';
