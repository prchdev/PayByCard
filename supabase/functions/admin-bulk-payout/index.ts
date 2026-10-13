import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { serveAdmin } from "../_shared/session.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = () => Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Statuses that are valid targets for manual payout confirmation
const PROCESSABLE_STATUSES = new Set([
  "settlement_pending",
  "settlement_in_progress",
  "kyc_pending",
  "merchant_kyc_review",
]);

interface BulkRow {
  reference: string;
  payout_date: string;   // DD/MM/YYYY
  utr_reference: string;
  confirmed_amount: string;
}

interface RowResult {
  row_number: number;
  reference: string;
  success: boolean;
  error?: string;
  payment_reference?: string;
}

interface PreviewResult {
  reference: string;
  action: "will_update" | "skip";
  reason?: string;
  current_status?: string;
}

// Convert DD/MM/YYYY → YYYY-MM-DD; returns null on invalid
function parseDate(ddmmyyyy: string): string | null {
  const parts = ddmmyyyy.trim().split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null;
  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Parse amount that may be prefixed with "INR " and contain commas
function parseAmount(raw: string): number {
  const cleaned = String(raw).replace(/INR/i, "").replace(/,/g, "").trim();
  return parseFloat(cleaned);
}

function fmt(amount: number | string): string {
  return `₹${parseFloat(String(amount)).toFixed(2)}`;
}

async function generateInvoicePdf(paymentId: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL()}/functions/v1/generate-invoice-html`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payment_id: paymentId, invoice_type: "settlement" }),
    });
    const data = await res.json();
    return data.html_base64 ?? null;
  } catch { return null; }
}

async function sendEmail(to: string, subject: string, body: string, attachmentBase64?: string | null, attachmentFilename?: string) {
  try {
    await fetch(`${SUPABASE_URL()}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to, subject, body, body_type: "html", use_template: true,
        ...(attachmentBase64 ? { attachment_base64: attachmentBase64, attachment_filename: attachmentFilename || "invoice.html", attachment_content_type: "text/html" } : {}),
      }),
    });
  } catch (_) {}
}

async function sendSettledSms(supabase: any, payment: any, confirmedAmount: number | string) {
  try {
    const { data: senderUser } = await supabase
      .from("users").select("mobile_number, first_name, last_name").eq("id", payment.user_id).maybeSingle();
    const mobile = senderUser?.mobile_number;
    if (!mobile) return;
    const senderName = senderUser ? `${senderUser.first_name || ""} ${senderUser.last_name || ""}`.trim() : "Customer";
    const categoryName = payment.category_details?.category_name || "Payment";
    const beneficiaryName = (payment.beneficiaries?.full_name) || "Beneficiary";
    await fetch(`${SUPABASE_URL()}/functions/v1/send-sms`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile, message: "", message_type: "payment_settled",
        variables: {
          var1: categoryName,
          var2: parseFloat(String(confirmedAmount)).toFixed(2),
          var3: senderName,
          var4: beneficiaryName,
        },
      }),
    });
  } catch (_) {}
}

// Look up a payment by reference (with hyphens removed) and return it + eligibility info
async function checkPayment(
  supabase: any,
  reference: string,
): Promise<{ payment: any | null; error?: string; skipReason?: string }> {
  let { data: payment, error: fetchErr } = await supabase
    .from("payments")
    .select("*, payment_gateway_settings(*), beneficiaries(*)")
    .ilike("payment_reference", reference)
    .maybeSingle();

  if (fetchErr) return { payment: null, error: `DB error: ${fetchErr.message}` };

  // Fallback: try with hyphens removed if exact match failed
  if (!payment) {
    const stripped = reference.replace(/-/g, "");
    if (stripped !== reference) {
      const res2 = await supabase
        .from("payments")
        .select("*, payment_gateway_settings(*), beneficiaries(*)")
        .ilike("payment_reference", stripped)
        .maybeSingle();
      payment = res2.data;
      if (res2.error) return { payment: null, error: `DB error: ${res2.error.message}` };
    }
  }

  if (!payment) return { payment: null, skipReason: `Payment reference not found` };

  if (payment.status === "completed") return { payment, skipReason: `Already completed` };
  if (payment.status === "refunded") return { payment, skipReason: `Already refunded` };
  if (payment.status === "cancelled") return { payment, skipReason: `Transaction failed/cancelled` };

  if (!PROCESSABLE_STATUSES.has(payment.status) && !payment.auto_payout_failed) {
    return { payment, skipReason: `Status "${payment.status}" not eligible for update` };
  }

  return { payment };
}

