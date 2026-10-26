import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  isSupportedGateway,
  initiateSettlement,
  checkSettlementStatus,
  disablePaymentOptionsForGateway,
  getPendingSettlement,
} from "../_shared/settlementApi.ts";

/**
 * on-demand-settlement
 *
 * Scheduled every 5 minutes via pg_cron.
 *
 * PHASE 1 — Settlement status tracking:
 *   For each gateway with on_demand_settlement_enabled = true that has a
 *   non-terminal last_settlement_status, checks the gateway API for the
 *   current settlement status. If "onhold", disables all payment_options
 *   linked to that gateway.
 *
 * PHASE 2 — On-demand settlement initiation:
 *   For each gateway where on_demand_settlement_enabled = true AND the gateway
 *   supports on-demand settlement (Razorpay, Cashfree):
 *   1. Queries payments with status = 'settlement_pending' that have NOT
 *      already been included in a prior on-demand settlement attempt
 *      (ondemand_settlement_included_at IS NULL).
 *   2. Calculates the net settlement amount per gateway:
 *      SUM(total_amount - gateway_fee)  — i.e. the amount the customer paid
 *      minus the actual gateway fee (including GST) extracted from the
 *      gateway's webhook response.
 *   3. If the net amount > 0, initiates an on-demand settlement with that
 *      specific amount (settle_full_balance=false for Razorpay).
 *   4. Marks all included payments with ondemand_settlement_included_at = now()
 *      so subsequent runs skip them until the settlement settles or fails.
 *   5. Records the settlement attempt. If "onhold", disables payment options.
 *
 * Gateways that don't support on-demand settlement are skipped entirely to
 * speed up calculations. Only Razorpay and Cashfree are supported.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

// Extract the actual gateway fee (in rupees) from the stored webhook response.
// Razorpay stores fee in paise at gateway_response.payment.fee.
// CashFree stores payment charges at gateway_response.data.payment.payment_amount
// (we subtract the settlement amount, but CashFree fee isn't always in the webhook;
// for CashFree the gateway API path should succeed, so this is only a fallback).
function extractGatewayFee(gatewayResponse: any): number {
  if (!gatewayResponse || typeof gatewayResponse !== "object") return 0;
  // Razorpay: fee is in paise
  const rzpFee = gatewayResponse?.payment?.fee;
  if (rzpFee != null) return Number(rzpFee) / 100;
  // Some gateways nest under data
  const nested = gatewayResponse?.data?.payment?.fee;
  if (nested != null) return Number(nested) / 100;
  return 0;
}

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

    const now = new Date();
    const trackResults: Array<{ gateway: string; previousStatus: string; currentStatus: string; paymentOptionsDisabled: number }> = [];
    const initiateResults: Array<{ gateway: string; status: string; amount?: number; skipped: boolean; reason?: string; paymentsIncluded?: number; grossAmount?: number; totalFees?: number; totalGst?: number; amountSource?: string }> = [];

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Track status of existing non-terminal settlements
    // ═══════════════════════════════════════════════════════════════════════════

    const { data: trackSettings, error: tErr } = await supabase
      .from("gateway_settlement_settings")
      .select("id, gateway_name, last_settlement_status, last_settlement_at")
      .eq("on_demand_settlement_enabled", true)
      .not("last_settlement_at", "is", null);

    if (tErr) throw new Error(`Track settings query failed: ${tErr.message}`);

    const TERMINAL_STATUSES = ["settled", "failed", "not_applicable", "no_settlement"];

    for (const setting of trackSettings || []) {
      if (TERMINAL_STATUSES.includes(setting.last_settlement_status)) continue;

      const { data: gateway, error: gErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("gateway_name", setting.gateway_name)
        .maybeSingle();

      if (gErr || !gateway) {
        trackResults.push({
          gateway: setting.gateway_name,
          previousStatus: setting.last_settlement_status,
          currentStatus: "no_gateway_config",
          paymentOptionsDisabled: 0,
        });
        continue;
      }

      const env = gateway.environment || "production";
      const { status: currentStatus } = await checkSettlementStatus(setting.gateway_name, gateway, env);

      await supabase
        .from("gateway_settlement_settings")
        .update({
          last_settlement_status: currentStatus,
          updated_at: now.toISOString(),
        })
        .eq("id", setting.id);

      let disabledCount = 0;
      if (currentStatus === "onhold") {
        disabledCount = await disablePaymentOptionsForGateway(supabase, gateway.id, setting.gateway_name);
      }

      trackResults.push({
        gateway: setting.gateway_name,
        previousStatus: setting.last_settlement_status,
        currentStatus,
        paymentOptionsDisabled: disabledCount,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: Initiate new on-demand settlements
    //
    // The net settlement amount is fetched from the gateway's own settlement
    // API (Razorpay recon / Cashfree settlements) which reflects the actual
    // pending balance the gateway will settle. If the API call fails, we fall
    // back to calculating from DB rows (SUM(total_amount - gateway_fee)).
    //
    // Unsupported gateways are filtered out at the DB query level so we never
    // fetch their settings or payments. The payments query also filters for
    // ondemand_settlement_included_at IS NULL so already-included payments are
    // never fetched.
    // ═══════════════════════════════════════════════════════════════════════════

    // Query only supported gateways directly from the DB — unsupported ones
    // are never fetched, saving a round-trip and avoiding large result sets.
    const { data: initSettings, error: sErr } = await supabase
      .from("gateway_settlement_settings")
      .select(`
        id, gateway_name,
        settlement_trigger_minutes, last_settlement_at
      `)
      .eq("on_demand_settlement_enabled", true)
      .ilike("gateway_name", "%razorpay%");

    if (sErr) throw new Error(`Initiate settings query failed: ${sErr.message}`);

    // Also fetch cashfree settings in a parallel query
    const { data: cashfreeSettings, error: cErr } = await supabase
      .from("gateway_settlement_settings")
      .select(`
        id, gateway_name,
        settlement_trigger_minutes, last_settlement_at
      `)
      .eq("on_demand_settlement_enabled", true)
      .ilike("gateway_name", "%cashfree%");

    if (cErr) throw new Error(`Cashfree settings query failed: ${cErr.message}`);

    const supportedSettings = [...(initSettings || []), ...(cashfreeSettings || [])];

    for (const setting of supportedSettings) {
      const { data: gateway, error: gErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("gateway_name", setting.gateway_name)
        .maybeSingle();

      if (gErr || !gateway) {
        initiateResults.push({ gateway: setting.gateway_name, status: "no_gateway_config", skipped: true });
        continue;
      }

      const env = gateway.environment || "production";

      // ── Fetch the actual pending settlement amount from the gateway API ──
      // This is the real net amount the gateway will settle, sourced from the
      // gateway's own settlement/recon API. Falls back to DB calculation only
      // if the API call fails or returns an error.
      const apiResult = await getPendingSettlement(setting.gateway_name, gateway, env);

      let netSettlementAmount: number;
      let amountSource: "gateway_api" | "db_fallback";
      let grossAmount = 0;
      let totalFees = 0;
      let totalGst = 0;

      // ── Fetch payment IDs to mark as included ──
      // Only fetch IDs (not full rows) to minimize memory. The filters ensure
      // we only get settlement_pending payments for this gateway that haven't
      // been included in a prior settlement attempt.
      const { data: pendingPayments, error: pErr } = await supabase
        .from("payments")
        .select("id, total_amount, gateway_response")
        .eq("status", "settlement_pending")
        .eq("payment_gateway_id", gateway.id)
        .is("ondemand_settlement_included_at", null);

      if (pErr) {
        initiateResults.push({
          gateway: setting.gateway_name,
          status: "query_failed",
          amount: 0,
          skipped: true,
          reason: `Payments query failed: ${pErr.message}`,
        });
        continue;
      }

      if (!pendingPayments || pendingPayments.length === 0) {
        initiateResults.push({
          gateway: setting.gateway_name,
          status: "no_pending_payments",
          amount: 0,
          skipped: true,
          reason: "No new settlement_pending payments to process",
        });
        continue;
      }

      const paymentIds: string[] = pendingPayments.map((p: any) => p.id);

      if (apiResult.error || apiResult.amount <= 0) {
        // Gateway API failed or returned zero — fall back to DB calculation.
        // The net settlement is: total_amount (what the customer paid) minus
        // the actual gateway fee (from the gateway's webhook response, in paise).
        // The platform's own charges/gst columns are NOT the gateway fee — they
        // are PayByCard's markup, so they must not be subtracted here.
        for (const p of pendingPayments) {
          const paid = Number(p.total_amount) || 0;
          // Razorpay stores fee in paise inside gateway_response.payment.fee;
          // CashFree stores it in gateway_response.data.payment.amount.
          // Fall back to 0 if the field is absent (settles full amount — safe upper bound).
          const gwFee = extractGatewayFee(p.gateway_response);
          grossAmount += paid;
          totalFees += gwFee;
        }
        netSettlementAmount = grossAmount - totalFees;
        amountSource = "db_fallback";
      } else {
        // Use the gateway's reported pending settlement amount directly
        netSettlementAmount = apiResult.amount;
        amountSource = "gateway_api";
        // Still compute gross/fees from DB for reporting
        for (const p of pendingPayments) {
          grossAmount += Number(p.total_amount) || 0;
          totalFees += extractGatewayFee(p.gateway_response);
        }
      }

      if (netSettlementAmount <= 0) {
        // Still mark these payments as processed so we don't keep re-evaluating
        // them — fees equal or exceed the transaction value (edge case).
        await supabase
          .from("payments")
          .update({ ondemand_settlement_included_at: now.toISOString() })
          .in("id", paymentIds);

        initiateResults.push({
          gateway: setting.gateway_name,
          status: "no_net_amount",
          amount: 0,
          skipped: true,
          reason: `Net amount ≤ 0 (source=${amountSource}, gross=${grossAmount}, fees=${totalFees}, gst=${totalGst})`,
        });
        continue;
      }

      // Initiate settlement with the net amount (from gateway API or DB fallback)
      const settlementResult = await initiateSettlement(
        setting.gateway_name, gateway, env, netSettlementAmount,
      );

      // Only mark payments as "included" if the settlement was actually
      // triggered (initiated, in_progress, or onhold). If it failed or the
      // API check failed, leave the payments unmarked so they're retried
      // in the next run.
      const wasTriggered = ["initiated", "in_progress", "onhold"].includes(
        settlementResult.status,
      );

      if (wasTriggered) {
        await supabase
          .from("payments")
          .update({ ondemand_settlement_included_at: now.toISOString() })
          .in("id", paymentIds);
      }

      const errorDetail = settlementResult.status === "failed" || settlementResult.status === "check_failed"
        ? JSON.stringify(settlementResult.response || {}).substring(0, 500)
        : null;

      await supabase
        .from("gateway_settlement_settings")
        .update({
          last_settlement_at: now.toISOString(),
          last_settlement_status: settlementResult.status,
          last_settlement_amount: netSettlementAmount,
          last_settlement_error: errorDetail,
          updated_at: now.toISOString(),
        })
        .eq("id", setting.id);

      initiateResults.push({
        gateway: setting.gateway_name,
        status: settlementResult.status,
        amount: netSettlementAmount,
        skipped: false,
        paymentsIncluded: paymentIds.length,
        grossAmount,
        totalFees,
        totalGst,
        amountSource,
      });

      if (settlementResult.status === "onhold") {
        await disablePaymentOptionsForGateway(supabase, gateway.id, setting.gateway_name);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════════════════════

    const trackedOnhold = trackResults.filter((r) => r.currentStatus === "onhold").length;
    const trackedSettled = trackResults.filter((r) => r.currentStatus === "settled").length;
    const trackedFailed = trackResults.filter((r) => r.currentStatus === "failed").length;
    const totalOptionsDisabled = trackResults.reduce((sum, r) => sum + r.paymentOptionsDisabled, 0);

    const initiated = initiateResults.filter((r) => r.status === "initiated").length;
    const initOnhold = initiateResults.filter((r) => r.status === "onhold").length;
    const initFailed = initiateResults.filter((r) => r.status === "failed").length;
    const initSkipped = initiateResults.filter((r) => r.skipped).length;

    console.log(
      `on-demand-settlement: ` +
        `tracked=${trackResults.length} tracked_onhold=${trackedOnhold} tracked_settled=${trackedSettled} ` +
        `tracked_failed=${trackedFailed} options_disabled=${totalOptionsDisabled} | ` +
        `initiated_processing=${initiateResults.length} initiated=${initiated} ` +
        `init_onhold=${initOnhold} init_failed=${initFailed} init_skipped=${initSkipped} ` +
        `duration=${Date.now() - startedAt}ms`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        tracking: {
          processed: trackResults.length,
          onhold: trackedOnhold,
          settled: trackedSettled,
          failed: trackedFailed,
          options_disabled: totalOptionsDisabled,
          results: trackResults,
        },
        initiation: {
          processed: initiateResults.length,
          initiated,
          onhold: initOnhold,
          failed: initFailed,
          skipped: initSkipped,
          results: initiateResults,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("on-demand-settlement error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
