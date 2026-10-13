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
    const {
      adminId,
      company_name,
      address,
      cin,
      gst_number,
      pan,
      tan,
      company_logo_url,
      website_url,
      support_email,
      phone_number,
      bank_beneficiary_name,
      bank_ifsc_code,
      bank_account_number,
      bank_branch_name,
      bank_name,
      bank_account_type,
      mobile_app_enabled,
      android_min_version,
      android_min_build,
      ios_min_version,
      ios_min_build,
    } = await req.json();

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Admin ID is required" }),
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

    const payload = {
      company_name: company_name || "",
      address: address || "",
      cin: cin || "",
      gst_number: gst_number || "",
      pan: pan || "",
      tan: tan || "",
      company_logo_url: company_logo_url || "",
      website_url: website_url || "",
      support_email: support_email || "",
      phone_number: phone_number || "",
      bank_beneficiary_name: bank_beneficiary_name || "",
      bank_ifsc_code: bank_ifsc_code || "",
      bank_account_number: bank_account_number || "",
      bank_branch_name: bank_branch_name || "",
      bank_name: bank_name || "",
      bank_account_type: bank_account_type || "current",
      mobile_app_enabled: mobile_app_enabled !== undefined ? !!mobile_app_enabled : true,
      android_min_version: android_min_version || "",
      android_min_build: android_min_build || "",
      ios_min_version: ios_min_version || "",
      ios_min_build: ios_min_build || "",
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("master_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("master_settings")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("master_settings")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settingsData = result.data;
    if (settingsData?.company_logo_url) {
      const bucketMatch = settingsData.company_logo_url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.*)/);
      if (bucketMatch) {
        const [, bucket, filePath] = bucketMatch;
        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600);
        if (signedData?.signedUrl) {
          settingsData.company_logo_url = signedData.signedUrl;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, settings: settingsData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


