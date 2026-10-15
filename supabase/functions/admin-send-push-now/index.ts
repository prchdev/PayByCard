import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  priority?: string;
  data?: Record<string, unknown>;
  "mutable-content"?: number;
  richContent?: { image?: string };
}

interface ExpoPushTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

async function sendExpoBatch(
  messages: ExpoPushMessage[]
): Promise<{ tickets: ExpoPushTicket[]; httpStatus: number; rawBody: string }> {
  try {
    const resp = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(messages),
    });

    const rawBody = await resp.text();

    if (!resp.ok) {
      return { tickets: [], httpStatus: resp.status, rawBody };
    }

    const json = JSON.parse(rawBody);
    const tickets: ExpoPushTicket[] = json.data || [];
    return { tickets, httpStatus: resp.status, rawBody };
  } catch (err) {
    return {
      tickets: [],
      httpStatus: 0,
      rawBody: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { adminId, campaignId, resetLogs } = await req.json();

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Missing adminId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Missing campaignId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: campaign, error: campErr } = await supabase
      .from("mobile_notification_campaigns")
      .select("id, title, message, image_url, frequency, status")
      .eq("id", campaignId)
      .maybeSingle();

    if (campErr || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Campaign is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If resetLogs is true, clear previous delivery logs so "once" campaigns resend to everyone
    if (resetLogs) {
      await supabase
        .from("mobile_notification_logs")
        .delete()
        .eq("campaign_id", campaignId);
    }

    // Determine which users have already been pushed (for "once" campaigns without reset)
    let alreadyPushedUserIds: Set<string> = new Set();
    if (campaign.frequency === "once" && !resetLogs) {
      const { data: allLogs } = await supabase
        .from("mobile_notification_logs")
        .select("user_id")
        .eq("campaign_id", campaignId);

      if (allLogs) {
        alreadyPushedUserIds = new Set(
          allLogs.map((l: any) => l.user_id).filter(Boolean)
        );
      }
    }

    // Fetch all active push tokens
    const { data: tokens, error: tokErr } = await supabase
      .from("mobile_push_tokens")
      .select("user_id, push_token, platform")
      .eq("is_active", true);

    if (tokErr || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active push tokens found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eligibleTokens = tokens.filter(
      (t: any) => !alreadyPushedUserIds.has(t.user_id)
    );

    if (eligibleTokens.length === 0) {
      return new Response(
        JSON.stringify({ error: "All users have already received this campaign. Enable 'Reset and resend' to push again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < eligibleTokens.length; i += BATCH_SIZE) {
      const batch = eligibleTokens.slice(i, i + BATCH_SIZE);

      const messages: ExpoPushMessage[] = batch.map((t: any) => {
        const msg: ExpoPushMessage = {
          to: t.push_token,
          title: campaign.title,
          body: campaign.message,
          sound: "default",
          priority: "high",
          data: { campaign_id: campaign.id },
        };
        if (campaign.image_url) {
          msg["mutable-content"] = 1;
          msg.richContent = { image: campaign.image_url };
          msg.data = { ...msg.data, image_url: campaign.image_url };
        }
        return msg;
      });

      const { tickets, httpStatus, rawBody } = await sendExpoBatch(messages);

      if (httpStatus !== 200 || tickets.length === 0) {
        console.error(`Expo push failed: HTTP ${httpStatus}`, rawBody);
        totalFailed += batch.length;
        const nowIso = new Date().toISOString();
        const logRows = batch.map((t: any) => ({
          campaign_id: campaign.id,
          user_id: t.user_id,
          pushed_at: nowIso,
          status: "failed",
          error_message: `Expo HTTP ${httpStatus}: ${rawBody.slice(0, 500)}`,
        }));
        await supabase.from("mobile_notification_logs").insert(logRows);
        continue;
      }

      let batchSuccess = 0;
      let batchFailed = 0;
      const nowIso = new Date().toISOString();

      const logRows = batch.map((t: any, idx: number) => {
        const ticket = tickets[idx] || ({ status: "error" } as ExpoPushTicket);
        const isOk = ticket.status === "ok";
        if (isOk) batchSuccess++;
        else batchFailed++;
        return {
          campaign_id: campaign.id,
          user_id: t.user_id,
          pushed_at: nowIso,
          status: isOk ? "delivered" : "failed",
          error_message: isOk ? null : (ticket.message || ticket.details?.error || "Unknown Expo error"),
        };
      });

      totalSent += batchSuccess;
      totalFailed += batchFailed;

      await supabase.from("mobile_notification_logs").insert(logRows);

      // Create in-app notification rows
      const notifRows = batch.map((t: any) => ({
        user_id: t.user_id,
        type: "campaign",
        title: campaign.title,
        body: campaign.message,
        data: { campaign_id: campaign.id, ...(campaign.image_url ? { image_url: campaign.image_url } : {}) },
        campaign_id: campaign.id,
        image_url: campaign.image_url || null,
        notification_format: campaign.image_url ? "image" : "text",
        is_read: false,
      }));

      await supabase.from("mobile_notifications").insert(notifRows);
    }

    return new Response(
      JSON.stringify({
        message: "Push notifications sent",
        sent: totalSent,
        failed: totalFailed,
        totalEligible: eligibleTokens.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in admin-send-push-now:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
