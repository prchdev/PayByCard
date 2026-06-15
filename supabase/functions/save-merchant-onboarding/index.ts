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
    const { token, email, mobile, pan_number, pan_photo_url } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pan_number || !pan_photo_url) {
      return new Response(
        JSON.stringify({ error: "PAN number and PAN photo are required" }),
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
        JSON.stringify({ error: "Invalid link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (record.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "This form has already been submitted or expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const expiresAt = new Date(record.expires_at);

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark merchant onboarding as 'submitted' (awaiting admin review)
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const { error: updateError } = await supabase
      .from("merchant_onboarding")
      .update({
        email: email || record.email,
        mobile: mobile || record.mobile,
        pan_number,
        pan_photo_url,
        kyc_method: "manual",
        status: "submitted",
        ip_address: ipAddress,
        kyc_completed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", record.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to save KYC data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS notification to merchant on submission
    const notifyMobile = mobile || record.mobile;
    if (notifyMobile) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            mobile: notifyMobile,
            message: "",
            message_type: "merchant_onboarding",
            variables: { var1: token },
          }),
        });
      } catch (_) {}
    }

    // Update associated payment status to 'merchant_kyc_review'
    if (record.payment_id) {
      await supabase
        .from("payments")
        .update({
          status: "merchant_kyc_review",
          updated_at: now.toISOString(),
        })
        .eq("id", record.payment_id)
        .eq("status", "kyc_pending");

      // Log the status transition
      await supabase.from("payment_logs").insert({
        payment_id: record.payment_id,
        status: "merchant_kyc_review",
        message: "Merchant KYC submitted. Awaiting admin review.",
        metadata: { merchant_onboarding_id: record.id },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "KYC submitted successfully. Our team will review your details shortly." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
