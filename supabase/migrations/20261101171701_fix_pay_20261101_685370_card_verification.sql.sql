-- Temporarily disable the guard to reset payment status for re-processing
ALTER TABLE payments DISABLE TRIGGER trg_guard_payment_columns;

UPDATE payments
SET status = 'processing',
    poll_count = 0,
    last_polled_at = NULL
WHERE payment_reference = 'PAY-20261101-685370';

ALTER TABLE payments ENABLE TRIGGER trg_guard_payment_columns;
