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
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const BATCH_SIZE = 100;
const RECEIPT_DELAY_MS = 3000;

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
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoReceipt {
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

async function checkExpoReceipts(ids: string[]): Promise<Map<string, ExpoReceipt>> {
  const receipts = new Map<string, ExpoReceipt>();
  if (ids.length === 0) return receipts;

  try {
    const resp = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ ids }),
    });

    if (!resp.ok) return receipts;

    const json = await resp.json();
    if (json.data) {
      for (const [id, receipt] of Object.entries(json.data)) {
        receipts.set(id, receipt as ExpoReceipt);
      }
    }
  } catch {
    // If receipts check fails, treat as unknown — don't deactivate tokens
  }
  return receipts;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    if (resetLogs) {
      await supabase
        .from("mobile_notification_logs")
        .delete()
        .eq("campaign_id", campaignId);
    }

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

    const { data: tokens, error: tokErr } = await supabase
      .from("mobile_push_tokens")
      .select("user_id, push_token, platform, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (tokErr || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active push tokens found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate: keep only the newest active token per user (one device = one notification)
    const seenUserIds = new Set<string>();
    const eligibleTokens: any[] = [];
    for (const t of tokens) {
      if (alreadyPushedUserIds.has(t.user_id)) continue;
      if (seenUserIds.has(t.user_id)) continue;
      seenUserIds.add(t.user_id);
      eligibleTokens.push(t);
    }

    if (eligibleTokens.length === 0) {
      return new Response(
        JSON.stringify({ error: "All users have already received this campaign. Enable 'Reset and resend' to push again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    let totalFailed = 0;
    const tokensToDeactivate: string[] = [];

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

      // Collect ticket IDs for receipt checking
      const ticketIdByIndex: (string | null)[] = batch.map((_, idx) => {
        const ticket = tickets[idx];
        if (ticket && ticket.status === "ok" && ticket.id) {
          return ticket.id;
        }
        return null;
      });
      const ticketIds = ticketIdByIndex.filter((id): id is string => id !== null);

      // Wait briefly for Expo to process, then check receipts
      if (ticketIds.length > 0) {
        await sleep(RECEIPT_DELAY_MS);
      }
      const receipts = await checkExpoReceipts(ticketIds);

      let batchSuccess = 0;
      let batchFailed = 0;
      const nowIso = new Date().toISOString();

      const logRows = batch.map((t: any, idx: number) => {
        const ticket = tickets[idx] || ({ status: "error" } as ExpoPushTicket);

        if (ticket.status !== "ok") {
          batchFailed++;
          const errMsg = ticket.message || ticket.details?.error || "Unknown Expo error";
          if (ticket.details?.error === "DeviceNotRegistered") {
            tokensToDeactivate.push(t.push_token);
          }
          return {
            campaign_id: campaign.id,
            user_id: t.user_id,
            pushed_at: nowIso,
            status: "failed",
            error_message: errMsg,
          };
        }

        const tid = ticketIdByIndex[idx];
        if (tid) {
          const receipt = receipts.get(tid);
          if (receipt && receipt.status === "error") {
            batchFailed++;
            const errMsg = receipt.message || receipt.details?.error || "Delivery failed";
            if (receipt.details?.error === "DeviceNotRegistered") {
              tokensToDeactivate.push(t.push_token);
            }
            return {
              campaign_id: campaign.id,
              user_id: t.user_id,
              pushed_at: nowIso,
              status: "failed",
              error_message: errMsg,
            };
          }
        }

        batchSuccess++;
        return {
          campaign_id: campaign.id,
          user_id: t.user_id,
          pushed_at: nowIso,
          status: "delivered",
          error_message: null,
        };
      });

      totalSent += batchSuccess;
      totalFailed += batchFailed;

      await supabase.from("mobile_notification_logs").insert(logRows);

      // Create in-app notification rows only for tokens that were actually sent
      const successfulTokens = batch.filter((_: any, idx: number) => logRows[idx].status === "delivered");
      if (successfulTokens.length > 0) {
        const notifRows = successfulTokens.map((t: any) => ({
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
    }

    // Deactivate stale tokens that Expo reported as DeviceNotRegistered
    if (tokensToDeactivate.length > 0) {
      const uniqueTokens = [...new Set(tokensToDeactivate)];
      for (const token of uniqueTokens) {
        await supabase
          .from("mobile_push_tokens")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("push_token", token);
      }
      console.log(`Deactivated ${uniqueTokens.length} stale push tokens`);
    }

    return new Response(
      JSON.stringify({
        message: "Push notifications processed",
        sent: totalSent,
        failed: totalFailed,
        totalEligible: eligibleTokens.length,
        stale_tokens_deactivated: tokensToDeactivate.length,
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
