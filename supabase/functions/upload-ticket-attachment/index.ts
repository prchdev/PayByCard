import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { serveUserOrAdmin } from "../_shared/session.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

serveUserOrAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const ticketId = formData.get("ticketId") as string;
    const replyId = formData.get("replyId") as string | null;
    const userId = formData.get("userId") as string;
    const ip = formData.get("ip") as string;
    const isAdmin = formData.get("isAdmin") === "true";

    if (!file || !ticketId || !userId) {
      return new Response(
        JSON.stringify({ error: "File, ticket ID, and user ID are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const maxSize = 1048576;
    const minSize = 100;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: "File size must be less than 1MB" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (file.size < minSize) {
      return new Response(
        JSON.stringify({ error: "File is too small to be a valid attachment" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Only PNG, JPG, JPEG, and PDF files are allowed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate file magic bytes to prevent disguised content (e.g. text/HTML
    // with a .png extension used to smuggle API links or phishing payloads).
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isValidImage =
      (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) || // PNG
      (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) || // JPEG
      (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46); // PDF
    if (!isValidImage) {
      return new Response(
        JSON.stringify({ error: "File content does not match the declared type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user is mobile/email verified before allowing attachment uploads.
    if (!isAdmin) {
      const { data: userRow } = await supabase
        .from("users")
        .select("is_mobile_verified, is_email_verified, is_disabled")
        .eq("id", userId)
        .maybeSingle();
      if (!userRow || userRow.is_disabled) {
        return new Response(
          JSON.stringify({ error: "Account not authorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!userRow.is_mobile_verified || !userRow.is_email_verified) {
        return new Response(
          JSON.stringify({ error: "Please verify your mobile and email before uploading attachments." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let ticketQuery = supabase
      .from("support_tickets")
      .select("id, user_id")
      .eq("id", ticketId);

    if (!isAdmin) {
      ticketQuery = ticketQuery.eq("user_id", userId);
    }

    const { data: ticket } = await ticketQuery.maybeSingle();

    if (!ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${ticketId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("support-tickets")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload file" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const attachmentData: any = {
      ticket_id: ticketId,
      reply_id: replyId || null,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type,
      uploaded_ip: ip,
    };

    if (isAdmin) {
      attachmentData.admin_uploaded_by = userId;
    } else {
      attachmentData.uploaded_by = userId;
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from("support_ticket_attachments")
      .insert(attachmentData)
      .select()
      .single();

    if (attachmentError) {
      console.error("Error saving attachment record:", attachmentError);
      await supabase.storage.from("support-tickets").remove([filePath]);
      return new Response(
        JSON.stringify({ error: "Failed to save attachment record" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "File uploaded successfully",
        attachment,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Exception in upload-ticket-attachment:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});


