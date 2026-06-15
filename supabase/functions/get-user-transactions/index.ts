import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Derive the user-facing display status from the payment + its latest payout.
 *
 * Rules:
 * 1. payment.status = failed/cancelled              → "failed" / "cancelled"
 * 2. payment.status = kyc_pending                   → "kyc_pending"
 * 3. payment.status = refund_pending                → "refund_pending"
 * 4. payment.status = refunded                      → "refunded"
 * 5. payment.status = settlement_pending            → check payout:
 *      payout.status = completed                    → "completed"
 *      payout.status = failed/pending/processing    → "settlement_pending"
 *      no payout yet                                → "settlement_pending"
 * 6. payment.status = completed                     → "completed"
 * 7. payment.status = pending/processing            → "processing"
 */
function deriveDisplayStatus(payment: any, payout: any): string {
  const s = payment.status;

  if (s === "failed") return "failed";
  if (s === "cancelled") return "cancelled";
  if (s === "kyc_pending") return "kyc_pending";
  if (s === "refund_pending") return "refund_pending";
  if (s === "refunded") return "refunded";

  if (s === "completed") return "completed";

  if (s === "settlement_pending") {
    if (payout && payout.status === "completed") return "completed";
    return "settlement_pending";
  }

  // pending / processing
  return "processing";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { userId, page = 1, limit = 20, status } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const offset = (page - 1) * limit;

    let query = supabase
      .from("payments")
      .select(`
        id,
        payment_reference,
        amount,
        charges,
        gst,
        discount,
        total_amount,
        status,
        card_type,
        gateway_transaction_id,
        failure_reason,
        bill_file_url,
        gateway_environment,
        created_at,
        completed_at,
        updated_at,
        beneficiary_details,
        category_details,
        selected_payment_option,
        transaction_summary,
        payment_gateway_id,
        payment_gateway_settings!payment_gateway_id(gateway_name, registered_name, gst_number)
      `, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // When filtering by display status, we need to map back to DB statuses
    // For simplicity: filter by raw DB status when it maps 1:1, otherwise fetch all and filter in memory
    const needsInMemoryFilter = status && ["settlement_pending", "completed"].includes(status);
    if (status && status !== "all" && !needsInMemoryFilter) {
      query = query.eq("status", status);
    }

    const { data: payments, error, count } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({ payments: [], total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch latest payout for each payment (by payment_id)
    const paymentIds = payments.map((p: any) => p.id);
    const { data: payouts } = await supabase
      .from("payouts")
      .select("id, payment_id, status, completed_at, utr_number, gateway_transaction_id, failure_reason, payout_reference, payout_type, refund_reason, refunded_at")
      .in("payment_id", paymentIds)
      .order("created_at", { ascending: false });

    // Build a map: payment_id → latest payout
    const payoutMap: Record<string, any> = {};
    if (payouts) {
      for (const payout of payouts) {
        if (payout.payment_id && !payoutMap[payout.payment_id]) {
          payoutMap[payout.payment_id] = payout;
        }
      }
    }

    // Enrich each payment with display_status and payout info
    let enriched = payments.map((payment: any) => {
      const payout = payoutMap[payment.id] || null;
      const displayStatus = deriveDisplayStatus(payment, payout);
      return {
        ...payment,
        display_status: displayStatus,
        payout: payout
          ? {
              id: payout.id,
              status: payout.status,
              payout_reference: payout.payout_reference,
              completed_at: payout.completed_at,
              utr_number: payout.utr_number,
              gateway_transaction_id: payout.gateway_transaction_id,
              failure_reason: payout.failure_reason,
              payout_type: payout.payout_type,
              refund_reason: payout.refund_reason,
              refunded_at: payout.refunded_at,
            }
          : null,
      };
    });

    // Apply in-memory filter for display statuses that depend on payout
    if (status && status !== "all") {
      enriched = enriched.filter((p: any) => p.display_status === status);
    }

    return new Response(
      JSON.stringify({
        payments: enriched,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
