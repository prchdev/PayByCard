-- Add payment_option_name column to payments table for storing the selected payment option name
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_option_name TEXT;
