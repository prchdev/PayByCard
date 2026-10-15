import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { isInternalCall, readSessionToken, ADMIN_SESSION_HEADER, unauthorized } from "../_shared/session.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const CRON_INTERVAL_MINUTES = 5;
const MINUTES_PER_HOUR = 60;
const LOCK_WINDOW_MINUTES = 2;

// How many emails to send concurrently within a single cron cycle
const CONCURRENCY = 5;

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

    // Cron entry point — no admin auth required
    if (action === "process_scheduled") {
      const now = new Date().toISOString();

      // Pick up scheduled campaigns whose time has arrived
      const { data: dueCampaigns } = await supabase
        .from("bulk_email_campaigns")
        .select("*")
        .eq("status", "scheduled")
        .not("scheduled_at", "is", null)
        .lte("scheduled_at", now);

      for (const c of (dueCampaigns || [])) {
        await supabase.from("bulk_email_campaigns")
          .update({ status: "sending", started_at: new Date().toISOString() })
          .eq("id", c.id);
      }

      // Pick up all campaigns in "sending" status
      const { data: sendingCampaigns } = await supabase
        .from("bulk_email_campaigns")
        .select("*")
        .eq("status", "sending");

      let totalProcessed = 0;
      const lockCutoff = new Date(Date.now() - LOCK_WINDOW_MINUTES * 60 * 1000).toISOString();
      for (const c of (sendingCampaigns || [])) {
        // Skip if another cron run is likely still processing this campaign
        if (c.last_batch_sent_at && c.last_batch_sent_at > lockCutoff) {
          continue;
        }
        const processed = await processEmailCampaignBatch(supabaseUrl, supabaseKey, supabase, c);
        totalProcessed += processed;
      }

      return new Response(JSON.stringify({ processed: totalProcessed }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    if (action === "list" || !action) {
      const { data: campaigns, error } = await supabase
        .from("bulk_email_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const enriched = await Promise.all((campaigns || []).map(async (c: any) => {
        const { count: sentCount } = await supabase
          .from("bulk_campaign_recipients")
          .select("id", { count: "exact", head: true })
          .eq("campaign_type", "email")
          .eq("campaign_id", c.id)
          .eq("status", "sent");
        const { count: failedCount } = await supabase
          .from("bulk_campaign_recipients")
          .select("id", { count: "exact", head: true })
          .eq("campaign_type", "email")
          .eq("campaign_id", c.id)
          .eq("status", "failed");
        const { count: pendingCount } = await supabase
          .from("bulk_campaign_recipients")
          .select("id", { count: "exact", head: true })
          .eq("campaign_type", "email")
          .eq("campaign_id", c.id)
          .eq("status", "pending");
        return {
          ...c,
          sent_count: sentCount || 0,
          failed_count: failedCount || 0,
          pending_count: pendingCount || 0,
        };
      }));

      return new Response(JSON.stringify({ campaigns: enriched }), {
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
      const { campaign_id, page, per_page, sortKey, sortDir } = body;
      const pageNum = page || 1;
      const perPage = per_page || 50;
      const offset = (pageNum - 1) * perPage;
      const sortColumnMap: Record<string, string> = {
        email: "email_or_phone",
        status: "status",
        sentAt: "sent_at",
        error: "error_message",
      };
      const sortColumn = sortKey ? sortColumnMap[sortKey] : "created_at";
      const sortAscending = sortKey ? sortDir === "asc" : true;
      const { data: recipients, error, count } = await supabase
        .from("bulk_campaign_recipients")
        .select("id, email_or_phone, status, sent_at, error_message", { count: "exact" })
        .eq("campaign_type", "email")
        .eq("campaign_id", campaign_id)
        .order(sortColumn, { ascending: sortAscending })
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
      const { campaign_name, subject, body_html, recipient_filter, filter_days, hourly_rate, scheduled_at, status, campaign_id, attachments } = body;

      if (!campaign_name || !subject) {
        return new Response(JSON.stringify({ error: "Campaign name and subject are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recipients = await fetchRecipients(supabase, recipient_filter || "all_users", filter_days || 0);

      if (action === "create") {
        const { data, error } = await supabase
          .from("bulk_email_campaigns")
          .insert({
            campaign_name, subject, body_html: body_html || "",
            recipient_filter: recipient_filter || "all_users",
            filter_days: filter_days || 0,
            hourly_rate: hourly_rate || 100,
            status: status || "draft",
            scheduled_at: scheduled_at || null,
            total_recipients: recipients.length,
            created_by_admin_id: admin_id,
            attachments: attachments || [],
            ...(status === "sending" ? { started_at: new Date().toISOString() } : {}),
          })
          .select().single();
        if (error) {
          return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await insertRecipientRecords(supabase, "email", data.id, recipients);

        return new Response(JSON.stringify({ campaign: data }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const { data, error } = await supabase
          .from("bulk_email_campaigns")
          .update({
            campaign_name, subject, body_html: body_html || "",
            recipient_filter: recipient_filter || "all_users",
            filter_days: filter_days || 0,
            hourly_rate: hourly_rate || 100,
            status: status || "draft",
            scheduled_at: scheduled_at || null,
            total_recipients: recipients.length,
            updated_at: new Date().toISOString(),
            attachments: attachments || [],
            ...(status === "sending" ? { started_at: new Date().toISOString() } : {}),
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
        .from("bulk_email_campaigns")
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
      const { error } = await supabase.from("bulk_email_campaigns").delete().eq("id", campaign_id);
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
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again.", detail: msg.substring(0, 300) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface Recipient {
  id: string;
  email: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}

async function fetchRecipients(supabase: any, filter: string, filterDays: number): Promise<Recipient[]> {
  let query = supabase.from("users").select("id, email, first_name, middle_name, last_name, kyc_completed, created_at");

  if (filter === "all_users") {
    // No additional filter
  } else if (filter === "kyced_users") {
    query = query.eq("kyc_completed", true);
  } else if (filter === "non_kyced_users") {
    query = query.eq("kyc_completed", false);
  } else if (filter === "kyced_no_payment") {
    const { data: kycedUsers } = await supabase.from("users").select("id, email, first_name, middle_name, last_name").eq("kyc_completed", true);
    if (!kycedUsers) return [];
    const userIds = kycedUsers.map((u: any) => u.id);
    const { data: payingUsers } = await supabase.from("payments").select("user_id").in("user_id", userIds);
    const payingIds = new Set((payingUsers || []).map((p: any) => p.user_id));
    return kycedUsers.filter((u: any) => !payingIds.has(u.id));
  } else if (filter === "kyced_no_payment_x_days") {
    const daysAgo = new Date(Date.now() - filterDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: kycedUsers } = await supabase.from("users").select("id, email, first_name, middle_name, last_name").eq("kyc_completed", true);
    if (!kycedUsers) return [];
    const userIds = kycedUsers.map((u: any) => u.id);
    const { data: recentPayments } = await supabase.from("payments").select("user_id").in("user_id", userIds).gte("created_at", daysAgo);
    const recentPayingIds = new Set((recentPayments || []).map((p: any) => p.user_id));
    return kycedUsers.filter((u: any) => !recentPayingIds.has(u.id));
  }

  const { data, error } = await query.eq("is_disabled", false).not("email", "is", null);
  if (error || !data) return [];
  return data;
}

async function insertRecipientRecords(supabase: any, campaignType: string, campaignId: string, recipients: Recipient[]) {
  const rows = recipients.map((r) => ({
    campaign_type: campaignType,
    campaign_id: campaignId,
    user_id: r.id,
    email_or_phone: r.email,
    status: "pending",
  }));
  if (rows.length === 0) return;
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    await supabase.from("bulk_campaign_recipients").insert(rows.slice(i, i + batchSize));
  }
}

async function sendSingleEmail(
  supabaseUrl: string,
  supabaseKey: string,
  recipient: { id: string; email_or_phone: string; first_name: string; middle_name: string; last_name: string },
  campaign: any,
): Promise<{ success: boolean; error?: string }> {
  const firstName = recipient.first_name || "";
  const middleName = recipient.middle_name || "";
  const lastName = recipient.last_name || "";

  const personalizedSubject = (campaign.subject || "")
    .replace(/\{first_name\}/g, firstName)
    .replace(/\{middle_name\}/g, middleName)
    .replace(/\{last_name\}/g, lastName);
  const personalizedBody = (campaign.body_html || "")
    .replace(/\{first_name\}/g, firstName)
    .replace(/\{middle_name\}/g, middleName)
    .replace(/\{last_name\}/g, lastName);

  const emailPayload: any = {
    to: recipient.email_or_phone,
    subject: personalizedSubject,
    body: personalizedBody,
    body_type: "html",
    use_template: false,
  };

  if (campaign.attachments && campaign.attachments.length > 0) {
    emailPayload.attachments = campaign.attachments;
  }

  try {
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify(emailPayload),
    });

    if (emailResponse.ok) {
      return { success: true };
    } else {
      const errData = await emailResponse.json().catch(() => ({}));
      return { success: false, error: (errData.error || "Email send failed").substring(0, 500) };
    }
  } catch (err) {
    return { success: false, error: (err instanceof Error ? err.message : "Fetch failed").substring(0, 500) };
  }
}

/**
 * Process one batch of a campaign, respecting the hourly_rate limit.
 * Sends emails concurrently (CONCURRENCY at a time) to maximize throughput
 * while staying within the per-cycle quota derived from the hourly rate.
 */
async function processEmailCampaignBatch(
  supabaseUrl: string,
  supabaseKey: string,
  supabase: any,
  campaign: any,
): Promise<number> {
  const hourlyRate = campaign.hourly_rate || 100;
  const perCycle = Math.max(1, Math.floor(hourlyRate * CRON_INTERVAL_MINUTES / MINUTES_PER_HOUR));

  // Set lock timestamp immediately so concurrent cron runs skip this campaign
  await supabase.from("bulk_email_campaigns")
    .update({ last_batch_sent_at: new Date().toISOString() })
    .eq("id", campaign.id);

  // Sync counters from DB first (in case a previous run timed out before updating them)
  const { count: syncedSent } = await supabase
    .from("bulk_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_type", "email")
    .eq("campaign_id", campaign.id)
    .eq("status", "sent");
  const { count: syncedFailed } = await supabase
    .from("bulk_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_type", "email")
    .eq("campaign_id", campaign.id)
    .eq("status", "failed");
  await supabase.from("bulk_email_campaigns")
    .update({ sent_count: syncedSent || 0, failed_count: syncedFailed || 0 })
    .eq("id", campaign.id);

  // Fetch a batch of pending recipients — include user names to avoid per-recipient lookups
  const { data: batch, error } = await supabase
    .from("bulk_campaign_recipients")
    .select("id, user_id, email_or_phone")
    .eq("campaign_type", "email")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(perCycle);

  if (error || !batch || batch.length === 0) {
    await supabase.from("bulk_email_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        last_batch_sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);
    return 0;
  }

  // Pre-fetch user names in chunked queries (Supabase REST API has URL length limits)
  const userIds = [...new Set(batch.map((r: any) => r.user_id))];
  const userMap = new Map<string, { first_name: string; middle_name: string; last_name: string }>();
  const ID_CHUNK = 50;
  for (let i = 0; i < userIds.length; i += ID_CHUNK) {
    const chunk = userIds.slice(i, i + ID_CHUNK);
    const { data: usersChunk } = await supabase
      .from("users")
      .select("id, first_name, middle_name, last_name")
      .in("id", chunk);
    for (const u of (usersChunk || [])) {
      userMap.set(u.id, {
        first_name: u.first_name || "",
        middle_name: u.middle_name || "",
        last_name: u.last_name || "",
      });
    }
  }

  // Enrich batch with user names
  const enrichedBatch = batch.map((r: any) => {
    const names = userMap.get(r.user_id) || { first_name: "", middle_name: "", last_name: "" };
    return { ...r, ...names };
  });

  // Send emails concurrently in chunks of CONCURRENCY
  const results: { id: string; success: boolean; error?: string }[] = [];
  for (let i = 0; i < enrichedBatch.length; i += CONCURRENCY) {
    const chunk = enrichedBatch.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (recipient) => {
        const result = await sendSingleEmail(supabaseUrl, supabaseKey, recipient, campaign);
        return { id: recipient.id, ...result };
      })
    );
    results.push(...chunkResults);
  }

  // Batch-update recipient statuses: collect sent and failed IDs, update in bulk
  const sentIds = results.filter((r) => r.success).map((r) => r.id);
  const failedResults = results.filter((r) => !r.success);
  const nowIso = new Date().toISOString();

  // Batch-update in chunks to avoid URL length limits
  for (let i = 0; i < sentIds.length; i += ID_CHUNK) {
    await supabase
      .from("bulk_campaign_recipients")
      .update({ status: "sent", sent_at: nowIso })
      .in("id", sentIds.slice(i, i + ID_CHUNK));
  }

  for (const fr of failedResults) {
    await supabase
      .from("bulk_campaign_recipients")
      .update({ status: "failed", error_message: (fr.error || "Email send failed").substring(0, 500) })
      .eq("id", fr.id);
  }

  // Update campaign counters
  const { count: actualSent } = await supabase
    .from("bulk_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_type", "email")
    .eq("campaign_id", campaign.id)
    .eq("status", "sent");

  const { count: actualFailed } = await supabase
    .from("bulk_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_type", "email")
    .eq("campaign_id", campaign.id)
    .eq("status", "failed");

  const { count: remainingPending } = await supabase
    .from("bulk_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_type", "email")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending");

  const isComplete = !remainingPending || remainingPending === 0;

  await supabase.from("bulk_email_campaigns")
    .update({
      sent_count: actualSent || 0,
      failed_count: actualFailed || 0,
      last_batch_sent_at: new Date().toISOString(),
      ...(isComplete ? { status: "completed", completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", campaign.id);

  return results.length;
}
