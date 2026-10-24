-- Fix "consumer" → "customer" in card_sub_types to match Razorpay API.
-- Razorpay's card sub_type accepts "customer" and "business", not "consumer".
UPDATE razorpay_payment_configs
SET card_sub_types = array_replace(card_sub_types, 'consumer', 'customer')
WHERE 'consumer' = ANY(card_sub_types);
