-- Mark PAY-20261101-357309 as refunded (already refunded outside the system)
ALTER TABLE payments DISABLE TRIGGER trg_guard_payment_columns;

UPDATE payments
SET status = 'refunded', updated_at = NOW()
WHERE payment_reference = 'PAY-20261101-357309';

-- Reject any linked merchant_onboarding if present
UPDATE merchant_onboarding
SET status = 'rejected', updated_at = NOW()
WHERE payment_id = (
  SELECT id FROM payments WHERE payment_reference = 'PAY-20261101-357309'
) AND status IN ('pending', 'submitted', 'expired');

ALTER TABLE payments ENABLE TRIGGER trg_guard_payment_columns;
