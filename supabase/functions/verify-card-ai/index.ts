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
 * Performs verification of a user's card submission:
 * 1. Reads the cardholder name that was extracted by in-browser OCR
 *    (Tesseract.js) at upload time and stored in name_on_card.
 * 2. Checks that last 4 digits on the uploaded card photo match the
 *    last 4 digits recorded from the payment gateway.
 * 3. Checks that the name extracted from the card photo matches the user's
 *    KYCed name (minimum 50% token overlap to pass).
 *
 * If verification passes both checks → status = "verified"
 * If last 4 matches but name does NOT match → status = "third_party"
 * If name could not be read (OCR failed) → status = "submitted" (admin review)
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

    // Use the name extracted by in-browser OCR at upload time
    const extractedName = card.name_on_card;
    const ocrLastFour = card.ocr_last_four;
    const dbLastFour = card.card_last_four;

    // Compare the last 4 digits read from the photo against the gateway record
    const last4Match = !!(ocrLastFour && dbLastFour && ocrLastFour === dbLastFour);

    if (!extractedName) {
      const aiResult = {
        ocr_name: null,
        ocr_status: "failed",
        ocr_last_four: ocrLastFour,
        db_last_four: dbLastFour,
        last4_match: last4Match,
        name_match_score: 0,
        name_match_threshold: NAME_MATCH_THRESHOLD,
        verified: false,
        is_third_party: false,
        verified_at: new Date().toISOString(),
        note: "OCR could not read the name from the card photo. Submitted for admin review.",
      };

      await supabase.from("user_cards").update({
        status: "submitted",
        ai_verification_result: aiResult,
        updated_at: new Date().toISOString(),
      }).eq("id", cardId);

      await supabase.from("card_payment_links")
        .update({ verification_status: "submitted" })
        .eq("user_card_id", cardId);

      return new Response(
        JSON.stringify({
          success: true,
          status: "submitted",
          aiResult,
          message: "Could not read the name from the card photo. Submitted for admin review.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch user's KYC name for comparison
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

    const nameScore = nameMatchScore(extractedName, kycName);

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
      ocr_name: extractedName,
      ocr_status: "success",
      ocr_last_four: ocrLastFour,
      db_last_four: dbLastFour,
      last4_match: last4Match,
      name_match_score: nameScore,
      name_match_threshold: NAME_MATCH_THRESHOLD,
      name_on_card: extractedName,
      kyc_name: kycName,
      verified,
      is_third_party: isThirdParty,
      verified_at: new Date().toISOString(),
    };

    await supabase.from("user_cards").update({
      status: newStatus,
      name_on_card: extractedName,
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
