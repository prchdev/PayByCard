import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { serveUser } from "../_shared/session.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

serveUser(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, beneficiaryId, categoryId, amount } = await req.json();

    if (!userId || !beneficiaryId || !categoryId) {
      return new Response(
        JSON.stringify({ error: "userId, beneficiaryId, and categoryId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the category's invoice settings
    const { data: category, error: catError } = await supabase
      .from("payment_categories")
      .select("invoice_required, invoice_frequency_months, invoice_min_amount")
      .eq("id", categoryId)
      .maybeSingle();

    if (catError || !category) {
      return new Response(
        JSON.stringify({ error: "Category not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoiceRequired = !!category.invoice_required;
    const frequencyMonths = Number(category.invoice_frequency_months) || 0;
    const minAmount = Number(category.invoice_min_amount) || 0;

    if (!invoiceRequired) {
      return new Response(
        JSON.stringify({
          invoiceRequired: false,
          hasConfirmedInvoice: false,
          canUsePreviousInvoice: false,
          needsInvoiceUpload: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If invoice_min_amount is set and the payment amount is below it, no invoice needed
    const paymentAmount = Number(amount) || 0;
    if (minAmount > 0 && paymentAmount < minAmount) {
      return new Response(
        JSON.stringify({
          invoiceRequired: false,
          hasConfirmedInvoice: false,
          canUsePreviousInvoice: false,
          needsInvoiceUpload: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the most recent payment with a verified invoice for this beneficiary + category
    const { data: recentPayments, error: payError } = await supabase
      .from("payments")
      .select("id, amount, bill_file_url, invoice_status, invoice_confirmed_at, created_at")
      .eq("user_id", userId)
      .eq("beneficiary_id", beneficiaryId)
      .eq("business_category_id", categoryId)
      .eq("invoice_status", "verified")
      .not("bill_file_url", "is", null)
      .order("invoice_confirmed_at", { ascending: false })
      .limit(1);

    if (payError) {
      console.error("Error fetching recent verified invoices:", payError);
      return new Response(
        JSON.stringify({ error: "Failed to check invoice status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasConfirmedInvoice = recentPayments && recentPayments.length > 0;

    if (!hasConfirmedInvoice) {
      // No previous confirmed invoice — needs document verification flow
      return new Response(
        JSON.stringify({
          invoiceRequired: true,
          hasConfirmedInvoice: false,
          canUsePreviousInvoice: false,
          needsInvoiceUpload: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lastConfirmed = recentPayments[0];
    const confirmedAt = new Date(lastConfirmed.invoice_confirmed_at);
    const now = new Date();

    // Check if within frequency period
    let withinFrequency = true;
    if (frequencyMonths > 0) {
      const frequencyMs = frequencyMonths * 30 * 24 * 60 * 60 * 1000;
      withinFrequency = (now.getTime() - confirmedAt.getTime()) < frequencyMs;
    }

    // If frequency is 0, bill is required for every payment (can't reuse)
    if (frequencyMonths === 0) {
      return new Response(
        JSON.stringify({
          invoiceRequired: true,
          hasConfirmedInvoice: true,
          canUsePreviousInvoice: false,
          needsInvoiceUpload: true,
          lastConfirmedAt: lastConfirmed.invoice_confirmed_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (withinFrequency) {
      // Previous confirmed invoice is still within frequency — can reuse it
      return new Response(
        JSON.stringify({
          invoiceRequired: true,
          hasConfirmedInvoice: true,
          canUsePreviousInvoice: true,
          needsInvoiceUpload: false,
          lastConfirmedAt: lastConfirmed.invoice_confirmed_at,
          previousInvoiceUrl: lastConfirmed.bill_file_url,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Previous confirmed invoice is outside frequency — needs new upload + verification
    return new Response(
      JSON.stringify({
        invoiceRequired: true,
        hasConfirmedInvoice: true,
        canUsePreviousInvoice: false,
        needsInvoiceUpload: true,
        lastConfirmedAt: lastConfirmed.invoice_confirmed_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Exception in check-invoice-verification:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// redeploy-1790387697
