/*
# Update payout UTR for PAY-20261029-338497

## Purpose
Corrects the UTR number for transaction PAY-20261029-338497.
Old UTR: 630211369148 → New UTR: 630211467832
*/
SET ROLE service_role;
UPDATE payouts
SET utr_number = '630211467832',
    payout_reference_number = '630211467832',
    updated_at = NOW()
WHERE id = '67bc5790-2eeb-4c9b-bc98-846eea01f08c';
RESET ROLE;
