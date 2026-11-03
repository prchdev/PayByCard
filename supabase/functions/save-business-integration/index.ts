import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveUser } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session",
};

const VALID_COMPANY_TYPES = [
  "Sole Proprietorship",
  "Limited Liability Partnership (LLP)",
  "Private Limited Company",
  "One Person Company (OPC)",
  "Public Limited Company",
];

serveUser(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      userId,
      companyType,
      businessName,
      incorporationNumber,
      businessPan,
      gstNumber,
      businessAddress,
      businessEmail,
      businessPhone,
      incorporationCertificateUrl,
      companyPanPhotoUrl,
      gstCertificateUrl,
      loaUrl,
      bankAccountName,
      bankIfsc,
      bankAccountNumber,
      bankAccountType,
      cancelChequeUrl,
      bankStatementUrl,
      bankStatementPassword,
    } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validation
    if (!companyType || !VALID_COMPANY_TYPES.includes(companyType)) {
      return new Response(JSON.stringify({ error: "Valid Company Type is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!businessName?.trim()) {
      return new Response(JSON.stringify({ error: "Business / Company Registration Name is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!incorporationNumber?.trim()) {
      return new Response(JSON.stringify({ error: "Incorporation Number is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!businessPan?.trim() || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(businessPan.toUpperCase())) {
      return new Response(JSON.stringify({ error: "Valid Business PAN is required (format: AAAAA9999A)." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!gstNumber?.trim() || gstNumber.trim().length !== 15) {
      return new Response(JSON.stringify({ error: "GST Number is required and must be exactly 15 characters." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!businessAddress?.trim() || businessAddress.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Business Address is required (at least 10 characters)." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!businessEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
      return new Response(JSON.stringify({ error: "Valid Business Email is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!businessPhone?.trim() || !/^[0-9]{10}$/.test(businessPhone)) {
      return new Response(JSON.stringify({ error: "Business Phone Number must be exactly 10 digits." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!incorporationCertificateUrl) {
      return new Response(JSON.stringify({ error: "Business / Company Incorporation Certificate is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!companyPanPhotoUrl) {
      return new Response(JSON.stringify({ error: "Company PAN Photo is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!gstCertificateUrl) {
      return new Response(JSON.stringify({ error: "GST Certificate is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!loaUrl) {
      return new Response(JSON.stringify({ error: "Letter of Authorization (LoA) is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Bank details validation
    if (!bankAccountName?.trim()) {
      return new Response(JSON.stringify({ error: "Bank Account Name is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!bankIfsc?.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc.toUpperCase())) {
      return new Response(JSON.stringify({ error: "Valid IFSC code is required (format: AAAA0XXXXXX)." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!bankAccountNumber?.trim()) {
      return new Response(JSON.stringify({ error: "Bank Account Number is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const cleanAcctNum = bankAccountNumber.replace(/[\s-]/g, '');
    if (cleanAcctNum.length < 6 || cleanAcctNum.length > 20) {
      return new Response(JSON.stringify({ error: "Bank Account Number must be 6–20 alphanumeric characters." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const VALID_ACCOUNT_TYPES = ["Saving", "Current", "NRE", "NRO"];
    if (!bankAccountType || !VALID_ACCOUNT_TYPES.includes(bankAccountType)) {
      return new Response(JSON.stringify({ error: "Valid Account Type is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!cancelChequeUrl) {
      return new Response(JSON.stringify({ error: "Cancelled Cheque is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!bankStatementUrl) {
      return new Response(JSON.stringify({ error: "Bank Account Statement is required." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check for existing application — only allow new submission if none or rejected
    const { data: existing } = await supabase
      .from("business_integration_applications")
      .select("id, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && (existing.status === "pending" || existing.status === "in_review" || existing.status === "approved")) {
      return new Response(
        JSON.stringify({ error: "You already have a pending or approved application. You cannot submit a new one." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const record: Record<string, any> = {
      user_id: userId,
      company_type: companyType,
      business_name: businessName.trim(),
      incorporation_number: incorporationNumber.trim(),
      business_pan: businessPan.toUpperCase(),
      gst_number: gstNumber?.trim() || "",
      business_address: businessAddress.trim(),
      business_email: businessEmail.trim(),
      business_phone: businessPhone.trim(),
      incorporation_certificate_url: incorporationCertificateUrl || null,
      company_pan_photo_url: companyPanPhotoUrl || null,
      gst_certificate_url: gstCertificateUrl || null,
      loa_url: loaUrl || null,
      bank_account_name: bankAccountName.trim(),
      bank_ifsc: bankIfsc.toUpperCase(),
      bank_account_number: bankAccountNumber.trim(),
      bank_account_type: bankAccountType,
      cancel_cheque_url: cancelChequeUrl || null,
      bank_statement_url: bankStatementUrl || null,
      bank_statement_password: bankStatementPassword?.trim() || null,
      status: "pending",
      rejection_reason: null,
      reviewed_by_admin_id: null,
      reviewed_at: null,
      submitted_at: new Date().toISOString(),
    };

    let result;
    if (existing && existing.status === "rejected") {
      // Update existing rejected record → resubmit
      const { data: updated, error } = await supabase
        .from("business_integration_applications")
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      result = { data: updated, error };
    } else {
      const { data: inserted, error } = await supabase
        .from("business_integration_applications")
        .insert({ ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select("*")
        .maybeSingle();
      result = { data: inserted, error };
    }

    if (result.error) {
      return new Response(
        JSON.stringify({ error: "Failed to save application: " + result.error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, application: result.data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
