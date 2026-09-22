import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { withSignedKycUrls } from "../_shared/kycUrls.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(withSignedKycUrls(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { adminId, statusFilter } = await req.json();

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Admin ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersError) {
      return new Response(
        JSON.stringify({ error: usersError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const kycData = await Promise.all(
      users.map(async (user) => {
        const [panRes, addressRes, businessRes, merchantRes] = await Promise.all([
          supabase.from("kyc_pan_verification").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("kyc_address_proof").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("kyc_business_info").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("merchant_onboarding").select("payment_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);

        let invoice_status = null;
        let bill_file_url = null;
        let payment_reference = null;
        if (merchantRes.data?.payment_id) {
          const { data: payment } = await supabase
            .from("payments")
            .select("invoice_status, bill_file_url, payment_reference")
            .eq("id", merchantRes.data.payment_id)
            .maybeSingle();
          invoice_status = payment?.invoice_status ?? null;
          bill_file_url = payment?.bill_file_url ?? null;
          payment_reference = payment?.payment_reference ?? null;
        }

        return {
          user,
          pan: panRes.data,
          address: addressRes.data,
          business: businessRes.data,
          invoice_status,
          bill_file_url,
          payment_reference,
        };
      })
    );

    let filtered = kycData;
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "invoice_pending") {
        filtered = kycData.filter((entry: any) => entry.invoice_status === "pending_verification");
      } else {
        filtered = kycData.filter((entry) => {
        const panStatus = entry.pan?.status;
        const addressStatus = entry.address?.status;
        const businessStatus = entry.business?.status;

        if (!panStatus || !addressStatus) {
          return statusFilter === "pending";
        }

        if (panStatus === "rejected" || addressStatus === "rejected") {
          return statusFilter === "rejected";
        }

        const hasBusinessDocs = entry.business?.incorporation_certificate_url || entry.business?.gst_certificate_url || entry.business?.loa_url;
        if (hasBusinessDocs && businessStatus === "rejected") {
          return statusFilter === "rejected";
        }

        if (panStatus === "verification_pending" || addressStatus === "verification_pending") {
          return statusFilter === "verification_pending";
        }

        if (hasBusinessDocs && businessStatus === "verification_pending") {
          return statusFilter === "verification_pending";
        }

        if (panStatus === "verified" && addressStatus === "verified") {
          if (hasBusinessDocs) {
            return businessStatus === "verified" ? statusFilter === "verified" : statusFilter === "verification_pending";
          }
          return statusFilter === "verified";
        }

        return statusFilter === "pending";
      });
      }
    }

    return new Response(
      JSON.stringify({ users: filtered }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}));


// redeploy
