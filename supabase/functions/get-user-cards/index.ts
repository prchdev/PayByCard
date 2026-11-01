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
 */
serveUser(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
        updated_at
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // Get payment counts per card
    const cardIds = (cards || []).map((c: any) => c.id);
    let paymentCounts: Record<string, number> = {};
    if (cardIds.length > 0) {
      const { data: links } = await supabase
        .from("card_payment_links")
        .select("user_card_id")
        .in("user_card_id", cardIds);

      if (links) {
        for (const link of links) {
          paymentCounts[link.user_card_id] = (paymentCounts[link.user_card_id] || 0) + 1;
        }
      }
    }

    const result = (cards || []).map((card: any) => ({
      ...card,
      payment_count: paymentCounts[card.id] || 0,
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
