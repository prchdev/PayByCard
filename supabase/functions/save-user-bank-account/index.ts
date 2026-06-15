import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const {
      userId,
      bank_account_number,
      ifsc,
      bank_name,
      branch_name,
      account_type,
      full_name,
      email,
      mobile,
      pan_number,
      ipAddress,
    } = await req.json();

    const resolvedIP = ipAddress || clientIP;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bank_account_number || !ifsc || !bank_name || !branch_name || !account_type || !full_name || !email || !mobile) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["Saving", "Current"].includes(account_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid account type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ifscUpper = ifsc.toUpperCase();
    if (ifscUpper.length !== 11) {
      return new Response(
        JSON.stringify({ error: "IFSC code must be 11 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const ifscResponse = await fetch(`https://ifsc.razorpay.com/${ifscUpper}`);
      if (!ifscResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Invalid IFSC code. Please verify before saving." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (_ifscErr) {
      return new Response(
        JSON.stringify({ error: "Could not validate IFSC code. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userExists, error: userCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userCheckError || !userExists) {
      return new Response(
        JSON.stringify({ error: "Invalid user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate — column is ifsc_code in the DB
    const { data: existing } = await supabase
      .from("user_bank_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("bank_account_number", bank_account_number)
      .eq("ifsc_code", ifscUpper)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Bank account already exists with this account number and IFSC code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingAccounts } = await supabase
      .from("user_bank_accounts")
      .select("id")
      .eq("user_id", userId);

    const isFirst = !existingAccounts || existingAccounts.length === 0;

    const { data, error } = await supabase
      .from("user_bank_accounts")
      .insert([
        {
          user_id: userId,
          bank_account_number,
          ifsc_code: ifscUpper,
          bank_name,
          branch_name,
          account_type,
          full_name,
          email,
          mobile_number: mobile,
          pan_number: pan_number || null,
          is_default: isFirst,
          created_ip: resolvedIP,
          updated_ip: resolvedIP,
        },
      ])
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, account: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
