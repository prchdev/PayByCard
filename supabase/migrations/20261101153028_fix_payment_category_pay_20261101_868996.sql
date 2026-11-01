-- Fix payment PAY-20261101-868996: category_details was built from the payment
-- option instead of the actual payment_categories row. business_category_id is
-- already correct (cca8af45...), so only category_details needs fixing.

UPDATE payments
SET
  category_details = jsonb_build_object(
    'category_name', 'Housing, Rent & Maintenance Payments',
    'is_enabled', true,
    'display_order', 47,
    'receiver_kyc_required', true,
    'refund_after_hours', 48,
    'settlement_time', 'instant'
  ),
  updated_at = now()
WHERE payment_reference = 'PAY-20261101-868996'
  AND id = '037e0046-759a-4de1-8b92-be2c66e3dea4';

-- Log the correction
INSERT INTO payment_logs (payment_id, status, message, metadata)
SELECT
  id,
  status,
  'Payment category_details corrected to "Housing, Rent & Maintenance Payments".',
  jsonb_build_object('corrected_by', 'migration', 'old_category_name', 'Visa/Master/Rupay/Maestro Credit Card - Fast Settlement', 'new_category_name', 'Housing, Rent & Maintenance Payments')
FROM payments
WHERE payment_reference = 'PAY-20261101-868996'
  AND id = '037e0046-759a-4de1-8b92-be2c66e3dea4';
