import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { isInternalCall } from "../_shared/session.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!isInternalCall(req)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayDate = nowIST.toISOString().slice(0, 10);
    const currentTime = nowIST.toTimeString().slice(0, 8);

    const { data: campaigns, error: campErr } = await supabase
      .from("mobile_notification_campaigns")
      .select("id, title, message, image_url, frequency, start_date, end_date, push_time_from, push_time_to")
      .eq("status", "active")
      .eq("push_enabled", true)
      .lte("start_date", todayDate)
      .gte("end_date", todayDate)
      .lte("push_time_from", currentTime)
      .gte("push_time_to", currentTime);

    if (campErr) throw campErr;
    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active campaigns in current time window", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    let totalFailed = 0;
    const tokensToDeactivate: string[] = [];

    for (const campaign of campaigns) {
      let alreadyPushedUserIds: Set<string> = new Set();

      if (campaign.frequency === "once") {
        const { data: allLogs } = await supabase
          .from("mobile_notification_logs")
          .select("user_id")
          .eq("campaign_id", campaign.id);

        if (allLogs) {
          alreadyPushedUserIds = new Set(allLogs.map((l: any) => l.user_id).filter(Boolean));
        }
      } else {
        const { data: todayLogs } = await supabase
          .from("mobile_notification_logs")
          .select("user_id")
          .eq("campaign_id", campaign.id)
          .gte("pushed_at", `${todayDate}T00:00:00+05:30`);

        if (todayLogs) {
          alreadyPushedUserIds = new Set(todayLogs.map((l: any) => l.user_id).filter(Boolean));
        }
      }

      const { data: tokens, error: tokErr } = await supabase
        .from("mobile_push_tokens")
        .select("user_id, push_token, platform")
        .eq("is_active", true);

      if (tokErr || !tokens || tokens.length === 0) continue;

      const eligibleTokens = tokens.filter(
        (t: any) => !alreadyPushedUserIds.has(t.user_id)
      );

      if (eligibleTokens.length === 0) continue;

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
        const ticketIds: string[] = [];
        const ticketIdByIndex: (string | null)[] = batch.map((_, idx) => {
          const ticket = tickets[idx];
          if (ticket && ticket.status === "ok" && ticket.id) {
            ticketIds.push(ticket.id);
            return ticket.id;
          }
          return null;
        });

        // Wait briefly for Expo to process, then check receipts
        if (ticketIds.length > 0) {
          await sleep(RECEIPT_DELAY_MS);
        }
        const receipts = await checkExpoReceipts(ticketIds);

        let batchSuccess = 0;
        let batchFailed = 0;
        const nowIso = new Date().toISOString();

        const logRows = batch.map((t: any, idx: number) => {
          const ticket = tickets[idx] || { status: "error" } as ExpoPushTicket;

          // If ticket itself errored at send time
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

          // Ticket was "ok" — check the actual receipt for delivery status
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

          // Receipt confirmed or unavailable — treat as sent
          batchSuccess++;
          return {
            campaign_id: campaign.id,
            user_id: t.user_id,
            pushed_at: nowIso,
            status: "sent",
            error_message: null,
          };
        });

        totalSent += batchSuccess;
        totalFailed += batchFailed;

        await supabase.from("mobile_notification_logs").insert(logRows);

        // Create in-app notification rows for tokens that were actually sent
        const successfulTokens = batch.filter((_: any, idx: number) => logRows[idx].status === "sent");
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
        stale_tokens_deactivated: tokensToDeactivate.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again."}),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
