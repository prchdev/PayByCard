import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * check-settlement-status
 *
 * Scheduled every 30 minutes via pg_cron.
 *
 * Covers ALL in-flight payments regardless of payout mode
 * (manual, auto payout / payout, split payment / payment_split).
 *
 * Eligible payments:
 *   payments.status IN (settlement_pending, kyc_pending, merchant_kyc_review, processing)
 *   AND gateway_settlement_status NOT IN (settled, refunded, not_applicable)
 *   AND (gateway_settlement_checked_at IS NULL
 *        OR gateway_settlement_checked_at < now() - 25 minutes)
 *
 * For each eligible payment:
 *   1. Calls the gateway API to fetch the current settlement state.
 *   2. Writes gateway_settlement_status + gateway_settlement_checked_at.
 *   3. If the gateway reports a REFUND, also sets payments.status = 'refunded'
 *      (so it surfaces in the admin refund processing queue automatically).
 *
 * Processes up to 100 payments per run in parallel batches of 10.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

// ─── Terminal gateway_settlement_status values (skip re-checking) ─────────────
const TERMINAL_STATUSES = ["settled", "refunded", "not_applicable"];

// ─── Payment statuses that are still "in flight" (worth checking) ─────────────
const IN_FLIGHT_STATUSES = [
  "settlement_pending",
  "kyc_pending",
  "merchant_kyc_review",
  "processing",
];

// ─── Credential helper ────────────────────────────────────────────────────────

function getCredentials(gateway: any, env: string) {
  const isTest = (env ?? "production").toLowerCase() === "test";
  return {
    apiKey:    (isTest ? gateway.test_api_key    : gateway.production_api_key)    ?? "",
    apiSecret: (isTest ? gateway.test_api_secret : gateway.production_api_secret) ?? "",
  };
}

// ─── Razorpay ─────────────────────────────────────────────────────────────────

