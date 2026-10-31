import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SESSION_HEADER, readSessionToken } from "../_shared/session.ts";
import { rewriteToPublicHost } from "../_shared/kycUrls.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MIN_FILE_SIZE = 100;

const ALLOWED_FILE_KEYS = new Set([
  "pan_photo",
  "address_proof_front",
  "address_proof_back",
  "address_front",
  "address_back",
  "business_pan_photo",
  "company_pan_photo",
  "gst_certificate",
  "inc_certificate",
  "loa",
  "moa",
  "aoa",
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

    if (file.size < MIN_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File is too small to be a valid document" }), {
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

    // Magic byte validation: verify the file content matches its declared type.
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isValidFile =
      (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) || // JPEG
      (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) || // PNG
      (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) || // PDF
      (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && // RIFF (WebP)
       header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50); // WEBP
    if (!isValidFile) {
      return new Response(JSON.stringify({ error: "File content does not match the declared type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // F12: userId comes from the verified session token, not the request body.
    // For public merchant-onboarding uploads (no session), fall back to the
    // userId provided in the form data, but only if it starts with "merchant-".
    const session = await readSessionToken(req.headers.get(SESSION_HEADER));
    const sessionUserId = session?.kind === "user" ? session.id : null;
    const formUserId = formData.get("userId") as string;

    let userId: string | null = sessionUserId;
    if (!userId && formUserId && formUserId.startsWith("merchant-")) {
      userId = formUserId;
    }

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

    // For authenticated users (not merchant-onboarding), verify the account is
    // not disabled and mobile/email verification is complete.
    if (sessionUserId) {
      const { data: userRow } = await supabase
        .from("users")
        .select("is_disabled, is_mobile_verified, is_email_verified")
        .eq("id", sessionUserId)
        .maybeSingle();
      if (!userRow || userRow.is_disabled) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!userRow.is_mobile_verified || !userRow.is_email_verified) {
        return new Response(JSON.stringify({ error: "Please verify your mobile and email before uploading KYC documents." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: settings } = await supabase
      .from("master_settings")
      .select("allow_manual_kyc")
      .limit(1)
      .maybeSingle();

    if (settings?.allow_manual_kyc === false) {
      return new Response(
        JSON.stringify({ error: "Manual KYC submission is currently disabled. Please use DigiLocker to complete your KYC." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Store the canonical public-style path (not the signed URL) so that
    // downstream code can generate fresh signed URLs on demand. The signed
    // URL returned to the uploader is still valid for immediate use.
    const canonicalUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/kyc-documents/${path}`;

    const clientIp = getClientIp(req);
    const uploadedAt = new Date().toISOString();

    return new Response(
      JSON.stringify({ url: rewriteToPublicHost(canonicalUrl), signedUrl: urlData.signedUrl ? rewriteToPublicHost(urlData.signedUrl) : undefined, uploadedAt, uploadIp: clientIp }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


