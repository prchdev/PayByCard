import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-admin-session",
};

/**
 * admin-get-cards
 *
 * Returns cards for admin review. Supports filtering by status and
 * searching by user name/email. Includes user details and payment info.
 */
serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { status, search, page = 1, limit = 20 } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase
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
        admin_verified_by,
        admin_verified_at,
        admin_rejection_reason,
        card_verification_deadline,
        created_at,
        updated_at,
        user_id
      `, { count: "exact" });

    if (status && status !== "all") {
      query = query.eq("status", status);
    } else if (!status) {
      // Default: show cards needing review
      query = query.in("status", ["submitted", "third_party", "not_submitted"]);
    }

    query = query
      .order("updated_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data: cards, error, count } = await query;

    if (error) throw error;

    // Fetch user details for each card
    const userIds = [...new Set((cards || []).map((c: any) => c.user_id))];
    let userMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, first_name, middle_name, last_name, email, mobile_number")
        .in("id", userIds);

      if (users) {
        for (const u of users) {
          userMap[u.id] = u;
        }
      }
    }

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

    // Filter by search term (user name/email) after fetching
    let result = (cards || []).map((card: any) => {
      const user = userMap[card.user_id] || {};
      const fullName = [user.first_name, user.middle_name, user.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        ...card,
        user: {
          id: user.id,
          full_name: fullName,
          email: user.email,
          mobile_number: user.mobile_number,
        },
        payment_count: paymentCounts[card.id] || 0,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) =>
        c.user?.full_name?.toLowerCase().includes(q) ||
        c.user?.email?.toLowerCase().includes(q) ||
        c.card_last_four?.includes(q),
      );
    }

    // Generate signed URLs for photos
    const cardsWithPhotos = result.filter((c: any) => c.front_photo_url || c.back_photo_url);
    for (const card of cardsWithPhotos) {
      if (card.front_photo_url) {
        const { data: signed } = await supabase.storage
          .from("card-photos")
          .createSignedUrl(card.front_photo_url, 3600);
        card.front_photo_url = signed?.signedUrl ?? null;
      }
      if (card.back_photo_url) {
        const { data: signed } = await supabase.storage
          .from("card-photos")
          .createSignedUrl(card.back_photo_url, 3600);
        card.back_photo_url = signed?.signedUrl ?? null;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cards: result,
        total: count ?? 0,
        page,
        limit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("admin-get-cards error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
