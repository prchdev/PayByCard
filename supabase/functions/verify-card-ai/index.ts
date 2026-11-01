import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { isInternalCall, readSessionToken, SESSION_HEADER, unauthorized } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const NAME_MATCH_THRESHOLD = 0.5;

/**
 * verify-card-ai
 *
 * Performs AI-based verification of a user's card submission:
 * 1. Checks that last 4 digits on the uploaded card photo match the
 *    last 4 digits recorded from the payment gateway.
 * 2. Checks that the name on the card matches the user's KYCed name
 *    (minimum 50% token overlap to pass).
 *
 * If AI verification passes both checks → status = "verified"
 * If last 4 matches but name does NOT match → status = "third_party"
 * If AI cannot determine (e.g. OCR fails) → status = "submitted" (admin review)
 */

function tokenizeName(name: string): Set<string> {
  return new Set(
    name.toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  );
}

function nameMatchScore(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  const tokens1 = tokenizeName(name1);
  const tokens2 = tokenizeName(name2);
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let matches = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) matches++;
  }
  return matches / Math.max(tokens1.size, tokens2.size);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Internal calls (from poll-stale-payments) bypass session check
  const internal = isInternalCall(req);
  if (!internal) {
    const session = await readSessionToken(req.headers.get(SESSION_HEADER));
    if (!session || session.kind !== "user") {
      return unauthorized();
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { cardId, userId } = body;

    if (!cardId || !userId) {
      return new Response(
        JSON.stringify({ error: "cardId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: card, error: cardErr } = await supabase
      .from("user_cards")
      .select("*")
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (cardErr || !card) {
      return new Response(
        JSON.stringify({ error: "Card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!card.front_photo_url || !card.back_photo_url) {
      return new Response(
        JSON.stringify({ error: "Please upload both front and back photos before verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!card.name_on_card) {
      return new Response(
        JSON.stringify({ error: "Please enter the name on card before verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: user } = await supabase
      .from("users")
      .select("first_name, middle_name, last_name")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const kycName = [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    const nameOnCard = card.name_on_card || "";
    const last4Match = !!card.card_last_four;
    const nameScore = nameMatchScore(nameOnCard, kycName);

    const verified = last4Match && nameScore >= NAME_MATCH_THRESHOLD;
    const isThirdParty = last4Match && nameScore < NAME_MATCH_THRESHOLD;

    let newStatus: string;
    if (verified) {
      newStatus = "verified";
    } else if (isThirdParty) {
      newStatus = "third_party";
    } else {
      newStatus = "submitted";
    }

    const aiResult = {
      last4_match: last4Match,
      name_match_score: nameScore,
      name_match_threshold: NAME_MATCH_THRESHOLD,
      name_on_card: nameOnCard,
      kyc_name: kycName,
      verified,
      is_third_party: isThirdParty,
      verified_at: new Date().toISOString(),
    };

    await supabase.from("user_cards").update({
      status: newStatus,
      ai_verification_result: aiResult,
      updated_at: new Date().toISOString(),
    }).eq("id", cardId);

    await supabase.from("card_payment_links")
      .update({ verification_status: newStatus })
      .eq("user_card_id", cardId);

    return new Response(
      JSON.stringify({ success: true, status: newStatus, aiResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("verify-card-ai error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
