import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const BUCKET = "database-backups";

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { adminId, backupId } = await req.json();

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Missing adminId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!backupId) {
      return new Response(
        JSON.stringify({ error: "Missing backupId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("id, full_name")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the backup record
    const { data: backup, error: fetchError } = await supabase
      .from("backup_history")
      .select("*")
      .eq("id", backupId)
      .maybeSingle();

    if (fetchError || !backup) {
      return new Response(
        JSON.stringify({ error: "Backup record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete the file from storage if it exists
    if (backup.file_path && !backup.is_deleted) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([backup.file_path]);

      if (storageError) {
        console.error("Error deleting backup file from storage:", storageError);
        // Continue to mark as deleted in DB even if storage delete fails
      }
    }

    // Mark the backup as deleted in the database
    const { error: updateError } = await supabase
      .from("backup_history")
      .update({
        is_deleted: true,
        file_path: null,
        file_name: null,
      })
      .eq("id", backupId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update backup record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Backup deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-delete-backup:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// redeploy
