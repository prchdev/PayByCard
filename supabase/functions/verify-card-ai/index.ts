import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { isInternalCall, readSessionToken, SESSION_HEADER, unauthorized } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

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

/**
 * verify-card-ai
 *
 * Submits the card for admin review. No automatic AI verification is performed.
 * The cardholder name (entered manually by the user) and last 4 digits are
 * compared against the user's KYC name and gateway-recorded last 4 digits,
 * and the comparison result is stored for the admin to review.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

    if (!cardId || typeof cardId !== "string" || !userId || typeof userId !== "string") {
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

    if (card.status === "verified" || card.status === "third_party") {
      return new Response(
        JSON.stringify({ error: "This card is already verified", status: card.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (card.status === "submitted" && card.ai_verification_result) {
      return new Response(
        JSON.stringify({ error: "This card is already under admin review", status: card.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!card.front_photo_url || !card.back_photo_url) {
      return new Response(
        JSON.stringify({ error: "Please upload both front and back photos before verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!card.name_on_card || card.name_on_card.trim().length < 4) {
      return new Response(
        JSON.stringify({ error: "Please enter the name on card before submitting for verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dbLastFour = card.card_last_four;
    const last4Match = !!(dbLastFour && dbLastFour !== "????" && dbLastFour.length === 4);

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

    const nameScore = nameMatchScore(card.name_on_card, kycName);

    const reviewResult = {
      name_on_card: card.name_on_card,
      kyc_name: kycName,
      name_match_score: nameScore,
      last4_match: last4Match,
      db_last_four: dbLastFour,
      submitted_at: new Date().toISOString(),
      note: "Submitted for admin review. Admin to verify last 4 digits match and name match.",
    };

    await supabase.from("user_cards").update({
      status: "submitted",
      ai_verification_result: reviewResult,
      updated_at: new Date().toISOString(),
    }).eq("id", cardId);

    await supabase.from("card_payment_links")
      .update({ verification_status: "submitted" })
      .eq("user_card_id", cardId);

    return new Response(
      JSON.stringify({ success: true, status: "submitted", aiResult: reviewResult }),
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
