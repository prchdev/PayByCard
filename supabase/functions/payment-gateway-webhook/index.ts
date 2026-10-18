import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

/**
 * Delegate the actual status recording to save-transaction-status so that
 * emails, SMS, KYC handling, coupon usage, payout triggers, and the
 * transaction_status table are all handled consistently — exactly as they
 * are when the client or poll-stale-payments reports the same payment.
 *
 * Idempotency: if the payment is already in a terminal state (completed,
 * settlement_pending, kyc_pending, failed, cancelled, refunded), skip the
 * call to avoid double-processing duplicate webhook deliveries.
 */
async function recordPaymentStatus(
  supabaseUrl: string,
  supabaseKey: string,
  supabase: any,
  payment: any,
  status: "completed" | "failed",
  gatewayTransactionId: string | null,
  gatewayResponse: any,
  failureReason?: string | null,
): Promise<{ status: string; skipped: boolean }> {
  const terminalStates = new Set([
    "completed", "settlement_pending", "kyc_pending",
    "failed", "cancelled", "refunded", "refund_pending",
  ]);

  if (terminalStates.has(payment.status)) {
    // Already processed — log and skip
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: payment.status,
      message: `Webhook duplicate skipped (already ${payment.status})`,
      metadata: { gateway_response: gatewayResponse },
    }).catch(() => {});
    return { status: payment.status, skipped: true };
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/save-transaction-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      userId: payment.user_id,
      paymentId: payment.id,
      transactionReference: payment.payment_reference,
      status,
      amount: payment.total_amount || payment.amount,
      gatewayResponse,
      gatewayTransactionId,
      gatewayName: payment.payment_gateway_settings?.gateway_name,
      errorMessage: failureReason || undefined,
    }),
  });

  const result = await response.json().catch(() => ({}));
  return { status: result.transactionStatus?.status || status, skipped: false };
}

