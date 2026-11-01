import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveUser } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session",
};

/**
 * get-user-cards
 *
 * Returns all cards associated with the authenticated user, including
 * verification status, card details, and payment count per card.
 * Uses a single query with an embedded join to avoid N+1 patterns.
 */
serveUser(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId || typeof userId !== "string") {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Single query with embedded join to get payment counts in one round trip
    const { data: cards, error } = await supabase
      .from("user_cards")
      .select(`
        id,
        card_last_four,
        card_network,
        card_type,
        bank_name,
        name_on_card,
        front_photo_url,
        back_photo_url,
        status,
        ai_verification_result,
        admin_rejection_reason,
        card_verification_deadline,
        created_at,
        updated_at,
        card_payment_links!inner ( id )
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const result = (cards || []).map((card: any) => ({
      id: card.id,
      card_last_four: card.card_last_four,
      card_network: card.card_network,
      card_type: card.card_type,
      bank_name: card.bank_name,
      name_on_card: card.name_on_card,
      front_photo_url: card.front_photo_url,
      back_photo_url: card.back_photo_url,
      status: card.status,
      ai_verification_result: card.ai_verification_result,
      admin_rejection_reason: card.admin_rejection_reason,
      card_verification_deadline: card.card_verification_deadline,
      created_at: card.created_at,
      updated_at: card.updated_at,
      payment_count: card.card_payment_links?.length || 0,
    }));

    return new Response(
      JSON.stringify({ success: true, cards: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("get-user-cards error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
