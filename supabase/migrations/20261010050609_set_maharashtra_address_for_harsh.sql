INSERT INTO kyc_address_proof (user_id, state, status)
VALUES ('2d92b650-e6c7-4bf2-8b51-048b2eae4d7c', 'Maharashtra', 'pending')
ON CONFLICT (user_id) DO UPDATE
SET state = 'Maharashtra',
    updated_at = now();
