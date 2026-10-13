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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { adminId } = await req.json();

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Admin ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("id, role, is_active")
      .eq("id", adminId)
      .maybeSingle();

    if (adminError || !admin || !admin.is_active) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: rolePermissions, error: permissionsError } = await supabase
      .from("role_permissions")
      .select(`
        can_view,
        can_edit,
        page_id,
        admin_pages!inner (
          id,
          page_key,
          page_name,
          page_path,
          icon,
          display_order,
          is_active
        )
      `)
      .eq("role", admin.role)
      .eq("admin_pages.is_active", true);

    if (permissionsError) {
      throw permissionsError;
    }

    // Get per-user overrides for this user
    const { data: userOverrides, error: overridesError } = await supabase
      .from("user_permissions")
      .select("page_id, can_view, can_edit")
      .eq("user_id", adminId);

    if (overridesError) {
      throw overridesError;
    }

    const overridesMap = new Map(userOverrides?.map((o: any) => [o.page_id, o]));

    const allowedPages = (rolePermissions ?? [])
      .map((perm: any) => {
        const override = overridesMap.get(perm.admin_pages.id);

        // Override can only restrict, never expand
        const finalCanView = override ? override.can_view && perm.can_view : perm.can_view;
        const finalCanEdit = override ? override.can_edit && perm.can_edit : perm.can_edit;

        return {
          page_key: perm.admin_pages.page_key,
          page_name: perm.admin_pages.page_name,
          page_path: perm.admin_pages.page_path,
          icon: perm.admin_pages.icon,
          display_order: perm.admin_pages.display_order,
          can_view: finalCanView,
          can_edit: finalCanEdit,
        };
      })
      .filter((p: any) => p.can_view)
      .sort((a: any, b: any) => a.display_order - b.display_order);

    return new Response(
      JSON.stringify({
        role: admin.role,
        permissions: allowedPages || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

