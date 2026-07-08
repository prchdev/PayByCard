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

    const now = new Date();
    const expiresAt = new Date(record.expires_at);

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ status: "expired", message: "This link has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Auto-reuse: skip KYC form if merchant was previously verified ─────
    if (record.beneficiary_id) {
      // Look up beneficiary's email + mobile for the AND match
      const { data: bene } = await supabase
        .from("beneficiaries")
        .select("email, mobile")
        .eq("id", record.beneficiary_id)
        .maybeSingle();

      const beneEmail = bene?.email?.trim() || null;
      const beneMobile = bene?.mobile?.trim() || null;

      let previousKyc: any = null;

      if (beneEmail && beneMobile) {
        // All three must match: same bank account, same email, same mobile
        const { data: match } = await supabase
          .from("merchant_onboarding")
          .select("*")
          .eq("beneficiary_id", record.beneficiary_id)
          .eq("email", beneEmail)
          .eq("mobile", beneMobile)
          .eq("status", "verified")
          .neq("id", record.id)
          .order("verified_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        previousKyc = match ?? null;
      }

      if (previousKyc) {
        const nowIso = now.toISOString();

        await supabase
          .from("merchant_onboarding")
          .update({
            status: "verified",
            kyc_completed_at: nowIso,
            verified_at: nowIso,
            updated_at: nowIso,
            pan_number: previousKyc.pan_number ?? null,
            pan_photo_url: previousKyc.pan_photo_url ?? null,
            full_name: previousKyc.full_name ?? record.full_name,
            email: previousKyc.email ?? record.email,
            mobile: previousKyc.mobile ?? record.mobile,
            dob: previousKyc.dob ?? null,
            id_number: previousKyc.id_number ?? null,
            aadhaar_front_url: previousKyc.aadhaar_front_url ?? null,
            aadhaar_back_url: previousKyc.aadhaar_back_url ?? null,
            address: previousKyc.address ?? null,
            city: previousKyc.city ?? null,
            state: previousKyc.state ?? null,
            pincode: previousKyc.pincode ?? null,
            bank_account_number: previousKyc.bank_account_number ?? null,
            bank_ifsc: previousKyc.bank_ifsc ?? null,
            bank_name: previousKyc.bank_name ?? null,
            bank_branch: previousKyc.bank_branch ?? null,
            kyc_method: previousKyc.kyc_method ?? null,
            digilocker_verified: previousKyc.digilocker_verified ?? null,
            digilocker_provider: previousKyc.digilocker_provider ?? null,
            address_proof_type: previousKyc.address_proof_type ?? null,
          })
          .eq("id", record.id);

        // Mark beneficiary as verified merchant
        await supabase
          .from("beneficiaries")
          .update({ is_verified_merchant: true, updated_at: nowIso })
          .eq("id", record.beneficiary_id);

        // Advance payment to settlement_pending
        if (record.payment_id) {
          const { data: payment } = await supabase
            .from("payments")
            .select("id, status")
            .eq("id", record.payment_id)
            .maybeSingle();

          if (payment && payment.status === "merchant_kyc_review") {
            await supabase
              .from("payments")
              .update({ status: "settlement_pending", updated_at: nowIso })
              .eq("id", payment.id);

            await supabase.from("payment_logs").insert({
              payment_id: payment.id,
              status: "settlement_pending",
              message: "Merchant KYC auto-reused from a previous verified submission. Payment queued for settlement.",
              metadata: { previous_merchant_onboarding_id: previousKyc.id },
            });
          }
        }

        return new Response(
          JSON.stringify({ status: "verified", message: "KYC verified using previously submitted details" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // ── End auto-reuse ────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({
        status: "pending",
        data: {
          id: record.id,
          sender_name: record.sender_name,
          category_name: record.category_name,
          beneficiary_name: record.beneficiary_name,
          email: record.email,
          mobile: record.mobile,
          pan_number: record.pan_number,
          pan_photo_url: record.pan_photo_url,
          expires_at: record.expires_at,
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
