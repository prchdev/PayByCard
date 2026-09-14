import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { adminId, paymentId, action, reason } = await req.json();

    if (!adminId || !paymentId || !action) {
      return new Response(
        JSON.stringify({ error: "adminId, paymentId, and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action !== "hold" && action !== "unhold") {
      return new Response(
        JSON.stringify({ error: "action must be 'hold' or 'unhold'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: payment, error: fetchErr } = await supabase
      .from("payments")
      .select("id, status, pre_hold_status")
      .eq("id", paymentId)
      .maybeSingle();

    if (fetchErr || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "hold") {
      if (payment.status === "on_hold") {
        return new Response(
          JSON.stringify({ error: "Transaction is already on hold" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (payment.status === "failed" || payment.status === "cancelled") {
        return new Response(
          JSON.stringify({ error: "Cannot hold a failed transaction" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: updateErr } = await supabase
        .from("payments")
        .update({
          pre_hold_status: payment.status,
          status: "on_hold",
          hold_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (updateErr) {
        return new Response(
          JSON.stringify({ error: updateErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("payment_logs").insert({
        payment_id: paymentId,
        status: "on_hold",
        message: `Transaction put on hold by admin. Previous status: ${payment.status}. Reason: ${reason || "Not specified"}`,
        metadata: { previous_status: payment.status, action: "hold", admin_id: adminId, reason: reason || null },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Transaction put on hold", previous_status: payment.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // action === "unhold"
    if (payment.status !== "on_hold") {
      return new Response(
        JSON.stringify({ error: "Transaction is not on hold" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const restoreStatus = payment.pre_hold_status || "processing";

    const { error: updateErr } = await supabase
      .from("payments")
      .update({
        status: restoreStatus,
        pre_hold_status: null,
        hold_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("payment_logs").insert({
      payment_id: paymentId,
      status: restoreStatus,
      message: `Transaction released from hold. Restored to status: ${restoreStatus}`,
      metadata: { restored_status: restoreStatus, action: "unhold", admin_id: adminId },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Transaction released from hold", restored_status: restoreStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in admin-toggle-hold:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
