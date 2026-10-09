/**
 * Shared settlement API helpers for Razorpay and Cashfree.
 * Used by both admin-gateway-settlement and on-demand-settlement edge functions.
 */

export function getCredentials(gateway: any, env: string) {
  const isTest = (env ?? "production").toLowerCase() === "test";
  return {
    apiKey: (isTest ? gateway.test_api_key : gateway.production_api_key) ?? "",
    apiSecret: (isTest ? gateway.test_api_secret : gateway.production_api_secret) ?? "",
  };
}

export function isSupportedGateway(gatewayName: string): boolean {
  const name = (gatewayName || "").toLowerCase();
  return name.includes("razorpay") || name.includes("cashfree");
}

// ─── Razorpay: fetch pending settlement balance via recon API ────────────────
// GET /v1/settlements/recon returns per-payment settlement reconciliation data.
// Each item has: amount (paise), fee, tax, on_hold (bool), settled (bool).
// Pending = sum of amount where settled=false and on_hold=false.
export async function getRazorpayPendingSettlement(
  gateway: any,
  env: string,
): Promise<{ amount: number; onHold: boolean }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { amount: 0, onHold: false };

  try {
    // Fetch recon data — Razorpay returns up to 100 items by default
    // We paginate to get all unsettled items
    let pendingPaise = 0;
    let hasOnHold = false;
    let hasMore = true;
    let skip = 0;

    while (hasMore) {
      const url = `https://api.razorpay.com/v1/settlements/recon?count=100&skip=${skip}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Basic ${btoa(`${apiKey}:${apiSecret}`)}` },
      });

      if (!res.ok) return { amount: 0, onHold: false };

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of items) {
        if (item.on_hold) hasOnHold = true;
        if (!item.settled && !item.on_hold) {
          pendingPaise += Number(item.amount || 0);
        }
      }

      if (items.length < 100) {
        hasMore = false;
      } else {
        skip += 100;
      }
    }

    return { amount: pendingPaise / 100, onHold: hasOnHold };
  } catch {
    return { amount: 0, onHold: false };
  }
}

// ─── Cashfree: fetch pending settlement balance via settlements API ───────────
// GET /pg/settlements returns settlement records with settlement_status.
// Pending = sum of settlement_amount where status is PENDING or NOT_INITIATED.
export async function getCashfreePendingSettlement(
  gateway: any,
  env: string,
): Promise<{ amount: number; onHold: boolean }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { amount: 0, onHold: false };

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

    if (!res.ok) return { amount: 0, onHold: false };

    const data = await res.json();
    const settlements = Array.isArray(data) ? data : (data.data || data.settlements || []);

    let pending = 0;
    let hasOnHold = false;

    for (const s of settlements) {
      const status = (s.settlement_status || s.status || "").toUpperCase();
      if (status === "PENDING" || status === "NOT_INITIATED") {
        pending += Number(s.settlement_amount || s.amount || 0);
      }
      if (status === "ONHOLD" || status === "ON_HOLD") {
        hasOnHold = true;
      }
    }

    return { amount: pending, onHold: hasOnHold };
  } catch {
    return { amount: 0, onHold: false };
  }
}

// ─── Dispatcher: get pending settlement for any supported gateway ─────────────
export async function getPendingSettlement(
  gatewayName: string,
  gateway: any,
  env: string,
): Promise<{ amount: number; onHold: boolean }> {
  const name = (gatewayName || "").toLowerCase();

  if (name.includes("razorpay")) {
    return getRazorpayPendingSettlement(gateway, env);
  }
  if (name.includes("cashfree")) {
    return getCashfreePendingSettlement(gateway, env);
  }
  return { amount: 0, onHold: false };
}

// ─── Razorpay: initiate on-demand settlement ─────────────────────────────────
// POST /v1/settlements/ondemand with amount (paise) and settle_full_balance.
export async function initiateRazorpaySettlement(
  gateway: any,
  env: string,
  amount: number,
): Promise<{ status: string; response?: any }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { status: "check_failed" };

  try {
    const res = await fetch("https://api.razorpay.com/v1/settlements/ondemand", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        settle_full_balance: false,
        description: "On-demand settlement initiated by PayByCard",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const errText = (data.error?.code || data.error?.description || data.error?.reason || "").toLowerCase();
      if (errText.includes("onhold") || errText.includes("on_hold") || errText.includes("hold")) {
        return { status: "onhold", response: data };
      }
      return { status: "failed", response: data };
    }

    return { status: "initiated", response: data };
  } catch {
    return { status: "failed" };
  }
}

// ─── Cashfree: initiate on-demand settlement ─────────────────────────────────
export async function initiateCashfreeSettlement(
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
      const errText = (data.error?.code || data.error?.message || data.status || "").toLowerCase();
      if (errText.includes("onhold") || errText.includes("on_hold") || errText.includes("hold")) {
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
export async function initiateSettlement(
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

// ─── Razorpay: check on-demand settlement status ─────────────────────────────
// GET /v1/settlements/ondemand returns all on-demand settlements.
// We fetch the most recent one and check its status.
export async function checkRazorpaySettlementStatus(
  gateway: any,
  env: string,
): Promise<{ status: string }> {
  const { apiKey, apiSecret } = getCredentials(gateway, env);
  if (!apiKey || !apiSecret) return { status: "check_failed" };

  try {
    const res = await fetch(
      "https://api.razorpay.com/v1/settlements/ondemand?count=1",
      {
        headers: { "Authorization": `Basic ${btoa(`${apiKey}:${apiSecret}`)}` },
      },
    );

    if (!res.ok) return { status: "check_failed" };

    const data = await res.json();
    const items = data.items || [];

    if (items.length === 0) return { status: "no_settlement" };

    const latest = items[0];
    const rawStatus = (latest.status || "").toLowerCase();

    if (rawStatus === "on_hold" || rawStatus === "onhold") {
      return { status: "onhold" };
    }
    if (rawStatus === "settled" || rawStatus === "processed") {
      return { status: "settled" };
    }
    if (rawStatus === "in_process" || rawStatus === "pending" || rawStatus === "created") {
      return { status: "in_progress" };
    }
    if (rawStatus === "failed" || rawStatus === "cancelled" || rawStatus === "rejected") {
      return { status: "failed" };
    }
    return { status: rawStatus || "unknown" };
  } catch {
    return { status: "check_failed" };
  }
}

// ─── Cashfree: check settlement status ───────────────────────────────────────
export async function checkCashfreeSettlementStatus(
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
    if (rawStatus === "pending" || rawStatus === "in_process" || rawStatus === "initiated") {
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
export async function checkSettlementStatus(
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

// ─── Helper: disable payment options for a gateway ───────────────────────────
export async function disablePaymentOptionsForGateway(
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
  console.log(`settlement: ${gatewayName} is onhold — disabled ${count} payment options`);
  return count;
}
