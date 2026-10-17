/*
# Add coupon discount support to payments and max discount to coupons

1. Changes to `coupons` table
- Add `maximum_discount_value` (numeric, nullable) — caps the discount amount for percentage-type coupons.
2. Changes to `payments` table
- Add `coupon_id` (uuid, nullable, references coupons(id)) — which coupon was applied.
- Add `coupon_code` (text, nullable) — the coupon code string at time of payment.
- Add `coupon_discount_amount` (numeric(15,2), default 0) — the discount amount deducted from the total.
3. Security
- No RLS policy changes (payments already has RLS; coupons are admin-managed via service role).
4. Notes
- The `maximum_discount_value` only applies to percentage coupons: if the computed percentage exceeds the cap, the cap is used.
- `coupon_discount_amount` is subtracted from `total_amount` at payment initiation time.
- Coupon usage is recorded in `coupon_usages` table when the payment reaches `completed` or `settlement_pending` status.
*/

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS maximum_discount_value numeric;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS coupon_discount_amount numeric(15,2) NOT NULL DEFAULT 0;
