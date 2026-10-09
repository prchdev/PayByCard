import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * on-demand-settlement
 *
 * Scheduled every 5 minutes via pg_cron.
 *
 * For each gateway where on_demand_settlement_enabled = true:
 *   1. Checks if enough time has passed since last_settlement_at
 *      (settlement_trigger_minutes).
 *   2. Calculates the pending settlement amount (sum of captured/paid payments
 *      for that gateway that haven't been settled yet).
 *   3. If pending >= minimum_settlement_amount, initiates a settlement request
 *      to the gateway API.
 *   4. Records the settlement attempt in last_settlement_at/_status/_amount.
 *
 * Currently supports Razorpay and Cashfree settlement APIs.
 * For gateways without a settlement API, records as "not_applicable".
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
    // Razorpay X settlement: create a payout to trigger settlement
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
      // Check for onhold in the response
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
    // Cashfree settlement request
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

// ─── Dispatcher ───────────────────────────────────────────────────────────────
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
  // For unsupported gateways, record as not_applicable
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

    // Get all gateways with on-demand settlement enabled
    const { data: settings, error: sErr } = await supabase
      .from("gateway_settlement_settings")
      .select(`
        id, gateway_name, minimum_settlement_amount,
        settlement_trigger_minutes, last_settlement_at
      `)
      .eq("on_demand_settlement_enabled", true);

    if (sErr) throw new Error(`Settings query failed: ${sErr.message}`);

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No gateways with on-demand settlement enabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date();
    const results: Array<{ gateway: string; status: string; amount?: number; skipped: boolean; reason?: string }> = [];

    for ( const setting of settings) {
      // Check trigger interval
      if (setting.last_settlement_at) {
        const lastAt = new Date(setting.last_settlement_at);
        const elapsedMins = (now.getTime() - lastAt.getTime()) / (1000 * 60);
        if (elapsedMins < setting.settlement_trigger_minutes) {
          results.push({
            gateway: setting.gateway_name,
            status: "skipped",
            skipped: true,
            reason: `Only ${Math.round(elapsedMins)} mins since last settlement (need ${setting.settlement_trigger_minutes})`,
          });
          continue;
        }
      }

      // Get gateway config
      const { data: gateway, error: gErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("gateway_name", setting.gateway_name)
        .maybeSingle();

      if (gErr || !gateway) {
        results.push({ gateway: setting.gateway_name, status: "no_gateway_config", skipped: true });
        continue;
      }

      // Calculate pending settlement amount: sum of payments for this gateway
      // with settlement status in (captured, paid) — money received but not settled
      const { data: pendingPayments, error: pErr } = await supabase
        .from("payments")
        .select("amount")
        .eq("payment_gateway_id", gateway.id)
        .in("gateway_settlement_status", ["captured", "paid"]);

      if (pErr) {
        results.push({ gateway: setting.gateway_name, status: "query_failed", skipped: true });
        continue;
      }

      const pendingAmount = (pendingPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      if (pendingAmount < Number(setting.minimum_settlement_amount)) {
        results.push({
          gateway: setting.gateway_name,
          status: "below_minimum",
          amount: pendingAmount,
          skipped: true,
          reason: `Pending ${pendingAmount} < minimum ${setting.minimum_settlement_amount}`,
        });
        continue;
      }

      // Initiate settlement
      const env = gateway.environment || "production";
      const settlementResult = await initiateSettlement(setting.gateway_name, gateway, env, pendingAmount);

      // Update settlement settings record
      await supabase
        .from("gateway_settlement_settings")
        .update({
          last_settlement_at: now.toISOString(),
          last_settlement_status: settlementResult.status,
          last_settlement_amount: pendingAmount,
          updated_at: now.toISOString(),
        })
        .eq("id", setting.id);

      results.push({
        gateway: setting.gateway_name,
        status: settlementResult.status,
        amount: pendingAmount,
        skipped: false,
      });

      // If onhold, immediately disable payment options using this gateway
      if (settlementResult.status === "onhold") {
        const { data: disabledOptions } = await supabase
          .from("payment_options")
          .update({ is_enabled: false, updated_at: now.toISOString() })
          .eq("gateway_id", gateway.id)
          .select("id, category_name");

        console.log(`on-demand-settlement: ${setting.gateway_name} returned onhold — disabled ${disabledOptions?.length || 0} payment options`);
      }
    }

    const initiated = results.filter(r => r.status === "initiated").length;
    const onhold = results.filter(r => r.status === "onhold").length;
    const failed = results.filter(r => r.status === "failed").length;
    const skipped = results.filter(r => r.skipped).length;

    console.log(
      `on-demand-settlement: processed=${results.length} initiated=${initiated} ` +
      `onhold=${onhold} failed=${failed} skipped=${skipped} duration=${Date.now() - startedAt}ms`,
    );

    return new Response(
      JSON.stringify({ success: true, processed: results.length, initiated, onhold, failed, skipped, results }),
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
