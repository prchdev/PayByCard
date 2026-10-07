/*
# Add retail/business visibility flags to payment_categories

## Purpose
Allows admin to control which payment categories are visible to retail vs business users.
A user is considered "business" only if their kyc_business_info has status = 'verified'.
If business KYC is not submitted or not approved, the user is treated as retail.

## Changes
1. New columns on `payment_categories`:
   - `available_to_retail` (boolean, NOT NULL, default true) -- category visible to retail users
   - `available_to_business` (boolean, NOT NULL, default true) -- category visible to business users

2. Existing rows are backfilled to `true` for both columns so current behavior is unchanged.

## Notes
- The filtering logic lives in the `get-payment-categories-list` edge function (server-side),
  so both the web app and native mobile app receive the correct filtered list without any
  client-side changes beyond passing `userId` in the request body.
*/