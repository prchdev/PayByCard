ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS gateway_encryption_key text;
