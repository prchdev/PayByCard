/*
# Add "Enable Manual KYC for Address Proof When PAN is Verified" setting

## Purpose
When enabled, users who already have a verified PAN (via DigiLocker or manual upload)
can upload their address proof documents manually through the "My KYC Details" page,
without needing to go through DigiLocker again. Their personal details (first/middle/last name)
remain locked since the PAN is already verified.

When disabled, the system follows the existing KYC verification approach — users must
complete both PAN and address proof through DigiLocker or the standard manual flow.

## Changes
1. **master_settings table**
   - New column: `allow_manual_addr_proof_when_pan_verified` (boolean, default false)
   - When true: users with verified PAN can upload address proof manually
   - When false: existing behavior is preserved

## Security
- No RLS or policy changes needed — the column is read/written only by admin and service_role
- The setting is enforced server-side in the save-kyc-data edge function
*/

ALTER TABLE master_settings
  ADD COLUMN IF NOT EXISTS allow_manual_addr_proof_when_pan_verified boolean NOT NULL DEFAULT false;
