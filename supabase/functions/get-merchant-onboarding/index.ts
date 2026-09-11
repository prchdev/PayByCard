import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { withSignedKycUrls } from "../_shared/kycUrls.ts";

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
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: record, error: fetchError } = await supabase
      .from("merchant_onboarding")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (fetchError || !record) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch beneficiary bank details and name from the beneficiaries table
    let bankDetails = { bank_name: '', bank_branch: '', bank_ifsc: '', bank_account_number: '' };
    let beneficiaryName = record.beneficiary_name || '';
    if (record.beneficiary_id) {
      const { data: bene } = await supabase
        .from("beneficiaries")
        .select("bank_name, branch_name, ifsc, bank_account, full_name")
        .eq("id", record.beneficiary_id)
        .maybeSingle();
      if (bene) {
        bankDetails = {
          bank_name: bene.bank_name || '',
          bank_branch: bene.branch_name || '',
          bank_ifsc: bene.ifsc || '',
          bank_account_number: bene.bank_account || '',
        };
        if (!beneficiaryName) beneficiaryName = bene.full_name || '';
      }
    }

    if (record.status === "verified") {
      return new Response(
        JSON.stringify({ status: "verified", message: "KYC already completed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (record.status === "refunded") {
      return new Response(
        JSON.stringify({ status: "refunded", message: "This payment has been refunded" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (record.status === "rejected") {
      const now = new Date();
      const expiresAt = new Date(record.expires_at);
      const expired = now > expiresAt;

      if (expired) {
        return new Response(
          JSON.stringify({ status: "expired", message: "This link has expired" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "rejected",
          message: "KYC was rejected. Please re-submit.",
          data: {
            id: record.id,
            sender_name: record.sender_name,
            category_name: record.category_name,
            beneficiary_name: beneficiaryName,
            email: record.email,
            mobile: record.mobile,
            pan_number: record.pan_number,
            pan_photo_url: record.pan_photo_url,
            expires_at: record.expires_at,
            rejection_reason: record.rejection_reason || null,
            bank_name: bankDetails.bank_name,
            bank_branch: bankDetails.bank_branch,
            bank_ifsc: bankDetails.bank_ifsc,
            bank_account_number: bankDetails.bank_account_number,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const expiresAt = new Date(record.expires_at);

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ status: "expired", message: "This link has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "pending",
        data: {
          id: record.id,
          sender_name: record.sender_name,
          category_name: record.category_name,
          beneficiary_name: beneficiaryName,
          email: record.email,
          mobile: record.mobile,
          pan_number: record.pan_number,
          pan_photo_url: record.pan_photo_url,
          expires_at: record.expires_at,
          bank_name: bankDetails.bank_name,
          bank_branch: bankDetails.bank_branch,
          bank_ifsc: bankDetails.bank_ifsc,
          bank_account_number: bankDetails.bank_account_number,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


// redeploy
