import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveUser } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session",
};

/**
 * save-card-name
 *
 * Allows a user to set/update the name on card for one of their cards.
 * This name is used for AI name-match verification against the user's
 * KYC profile name.
 */
serveUser(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { userId, cardId, nameOnCard } = body;

    if (!userId || !cardId || !nameOnCard) {
      return new Response(
        JSON.stringify({ error: "userId, cardId, and nameOnCard are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (nameOnCard.length > 100) {
      return new Response(
        JSON.stringify({ error: "Name on card must not exceed 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: card, error } = await supabase
      .from("user_cards")
      .select("id, user_id")
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !card) {
      return new Response(
        JSON.stringify({ error: "Card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("user_cards").update({
      name_on_card: nameOnCard.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", cardId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("save-card-name error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
