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
    const { adminId, targetUserId } = await req.json();

    if (!adminId || !targetUserId) {
      return new Response(
        JSON.stringify({ error: "adminId and targetUserId are required" }),
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
        JSON.stringify({ error: "Only super admins can view user permission overrides" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user's role
    const { data: targetUser, error: targetError } = await supabase
      .from("admin_users")
      .select("id, role, full_name, email")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active pages
    const { data: pages, error: pagesError } = await supabase
      .from("admin_pages")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (pagesError) throw pagesError;

    // Get role-based permissions for target user's role
    const { data: rolePerms, error: rolePermsError } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("role", targetUser.role);

    if (rolePermsError) throw rolePermsError;

    // Get per-user overrides
    const { data: userPerms, error: userPermsError } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("user_id", targetUserId);

    if (userPermsError) throw userPermsError;

    // Build merged result: for each page, show role default + user override
    const rolePermsMap = new Map(rolePerms?.map((p: any) => [p.page_id, p]));
    const userPermsMap = new Map(userPerms?.map((p: any) => [p.page_id, p]));

    const mergedPages = (pages ?? []).map((page: any) => {
      const rolePerm = rolePermsMap.get(page.id);
      const userPerm = userPermsMap.get(page.id);

      if (!rolePerm) {
        return {
          ...page,
          role_can_view: false,
          role_can_edit: false,
          has_override: false,
          can_view: false,
          can_edit: false,
        };
      }

      const roleCanView = rolePerm.can_view;
      const roleCanEdit = rolePerm.can_edit;
      const hasOverride = !!userPerm;

      // Override can only restrict, not expand
      const finalCanView = hasOverride ? userPerm.can_view && roleCanView : roleCanView;
      const finalCanEdit = hasOverride ? userPerm.can_edit && roleCanEdit : roleCanEdit;

      return {
        ...page,
        role_can_view: roleCanView,
        role_can_edit: roleCanEdit,
        has_override: hasOverride,
        can_view: finalCanView,
        can_edit: finalCanEdit,
      };
    });

    return new Response(
      JSON.stringify({
        user: targetUser,
        pages: mergedPages,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching user permission overrides:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
