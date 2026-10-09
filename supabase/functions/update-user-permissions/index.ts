import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { adminId, targetUserId, permissions } = await req.json();

    if (!adminId || !targetUserId || !permissions || !Array.isArray(permissions)) {
      return new Response(
        JSON.stringify({ error: "adminId, targetUserId, and permissions array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: requestingAdmin, error: adminError } = await supabase
      .from("admin_users")
      .select("id, role, is_active")
      .eq("id", adminId)
      .maybeSingle();

    if (adminError || !requestingAdmin || !requestingAdmin.is_active) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requestingAdmin.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Only super admins can modify user permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user's role to validate overrides don't exceed role permissions
    const { data: targetUser, error: targetError } = await supabase
      .from("admin_users")
      .select("id, role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get role permissions for validation
    const { data: rolePerms, error: rolePermsError } = await supabase
      .from("role_permissions")
      .select("page_id, can_view, can_edit")
      .eq("role", targetUser.role);

    if (rolePermsError) throw rolePermsError;

    const rolePermsMap = new Map(rolePerms?.map((p: any) => [p.page_id, p]));

    // Delete existing overrides, then insert new ones
    const { error: deleteError } = await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", targetUserId);

    if (deleteError) throw deleteError;

    // Only insert overrides where the user's permission differs from the role default
    const overridesToInsert: any[] = [];

    for (const perm of permissions) {
      const rolePerm = rolePermsMap.get(perm.page_id);
      const roleCanView = rolePerm?.can_view ?? false;
      const roleCanEdit = rolePerm?.can_edit ?? false;

      // Only save if there's a difference from role defaults
      if (perm.can_view !== roleCanView || perm.can_edit !== roleCanEdit) {
        // Enforce: override cannot grant more than the role allows
        const finalCanView = perm.can_view && roleCanView;
        const finalCanEdit = perm.can_edit && roleCanEdit;

        overridesToInsert.push({
          user_id: targetUserId,
          page_id: perm.page_id,
          can_view: finalCanView,
          can_edit: finalCanEdit,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (overridesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("user_permissions")
        .insert(overridesToInsert);

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ message: "User permissions updated successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating user permissions:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
