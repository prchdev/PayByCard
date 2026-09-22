DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_categories'
      AND column_name = 'max_payment_per_beneficiary'
  ) THEN
    ALTER TABLE payment_categories ADD COLUMN max_payment_per_beneficiary numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
