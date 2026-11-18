import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { isInternalCall, readSessionToken, ADMIN_SESSION_HEADER, unauthorized } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { admin_id, action } = body;

    if (!admin_id) {
      return new Response(JSON.stringify({ error: "Admin ID is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isInternalCall(req)) {
      const session = await readSessionToken(req.headers.get(ADMIN_SESSION_HEADER));
      if (!session || session.kind !== "admin" || session.id !== admin_id) {
        return unauthorized();
      }
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users").select("id, email, is_active").eq("id", admin_id).maybeSingle();
    if (adminError || !admin || !admin.is_active) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: businesses, error } = await supabase
        .from("kyc_business_info")
        .select(`
          id, user_id, business_name, company_type, gst_number, business_pan,
          business_address, business_email, business_phone, status,
          created_at, updated_at
        `)
        .eq("status", "verified")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = [...new Set((businesses || []).map((b: any) => b.user_id))];
      if (userIds.length === 0) {
        return new Response(JSON.stringify({ users: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ID_CHUNK = 50;
      const userMap = new Map<string, any>();
      for (let i = 0; i < userIds.length; i += ID_CHUNK) {
        const chunk = userIds.slice(i, i + ID_CHUNK);
        const { data: usersChunk } = await supabase
          .from("users")
          .select("id, email, first_name, middle_name, last_name, full_name, mobile_number, kyc_completed, created_at")
          .in("id", chunk);
        for (const u of (usersChunk || [])) {
          userMap.set(u.id, u);
        }
      }

      const result = (businesses || []).map((b: any) => {
        const user = userMap.get(b.user_id) || {};
        return {
          user_id: b.user_id,
          business_name: b.business_name,
          company_type: b.company_type,
          gst_number: b.gst_number,
          business_pan: b.business_pan,
          business_address: b.business_address,
          business_email: b.business_email,
          business_phone: b.business_phone,
          kyc_status: b.status,
          kyc_date: b.updated_at,
          email: user.email,
          first_name: user.first_name,
          middle_name: user.middle_name,
          last_name: user.last_name,
          full_name: user.full_name,
          mobile_number: user.mobile_number,
          user_created_at: user.created_at,
        };
      });

      return new Response(JSON.stringify({ users: result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_details") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: business } = await supabase
        .from("kyc_business_info")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      const { data: user } = await supabase
        .from("users")
        .select("id, email, first_name, middle_name, last_name, full_name, mobile_number, kyc_completed, created_at")
        .eq("id", user_id)
        .maybeSingle();

      const { data: settings } = await supabase
        .from("business_settings")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      return new Response(JSON.stringify({
        business,
        user,
        settings: settings || null,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_bank_details") {
      const { user_id, account_holder_name, ifsc_code, account_number, account_type } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("business_settings")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from("business_settings")
          .update({
            account_holder_name, ifsc_code, account_number, account_type,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user_id)
          .select().single();
      } else {
        result = await supabase
          .from("business_settings")
          .insert({
            user_id, account_holder_name, ifsc_code, account_number, account_type,
          })
          .select().single();
      }

      if (result.error) {
        return new Response(JSON.stringify({ error: "Failed to save bank details." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, settings: result.data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_services") {
      const {
        user_id, payout_enabled, min_transaction_amount, max_transaction_amount,
        charges_percentage, min_charges_inr, max_charges_inr, gst_percentage,
        charges_deduction_mode,
      } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("business_settings")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      const payload = {
        payout_enabled: !!payout_enabled,
        min_transaction_amount: Number(min_transaction_amount) || 0,
        max_transaction_amount: Number(max_transaction_amount) || 0,
        charges_percentage: Number(charges_percentage) || 0,
        min_charges_inr: Number(min_charges_inr) || 0,
        max_charges_inr: Number(max_charges_inr) || 0,
        gst_percentage: Number(gst_percentage) || 0,
        charges_deduction_mode: charges_deduction_mode || "additional",
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existing) {
        result = await supabase
          .from("business_settings")
          .update(payload)
          .eq("user_id", user_id)
          .select().single();
      } else {
        result = await supabase
          .from("business_settings")
          .insert({ user_id, ...payload })
          .select().single();
      }

      if (result.error) {
        return new Response(JSON.stringify({ error: "Failed to save service settings." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, settings: result.data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_payouts") {
      const { user_id, page, per_page, sort_key, sort_dir, date_from, date_to } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pageNum = page || 1;
      const perPage = per_page || 10;
      const offset = (pageNum - 1) * perPage;

      const sortColumnMap: Record<string, string> = {
        date: "created_at",
        amount: "amount",
        status: "status",
        utr: "utr_number",
        reference: "payout_reference",
      };
      const sortColumn = sort_key ? (sortColumnMap[sort_key] || "created_at") : "created_at";
      const sortAscending = sort_dir === "asc";

      let query = supabase
        .from("payouts")
        .select("id, payout_reference, amount, charges, gst, net_amount, total_deduction, status, utr_number, gateway_transaction_id, transfer_type, account_number, ifsc_code, account_holder_name, bank_name, created_at, completed_at, payout_date, instant_settlement, payout_type, payment_id", { count: "exact" })
        .eq("user_id", user_id)
        .order(sortColumn, { ascending: sortAscending });

      if (date_from) {
        query = query.gte("created_at", date_from);
      }
      if (date_to) {
        query = query.lte("created_at", date_to + "T23:59:59");
      }

      const { data: payouts, error, count } = await query
        .range(offset, offset + perPage - 1);

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch payouts." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        payouts: payouts || [],
        total: count || 0,
        page: pageNum,
        per_page: perPage,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "export_payouts_csv") {
      const { user_id, date_from, date_to } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabase
        .from("payouts")
        .select("payout_reference, amount, charges, gst, net_amount, total_deduction, status, utr_number, gateway_transaction_id, transfer_type, account_number, ifsc_code, account_holder_name, bank_name, created_at, completed_at, payout_date, instant_settlement, payout_type, payment_id")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      if (date_from) {
        query = query.gte("created_at", date_from);
      }
      if (date_to) {
        query = query.lte("created_at", date_to + "T23:59:59");
      }

      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let pageIdx = 0;
      while (true) {
        const { data } = await query.range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        pageIdx++;
      }

      const headers = [
        "Payout Reference", "Amount", "Charges", "GST", "Net Amount", "Total Deduction",
        "Status", "UTR Number", "Gateway Txn ID", "Transfer Type", "Account Number",
        "IFSC Code", "Account Holder Name", "Bank Name", "Created At", "Completed At",
        "Payout Date", "Instant Settlement", "Payout Type", "Payment ID",
      ];

      const rows = allData.map((p: any) => [
        p.payout_reference || "",
        p.amount || "",
        p.charges || "",
        p.gst || "",
        p.net_amount || "",
        p.total_deduction || "",
        p.status || "",
        p.utr_number || "",
        p.gateway_transaction_id || "",
        p.transfer_type || "",
        p.account_number || "",
        p.ifsc_code || "",
        p.account_holder_name || "",
        p.bank_name || "",
        p.created_at || "",
        p.completed_at || "",
        p.payout_date || "",
        p.instant_settlement ? "Yes" : "No",
        p.payout_type || "",
        p.payment_id || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      return new Response(JSON.stringify({ csv: csvContent, count: allData.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred.", detail: msg.substring(0, 300) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
