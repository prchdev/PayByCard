import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, section, data, ipAddress } = body;

    if (!userId || !section || !data) {
      return new Response(JSON.stringify({ error: "userId, section and data are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const clientIp = ipAddress || getClientIp(req);
    const now = new Date().toISOString();
    let result;

    if (section === "pan") {
      if (data.pan_number) {
        const { data: duplicatePan } = await supabase
          .from("kyc_pan_verification")
          .select("id, user_id")
          .eq("pan_number", data.pan_number)
          .neq("user_id", userId)
          .maybeSingle();

        if (duplicatePan) {
          return new Response(
            JSON.stringify({ error: "This PAN number is already linked to another account. Each PAN can only be used for one account's KYC verification." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const existing = await supabase
        .from("kyc_pan_verification")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const payload = { ...data, status: "verification_pending", uploaded_at: now, upload_ip: clientIp, updated_at: now };

      if (existing.data) {
        result = await supabase
          .from("kyc_pan_verification")
          .update(payload)
          .eq("user_id", userId)
          .select()
          .single();
      } else {
        result = await supabase
          .from("kyc_pan_verification")
          .insert({ user_id: userId, ...payload })
          .select()
          .single();
      }
    } else if (section === "address") {
      const existing = await supabase
        .from("kyc_address_proof")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const payload = { ...data, status: "verification_pending", uploaded_at: now, upload_ip: clientIp, updated_at: now };

      if (existing.data) {
        result = await supabase
          .from("kyc_address_proof")
          .update(payload)
          .eq("user_id", userId)
          .select()
          .single();
      } else {
        result = await supabase
          .from("kyc_address_proof")
          .insert({ user_id: userId, ...payload })
          .select()
          .single();
      }
    } else if (section === "business") {
      const existing = await supabase
        .from("kyc_business_info")
        .select("id, status")
        .eq("user_id", userId)
        .maybeSingle();

      const hasBusinessDocs = data.incorporation_certificate_url || data.gst_certificate_url || data.loa_url;

      const payload = {
        ...data,
        status: hasBusinessDocs ? "verification_pending" : "pending",
        uploaded_at: now,
        upload_ip: clientIp,
        updated_at: now
      };

      if (existing.data) {
        result = await supabase
          .from("kyc_business_info")
          .update(payload)
          .eq("user_id", userId)
          .select()
          .single();
      } else {
        result = await supabase
          .from("kyc_business_info")
          .insert({ user_id: userId, ...payload })
          .select()
          .single();
      }

      if (hasBusinessDocs && (!existing.data || existing.data.status !== "verification_pending")) {
        await supabase
          .from("users")
          .update({ kyc_completed: false })
          .eq("id", userId);
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid section" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    return new Response(JSON.stringify({ success: true, data: result.data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
