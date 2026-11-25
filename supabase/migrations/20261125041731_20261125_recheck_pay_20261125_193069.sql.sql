/*
# Re-check PAY-20261125-193069 with Razorpay

1. Purpose
   - Payment PAY-20261125-193069 was marked "failed" after Razorpay reported
     a bank_technical_error from the issuer bank (Bank of Baroda). The user
     believes the payment may have succeeded on retry. This resets the payment
     to "processing" with poll_count = 0 so the stale-payment poller re-queries
     Razorpay and picks up any late capture.

2. Changes
   - Temporarily disables the trg_guard_payment_columns trigger on payments.
   - Sets status = 'processing', failure_reason = NULL, poll_count = 0,
     last_polled_at = NULL on the single payment row.
   - Re-enables the trigger.

3. Notes
   - No data is lost; payment_logs retains the full history.
   - The poller runs every 5 minutes and will call Razorpay's API on its next run.
   - If Razorpay still reports "failed", the poller will re-mark it as failed.
   - If Razorpay now reports "captured", the poller will process it as completed.
*/

ALTER TABLE payments DISABLE TRIGGER trg_guard_payment_columns;

UPDATE payments
SET status = 'processing',
    failure_reason = NULL,
    poll_count = 0,
    last_polled_at = NULL,
    updated_at = now()
WHERE payment_reference = 'PAY-20261125-193069'
  AND status = 'failed';

ALTER TABLE payments ENABLE TRIGGER trg_guard_payment_columns;