async function processRow(
  supabase: any,
  row: BulkRow,
  rowNumber: number,
  adminId: string,
): Promise<RowResult> {
  const ref = row.reference?.trim();
  const utr = row.utr_reference?.trim();
  const dateRaw = row.payout_date?.trim();
  const amtRaw = row.confirmed_amount?.toString().trim();

  if (!ref) return { row_number: rowNumber, reference: ref || "", success: false, error: "Reference is required" };
  if (!dateRaw) return { row_number: rowNumber, reference: ref, success: false, error: "Transaction Date is required" };
  if (!utr) return { row_number: rowNumber, reference: ref, success: false, error: "UTR is required" };
  if (!amtRaw) return { row_number: rowNumber, reference: ref, success: false, error: "Amount is required" };

  const payoutDateIso = parseDate(dateRaw);
  if (!payoutDateIso) {
    return { row_number: rowNumber, reference: ref, success: false, error: `Invalid Transaction Date "${dateRaw}" — expected DD/MM/YYYY (e.g. 08/09/2026)` };
  }

  const confirmedAmount = parseAmount(amtRaw);
  if (isNaN(confirmedAmount) || confirmedAmount <= 0) {
    return { row_number: rowNumber, reference: ref, success: false, error: `Invalid Amount "${amtRaw}" — must be a positive number` };
  }

  const { payment, error, skipReason } = await checkPayment(supabase, ref);
  if (error) return { row_number: rowNumber, reference: ref, success: false, error };
  if (!payment) return { row_number: rowNumber, reference: ref, success: false, error: skipReason || "Payment not found" };
  if (skipReason) return { row_number: rowNumber, reference: ref, success: false, error: skipReason };

  // ── Duplicate payout check ────────────────────────────────────────────────
  const { data: existingPayout } = await supabase
    .from("payouts")
    .select("id, status")
    .eq("payment_id", payment.id)
    .eq("status", "completed")
    .maybeSingle();

  if (existingPayout) {
    return { row_number: rowNumber, reference: ref, success: false, error: `Payout already completed for this payment` };
  }

  // ── Check if a pending payout record exists to update ────────────────────
  const { data: pendingPayout } = await supabase
    .from("payouts")
    .select("id")
    .eq("payment_id", payment.id)
    .in("status", ["pending", "processing", "failed"])
    .maybeSingle();

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  const newPayoutRef = `POUT-${dateStr}-${rand}`;
  const nowIso = now.toISOString();

  if (pendingPayout) {
    await supabase.from("payouts").update({
      status: "completed",
      payout_date: payoutDateIso,
      payout_reference_number: utr,
      payout_confirmed_amount: confirmedAmount,
      payout_confirmed_by: adminId,
      payout_confirmed_at: nowIso,
      completed_at: nowIso,
      utr_number: utr,
      updated_at: nowIso,
    }).eq("id", pendingPayout.id);
  } else {
    const beneficiary = payment.beneficiaries;
    await supabase.from("payouts").insert({
      user_id: payment.user_id,
      payment_id: payment.id,
      beneficiary_id: payment.beneficiary_id,
      payment_gateway_id: payment.payment_gateway_id,
      amount: payment.amount,
      charges: 0,
      gst: 0,
      total_deduction: 0,
      net_amount: payment.amount,
      payout_reference: newPayoutRef,
      transfer_type: "IMPS",
      account_number: beneficiary?.bank_account || "",
      ifsc_code: beneficiary?.ifsc || "",
      account_holder_name: beneficiary?.full_name || "",
      bank_name: beneficiary?.bank_name || "",
      gateway_environment: payment.gateway_environment,
      status: "completed",
      payout_date: payoutDateIso,
      payout_reference_number: utr,
      payout_confirmed_amount: confirmedAmount,
      payout_confirmed_by: adminId,
      payout_confirmed_at: nowIso,
      completed_at: nowIso,
      utr_number: utr,
      ip_address: "admin-bulk",
    });
  }

  await supabase.from("payments").update({
    status: "completed",
    completed_at: nowIso,
    updated_at: nowIso,
  }).eq("id", payment.id);

  await supabase.from("payment_logs").insert({
    payment_id: payment.id,
    status: "completed",
    message: `Bulk manual payout confirmed by admin. UTR: ${utr}, Amount: ${confirmedAmount}`,
    metadata: { admin_id: adminId, payout_date: payoutDateIso, payout_reference_number: utr, payout_confirmed_amount: confirmedAmount, bulk: true },
  });

  // ── Async notifications ───────────────────────────────────────────────────
  EdgeRuntime.waitUntil((async () => {
    const [senderRes] = await Promise.all([
      supabase.from("users").select("first_name, last_name, email").eq("id", payment.user_id).maybeSingle(),
    ]);
    const senderName = senderRes.data ? `${senderRes.data.first_name} ${senderRes.data.last_name}`.trim() : "Customer";
    const senderEmail = senderRes.data?.email;
    const beneficiaryDetails = payment.beneficiaries || {};
    const receiverName = beneficiaryDetails?.full_name || "Beneficiary";
    const receiverEmail = beneficiaryDetails?.email;

    const invoiceBase64 = await generateInvoicePdf(payment.id);
    const invoiceFilename = `invoice-${payment.payment_reference || "txn"}.html`;

    const receiptRows = `
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin:16px 0;">
        <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Transaction Reference</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;font-size:14px;text-align:right;">${payment.payment_reference}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Amount Transferred</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;font-size:14px;text-align:right;">${fmt(confirmedAmount)}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Payout UTR / Reference</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;font-size:14px;text-align:right;">${utr}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Payout Date</td><td style="padding:8px 12px;font-weight:600;color:#111827;font-size:14px;text-align:right;">${payoutDateIso}</td></tr>
      </table>`;

    if (senderEmail) {
      await sendEmail(
        senderEmail,
        `Transaction Completed – Ref: ${payment.payment_reference}`,
        `<p>Dear ${senderName},</p><p>Your payment has been completed and funds have been transferred to the beneficiary.</p>${receiptRows}${invoiceBase64 ? `<p style="color:#6b7280;font-size:13px;margin-top:8px;">Invoice copy is attached to this email.</p>` : ""}<p style="color:#6b7280;font-size:13px;">Contact support for any queries.</p>`,
        invoiceBase64,
        invoiceFilename,
      );
    }
    if (receiverEmail) {
      await sendEmail(
        receiverEmail,
        `Payment Received – Ref: ${payment.payment_reference}`,
        `<p>Dear ${receiverName},</p><p>The payment to your bank account has been completed successfully.</p>${receiptRows}<p><strong>Sent by:</strong> ${senderName}</p>${invoiceBase64 ? `<p style="color:#6b7280;font-size:13px;margin-top:8px;">Invoice copy is attached to this email.</p>` : ""}<p style="color:#6b7280;font-size:13px;">Contact support if you have any concerns.</p>`,
        invoiceBase64,
        invoiceFilename,
      );
    }
    await sendSettledSms(supabase, payment, confirmedAmount);
  })());

  return { row_number: rowNumber, reference: ref, success: true, payment_reference: payment.payment_reference };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { adminId, rows, dry_run } = await req.json();

    if (!adminId) {
      return new Response(JSON.stringify({ error: "Admin ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "No rows provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (rows.length > 500) {
      return new Response(JSON.stringify({ error: "Maximum 500 rows allowed per batch" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: admin } = await supabase.from("admin_users").select("id, full_name").eq("id", adminId).maybeSingle();
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Dry run: return preview without modifying anything ──────────────────
    if (dry_run) {
      const preview: PreviewResult[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as BulkRow;
        const ref = row.reference?.trim();
        if (!ref) {
          preview.push({ reference: "", action: "skip", reason: "Reference is empty" });
          continue;
        }

        const { payment, skipReason } = await checkPayment(supabase, ref);
        if (skipReason) {
          preview.push({ reference: ref, action: "skip", reason: skipReason, current_status: payment?.status });
        } else {
          preview.push({ reference: ref, action: "will_update", current_status: payment?.status });
        }
      }
      return new Response(
        JSON.stringify({ preview }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Actual processing ─────────────────────────────────────────────────────
    const results: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const result = await processRow(supabase, rows[i] as BulkRow, i + 1, adminId);
      results.push(result);
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ success: true, results, summary: { total: rows.length, succeeded, failed } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again."}),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


