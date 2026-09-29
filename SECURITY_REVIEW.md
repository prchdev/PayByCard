# PayByCard Security Review

**Date:** 2026-09-26
**Scope:** Web app (React/Vite), Supabase database (48 tables, 11 functions, RLS policies, storage), 80+ edge functions, 50+ migrations, shared backend used by native mobile app (`prchdev/PayByCardMobile`)
**Standards assessed against:** DPDP Act 2023, CERT-In Directions, PCI-DSS, ISO 27001

---

## CRITICAL Findings

### 1. KYC documents stored in public bucket — government IDs world-readable

The `kyc-documents` storage bucket was originally created as `public = true` with storage policies that had **no owner-scoping** — any authenticated user could read/overwrite any other user's PAN card, Aadhaar, and address proof. A later migration (`20260831175536`) made the bucket private, but the frontend (`ReviewModal.tsx`, `AdminMerchantKyc.tsx`) still renders images from `/storage/v1/object/public/kyc-documents/` URLs. If those URLs are cached anywhere or if the bucket is ever flipped back to public, the PII is exposed.

- **DPDP violation:** Sensitive personal data (Aadhaar, PAN) accessible without authentication
- **PCI-DSS 3.4:** Failure to render PAN unreadable
- **ISO 27001 A.8.2.2:** Lack of appropriate classification and handling

### 2. Broken Object-Level Authorization (BOLA/IDOR) across critical edge functions

Multiple edge functions trust a `userId` or `adminId` from the request body/query **without verifying a session token**:

| Function | Issue |
|---|---|
| `get-kyc-data` | Anyone with a user UUID gets full KYC (PAN, Aadhaar, business info) |
| `download-kyc-file` | Anyone with an admin UUID mints signed URLs for any user's KYC documents |
| `initiate-payment` | Anyone with a user UUID initiates payments on their behalf |
| `register-push-token` | Anyone with a user UUID registers push tokens for that account |
| `auto-payout` | Completely unauthenticated; `force` flag is a public query parameter |

The session framework exists (`_shared/session.ts` with `withUserSession`/`withAdminSession`) and is correctly used by `upload-kyc-file`, but most functions don't use it.

- **DPDP violation:** Unauthorized processing of personal data
- **ISO 27001 A.9.4.2:** Access control failure
- **CERT-In:** Reportable incident if exploited

### 3. Users can self-approve KYC and forge payment status

The `payments` and `payouts` UPDATE policies use `WITH CHECK (user_id = auth.uid())` — this only checks ownership, **not which columns are being changed**. A user can:

- Change their own `payment.status` from `pending` to `completed` (bypassing gateway confirmation)
- Set `gateway_transaction_id`, `gateway_response`, `charges`, `gst`, `total_amount`
- Self-verify their own invoice (`invoice_status = 'verified'`, `invoice_verified_by = <their UUID>`)
- Self-approve their own KYC (`status = 'verified'`, `approved_by_admin_id = <their UUID>`)
- Change their own `admin_users.role` to `super_admin`

- **PCI-DSS 6.5.8:** Broken authorization
- **ISO 27001 A.14.2.5:** Insecure system architecture

### 4. `admin-verify-login-otp` never issues a session token

After OTP verification, the function returns `adminId`, `email`, `role` but never calls `issueSessionToken()`. All subsequent admin API calls trust a client-supplied `adminId` in the request body. Anyone who learns an admin UUID can impersonate that admin.

### 5. Payment gateway webhook — generic handler accepts any payload

`payment-gateway-webhook` has a `handleGenericWebhook` default branch that accepts and echoes any payload with **no signature verification**. Unknown gateway values should return 400/404, not a success echo.

### 6. Payment gateway API secrets returned to client

`get-payment-gateways` edge function returns `secret_key`, `test_api_secret`, `production_api_secret` to the browser. `initiate-payment` returns gateway API keys (Enkash `apiKey`, Cashfree `clientId/secret`) to the client. These are secret credentials visible in DevTools.

