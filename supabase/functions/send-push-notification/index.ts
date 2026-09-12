import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
}

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<{ success: number; failed: number }> {
  try {
    const resp = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(messages),
    });

    if (!resp.ok) return { success: 0, failed: messages.length };

    const json = await resp.json();
    const results: Array<{ status: string }> = json.data || [];
    const failed = results.filter((r) => r.status === "error").length;
    return { success: results.length - failed, failed };
  } catch {
    return { success: 0, failed: messages.length };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayDate = nowIST.toISOString().slice(0, 10);
    const currentTime = nowIST.toTimeString().slice(0, 8);

    // Fetch active campaigns whose push window includes the current time
    const { data: campaigns, error: campErr } = await supabase
      .from("mobile_notification_campaigns")
      .select("id, title, message, image_url, frequency, start_date, end_date, push_time_from, push_time_to")
      .eq("status", "active")
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

    for (const campaign of campaigns) {
      // For 'once' frequency, skip users who already received this campaign today
      let alreadyPushedUserIds: Set<string> = new Set();

      if (campaign.frequency === "once") {
        const { data: todayLogs } = await supabase
          .from("mobile_notification_logs")
          .select("user_id")
          .eq("campaign_id", campaign.id)
          .gte("pushed_at", `${todayDate}T00:00:00+05:30`);

        if (todayLogs) {
          alreadyPushedUserIds = new Set(todayLogs.map((l: any) => l.user_id).filter(Boolean));
        }

        // For 'once' campaigns, also skip users pushed on any previous day
        if (campaign.frequency === "once") {
          const { data: allLogs } = await supabase
            .from("mobile_notification_logs")
            .select("user_id")
            .eq("campaign_id", campaign.id);

          if (allLogs) {
            for (const l of allLogs) {
              if (l.user_id) alreadyPushedUserIds.add(l.user_id);
            }
          }
        }
      } else {
        // Daily: skip users already pushed today for this campaign
        const { data: todayLogs } = await supabase
          .from("mobile_notification_logs")
          .select("user_id")
          .eq("campaign_id", campaign.id)
          .gte("pushed_at", `${todayDate}T00:00:00+05:30`);

        if (todayLogs) {
          alreadyPushedUserIds = new Set(todayLogs.map((l: any) => l.user_id).filter(Boolean));
        }
      }

      // Fetch all active push tokens (excluding already-pushed users)
      const { data: tokens, error: tokErr } = await supabase
        .from("mobile_push_tokens")
        .select("user_id, push_token, platform")
        .eq("is_active", true);

      if (tokErr || !tokens || tokens.length === 0) continue;

      const eligibleTokens = tokens.filter(
        (t: any) => !alreadyPushedUserIds.has(t.user_id)
      );

      if (eligibleTokens.length === 0) continue;

      // Build Expo messages in batches
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
            msg.data = { ...msg.data, image_url: campaign.image_url };
          }
          return msg;
        });

        const { success, failed } = await sendExpoBatch(messages);
        totalSent += success;
        totalFailed += failed;

        // Log push events
        const logRows = batch.map((t: any) => ({
          campaign_id: campaign.id,
          user_id: t.user_id,
          pushed_at: new Date().toISOString(),
          status: "delivered",
        }));

        await supabase.from("mobile_notification_logs").insert(logRows);
      }
    }

    return new Response(
      JSON.stringify({ message: "Push notifications sent", sent: totalSent, failed: totalFailed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

