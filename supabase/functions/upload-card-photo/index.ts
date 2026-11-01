import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveUser } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session",
};

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * upload-card-photo
 *
 * Accepts multipart form data with a masked card photo (front or back)
 * and uploads it to the private `card-photos` storage bucket.
 *
 * Body (FormData):
 *   - userId: string
 *   - cardId: string (user_cards.id)
 *   - side: "front" | "back"
 *   - file: Blob (the masked card photo)
 */
serveUser(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const userId = formData.get("userId") as string;
    const cardId = formData.get("cardId") as string;
    const side = formData.get("side") as string;
    const file = formData.get("file") as File | null;
    const extractedName = formData.get("extractedName") as string | null;

    if (!userId || !cardId || !side || !file) {
      return new Response(
        JSON.stringify({ error: "userId, cardId, side, and file are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (side !== "front" && side !== "back") {
      return new Response(
        JSON.stringify({ error: "side must be 'front' or 'back'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return new Response(
        JSON.stringify({ error: "File must be a JPEG, PNG, or WebP image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "File size must not exceed 5 MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the card belongs to the user
    const { data: card, error: cardErr } = await supabase
      .from("user_cards")
      .select("id, status")
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (cardErr || !card) {
      return new Response(
        JSON.stringify({ error: "Card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upload to storage
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const filePath = `${userId}/${cardId}/${side}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("card-photos")
      .upload(filePath, file, { contentType: file.type, upsert: true });

    if (uploadErr) throw uploadErr;

    // Get signed URL (valid for 1 hour) for the uploaded file
    const { data: signedUrlData } = await supabase.storage
      .from("card-photos")
      .createSignedUrl(filePath, 3600);

    const photoUrl = signedUrlData?.signedUrl ?? null;

    // Update card record with photo URL and set status to submitted
    const updateData: any = { updated_at: new Date().toISOString() };
    if (side === "front") {
      updateData.front_photo_url = filePath;
      if (extractedName && extractedName.trim().length >= 4) {
        updateData.name_on_card = extractedName.trim();
      }
    } else {
      updateData.back_photo_url = filePath;
    }

    // If both photos now exist, set status to submitted for AI verification
    const { data: updatedCard } = await supabase
      .from("user_cards")
      .select("front_photo_url, back_photo_url, status")
      .eq("id", cardId)
      .maybeSingle();

    const hasFront = side === "front" ? true : !!updatedCard?.front_photo_url;
    const hasBack = side === "back" ? true : !!updatedCard?.back_photo_url;

    if (hasFront && hasBack && (card.status === "not_submitted" || card.status === "rejected")) {
      updateData.status = "submitted";
    }

    await supabase.from("user_cards").update(updateData).eq("id", cardId);

    return new Response(
      JSON.stringify({
        success: true,
        photoUrl,
        side,
        extractedName: (side === "front" && extractedName && extractedName.trim().length >= 4) ? extractedName.trim() : null,
        cardStatus: hasFront && hasBack ? "submitted" : (card.status === "rejected" ? "not_submitted" : card.status),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("upload-card-photo error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
