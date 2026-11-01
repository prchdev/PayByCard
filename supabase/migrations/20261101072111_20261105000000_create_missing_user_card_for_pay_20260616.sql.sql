/*
# Create Missing user_card and card_payment_link for PAY-20260616-951859

## Purpose
Payment PAY-20260616-951859 (payment id 8b06cf18-3e44-4a1d-ae2e-da019c7b571b)
was completed with card_type=visa but the gateway_response only contained Razorpay
IDs (no card entity). The Razorpay payment/order IDs no longer exist on the API,
so card_last_four cannot be recovered. The original save-card-details and backfill
migration both skipped this payment because card_last_four was NULL.

This created a gap: the user sees only 1 card on My Cards despite having 2
transactions.

## Changes
1. Creates a user_cards record for user 8263bc38-0adf-4330-8e11-4cd0eddd3aaa
   with card_last_four = '????' (placeholder — real digits unrecoverable),
   card_type = 'visa', status = 'not_submitted'.
2. Creates a card_payment_links entry connecting this payment to the new card.

## Notes
- The '????' placeholder signals that the last 4 digits are unknown.
- If the user submits card photos for verification, the OCR-extracted last 4
  will be compared against the gateway's card_last_four (which remains NULL),
  so last4_match will be false — which is correct behavior since we have no
  gateway record to match against.
- Idempotent: checks NOT EXISTS before inserting both records.
*/

INSERT INTO user_cards (user_id, card_last_four, card_network, card_type, bank_name, status)
SELECT
  '8263bc38-0adf-4330-8e11-4cd0eddd3aaa',
  '????',
  NULL,
  'visa',
  NULL,
  'not_submitted'
WHERE NOT EXISTS (
  SELECT 1 FROM user_cards
  WHERE user_id = '8263bc38-0adf-4330-8e11-4cd0eddd3aaa'
    AND card_last_four = '????'
);

INSERT INTO card_payment_links (payment_id, user_card_id, user_id, verification_status)
SELECT
  '8b06cf18-3e44-4a1d-ae2e-da019c7b571b',
  uc.id,
  '8263bc38-0adf-4330-8e11-4cd0eddd3aaa',
  uc.status
FROM user_cards uc
WHERE uc.user_id = '8263bc38-0adf-4330-8e11-4cd0eddd3aaa'
  AND uc.card_last_four = '????'
  AND NOT EXISTS (
    SELECT 1 FROM card_payment_links cpl
    WHERE cpl.payment_id = '8b06cf18-3e44-4a1d-ae2e-da019c7b571b'
  );