- **PCI-DSS 3.1:** Unnecessary storage/exposure of cardholder data secrets
- **ISO 27001 A.8.2.3:** Cryptographic key management failure

---

## HIGH Findings

### 7. Admin identity stored in localStorage — trivially spoofable

`AdminHome.tsx` stores `adminId` and `adminRole` in `localStorage`. `useAdminPermission.ts` reads `adminRole` from `sessionStorage` and grants `super_admin` full access **without any server-side check**. Any user can open DevTools and set `sessionStorage.setItem('adminRole', 'super_admin')`.

### 8. Webhook signature comparison is not constant-time

All four gateway verifiers (Cashfree, Razorpay, PayU, PhonePe) use `===` for HMAC comparison, which is vulnerable to timing attacks. The shared session module already implements constant-time comparison — it should be reused.

### 9. Payment lookup before signature verification

Webhook handlers fetch the payment row **before** verifying the signature, allowing unauthenticated attackers to probe payment references via timing/error differences.

### 10. Bulk campaign tables have RLS enabled but no policies

`bulk_campaign_recipients`, `bulk_email_campaigns`, `bulk_sms_campaigns` have RLS enabled but zero policies — they are locked for all roles (including `service_role` bypasses RLS, so edge functions work, but any client query returns nothing). Confirm this is intentional and that no client code queries these tables directly.

### 11. `postMessage` with wildcard origin

`KYCVerification.tsx:52` sends `cf_verification_id` via `postMessage` with `'*'` target origin — any opener page receives the verification ID.

### 12. PhonePe checkout URL redirect without domain validation

`MakePayment.tsx:1287` redirects to `checkoutUrl` from the API response without validating it belongs to PhonePe's domain.

---

## MEDIUM Findings

### 13. WAF fails open silently

`secureFetch.ts:54` — if the WAF edge function fails, the request proceeds anyway. For a payment platform, consider fail-closed for high-risk operations.

### 14. `Math.random()` for payment references

`initiate-payment/index.ts:722` uses non-cryptographic randomness for payment references. Use `crypto.getRandomValues`.

### 15. User identity persisted in localStorage

`AuthContext.tsx:57` stores `userId` and `email` in `localStorage`, accessible to XSS. Consider httpOnly cookies or server-issued refresh tokens.

### 16. File upload validation is client-side only

Notification images, support ticket attachments, and KYC files have type/size validation only in the browser. Edge functions must independently validate magic bytes, MIME types, and sizes.

### 17. IP address is client-supplied

Support ticket replies send `ip: 'admin'` or `ip: 'user'` from the client. The edge function must capture the real IP from `x-forwarded-for`.

### 18. `settlement_config` readable by all authenticated users

Internal settlement configuration (IMPS thresholds, delays, payout intervals) is exposed to all authenticated users — should be admin-only.

### 19. Wildcard CORS on all non-webhook functions

`Access-Control-Allow-Origin: *` on all edge functions. Since auth uses custom headers (not cookies), this doesn't create CSRF directly, but removes any origin-bound defense layer for functions that trust body-supplied identifiers.

---

## Mobile App (PayByCardMobile) — Shared Backend Risks

Since the mobile app uses the same Supabase backend and edge functions, **all findings above apply to the mobile app directly**. Additional mobile-specific items to verify in the mobile repo:

1. **Service role key** — confirm `SUPABASE_SERVICE_ROLE_KEY` is not bundled in the app. If it is, it bypasses all RLS and is extractable from the APK/IPA.
2. **Session token storage** — verify tokens are stored in SecureStore/Keychain, not AsyncStorage (which is plaintext and backed up to cloud).
3. **Deep links** — check if `Linking.openURL` accepts attacker-controllable targets that could redirect payment flows.
4. **KYC URL construction** — confirm the mobile app uses signed URLs from API responses, not constructing public bucket URLs itself.

---

## Regulatory Compliance Summary

### DPDP Act 2023 (Digital Personal Data Protection)

