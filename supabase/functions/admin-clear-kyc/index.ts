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
    const { adminId, userId } = await req.json();

    if (!adminId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch existing KYC record ids (for storage cleanup)
    const [panRes, addressRes, businessRes] = await Promise.all([
      supabase.from("kyc_pan_verification").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("kyc_address_proof").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("kyc_business_info").select("id").eq("user_id", userId).maybeSingle(),
    ]);

    // Delete KYC rows (will cascade or simply remove this user's submissions)
    await Promise.all([
      supabase.from("kyc_pan_verification").delete().eq("user_id", userId),
      supabase.from("kyc_address_proof").delete().eq("user_id", userId),
      supabase.from("kyc_business_info").delete().eq("user_id", userId),
    ]);

    // Remove all KYC documents from storage under this user's folder
    try {
      const { data: objects } = await supabase
        .storage
        .from("kyc-documents")
        .list(userId, { limit: 1000 });

      if (objects && objects.length > 0) {
        const paths = objects.map((o) => `${userId}/${o.name}`);
        await supabase.storage.from("kyc-documents").remove(paths);
      }
    } catch (storageErr) {
      console.error("Failed to remove KYC storage files:", storageErr);
    }

    // Reset the user's KYC completion flag so they must re-submit
    await supabase
      .from("users")
      .update({ kyc_completed: false })
      .eq("id", userId);

    const clearedTables = [
      ...(panRes.data ? ["kyc_pan_verification"] : []),
      ...(addressRes.data ? ["kyc_address_proof"] : []),
      ...(businessRes.data ? ["kyc_business_info"] : []),
    ];

    return new Response(
      JSON.stringify({ success: true, userId, clearedTables }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
