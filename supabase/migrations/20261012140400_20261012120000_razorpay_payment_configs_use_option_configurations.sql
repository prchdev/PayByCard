/*
# Replace Razorpay Checkout Config ID with per-option payment configuration

## What this does
Razorpay previously stored a single `checkout_config_id` text field per payment
option, mirroring the Razorpay Dashboard's "Checkout Config" concept. That field
was never actually read by the initiate-payment function — the configuration was
stored but unused. This migration replaces it with two array columns that match
the per-option approach already used for PhonePe:

1. `methods` — which Razorpay payment methods to allow (e.g. `card`).
2. `allowed_card_networks` — which card networks to display in the checkout
   (e.g. `Visa`, `MasterCard`, `RuPay`, `AmericanExpress`, `DinersClub`).

These are sent to Razorpay's Orders API as `payment_capture` options and to the
checkout `options` object, giving the admin control over which card networks
appear for each payment category.

## Column changes on `razorpay_payment_configs`
- DROP `checkout_config_id` (text) — was never consumed at payment time.
- ADD `methods` (text[], default `{}`) — allowed Razorpay methods.
- ADD `allowed_card_networks` (text[], default `{}`) — allowed card networks.

## RLS
No policy changes. RLS stays enabled; the table remains deny-all for anon/authenticated
and is accessed only via the `razorpay-payment-configs` edge function using the service role.
*/

ALTER TABLE razorpay_payment_configs DROP COLUMN IF EXISTS checkout_config_id;
ALTER TABLE razorpay_payment_configs ADD COLUMN IF NOT EXISTS methods text[] NOT NULL DEFAULT '{}';
ALTER TABLE razorpay_payment_configs ADD COLUMN IF NOT EXISTS allowed_card_networks text[] NOT NULL DEFAULT '{}';
