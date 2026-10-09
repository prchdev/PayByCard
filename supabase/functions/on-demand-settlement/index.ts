import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * on-demand-settlement
 *
 * Scheduled every 5 minutes via pg_cron.
 *
 * Combines two responsibilities in a single run:
 *
 * PHASE 1 — Settlement status tracking:
 *   For each gateway with on_demand_settlement_enabled = true that has a
 *   non-terminal last_settlement_status (initiated, in_progress, onhold,
 *   etc.), checks the gateway API for the current settlement status.
 *   If the status is "onhold", disables all payment_options linked to
 *   that gateway. Updates last_settlement_status with the latest value.
 *
 * PHASE 2 — On-demand settlement initiation:
 *   For each gateway where on_demand_settlement_enabled = true:
 *   1. Checks if enough time has passed since last_settlement_at
 *      (settlement_trigger_minutes).
 *   2. Calculates the pending settlement amount (sum of captured/paid
 *      payments for that gateway that haven't been settled yet).
 *   3. If pending >= minimum_settlement_amount, initiates a settlement
 *      request to the gateway API.
 *   4. Records the settlement attempt in last_settlement_at/_status/_amount.
 *   5. If the gateway returns "onhold", immediately disables payment
 *      options using that gateway.
 *
 * Currently supports Razorpay and Cashfree settlement APIs.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

// Gateways that support on-demand settlement APIs
const SUPPORTED_GATEWAYS = ["razorpay", "cashfree"];

function isSupportedGateway(gatewayName: string): boolean {
  const name = (gatewayName || "").toLowerCase();
  return SUPPORTED_GATEWAYS.some((g) => name.includes(g));
}

function getCredentials(gateway: any, env: string) {
  const isTest = (env ?? "production").toLowerCase() === "test";
  return {
    apiKey: (isTest ? gateway.test_api_key : gateway.production_api_key) ?? "",
    apiSecret: (isTest ? gateway.test_api_secret : gateway.production_api_secret) ?? "",
  };
}

// ─── Razorpay on-demand settlement ───────────────────────────────────────────
async function initiateRazorpaySettlement(
  gateway: any,
  env: string,
  amount: number,
): Promise<{ status: string; response?: any }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { status: "check_failed" };

  const accountNumber = gateway.razorpay_account_number;
  if (!accountNumber) return { status: "no_account" };

  try {
    const res = await fetch("https://api.razorpay.com/v1/payouts", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_number: accountNumber,
        amount: Math.round(amount * 100),
        currency: "INR",
        mode: "IMPS",
        purpose: "settlement",
        notes: { type: "on_demand_settlement" },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const status = (data.error?.code || data.status || "").toLowerCase();
      if (status.includes("onhold") || status.includes("on_hold")) {
        return { status: "onhold", response: data };
      }
      return { status: "failed", response: data };
    }

    return { status: "initiated", response: data };
  } catch {
    return { status: "failed" };
  }
}

