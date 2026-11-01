import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveUser } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session",
};

interface CardPayment {
  payment_id: string;
  payment_reference: string;
  amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

/**
 * get-user-cards
 *
 * Returns all cards associated with the authenticated user, including
 * verification status, card details, payment count, and linked payment details.
 * Uses a left join so cards with no linked payments are still returned.
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

    // Single query with left join to get payment details in one round trip.
    // Using a left join (no !inner) so cards without payment links are still returned.
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
        card_payment_links (
          payment_id,
          payments (
            id,
            payment_reference,
            amount,
            status,
            created_at,
            completed_at
          )
        )
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const result = (cards || []).map((card: any) => {
      const links = card.card_payment_links || [];
      const payments: CardPayment[] = links
        .map((link: any) => {
          const p = link.payments;
          if (!p) return null;
          return {
            payment_id: p.id,
            payment_reference: p.payment_reference,
            amount: Number(p.amount) || 0,
            status: p.status,
            created_at: p.created_at,
            completed_at: p.completed_at,
          } as CardPayment;
        })
        .filter((p: CardPayment | null): p is CardPayment => p !== null)
        .sort((a: CardPayment, b: CardPayment) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      return {
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
        payment_count: payments.length,
        payments,
      };
    });

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
