/*
# Add hold_reason column to payments table

1. Purpose
   - Stores the admin-provided reason when a transaction is put on hold.
   - Paired with pre_hold_status (added in the previous migration) to support
     the Hold/Unhold feature.

2. Changes
   - Add column `hold_reason` (text, nullable) to `payments` table.
   - No RLS changes needed — the column is only modified by the service role
     (edge functions). Existing RLS policies on `payments` remain unchanged.
*/

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS hold_reason text;
