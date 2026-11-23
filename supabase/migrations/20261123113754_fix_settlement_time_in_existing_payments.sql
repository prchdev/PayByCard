/*
# Fix settlement_time in existing payment records

## Problem
The `initiate-payment` edge function was storing `payment_categories.settlement_time`
("instant") in `category_details->>settlement_time` instead of the value from
`payment_options` (the card-type row the admin configures on the Payment Options
page, e.g. "T+2"). This caused the admin Reports page and transaction displays
to show "Instant Settlement" even when the admin had configured "T+2".

## Fix
Update `category_details` JSON on all payments where the stored `settlement_time`
is "instant" to use the actual settlement_time from the linked `payment_options`
row (via `payment_category_id`). Falls back to the first enabled payment_options
settlement_time if the linked option is not found.

## Scope
All payments with `category_details->>'settlement_time' = 'instant'` are updated
to use the correct settlement_time from payment_options.
*/

-- Update category_details settlement_time for all payments that currently have "instant"
-- Use the settlement_time from the linked payment_options row (via payment_category_id).
-- If no linked option exists, fall back to the first enabled payment_options settlement_time.
UPDATE payments p
SET category_details = jsonb_set(
  p.category_details,
  '{settlement_time}',
  to_jsonb(COALESCE(
    po.settlement_time,
    (SELECT settlement_time FROM payment_options WHERE is_enabled = true LIMIT 1),
    'instant'
  ))
)
FROM payment_options po
WHERE p.payment_category_id = po.id
  AND p.category_details->>'settlement_time' = 'instant';

-- Also update payments that have no matching payment_category_id (fallback)
UPDATE payments p
SET category_details = jsonb_set(
  p.category_details,
  '{settlement_time}',
  to_jsonb(COALESCE(
    (SELECT settlement_time FROM payment_options WHERE is_enabled = true LIMIT 1),
    'instant'
  ))
)
WHERE p.category_details->>'settlement_time' = 'instant'
  AND NOT EXISTS (
    SELECT 1 FROM payment_options po WHERE po.id = p.payment_category_id
  );
