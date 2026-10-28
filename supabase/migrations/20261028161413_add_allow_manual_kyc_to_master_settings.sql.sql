ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS allow_manual_kyc boolean NOT NULL DEFAULT true;