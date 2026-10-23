import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  isSupportedGateway,
  getPendingSettlement,
  initiateSettlement,
  checkSettlementStatus,
  disablePaymentOptionsForGateway,
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
 *   For each gateway where on_demand_settlement_enabled = true:
 *   1. Checks if enough time has passed since last_settlement_at.
 *   2. Fetches the actual pending settlement amount from the gateway API.
 *   3. Initiates a settlement request to the gateway API.
 *   4. Records the settlement attempt. If "onhold", disables payment options.
 *
 * Currently supports Razorpay and Cashfree settlement APIs.
 *
 * Razorpay notes: amount is always sent (required by API) but
 * settle_full_balance=true tells Razorpay to ignore it and settle
 * everything available. Description must be <=30 chars, alphanumeric+spaces.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

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
    const initiateResults: Array<{ gateway: string; status: string; amount?: number; skipped: boolean; reason?: string }> = [];

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
    // ═══════════════════════════════════════════════════════════════════════════

    const { data: initSettings, error: sErr } = await supabase
      .from("gateway_settlement_settings")
      .select(`
        id, gateway_name,
        settlement_trigger_minutes, last_settlement_at
      `)
      .eq("on_demand_settlement_enabled", true);

    if (sErr) throw new Error(`Initiate settings query failed: ${sErr.message}`);

    for (const setting of initSettings || []) {
      const { data: gateway, error: gErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("gateway_name", setting.gateway_name)
        .maybeSingle();

      if (gErr || !gateway) {
        initiateResults.push({ gateway: setting.gateway_name, status: "no_gateway_config", skipped: true });
        continue;
      }

      // Fetch actual pending settlement amount from the gateway API
      const env = gateway.environment || "production";
      const { amount: pendingAmount, onHold, error: balanceError } = await getPendingSettlement(setting.gateway_name, gateway, env);

      // If the gateway reports onhold, disable payment options immediately
      if (onHold) {
        await disablePaymentOptionsForGateway(supabase, gateway.id, setting.gateway_name);
        await supabase
          .from("gateway_settlement_settings")
          .update({
            last_settlement_at: now.toISOString(),
            last_settlement_status: "onhold",
            last_settlement_amount: pendingAmount,
            updated_at: now.toISOString(),
          })
          .eq("id", setting.id);

        initiateResults.push({
          gateway: setting.gateway_name,
          status: "onhold",
          amount: pendingAmount,
          skipped: false,
        });
        continue;
      }

      // For Razorpay: always attempt settlement using settle_full_balance=true.
      // The recon API may report 0 or fail entirely, but Razorpay will settle
      // whatever is actually available when settle_full_balance=true is sent.
      // For other gateways: skip if no balance or if the balance check failed.
      const isRazorpay = setting.gateway_name.toLowerCase().includes("razorpay");

      if (!isRazorpay && !balanceError && pendingAmount === 0) {
        initiateResults.push({
          gateway: setting.gateway_name,
          status: "no_balance",
          amount: 0,
          skipped: true,
          reason: "No pending balance available for settlement",
        });
        continue;
      }

      if (!isRazorpay && balanceError) {
        initiateResults.push({
          gateway: setting.gateway_name,
          status: "check_failed",
          amount: 0,
          skipped: true,
          reason: `Balance check failed: ${balanceError}`,
        });
        continue;
      }

      if (balanceError) {
        console.log(`on-demand-settlement: balance check failed for ${setting.gateway_name} (${balanceError}), attempting settlement with settle_full_balance`);
      }

      // Initiate settlement via the gateway API
      const settlementResult = await initiateSettlement(setting.gateway_name, gateway, env, pendingAmount);

      // Only record in DB if a settlement was actually attempted
      const errorDetail = settlementResult.status === "failed" || settlementResult.status === "check_failed"
        ? JSON.stringify(settlementResult.response || {}).substring(0, 500)
        : null;

      await supabase
        .from("gateway_settlement_settings")
        .update({
          last_settlement_at: now.toISOString(),
          last_settlement_status: settlementResult.status,
          last_settlement_amount: pendingAmount,
          last_settlement_error: errorDetail,
          updated_at: now.toISOString(),
        })
        .eq("id", setting.id);

      initiateResults.push({
        gateway: setting.gateway_name,
        status: settlementResult.status,
        amount: pendingAmount,
        skipped: false,
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
