import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine account type: business if kyc_business_info.status === 'verified', else retail.
    // If no userId is provided, fall back to showing retail-enabled categories.
    let isBusinessAccount = false;

    let userId: string | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        userId = body?.userId;
      } catch {
        userId = undefined;
      }
    }

    if (userId) {
      const { data: businessData } = await supabase
        .from("kyc_business_info")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();

      isBusinessAccount = businessData?.status === "verified";
    }

    // Build query for enabled categories, filtered by account type.
    let query = supabase
      .from("payment_categories")
      .select("id, category_name, is_enabled, display_order, receiver_kyc_required, new_card_payment_delay_hours, refund_after_hours, settlement_time, invoice_required, invoice_frequency_months, invoice_min_amount, max_payment_per_beneficiary, available_to_retail, available_to_business")
      .eq("is_enabled", true);

    if (isBusinessAccount) {
      query = query.eq("available_to_business", true);
    } else {
      query = query.eq("available_to_retail", true);
    }

    const { data: categories, error } = await query.order("display_order", {
      ascending: true,
    });

    if (error) {
      console.error("Error fetching payment categories:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch payment categories" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ categories: categories || [] }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Exception in get-payment-categories-list:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