// ─── Cashfree on-demand settlement ───────────────────────────────────────────
async function initiateCashfreeSettlement(
  gateway: any,
  env: string,
  amount: number,
): Promise<{ status: string; response?: any }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { status: "check_failed" };

  const base = (env ?? "production").toLowerCase() === "test"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";

  try {
    const res = await fetch(`${base}/pg/settlements`, {
      method: "POST",
      headers: {
        "x-client-id": apiKey,
        "x-client-secret": apiSecret,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount.toFixed(2),
        currency: "INR",
        type: "on_demand",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const status = (data.error?.code || data.status || "").toLowerCase();
      if (status.includes("onhold") || status.includes("on_hold")) {
        return { status: "onhold", response: data };
      }
      return { status: "failed", response: data };
    }

    return { status: "initiated", response: data };
  } catch {
    return { status: "failed" };
  }
}

// ─── Settlement initiation dispatcher ─────────────────────────────────────────
async function initiateSettlement(
  gatewayName: string,
  gateway: any,
  env: string,
  amount: number,
): Promise<{ status: string; response?: any }> {
  const name = (gatewayName || "").toLowerCase();

  if (name.includes("razorpay")) {
    return initiateRazorpaySettlement(gateway, env, amount);
  }
  if (name.includes("cashfree")) {
    return initiateCashfreeSettlement(gateway, env, amount);
  }
  return { status: "not_applicable" };
}

// ─── Razorpay settlement status check ────────────────────────────────────────
async function checkRazorpaySettlementStatus(
  gateway: any,
  env: string,
): Promise<{ status: string }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { status: "check_failed" };

  const accountNumber = gateway.razorpay_account_number;
  if (!accountNumber) return { status: "no_account" };

  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/settlements?account_number=${accountNumber}&limit=1`,
      {
        headers: { "Authorization": `Basic ${btoa(`${apiKey}:${apiSecret}`)}` },
      },
    );

    if (!res.ok) return { status: "check_failed" };

    const data = await res.json();
    const settlements = data.items || data.settlements || [];

    if (settlements.length === 0) return { status: "no_settlement" };

    const latest = settlements[0];
    const rawStatus = (latest.status || "").toLowerCase();

    if (rawStatus === "on_hold" || rawStatus === "onhold") {
      return { status: "onhold" };
    }
    if (rawStatus === "settled" || rawStatus === "processed") {
      return { status: "settled" };
    }
    if (rawStatus === "in_process" || rawStatus === "pending") {
      return { status: "in_progress" };
    }
    if (rawStatus === "failed" || rawStatus === "cancelled") {
      return { status: "failed" };
    }
    return { status: rawStatus || "unknown" };
  } catch {
    return { status: "check_failed" };
  }
}

// ─── Cashfree settlement status check ────────────────────────────────────────
async function checkCashfreeSettlementStatus(
  gateway: any,
  env: string,
): Promise<{ status: string }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { status: "check_failed" };

  const base = (env ?? "production").toLowerCase() === "test"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";

  try {
    const res = await fetch(`${base}/pg/settlements`, {
      headers: {
        "x-client-id": apiKey,
        "x-client-secret": apiSecret,
        "x-api-version": "2023-08-01",
      },
    });

    if (!res.ok) return { status: "check_failed" };

    const data = await res.json();
    const settlements = Array.isArray(data) ? data : (data.data || data.settlements || []);

    if (settlements.length === 0) return { status: "no_settlement" };

    const latest = settlements[0];
    const rawStatus = (latest.settlement_status || latest.status || "").toLowerCase();

    if (rawStatus.includes("onhold") || rawStatus.includes("on_hold")) {
      return { status: "onhold" };
    }
    if (rawStatus === "success" || rawStatus === "settled" || rawStatus === "processed") {
      return { status: "settled" };
    }
    if (rawStatus === "pending" || rawStatus === "in_process") {
      return { status: "in_progress" };
    }
    if (rawStatus === "failed" || rawStatus === "cancelled") {
      return { status: "failed" };
    }
    return { status: rawStatus || "unknown" };
  } catch {
    return { status: "check_failed" };
  }
}

// ─── Status check dispatcher ──────────────────────────────────────────────────
async function checkSettlementStatus(
  gatewayName: string,
  gateway: any,
  env: string,
): Promise<{ status: string }> {
  const name = (gatewayName || "").toLowerCase();

  if (name.includes("razorpay")) {
    return checkRazorpaySettlementStatus(gateway, env);
  }
  if (name.includes("cashfree")) {
    return checkCashfreeSettlementStatus(gateway, env);
  }
  return { status: "not_applicable" };
}

// ─── Helper: disable payment options for a gateway ────────────────────────────
async function disablePaymentOptionsForGateway(
  supabase: any,
  gatewayId: string,
  gatewayName: string,
): Promise<number> {
  const { data: disabled } = await supabase
    .from("payment_options")
    .update({ is_enabled: false, updated_at: new Date().toISOString() })
    .eq("gateway_id", gatewayId)
    .select("id, category_name");

  const count = disabled?.length || 0;
  console.log(`on-demand-settlement: ${gatewayName} is onhold — disabled ${count} payment options`);
  return count;
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
        id, gateway_name, minimum_settlement_amount,
        settlement_trigger_minutes, last_settlement_at
      `)
      .eq("on_demand_settlement_enabled", true);

    if (sErr) throw new Error(`Initiate settings query failed: ${sErr.message}`);

    for (const setting of initSettings || []) {
      // Check trigger interval
      if (setting.last_settlement_at) {
        const lastAt = new Date(setting.last_settlement_at);
        const elapsedMins = (now.getTime() - lastAt.getTime()) / (1000 * 60);
        if (elapsedMins < setting.settlement_trigger_minutes) {
          initiateResults.push({
            gateway: setting.gateway_name,
            status: "skipped",
            skipped: true,
            reason: `Only ${Math.round(elapsedMins)} mins since last settlement (need ${setting.settlement_trigger_minutes})`,
          });
          continue;
        }
      }

      const { data: gateway, error: gErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("gateway_name", setting.gateway_name)
        .maybeSingle();

      if (gErr || !gateway) {
        initiateResults.push({ gateway: setting.gateway_name, status: "no_gateway_config", skipped: true });
        continue;
      }

      // Calculate pending settlement amount
      const { data: pendingPayments, error: pErr } = await supabase
        .from("payments")
        .select("amount")
        .eq("payment_gateway_id", gateway.id)
        .in("gateway_settlement_status", ["captured", "paid"]);

      if (pErr) {
        initiateResults.push({ gateway: setting.gateway_name, status: "query_failed", skipped: true });
        continue;
      }

      const pendingAmount = (pendingPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      if (pendingAmount < Number(setting.minimum_settlement_amount)) {
        initiateResults.push({
          gateway: setting.gateway_name,
          status: "below_minimum",
          amount: pendingAmount,
          skipped: true,
          reason: `Pending ${pendingAmount} < minimum ${setting.minimum_settlement_amount}`,
        });
        continue;
      }

      const env = gateway.environment || "production";
      const settlementResult = await initiateSettlement(setting.gateway_name, gateway, env, pendingAmount);

      await supabase
        .from("gateway_settlement_settings")
        .update({
          last_settlement_at: now.toISOString(),
          last_settlement_status: settlementResult.status,
          last_settlement_amount: pendingAmount,
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
