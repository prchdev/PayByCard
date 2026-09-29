// Finance: Secure document upload for invoices and payments
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SESSION_HEADER, readSessionToken } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
]);

const ALLOWED_DOC_TYPES = new Set([
  "invoice_pdf", "invoice_image", "receipt", "snapshot", "other",
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
    const docType = formData.get("docType") as string;
    const entityType = formData.get("entityType") as string;
    const entityId = formData.get("entityId") as string;

    if (!file || !docType || !entityType || !entityId) {
      return new Response(JSON.stringify({ error: "file, docType, entityType, and entityId are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_DOC_TYPES.has(docType)) {
      return new Response(JSON.stringify({ error: "Invalid document type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File exceeds 5 MB limit" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedType = file.type || "";
    if (!ALLOWED_MIME_TYPES.has(detectedType)) {
      return new Response(JSON.stringify({ error: "Only JPEG, PNG, WebP, and PDF files are accepted" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin identity from session token
    const adminToken = req.headers.get("x-pbc-admin-session");
    const session = await readSessionToken(adminToken);
    const adminId = session?.kind === "admin" ? session.id : null;

    if (!adminId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin exists
    const { data: admin } = await supabase
      .from("admin_users").select("id").eq("id", adminId).maybeSingle();
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate entity exists and determine bucket + table
    let bucketName: string;
    let tableName: string;
    let fkColumn: string;

    if (entityType === "invoice") {
      bucketName = "invoice-documents";
      tableName = "finance_invoice_documents";
      fkColumn = "invoice_id";
      const { data: inv } = await supabase
        .from("finance_invoices").select("id").eq("id", entityId).maybeSingle();
      if (!inv) {
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (entityType === "payment") {
      bucketName = "payment-documents";
      tableName = "finance_payment_documents";
      fkColumn = "payment_id";
      const { data: pay } = await supabase
        .from("finance_invoice_payments").select("id").eq("id", entityId).maybeSingle();
      if (!pay) {
        return new Response(JSON.stringify({ error: "Payment not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid entity type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to storage with random UUID filename
    const uuid = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${entityId}/${uuid}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, arrayBuffer, {
        contentType: detectedType,
        upsert: false,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: "Failed to upload file" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert DB record
    const insertData: Record<string, any> = {
      [fkColumn]: entityId,
      document_type: docType,
      file_url: path,
      uploaded_by: adminId,
    };

    const { error: dbError } = await supabase
      .from(tableName)
      .insert(insertData);

    if (dbError) {
      // Compensating delete: remove orphaned file from storage
      await supabase.storage.from(bucketName).remove([path]);
      return new Response(JSON.stringify({ error: "Failed to save document record" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit trail
    await supabase.from("finance_audit_trail").insert({
      entity_type: entityType === "invoice" ? "document" : "document",
      entity_id: entityId,
      action: "document_upload",
      field_name: docType,
      new_value: path,
      performed_by: adminId,
    });

    // Generate signed URL for immediate use
    const { data: urlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(path, 3600);

    const clientIp = getClientIp(req);

    return new Response(JSON.stringify({
      fileUrl: path,
      signedUrl: urlData?.signedUrl || null,
      docType,
      uploadedAt: new Date().toISOString(),
      uploadIp: clientIp,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