function verifyCashFreeSignature(payload: string, signature: string, timestamp: string, clientSecret: string): boolean {
  const signatureData = `${timestamp}${payload}`;
  const expectedSignature = createHmac("sha256", clientSecret).update(signatureData).digest("base64");
  if (signature.length !== expectedSignature.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

function verifyPayUHash(payload: any, salt: string): boolean {
  const hashString = `${salt}|${payload.status}|||||||||||${payload.udf5}|${payload.udf4}|${payload.udf3}|${payload.udf2}|${payload.udf1}|${payload.email}|${payload.firstname}|${payload.productinfo}|${payload.amount}|${payload.txnid}|${payload.key}`;
  const expectedHash = createHash("sha512").update(hashString).digest("hex");
  if (payload.hash.length !== expectedHash.length) return false;
  return timingSafeEqual(Buffer.from(payload.hash), Buffer.from(expectedHash));
}

async function handleCashFreeWebhook(req: Request, supabase: any, supabaseUrl: string, supabaseKey: string) {
  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");
  const payload = await req.text();
  const data = JSON.parse(payload);

  const { data: payment } = await supabase
    .from("payments")
    .select("*, payment_gateway_settings(*)")
    .eq("payment_reference", data.data.order.order_id)
    .single();

  if (!payment) throw new Error("Payment not found");

  const gateway = payment.payment_gateway_settings;
  const clientSecret = payment.gateway_environment === "test"
    ? gateway.test_api_secret
    : gateway.production_api_secret;

  if (!signature || !timestamp) {
    throw new Error("Missing CashFree webhook signature");
  }
  if (!verifyCashFreeSignature(payload, signature, timestamp, clientSecret)) {
    throw new Error("Invalid CashFree webhook signature");
  }

  const orderStatus = data.data.order.order_status;
  const cfPaymentId = data.data.payment?.cf_payment_id || payment.gateway_transaction_id;

  if (orderStatus === "PAID") {
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "completed", cfPaymentId, data,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `CashFree webhook: ${orderStatus} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: data,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  if (orderStatus === "FAILED" || orderStatus === "CANCELLED") {
    const failureReason = data.data.payment?.payment_message || "Payment failed";
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "failed", cfPaymentId, data, failureReason,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `CashFree webhook: ${orderStatus} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: data,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  // ACTIVE or other transient states — do not overwrite current DB status
  return { success: true, status: "ignored", message: `Order status ${orderStatus} ignored` };
}

async function handleRazorPayWebhook(req: Request, supabase: any, supabaseUrl: string, supabaseKey: string) {
  const signature = req.headers.get("x-razorpay-signature");
  const payload = await req.text();
  const data = JSON.parse(payload);

  const paymentEntity = data.payload.payment.entity;

  // Look up by our internal payment_id stored in notes, falling back to payment_reference
  const internalPaymentId = paymentEntity.notes?.payment_id;
  const query = internalPaymentId
    ? supabase.from("payments").select("*, payment_gateway_settings(*)").eq("id", internalPaymentId).single()
    : supabase.from("payments").select("*, payment_gateway_settings(*)").eq("payment_reference", paymentEntity.notes?.receipt || paymentEntity.description).single();

  const { data: payment } = await query;

  if (!payment) throw new Error("Payment not found");

  const gateway = payment.payment_gateway_settings;
  const keySecret = payment.gateway_environment === "test"
    ? gateway.test_api_secret
    : gateway.production_api_secret;

  if (!signature) {
    throw new Error("Missing Razorpay webhook signature");
  }
  const expectedSignature = createHmac("sha256", keySecret).update(payload).digest("hex");
  if (signature.length !== expectedSignature.length) throw new Error("Invalid Razorpay webhook signature");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) throw new Error("Invalid Razorpay webhook signature");

  if (paymentEntity.status === "captured") {
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "completed", paymentEntity.id, data,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `Razorpay webhook: ${paymentEntity.status} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: data,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  if (paymentEntity.status === "failed") {
    const failureReason = paymentEntity.error_description || "Payment failed";
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "failed", paymentEntity.id, data, failureReason,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `Razorpay webhook: ${paymentEntity.status} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: data,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  return { success: true, status: "ignored", message: `Payment status ${paymentEntity.status} ignored` };
}

async function handlePayUWebhook(req: Request, supabase: any, supabaseUrl: string, supabaseKey: string) {
  const formData = await req.formData();
  const payload: any = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("*, payment_gateway_settings(*)")
    .eq("payment_reference", payload.txnid)
    .single();

  if (!payment) throw new Error("Payment not found");

  const gateway = payment.payment_gateway_settings;
  const salt = payment.gateway_environment === "test"
    ? gateway.test_api_secret
    : gateway.production_api_secret;

  if (!verifyPayUHash(payload, salt)) throw new Error("Invalid hash");

  if (payload.status === "success") {
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "completed", payload.mihpayid, payload,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `PayU webhook: ${payload.status} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: payload,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  if (payload.status === "failure") {
    const failureReason = payload.error_Message || "Payment failed";
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "failed", payload.mihpayid, payload, failureReason,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `PayU webhook: ${payload.status} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: payload,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  return { success: true, status: "ignored", message: `Payment status ${payload.status} ignored` };
}

async function handlePhonePeWebhook(req: Request, supabase: any, supabaseUrl: string, supabaseKey: string) {
  const body = await req.json();
  const payload = body;

  // PhonePe sends { merchantId, merchantOrderId, transactionId, amount, state, ... }
  const merchantOrderId = payload.merchantOrderId || payload.merchantTransactionId;

  const { data: payment } = await supabase
    .from("payments")
    .select("*, payment_gateway_settings(*)")
    .eq("payment_reference", merchantOrderId)
    .single();

  if (!payment) throw new Error("Payment not found");

  const gateway = payment.payment_gateway_settings;
  const saltKey = payment.gateway_environment === "test"
    ? gateway.test_api_secret
    : gateway.production_api_secret;

  // F7: PhonePe X-VERIFY checksum is mandatory — reject if missing or mismatched.
  const xVerify = req.headers.get("x-verify");
  if (!xVerify || !saltKey) {
    throw new Error("Missing PhonePe webhook signature");
  }
  const callbackResponse = payload.response || JSON.stringify(payload);
  const base64Response = typeof callbackResponse === "string"
    ? btoa(callbackResponse)
    : btoa(JSON.stringify(callbackResponse));
  const checkString = base64Response + "/pg/v1/status" + saltKey;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(checkString));
  const expectedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("") + "###" + 1;
  if (xVerify.length !== expectedHash.length) {
    throw new Error("Invalid PhonePe webhook signature");
  }
  if (!timingSafeEqual(Buffer.from(xVerify), Buffer.from(expectedHash))) {
    throw new Error("Invalid PhonePe webhook signature");
  }

  const state = (payload.state || payload.code || "").toUpperCase();
  const phonepeTxId = payload.transactionId || payload.providerReferenceId || payment.gateway_transaction_id;

  if (state === "PAYMENT_SUCCESS" || state === "COMPLETED") {
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "completed", phonepeTxId, payload,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `PhonePe webhook: ${state} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: payload,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  if (state === "PAYMENT_ERROR" || state === "FAILED" || state === "PAYMENT_DECLINED") {
    const failureReason = payload.message || payload.errorDescription || "Payment failed";
    const result = await recordPaymentStatus(
      supabaseUrl, supabaseKey, supabase, payment,
      "failed", phonepeTxId, payload, failureReason,
    );
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: result.status,
      message: `PhonePe webhook: ${state} → ${result.status}${result.skipped ? " (skipped duplicate)" : ""}`,
      metadata: payload,
    });
    return { success: true, status: result.status, skipped: result.skipped };
  }

  return { success: true, status: "ignored", message: `Payment state ${state} ignored` };
}

async function handleGenericWebhook(_req: Request, _supabase: any) {
  return { success: false, message: "Unknown gateway — rejected" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Browser redirect (GET): some gateways redirect the user's browser back to
  // the callback URL after payment. The actual status recording is handled by
  // the server-to-server POST webhook (above) and/or the client calling
  // check-payment-status after the redirect. Return a minimal HTML page so the
  // browser doesn't see an error.
  if (req.method === "GET") {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Processing</title><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#111827}.card{text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);max-width:400px}.spinner{width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 1rem}@keyframes spin{to{transform:rotate(360deg)}}p{margin:.5rem 0;color:#6b7280}</style></head><body><div class="card"><div class="spinner"></div><h2>Payment Processing</h2><p>Please wait while we confirm your payment status.</p><p>You can close this window and return to the app.</p></div><script>try{window.close()}catch(e){}</script></body></html>`;
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const gateway = url.searchParams.get("gateway");

    let result;

    switch (gateway?.toLowerCase()) {
      case "cashfree":
        result = await handleCashFreeWebhook(req, supabase, supabaseUrl, supabaseKey);
        break;
      case "razorpay":
        result = await handleRazorPayWebhook(req, supabase, supabaseUrl, supabaseKey);
        break;
      case "payu":
        result = await handlePayUWebhook(req, supabase, supabaseUrl, supabaseKey);
        break;
      case "phonepe":
        result = await handlePhonePeWebhook(req, supabase, supabaseUrl, supabaseKey);
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown gateway: ${gateway}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

