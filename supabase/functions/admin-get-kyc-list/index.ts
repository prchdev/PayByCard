import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { withSignedKycUrls } from "../_shared/kycUrls.ts";

import { serveAdmin } from "../_shared/session.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

serveAdmin(withSignedKycUrls(async (req: Request) => {
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

    // --- Batch fetch all data in parallel instead of N+1 queries ---

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersError) {
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all KYC records without user_id filter — with 700+ users the .in()
    // filter exceeds the PostgREST URL length limit (~25k chars of UUIDs), causing
    // the query to fail silently. We need all records anyway, so fetch everything
    // and map by user_id in memory.
    const [panRes, addressRes, businessRes] = await Promise.all([
      supabase.from("kyc_pan_verification").select("*"),
      supabase.from("kyc_address_proof").select("*"),
      supabase.from("kyc_business_info").select("*"),
    ]);

    if (panRes.error || addressRes.error || businessRes.error) {
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const panMap = new Map<string, any>();
    for (const p of panRes.data || []) {
      panMap.set(p.user_id, p);
    }

    const addressMap = new Map<string, any>();
    for (const a of addressRes.data || []) {
      addressMap.set(a.user_id, a);
    }

    const businessMap = new Map<string, any>();
    for (const b of businessRes.data || []) {
      businessMap.set(b.user_id, b);
    }

    // Batch-resolve referrer details
    const referrerIds = Array.from(
      new Set(users.map((u: any) => u.referred_by).filter(Boolean))
    ) as string[];
    let referrerMap: Record<string, { first_name: string | null; middle_name: string | null; last_name: string | null; email: string | null; mobile_number: string | null; full_name: string | null }> = {};
    if (referrerIds.length > 0) {
      const { data: referrers } = await supabase
        .from("users")
        .select("id, first_name, middle_name, last_name, full_name, email, mobile_number")
        .in("id", referrerIds);
      if (referrers) {
        for (const r of referrers as any[]) {
          referrerMap[r.id] = r;
        }
      }
    }

    // Assemble results in memory — no further DB queries needed
    // (merchant_onboarding has no user_id column; the previous per-user query
    // always returned null, so invoice_status/bill_file_url/payment_reference
    // were always null and are kept as such for compatibility)
    const kycData = users.map((user: any) => {
      const referrer = user.referred_by ? referrerMap[user.referred_by] || null : null;

      return {
        user,
        pan: panMap.get(user.id) || null,
        address: addressMap.get(user.id) || null,
        business: businessMap.get(user.id) || null,
        invoice_status: null,
        bill_file_url: null,
        payment_reference: null,
        referrer: referrer ? {
          name: referrer.full_name || [referrer.first_name, referrer.middle_name, referrer.last_name].filter(Boolean).join(' ') || null,
          email: referrer.email,
          mobile_number: referrer.mobile_number,
        } : null,
      };
    });

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

          const hasBusinessDocs = entry.business?.incorporation_certificate_url || entry.business?.company_pan_photo_url || entry.business?.gst_certificate_url || entry.business?.loa_url;
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
