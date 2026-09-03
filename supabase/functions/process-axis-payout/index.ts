import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * process-axis-payout — Transfer money to a beneficiary using Axis Bank Neo Corporate API
 *
 * Flow:
 *   1. Fetch OAuth2 access token from Axis Bank token endpoint
 *   2. Create a fund transfer request using the Neo Corporate Payments API
 *   3. Return the transfer status and reference number
 *
 * Called by auto-payout when payout_mode is 'axis_payout'.
 */

interface AxisPayoutRequest {
  payment_id: string;
  beneficiary_account_number: string;
  beneficiary_ifsc: string;
  beneficiary_name: string;
  amount: number;
  remarks?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      payment_id,
      beneficiary_account_number,
      beneficiary_ifsc,
      beneficiary_name,
      amount,
      remarks,
    } = await req.json() as AxisPayoutRequest;

    if (!payment_id || !beneficiary_account_number || !beneficiary_ifsc || !beneficiary_name || !amount) {
      return new Response(JSON.stringify({ error: "Missing required payout parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payout settings
    const { data: settings, error: settingsError } = await supabase
      .from("payout_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Payout settings not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isTest = settings.environment === "test";
    const clientId = isTest ? settings.axis_test_client_id : settings.axis_production_client_id;
    const clientSecret = isTest ? settings.axis_test_client_secret : settings.axis_production_client_secret;
    const baseUrl = isTest ? settings.axis_test_base_url : settings.axis_production_base_url;
    const virtualAccount = isTest ? settings.axis_test_virtual_account : settings.axis_production_virtual_account;
    const corporateId = settings.axis_corporate_id;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Axis Bank API credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get OAuth2 access token
    const tokenUrl = `${baseUrl}/oauth/v2/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "neoapi",
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error("Axis Bank token error:", tokenError);
      return new Response(JSON.stringify({ error: "Failed to authenticate with Axis Bank API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No access token received from Axis Bank" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Create fund transfer
    const transferUrl = `${baseUrl}/neo/v1/payments/transfer`;
    const transferPayload = {
      corporateId,
      virtualAccountId: virtualAccount,
      paymentDetails: {
        paymentReference: payment_id,
        beneficiaryAccountNumber: beneficiary_account_number,
        beneficiaryIFSC: beneficiary_ifsc,
        beneficiaryName: beneficiary_name,
        amount: String(amount),
        currency: "INR",
        remarks: remarks || `Payout for ${payment_id}`,
        transferType: "IMPS",
      },
    };

    const transferResponse = await fetch(transferUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "client-id": clientId,
      },
      body: JSON.stringify(transferPayload),
    });

    const transferData = await transferResponse.json();

    if (!transferResponse.ok) {
      console.error("Axis Bank transfer error:", JSON.stringify(transferData));
      return new Response(JSON.stringify({
        error: "Axis Bank transfer failed",
        details: transferData.message || transferData.error || "Unknown error",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Return transfer status
    return new Response(JSON.stringify({
      success: true,
      status: transferData.status || "PENDING",
      reference_number: transferData.referenceNumber || transferData.rrn || "",
      message: transferData.message || "Transfer initiated successfully",
      raw_response: transferData,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Axis payout error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
