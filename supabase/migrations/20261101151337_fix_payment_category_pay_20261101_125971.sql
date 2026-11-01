-- Fix payment PAY-20261101-125971: category_details was built from the payment
-- option instead of the actual payment_categories row. This corrects
-- business_category_id and category_details so the merchant KYC flow fires.
-- payment_category_id is kept as the payment option ID (FK constraint requires it).
-- The status change to kyc_pending is done separately by the trigger-merchant-kyc
-- edge function using the service role key (bypasses the guard trigger).

UPDATE payments
SET
  business_category_id = 'cca8af45-0925-4bb5-825e-a49addd6a568',
  category_details = jsonb_build_object(
    'category_name', 'Housing, Rent & Maintenance Payments',
    'is_enabled', true,
    'display_order', 47,
    'receiver_kyc_required', true,
    'refund_after_hours', 48,
    'settlement_time', 'instant'
  ),
  updated_at = now()
WHERE payment_reference = 'PAY-20261101-125971'
  AND id = 'f50287ff-e114-459e-aa52-8b675449c244';

-- Log the correction
INSERT INTO payment_logs (payment_id, status, message, metadata)
SELECT
  id,
  'kyc_pending',
  'Payment category corrected to "Housing, Rent & Maintenance Payments". Merchant KYC will be triggered.',
  jsonb_build_object('corrected_by', 'migration', 'old_payment_category_id', 'ce34fb86-2445-4754-ad4c-aeca8ff9befc', 'new_business_category_id', 'cca8af45-0925-4bb5-825e-a49addd6a568')
FROM payments
WHERE payment_reference = 'PAY-20261101-125971'
  AND id = 'f50287ff-e114-459e-aa52-8b675449c244';
