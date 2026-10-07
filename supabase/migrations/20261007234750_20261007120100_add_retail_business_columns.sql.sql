ALTER TABLE payment_categories
  ADD COLUMN IF NOT EXISTS available_to_retail boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_to_business boolean NOT NULL DEFAULT true;