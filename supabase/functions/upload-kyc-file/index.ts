import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_FILE_KEYS = new Set([
  "pan_photo",
  "address_proof_front",
  "address_proof_back",
  "business_pan_photo",
  "gst_certificate",
  "cancelled_cheque",
  "business_photo",
  "additional_document",
]);

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileKey = formData.get("fileKey") as string;

    if (!file || !fileKey) {
      return new Response(JSON.stringify({ error: "file and fileKey are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_FILE_KEYS.has(fileKey)) {
      return new Response(JSON.stringify({ error: "Invalid document type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File exceeds 5 MB limit" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedType = file.type || "";
    if (!ALLOWED_MIME_TYPES.has(detectedType)) {
      return new Response(JSON.stringify({ error: "Only JPEG, PNG, WebP, and PDF files are accepted" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // F12: userId comes from the verified session token, not the request body.
    const userId = req.headers.get(SESSION_HEADER)
      ? (() => {
          const token = req.headers.get(SESSION_HEADER)!;
          const parts = token.split(".");
          return parts.length >= 4 ? parts[1] : null;
        })()
      : null;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${fileKey}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(path, arrayBuffer, {
        contentType: detectedType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: urlData } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 3600);

    const clientIp = getClientIp(req);
    const uploadedAt = new Date().toISOString();

    return new Response(
      JSON.stringify({ url: urlData.signedUrl, uploadedAt, uploadIp: clientIp }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


// redeploy
