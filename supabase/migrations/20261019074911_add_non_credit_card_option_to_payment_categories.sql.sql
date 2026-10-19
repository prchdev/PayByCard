-- 1. Order the credit-card payment_options: 0 → keep, assign incremental orders,
--    and push "Non Credit Card Payment Options" to the very end.
UPDATE payment_options
  SET display_order = new_order
  FROM (
    VALUES
      ('Visa/Master/Rupay/Maestro Card - Fast Settlement', 0),
      ('Visa/Master/Rupay/Maestro Corporate Card - Fast Settlement', 1),
      ('American Express/Diners Club Card', 2),
      ('Non Credit Card Payment Options (UPI, Internet Banking, Debit Card)', 100)
  ) AS mapping(name, new_order)
  WHERE payment_options.category_name = mapping.name;

-- 2. Add the "Non Credit Card Payment Options" entry to payment_categories
--    (the table the mobile app / get-payment-categories-list reads from) so it
--    shows as the last enabled option. display_order 52 follows the highest
--    existing enabled row (51). id matches the payment_options row so admin
--    management stays consistent.
INSERT INTO payment_categories (
    id, category_name, is_enabled, display_order,
    receiver_kyc_required, new_card_payment_delay_hours,
    refund_after_hours, settlement_time,
    invoice_required, invoice_frequency_months, invoice_min_amount,
    max_payment_per_beneficiary,
    available_to_retail, available_to_business
) VALUES (
    'f23ca556-d413-4d53-9aca-032fed566abe',
    'Non Credit Card Payment Options (UPI, Internet Banking, Debit Card)',
    true, 52,
    false, 0,
    0, 'instant',
    false, 0, 0,
    0,
    true, true
)
ON CONFLICT (id) DO UPDATE SET
    category_name   = EXCLUDED.category_name,
    is_enabled      = EXCLUDED.is_enabled,
    display_order   = EXCLUDED.display_order,
    settlement_time = EXCLUDED.settlement_time,
    available_to_retail   = EXCLUDED.available_to_retail,
    available_to_business = EXCLUDED.available_to_business;
