#!/usr/bin/env python3
"""Wrap edge function handlers with the shared session guard and/or the
signed-KYC-URL response post-processor. Idempotent."""
import re
import sys
import os

FUNCS = "supabase/functions"

ADMIN = [
    "admin-add-user", "admin-bulk-email", "admin-bulk-payout", "admin-bulk-sms",
    "admin-change-password", "admin-end-notification", "admin-gateway-refund",
    "admin-get-all-transactions", "admin-get-dashboard-stats", "admin-get-email-settings",
    "admin-get-expired-onboarding", "admin-get-kyc-list", "admin-get-master-settings",
    "admin-get-merchant-kyc", "admin-get-non-kyced-transactions", "admin-get-notifications",
    "admin-get-payment-categories", "admin-get-pending-payouts", "admin-get-support-tickets",
    "admin-get-user-summary", "admin-get-users", "admin-process-manual-payout",
    "admin-process-refund", "admin-review-kyc", "admin-review-merchant-kyc",
    "admin-save-email-settings", "admin-save-master-settings", "admin-save-notification",
    "admin-save-payment-category", "admin-save-surge-charge", "admin-toggle-account-status",
    "admin-toggle-user-status", "admin-update-ticket-status", "admin-update-user",
    "save-payment-gateways", "save-payment-limits", "save-payment-options",
    "get-payment-options",
    "save-sms-settings", "save-kyc-method-settings", "update-role-permissions",
    "get-role-permissions", "get-user-permissions", "get-kyc-method-settings",
    "get-sms-settings",
]

USER = [
    "add-ticket-reply", "change-password", "check-kyc-status", "check-payment-status",
    "check-settlement-status", "create-support-ticket", "digilocker-kyc",
    "download-ticket-attachment", "get-active-beneficiaries", "get-beneficiaries",
    "get-kyc-data", "get-merchant-onboarding", "get-support-tickets", "get-ticket-details",
    "get-user-bank-accounts", "get-user-profile-for-bank", "get-user-stats",
    "get-user-transactions", "initiate-payment", "merchant-digilocker-kyc",
    "remove-business-info", "save-beneficiary", "save-kyc-data", "save-merchant-onboarding",
    "save-transaction-status", "save-user-bank-account", "set-default-bank-account",
    "toggle-beneficiary-status", "update-user-profile", "upload-ticket-attachment",
    "calculate-payment-option-charges",
]

SIGN = [
    "admin-get-all-transactions", "admin-get-dashboard-stats", "admin-get-expired-onboarding",
    "admin-get-kyc-list", "admin-get-merchant-kyc", "admin-get-non-kyced-transactions",
    "admin-get-pending-payouts", "admin-get-user-summary", "admin-review-kyc",
    "check-kyc-status", "digilocker-kyc", "get-kyc-data", "get-merchant-onboarding",
    "merchant-digilocker-kyc", "remove-business-info", "save-kyc-data",
    "save-merchant-onboarding",
]


def transform(slug):
    path = os.path.join(FUNCS, slug, "index.ts")
    if not os.path.isfile(path):
        return slug, "MISSING"
    src = open(path).read()
    if "__pbcHandler" in src:
        return slug, "already-wrapped"
    if src.count("Deno.serve(") != 1:
        return slug, "SKIP(serve-count=%d)" % src.count("Deno.serve(")

    wrappers = []
    imports = []
    if slug in ADMIN:
        wrappers.append("withAdminSession")
        imports.append('import { withAdminSession } from "../_shared/session.ts";')
    if slug in USER:
        wrappers.append("withUserSession")
        imports.append('import { withUserSession } from "../_shared/session.ts";')
    if slug in SIGN:
        wrappers.append("withSignedKycUrls")
        imports.append('import { withSignedKycUrls } from "../_shared/kycUrls.ts";')
    if not wrappers:
        return slug, "no-op"

    src = src.replace("Deno.serve(", "const __pbcHandler = (", 1)

    lines = src.split("\n")
    last_import = -1
    for i, line in enumerate(lines):
        if line.startswith("import ") or line.startswith('import"'):
            last_import = i
    insert_at = last_import + 1
    lines[insert_at:insert_at] = imports
    src = "\n".join(lines)

    expr = "__pbcHandler as (req: Request) => Promise<Response>"
    for w in reversed(wrappers):
        expr = "%s(%s)" % (w, expr)
    if not src.endswith("\n"):
        src += "\n"
    src += "\nDeno.serve(%s);\n" % expr

    open(path, "w").write(src)
    return slug, "wrapped(%s)" % "+".join(wrappers)


if __name__ == "__main__":
    targets = sorted(set(ADMIN + USER + SIGN))
    for slug in targets:
        s, status = transform(slug)
        print("%-40s %s" % (s, status))
