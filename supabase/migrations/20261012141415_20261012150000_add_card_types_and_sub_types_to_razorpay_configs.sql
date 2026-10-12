/*
# Add card_types and card_sub_types to Razorpay payment configs

## What this does
Adds two new array columns to `razorpay_payment_configs` to mirror PhonePe's
per-option card filtering, giving the admin control over which card types
(credit/debit) and card sub-types (consumer/business) appear in Razorpay checkout
for each payment option.

## Column changes on `razorpay_payment_configs`
- ADD `card_types` (text[], default `{}`) — allowed card types: `credit`, `debit`.
- ADD `card_sub_types` (text[], default `{}`) — allowed card sub-types: `consumer`, `business`.

## RLS
No policy changes. RLS stays enabled; the table remains deny-all for anon/authenticated
and is accessed only via the `razorpay-payment-configs` edge function using the service role.
*/

ALTER TABLE razorpay_payment_configs ADD COLUMN IF NOT EXISTS card_types text[] NOT NULL DEFAULT '{}';
ALTER TABLE razorpay_payment_configs ADD COLUMN IF NOT EXISTS card_sub_types text[] NOT NULL DEFAULT '{}';
