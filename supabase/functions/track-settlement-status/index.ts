import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * track-settlement-status
 *
 * Scheduled every 30 minutes via pg_cron.
 *
 * For each gateway with on_demand_settlement_enabled = true:
 *   1. Checks the gateway API for the status of the most recent on-demand
 *      settlement (recorded in last_settlement_status).
 *   2. If the settlement status is "onhold", disables all payment_options
 *      linked to that gateway (sets is_enabled = false).
 *   3. Updates last_settlement_status with the latest status from the gateway.
 *
 * This complements the existing check-settlement-status cron job which tracks
 * per-payment settlement status. This job specifically monitors on-demand
 * settlement responses for the onhold condition.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

function getCredentials(gateway: any, env: string) {
  const isTest = (env ?? "production").toLowerCase() === "test";
  return {
    apiKey: (isTest ? gateway.test_api_key : gateway.production_api_key) ?? "",
    apiSecret: (isTest ? gateway.test_api_secret : gateway.production_api_secret) ?? "",
  };
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
    // Check recent settlements for this account
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
    // Check settlement status via Cashfree reconciliation API
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

// ─── Dispatcher ───────────────────────────────────────────────────────────────
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

    // Get all gateways with on-demand settlement enabled that have a recent settlement
    const { data: settings, error: sErr } = await supabase
      .from("gateway_settlement_settings")
      .select("id, gateway_name, last_settlement_status, last_settlement_at")
      .eq("on_demand_settlement_enabled", true)
      .not("last_settlement_at", "is", null);

    if (sErr) throw new Error(`Settings query failed: ${sErr.message}`);

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No gateways to track", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ gateway: string; previousStatus: string; currentStatus: string; paymentOptionsDisabled: number }> = [];

    for (const setting of settings) {
      // Skip if already in terminal state
      if (["settled", "failed", "not_applicable"].includes(setting.last_settlement_status)) {
        continue;
      }

      const { data: gateway, error: gErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("gateway_name", setting.gateway_name)
        .maybeSingle();

      if (gErr || !gateway) {
        results.push({
          gateway: setting.gateway_name,
          previousStatus: setting.last_settlement_status,
          currentStatus: "no_gateway_config",
          paymentOptionsDisabled: 0,
        });
        continue;
      }

      const env = gateway.environment || "production";
      const { status: currentStatus } = await checkSettlementStatus(setting.gateway_name, gateway, env);

      // Update the settlement status
      await supabase
        .from("gateway_settlement_settings")
        .update({
          last_settlement_status: currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", setting.id);

      let disabledCount = 0;

      // If onhold, disable all payment options using this gateway
      if (currentStatus === "onhold") {
        const { data: disabled } = await supabase
          .from("payment_options")
          .update({ is_enabled: false, updated_at: new Date().toISOString() })
          .eq("gateway_id", gateway.id)
          .select("id");

        disabledCount = disabled?.length || 0;
        console.log(`track-settlement-status: ${setting.gateway_name} is onhold — disabled ${disabledCount} payment options`);
      }

      results.push({
        gateway: setting.gateway_name,
        previousStatus: setting.last_settlement_status,
        currentStatus,
        paymentOptionsDisabled: disabledCount,
      });
    }

    const onhold = results.filter(r => r.currentStatus === "onhold").length;
    const settled = results.filter(r => r.currentStatus === "settled").length;
    const failed = results.filter(r => r.currentStatus === "failed").length;
    const totalDisabled = results.reduce((sum, r) => sum + r.paymentOptionsDisabled, 0);

    console.log(
      `track-settlement-status: processed=${results.length} onhold=${onhold} ` +
      `settled=${settled} failed=${failed} options_disabled=${totalDisabled} ` +
      `duration=${Date.now() - startedAt}ms`,
    );

    return new Response(
      JSON.stringify({ success: true, processed: results.length, onhold, settled, failed, options_disabled: totalDisabled, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("track-settlement-status error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
