import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { adminId, paymentId, action, rejectionReason } = await req.json();

    if (!adminId || !paymentId || !action) {
      return new Response(
        JSON.stringify({ error: "adminId, paymentId, and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action !== "verified" && action !== "rejected") {
      return new Response(
        JSON.stringify({ error: "action must be 'verified' or 'rejected'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin session
    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id")
      .eq("id", adminId)
      .maybeSingle();

    if (adminError || !admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the payment to verify it exists and has a bill
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .select("id, bill_file_url, invoice_status, status, beneficiary_id, business_category_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (payError || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payment.bill_file_url) {
      return new Response(
        JSON.stringify({ error: "No invoice/bill uploaded for this payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payment.invoice_status === "verified") {
      return new Response(
        JSON.stringify({ error: "Invoice already verified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    if (action === "verified") {
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          invoice_status: "verified",
          invoice_verified_at: now,
          invoice_verified_by: adminId,
          invoice_confirmed_at: now,
          invoice_rejection_reason: null,
        })
        .eq("id", paymentId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to verify invoice" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Invoice verified successfully", invoiceStatus: "verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // rejected
      if (!rejectionReason) {
        return new Response(
          JSON.stringify({ error: "Rejection reason is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase
        .from("payments")
        .update({
          invoice_status: "rejected",
          invoice_verified_at: now,
          invoice_verified_by: adminId,
          invoice_rejection_reason: rejectionReason,
        })
        .eq("id", paymentId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to reject invoice" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Invoice rejected", invoiceStatus: "rejected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Exception in admin-review-invoice:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
