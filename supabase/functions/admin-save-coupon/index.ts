import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { adminId, id, coupon_code, minimum_total, discount_type, discount_value,
            per_account_limit, applicable_to, total_usage_limit,
            start_date, end_date, is_active, action, maximum_discount_value } = body;

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Missing adminId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE action
    if (action === "delete" && id) {
      const { error: deleteError } = await supabase
        .from("coupons")
        .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete coupon" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Coupon deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TOGGLE action
    if (action === "toggle" && id) {
      const { data: existing } = await supabase
        .from("coupons")
        .select("is_active")
        .eq("id", id)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Coupon not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: toggleError } = await supabase
        .from("coupons")
        .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (toggleError) {
        console.error("Toggle error:", toggleError);
        return new Response(
          JSON.stringify({ error: "Failed to toggle coupon" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `Coupon ${!existing.is_active ? "enabled" : "disabled"}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREATE / UPDATE
    if (!coupon_code || typeof coupon_code !== "string" || !coupon_code.trim()) {
      return new Response(
        JSON.stringify({ error: "Coupon code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!discount_type || !["flat", "percentage"].includes(discount_type)) {
      return new Response(
        JSON.stringify({ error: "Discount type must be 'flat' or 'percentage'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (discount_value == null || isNaN(Number(discount_value)) || Number(discount_value) <= 0) {
      return new Response(
        JSON.stringify({ error: "Discount value must be a positive number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (discount_type === "percentage" && Number(discount_value) > 100) {
      return new Response(
        JSON.stringify({ error: "Percentage discount cannot exceed 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: "Start date and end date are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(end_date) < new Date(start_date)) {
      return new Response(
        JSON.stringify({ error: "End date cannot be before start date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!applicable_to || !["first_transaction", "non_first_transaction", "all"].includes(applicable_to)) {
      return new Response(
        JSON.stringify({ error: "Invalid applicable_to value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = coupon_code.trim().toUpperCase();
    const minTotal = Number(minimum_total) || 0;
    const discValue = Number(discount_value);
    const perAccount = Number(per_account_limit) || 1;
    const totalLimit = total_usage_limit != null ? Number(total_usage_limit) : null;
    const active = is_active !== false;
    const maxDisc = maximum_discount_value != null && maximum_discount_value !== ''
      ? Number(maximum_discount_value) : null;

    // Check uniqueness of coupon code
    let checkQuery = supabase
      .from("coupons")
      .select("id")
      .eq("coupon_code", code)
      .eq("is_deleted", false);

    if (id) {
      checkQuery = checkQuery.neq("id", id);
    }

    const { data: conflict } = await checkQuery.maybeSingle();
    if (conflict) {
      return new Response(
        JSON.stringify({ error: "Coupon code already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (id) {
      const { data: updated, error: updateError } = await supabase
        .from("coupons")
        .update({
          coupon_code: code,
          minimum_total: minTotal,
          discount_type,
          discount_value: discValue,
          per_account_limit: perAccount,
          applicable_to,
          total_usage_limit: totalLimit,
          maximum_discount_value: maxDisc,
          start_date,
          end_date,
          is_active: active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update coupon" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, coupon: updated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: created, error: insertError } = await supabase
      .from("coupons")
      .insert({
        coupon_code: code,
        minimum_total: minTotal,
        discount_type,
        discount_value: discValue,
        per_account_limit: perAccount,
        applicable_to,
        total_usage_limit: totalLimit,
        maximum_discount_value: maxDisc,
        start_date,
        end_date,
        is_active: active,
        created_by: adminId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create coupon" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, coupon: created }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