| Requirement | Status |
|---|---|
| Personal data processed only for lawful purpose with consent | **Gap** — KYC data accessible to unauthorized users via IDOR (#2) |
| Reasonable security safeguards to prevent personal data breach | **Gap** — public bucket, no column-level protection, BOLA vulnerabilities (#1, #3) |
| Breach notification to Data Protection Board within 72 hours | **Unknown** — no breach detection/notification mechanism found |
| Data principal rights (access, correction, erasure) | **Gap** — no data export or deletion API found |
| Purpose limitation | **Gap** — settlement config and gateway secrets exposed beyond need-to-know |

### CERT-In Directions (April 28, 2022)

| Requirement | Status |
|---|---|
| Log all ICT system logs for 180 days | **Gap** — `payment_logs` INSERT policy was dropped; no centralized logging |
| Report cyber incidents within 6 hours | **Unknown** — no incident response plan in code |
| Maintain KYC of customers | **Present** — KYC system exists but access controls are broken |
| Secure software development practices | **Gap** — no SAST/DAST, client-side auth checks, secrets in client |

### PCI-DSS (applicable if card data is processed/stored/transmitted)

| Requirement | Status |
|---|---|
| Requirement 3: Protect stored cardholder data | **Partial** — card numbers handled by gateway SDKs (good), but gateway secrets exposed to client (#6) |
| Requirement 6: Develop secure applications | **Gap** — BOLA/IDOR vulnerabilities, no input validation server-side for several functions |
| Requirement 8: Identify and authenticate access | **Gap** — admin auth issues (#4, #7), no MFA enforcement visible |
| Requirement 10: Track and monitor access | **Gap** — client-supplied IP addresses (#17), incomplete audit trails |
| Requirement 12: Information security policy | **Unknown** — no security policy documentation found |

### ISO 27001

| Control | Status |
|---|---|
| A.5.15 Access control | **Gap** — BOLA across edge functions, client-side admin role checks |
| A.5.17 Authentication information | **Gap** — session tokens not issued for admin, localStorage identity |
| A.8.2 Classification & handling | **Gap** — KYC documents in public bucket, gateway secrets in client |
| A.8.5 Secure development | **Gap** — no server-side validation for file uploads, amounts, statuses |
| A.8.12 Data leakage | **Gap** — error messages leak internal details, settlement config exposed |
| A.8.24 Cryptography | **Gap** — non-constant-time HMAC comparison, `Math.random()` for references |

---

## Recommended Remediation Priority

1. **Make KYC bucket private + owner-scoped policies** — rewrite storage policies to scope by `auth.uid()` in path; serve all images via signed URLs
2. **Apply `withUserSession`/`withAdminSession` to all edge functions** — stop trusting body-supplied `userId`/`adminId`; derive identity from session tokens
3. **Issue session token in `admin-verify-login-otp`** — and wrap all admin functions in `withAdminSession`
4. **Add column-level restrictions to `payments`/`payouts` UPDATE policies** — users must not be able to change `status`, `gateway_*`, `invoice_*`, `charges`, `gst`, `total_amount`; use `SECURITY DEFINER` functions or `BEFORE UPDATE` triggers for these columns
5. **Stop returning gateway secrets to the client** — mask secret fields in `get-payment-gateways`; use dedicated mutations for secret updates
6. **Fix `admin_users` UPDATE policy** — prevent self-role-elevation to `super_admin`
7. **Fix webhook handler** — constant-time comparison, verify signature before payment lookup, return 400 for unknown gateways
8. **Remove `super_admin` client-side shortcut** — all permission checks through server
9. **Gate `auto-payout` with `isInternalCall`** — no public access to payout processing
10. **Server-side file upload validation** — magic bytes, MIME types, size limits in edge functions

---

## Summary

This review identified **6 critical**, **6 high**, and **7 medium** findings across authentication, authorization, data storage, payment processing, and regulatory compliance. The most urgent items are the KYC document exposure, broken object-level authorization across edge functions, and the ability for users to forge payment/invoice/KYC statuses.