async function checkRazorpay(
  gateway: any,
  env: string,
  gatewayTransactionId: string,
  paymentReference?: string,
): Promise<{ gatewayStatus: string; shouldRefund: boolean }> {
  if (!gatewayTransactionId) return { gatewayStatus: "no_tx_id", shouldRefund: false };
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { gatewayStatus: "check_failed", shouldRefund: false };

  const auth = `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
  const headers = { Authorization: auth };
  const base = "https://api.razorpay.com/v1";

  // Resolve an Order ID (order_xxx) into a Payment ID (pay_xxx). The /payments
  // endpoint only accepts payment ids, so fetching it with an order id 404s and
  // produces a false "check_failed" result. Orders that were paid have at least
  // one captured/authorized payment under /orders/{id}/payments.
  let paymentId = gatewayTransactionId;
  if (gatewayTransactionId.startsWith("order_")) {
    try {
      const pmtRes = await fetch(`${base}/orders/${gatewayTransactionId}/payments`, { headers });
      if (!pmtRes.ok) return { gatewayStatus: "check_failed", shouldRefund: false };
      const pmtData = await pmtRes.json();
      const payments: any[] = pmtData.items || [];
      const captured = payments.find((p: any) => p.status === "captured");
      const authorized = payments.find((p: any) => p.status === "authorized");
      const latest = captured || authorized || payments[0];
      if (!latest) return { gatewayStatus: "not_captured", shouldRefund: false };
      paymentId = latest.id;
    } catch {
      return { gatewayStatus: "check_failed", shouldRefund: false };
    }
  }

  // Fallback: if we still don't have a pay_ id, search orders by receipt
  if (!paymentId.startsWith("pay_") && paymentReference) {
    try {
      const orderRes = await fetch(
        `${base}/orders?receipt=${encodeURIComponent(paymentReference)}&count=5`,
        { headers },
      );
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const orders: any[] = orderData.items || [];
        if (orders.length > 0) {
          const pmtRes = await fetch(`${base}/orders/${orders[0].id}/payments`, { headers });
          if (pmtRes.ok) {
            const pmtData = await pmtRes.json();
            const payments: any[] = pmtData.items || [];
            const captured = payments.find((p: any) => p.status === "captured");
            const authorized = payments.find((p: any) => p.status === "authorized");
            const latest = captured || authorized || payments[0];
            if (latest) paymentId = latest.id;
          }
        }
      }
    } catch {
      // ignore — fall through to the /payments call below
    }
  }

  if (!paymentId.startsWith("pay_")) {
    return { gatewayStatus: "not_captured", shouldRefund: false };
  }

  try {
    const res = await fetch(`${base}/payments/${paymentId}`, { headers });
    if (!res.ok) return { gatewayStatus: "check_failed", shouldRefund: false };

    const data = await res.json();

    if (data.status === "refunded") {
      return { gatewayStatus: "refunded", shouldRefund: true };
    }
    if (data.status === "failed") {
      return { gatewayStatus: "not_captured", shouldRefund: false };
    }
    if (data.status !== "captured") {
      return { gatewayStatus: "not_captured", shouldRefund: false };
    }
    // captured — check for settlement_id
    return {
      gatewayStatus: data.settlement_id ? "settled" : "captured",
      shouldRefund: false,
    };
  } catch {
    return { gatewayStatus: "check_failed", shouldRefund: false };
  }
}

// ─── Cashfree ─────────────────────────────────────────────────────────────────

async function checkCashfree(
  gateway: any,
  env: string,
  paymentReference: string,
): Promise<{ gatewayStatus: string; shouldRefund: boolean }> {
  if (!paymentReference) return { gatewayStatus: "no_tx_id", shouldRefund: false };
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { gatewayStatus: "check_failed", shouldRefund: false };

  const base = (env ?? "production").toLowerCase() === "test"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";
  const hdrs = {
    "x-client-id":     apiKey,
    "x-client-secret": apiSecret,
    "x-api-version":   "2023-08-01",
  };

  try {
    const orderRes = await fetch(`${base}/pg/orders/${paymentReference}`, { headers: hdrs });
    if (!orderRes.ok) return { gatewayStatus: "check_failed", shouldRefund: false };

    const order = await orderRes.json();

    if ((order.order_status ?? "").toUpperCase() === "REFUNDED") {
      return { gatewayStatus: "refunded", shouldRefund: true };
    }
    if (order.order_status !== "PAID") {
      return { gatewayStatus: "not_paid", shouldRefund: false };
    }

    // PAID — check settlement
    const settlRes = await fetch(`${base}/pg/orders/${paymentReference}/settlements`, { headers: hdrs });
    if (!settlRes.ok) return { gatewayStatus: "paid", shouldRefund: false };

    const settlData = await settlRes.json();
    const settlements: any[] = Array.isArray(settlData)
      ? settlData
      : (settlData?.data ?? settlData?.settlements ?? (settlData ? [settlData] : []));

    const success = settlements.some(
      (s: any) => (s.settlement_status ?? s.status ?? "").toUpperCase() === "SUCCESS",
    );
    return { gatewayStatus: success ? "settled" : "paid", shouldRefund: false };
  } catch {
    return { gatewayStatus: "check_failed", shouldRefund: false };
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function checkGateway(
  payment: any,
  gateway: any,
): Promise<{ gatewayStatus: string; shouldRefund: boolean }> {
  const env  = payment.gateway_environment ?? "production";
  const name = (gateway.gateway_name ?? "").toLowerCase();

  if (name.includes("razorpay")) {
    return checkRazorpay(gateway, env, payment.gateway_transaction_id, payment.payment_reference);
  }
  if (name.includes("cashfree")) {
    return checkCashfree(gateway, env, payment.payment_reference);
  }
  return { gatewayStatus: "not_applicable", shouldRefund: false };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 25-minute cutoff — slightly under the 30-minute cron interval so every
    // scheduled run always finds fresh eligible payments
    const cutoff = new Date(Date.now() - 25 * 60 * 1000).toISOString();

    const { data: payments, error } = await supabase
      .from("payments")
      .select(
        "id, payment_reference, gateway_transaction_id, gateway_environment, " +
        "payment_gateway_id, status, gateway_settlement_status, " +
        "payment_gateway_settings(*)",
      )
      .in("status", IN_FLIGHT_STATUSES)
      .or(`gateway_settlement_status.is.null,gateway_settlement_status.not.in.(${TERMINAL_STATUSES.join(",")})`)
      .or(`gateway_settlement_checked_at.is.null,gateway_settlement_checked_at.lt.${cutoff}`)
      .limit(100);

    if (error) throw new Error(`Query failed: ${error.message}`);

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No payments due for settlement check",
          processed: 0,
          durationMs: Date.now() - startedAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();

    type RunResult = {
      id: string;
      prevStatus: string;
      gatewayStatus: string;
      paymentStatusUpdated: boolean;
    };
    const results: RunResult[] = [];

    const CONCURRENCY = 10;
    for (let i = 0; i < payments.length; i += CONCURRENCY) {
      const batch = payments.slice(i, i + CONCURRENCY);

      await Promise.all(batch.map(async (payment: any) => {
        const gateway = payment.payment_gateway_settings;
        if (!gateway) {
          results.push({ id: payment.id, prevStatus: payment.status, gatewayStatus: "no_gateway", paymentStatusUpdated: false });
          return;
        }

        const { gatewayStatus, shouldRefund } = await checkGateway(payment, gateway);

        // Always persist the latest settlement check result
        await supabase.from("payments").update({
          gateway_settlement_status:     gatewayStatus,
          gateway_settlement_checked_at: now,
          // If the gateway has issued a refund, flip payments.status to refunded
          // so it surfaces in the admin refund processing queue immediately
          ...(shouldRefund && payment.status !== "refunded" && payment.status !== "completed"
            ? { status: "refunded" }
            : {}),
        }).eq("id", payment.id);

        results.push({
          id: payment.id,
          prevStatus: payment.status,
          gatewayStatus,
          paymentStatusUpdated: shouldRefund,
        });
      }));
    }

    const settled  = results.filter(r => r.gatewayStatus === "settled").length;
    const refunded = results.filter(r => r.gatewayStatus === "refunded").length;
    const captured = results.filter(r => r.gatewayStatus === "captured").length;
    const paid     = results.filter(r => r.gatewayStatus === "paid").length;
    const failed   = results.filter(r => r.gatewayStatus === "check_failed").length;
    const statusUpdated = results.filter(r => r.paymentStatusUpdated).length;

    console.log(
      `check-settlement-status: processed=${results.length} ` +
      `settled=${settled} refunded=${refunded} captured=${captured} paid=${paid} ` +
      `check_failed=${failed} payment_status_updated=${statusUpdated} ` +
      `duration=${Date.now() - startedAt}ms`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        settled,
        refunded,
        captured,
        paid,
        check_failed: failed,
        payment_status_updated: statusUpdated,
        durationMs: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("check-settlement-status error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


