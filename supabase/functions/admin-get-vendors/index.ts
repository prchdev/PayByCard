// Finance: Vendor list endpoint
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const adminId = body.adminId;
    const search = body.search || "";
    const statusFilter = body.status || "";
    const registrationFilter = body.registrationStatus || "";
    const domesticFilter = body.domesticOrInternational || "";

    if (!adminId) {
      return new Response(JSON.stringify({ error: "Missing adminId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: admin } = await supabase
      .from("admin_users").select("id").eq("id", adminId).maybeSingle();
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("finance_vendors")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`legal_name.ilike.%${search}%,vendor_code.ilike.%${search}%,gst_number.ilike.%${search}%,pan_number.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (statusFilter) query = query.eq("status", statusFilter);
    if (registrationFilter) query = query.eq("registration_status", registrationFilter);
    if (domesticFilter) query = query.eq("domestic_or_international", domesticFilter);

    const { data: vendors, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch vendors" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ vendors: vendors || [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
