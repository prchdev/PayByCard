import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { withAdminSession } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const __pbcHandler = (async (req: Request) => {
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

    const { data: admin, error: adminError } = await supabase
      .from("admin_users").select("id, email, is_active").eq("id", admin_id).maybeSingle();
    if (adminError || !admin || !admin.is_active) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list" || !action) {
      const { data: campaigns, error } = await supabase
        .from("bulk_sms_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ campaigns }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "preview_recipients") {
      const { recipient_filter, filter_days } = body;
      const recipients = await fetchRecipients(supabase, recipient_filter, filter_days || 0);
      return new Response(JSON.stringify({ count: recipients.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_recipients") {
      const { campaign_id, page, per_page } = body;
      const pageNum = page || 1;
      const perPage = per_page || 50;
      const offset = (pageNum - 1) * perPage;
      const { data: recipients, error, count } = await supabase
        .from("bulk_campaign_recipients")
        .select("id, email_or_phone, status, sent_at, error_message", { count: "exact" })
        .eq("campaign_type", "sms")
        .eq("campaign_id", campaign_id)
        .order("created_at", { ascending: true })
        .range(offset, offset + perPage - 1);
      if (error) {
        return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ recipients: recipients || [], total: count || 0, page: pageNum, per_page: perPage }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create" || action === "update") {
      const { campaign_name, message, recipient_filter, filter_days, hourly_rate, scheduled_at, status, campaign_id, dlt_template_id } = body;

      if (!campaign_name || !message) {
        return new Response(JSON.stringify({ error: "Campaign name and message are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recipients = await fetchRecipients(supabase, recipient_filter || "all_users", filter_days || 0);

      if (action === "create") {
        const { data, error } = await supabase
          .from("bulk_sms_campaigns")
          .insert({
            campaign_name, message: message || "",
            recipient_filter: recipient_filter || "all_users",
            filter_days: filter_days || 0,
            hourly_rate: hourly_rate || 100,
            status: status || "draft",
            scheduled_at: scheduled_at || null,
            total_recipients: recipients.length,
            dlt_template_id: dlt_template_id || "",
            created_by_admin_id: admin_id,
          })
          .select().single();
        if (error) {
          return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await insertRecipientRecords(supabase, "sms", data.id, recipients);
        return new Response(JSON.stringify({ campaign: data }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const { data, error } = await supabase
          .from("bulk_sms_campaigns")
          .update({
            campaign_name, message: message || "",
            recipient_filter: recipient_filter || "all_users",
            filter_days: filter_days || 0,
            hourly_rate: hourly_rate || 100,
            status: status || "draft",
            scheduled_at: scheduled_at || null,
            total_recipients: recipients.length,
            dlt_template_id: dlt_template_id || "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign_id)
          .select().single();
        if (error) {
          return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ campaign: data }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "cancel") {
      const { campaign_id } = body;
      const { error } = await supabase
        .from("bulk_sms_campaigns")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);
      if (error) {
        return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { campaign_id } = body;
      await supabase.from("bulk_campaign_recipients").delete().eq("campaign_id", campaign_id);
      const { error } = await supabase.from("bulk_sms_campaigns").delete().eq("id", campaign_id);
      if (error) {
        return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface Recipient {
  id: string;
  mobile_number: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}

async function fetchRecipients(supabase: any, filter: string, filterDays: number): Promise<Recipient[]> {
  let query = supabase.from("users").select("id, mobile_number, first_name, middle_name, last_name, kyc_completed, created_at");

  if (filter === "all_users") {
    // No additional filter
  } else if (filter === "kyced_users") {
    query = query.eq("kyc_completed", true);
  } else if (filter === "non_kyced_users") {
    query = query.eq("kyc_completed", false);
  } else if (filter === "kyced_no_payment") {
    const { data: kycedUsers } = await supabase.from("users").select("id, mobile_number, first_name, middle_name, last_name").eq("kyc_completed", true);
    if (!kycedUsers) return [];
    const userIds = kycedUsers.map((u: any) => u.id);
    const { data: payingUsers } = await supabase.from("payments").select("user_id").in("user_id", userIds);
    const payingIds = new Set((payingUsers || []).map((p: any) => p.user_id));
    return kycedUsers.filter((u: any) => !payingIds.has(u.id));
  } else if (filter === "kyced_no_payment_x_days") {
    const daysAgo = new Date(Date.now() - filterDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: kycedUsers } = await supabase.from("users").select("id, mobile_number, first_name, middle_name, last_name").eq("kyc_completed", true);
    if (!kycedUsers) return [];
    const userIds = kycedUsers.map((u: any) => u.id);
    const { data: recentPayments } = await supabase.from("payments").select("user_id").in("user_id", userIds).gte("created_at", daysAgo);
    const recentPayingIds = new Set((recentPayments || []).map((p: any) => p.user_id));
    return kycedUsers.filter((u: any) => !recentPayingIds.has(u.id));
  }

  const { data, error } = await query.eq("is_disabled", false).not("mobile_number", "is", null);
  if (error || !data) return [];
  return data;
}

async function insertRecipientRecords(supabase: any, campaignType: string, campaignId: string, recipients: Recipient[]) {
  const rows = recipients.map((r) => ({
    campaign_type: campaignType,
    campaign_id: campaignId,
    user_id: r.id,
    email_or_phone: r.mobile_number,
    status: "pending",
  }));
  if (rows.length === 0) return;
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    await supabase.from("bulk_campaign_recipients").insert(rows.slice(i, i + batchSize));
  }
}

Deno.serve(withAdminSession(__pbcHandler as (req: Request) => Promise<Response>));
