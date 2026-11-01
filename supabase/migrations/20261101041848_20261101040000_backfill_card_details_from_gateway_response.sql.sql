/*
# Backfill Card Details from Gateway Response JSON

## Purpose
When the credit card verification feature was introduced, existing completed payments
already had card_type set but were missing card_last_four, card_network, and card_bank_name.
These details are stored inside the gateway_response JSON (Razorpay format:
gateway_response->payment->card->{last4, network, issuer, type, id}).

This migration:
1. Updates the payments table to extract card_last_four, card_network, card_bank_name
   from gateway_response for completed payments where those columns are NULL.
2. Creates user_cards entries for each unique (user_id, card_last_four) pair from
   the backfilled payments data.
3. Creates card_payment_links connecting each payment to its user_card.

## Important Notes
- Only processes payments with status = 'completed'
- Only processes payments where card_last_four is currently NULL
- Only processes payments where gateway_response has recoverable card data
- user_cards entries are created with status = 'not_submitted' (default)
- Duplicate (user_id, card_last_four) pairs are handled via ON CONFLICT
- All operations are idempotent and safe to re-run
*/

-- Step 1: Backfill payments.card_last_four, card_network, card_bank_name from gateway_response
UPDATE payments
SET
  card_last_four = (gateway_response->'payment'->'card'->>'last4'),
  card_network = COALESCE(card_network, (gateway_response->'payment'->'card'->>'network')),
  card_bank_name = COALESCE(card_bank_name, (gateway_response->'payment'->'card'->>'issuer')),
  updated_at = now()
WHERE status = 'completed'
  AND card_last_four IS NULL
  AND (gateway_response->'payment'->'card'->>'last4') IS NOT NULL;

-- Step 2: Create user_cards entries from backfilled payments data
-- Insert distinct (user_id, card_last_four) pairs that don't already exist
INSERT INTO user_cards (user_id, card_last_four, card_network, card_type, bank_name, status, created_at, updated_at)
SELECT DISTINCT ON (p.user_id, p.card_last_four)
  p.user_id,
  p.card_last_four,
  p.card_network,
  CASE
    WHEN p.card_type ILIKE '%credit%' THEN 'credit_card'
    WHEN p.card_type ILIKE '%debit%' THEN 'debit_card'
    ELSE p.card_type
  END,
  p.card_bank_name,
  'not_submitted',
  now(),
  now()
FROM payments p
WHERE p.status = 'completed'
  AND p.card_last_four IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_cards uc
    WHERE uc.user_id = p.user_id
      AND uc.card_last_four = p.card_last_four
  )
ORDER BY p.user_id, p.card_last_four, p.created_at DESC;

-- Step 3: Create card_payment_links for all backfilled payments
INSERT INTO card_payment_links (payment_id, user_card_id, user_id, verification_status)
SELECT
  p.id,
  uc.id,
  p.user_id,
  uc.status
FROM payments p
JOIN user_cards uc ON uc.user_id = p.user_id AND uc.card_last_four = p.card_last_four
WHERE p.status = 'completed'
  AND p.card_last_four IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM card_payment_links cpl WHERE cpl.payment_id = p.id
  );
