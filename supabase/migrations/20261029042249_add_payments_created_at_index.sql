/*
# Add index on payments(created_at) for default sort in Reports

## Purpose
The admin reports page sorts by created_at DESC by default. Without an index,
Postgres must do a full table scan + sort on every page load. This index
speeds up the default sort and date-range filtered queries.

## Changes
- Creates an index on created_at (IF NOT EXISTS for idempotency)
*/

CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
