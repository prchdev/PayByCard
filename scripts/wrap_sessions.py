#!/usr/bin/env python3
"""Wrap edge functions with a server-side session guard.

Replaces the top-level `Deno.serve(` with `serveAdmin(` / `serveUser(` and adds the
corresponding import from ../_shared/session.ts. Idempotent.
"""
import os
import re
import sys

ADMIN = """admin-bulk-payout admin-process-manual-payout admin-gateway-refund
admin-add-user admin-update-user admin-reset-password admin-change-password
admin-toggle-user-status admin-toggle-account-status admin-toggle-hold
admin-get-users admin-get-all-transactions admin-get-kyc-list admin-get-merchant-kyc
admin-get-user-summary admin-get-pending-payouts admin-get-support-tickets
admin-get-dashboard-stats admin-get-notifications admin-get-payment-categories
admin-get-master-settings admin-get-email-settings get-sms-settings
get-role-permissions get-user-permissions get-kyc-method-settings
get-payment-options get-payment-gateways get-payout-settings
save-payout-settings save-payment-gateways save-payment-limits save-payment-options
save-kyc-method-settings save-sms-settings admin-save-email-settings
admin-save-master-settings admin-save-payment-category admin-save-surge-charge
admin-save-notification admin-end-notification update-role-permissions
admin-upload-logo admin-update-ticket-status admin-review-kyc
admin-review-merchant-kyc admin-bulk-email admin-bulk-sms phonepe-payment-configs
razorpay-payment-configs dashboard-notifications""".split()

USER = """get-user-transactions get-beneficiaries get-active-beneficiaries
get-user-bank-accounts get-user-stats get-user-profile-for-bank get-support-tickets
get-ticket-details download-ticket-attachment check-kyc-status
check-invoice-verification check-beneficiary-monthly-limit check-payment-status
get-merchant-onboarding
save-beneficiary save-user-bank-account set-default-bank-account
toggle-beneficiary-status update-user-profile remove-business-info save-kyc-data
save-merchant-onboarding add-ticket-reply create-support-ticket
upload-ticket-attachment change-password digilocker-kyc merchant-digilocker-kyc
send-kyc-reminder send-push-notification generate-invoice-pdf""".split()

ROOT = "supabase/functions"

changed, skipped, missing = [], [], []

for slug, fn in [(s, "serveAdmin") for s in ADMIN] + [(s, "serveUser") for s in USER]:
    path = os.path.join(ROOT, slug, "index.ts")
    if not os.path.exists(path):
        missing.append(slug)
        continue
    src = open(path, encoding="utf-8").read()
    if re.search(r"\b%s\s*\(" % fn, src):
        skipped.append(slug + " (already wrapped)")
        continue
    if "Deno.serve(" not in src:
        skipped.append(slug + " (no Deno.serve)")
        continue
    src = src.replace("Deno.serve(", fn + "(", 1)

    # add / extend the session import
    m = re.search(r'import\s*\{([^}]*)\}\s*from\s*"(\.\./_shared/session\.ts)";', src)
    if m:
        names = [n.strip() for n in m.group(1).split(",") if n.strip()]
        if fn not in names:
            names.append(fn)
        src = src[: m.start()] + 'import { %s } from "../_shared/session.ts";' % ", ".join(names) + src[m.end() :]
    else:
        imports = list(re.finditer(r"^import .*?;\s*$", src, re.M))
        line = 'import { %s } from "../_shared/session.ts";\n' % fn
        if imports:
            pos = imports[-1].end()
            src = src[:pos] + "\n" + line.rstrip("\n") + src[pos:]
        else:
            src = line + src
    open(path, "w", encoding="utf-8").write(src)
    changed.append(slug)

print("changed:", len(changed))
print("skipped:", skipped)
print("missing:", missing)
