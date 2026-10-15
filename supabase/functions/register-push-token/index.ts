import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { withUserSession } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

Deno.serve(withUserSession(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { user_id, push_token, platform, app_version, action } = await req.json();

    if (!user_id || !push_token) {
      return new Response(
        JSON.stringify({ error: "user_id and push_token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate push token format (Expo tokens start with ExponentPushToken or plain FCM tokens)
    if (typeof push_token !== "string" || push_token.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid push token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("id", user_id)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deregister") {
      // Deactivate this specific token
      await supabase
        .from("mobile_push_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("push_token", push_token);

      return new Response(
        JSON.stringify({ message: "Token deregistered" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deactivate all other active tokens for this user before registering the new one.
    // A single device should only have one active push token at a time.
    await supabase
      .from("mobile_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("is_active", true)
      .neq("push_token", push_token.trim());

    // Upsert: if token already exists for this user, update; otherwise insert
    const { error } = await supabase
      .from("mobile_push_tokens")
      .upsert(
        {
          user_id,
          push_token: push_token.trim(),
          platform: platform || "unknown",
          app_version: app_version || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,push_token" }
      );

    if (error) {
      // If no unique constraint, try insert-or-update manually
      const { data: existing } = await supabase
        .from("mobile_push_tokens")
        .select("id")
        .eq("user_id", user_id)
        .eq("push_token", push_token.trim())
        .maybeSingle();

      if (existing) {
        await supabase
          .from("mobile_push_tokens")
          .update({ is_active: true, platform: platform || "unknown", app_version: app_version || null, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("mobile_push_tokens").insert({
          user_id,
          push_token: push_token.trim(),
          platform: platform || "unknown",
          app_version: app_version || null,
          is_active: true,
        });
      }
    }

    return new Response(
      JSON.stringify({ message: "Push token registered successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again."}),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
