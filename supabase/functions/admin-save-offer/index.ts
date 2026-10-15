import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { adminId, id, offer_name, start_date, end_date, offer_details, is_active } = await req.json();

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Missing adminId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!offer_name || typeof offer_name !== "string" || !offer_name.trim()) {
      return new Response(
        JSON.stringify({ error: "Offer name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: "Start date and end date are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid date format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (endDate < startDate) {
      return new Response(
        JSON.stringify({ error: "End date cannot be before start date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const name = offer_name.trim();
    const details = typeof offer_details === "string" ? offer_details : "";
    const active = is_active !== false;
    const baseSlug = slugify(name);

    if (id) {
      const { data: existing } = await supabase
        .from("offers")
        .select("slug")
        .eq("id", id)
        .maybeSingle();

      let slug = existing?.slug || baseSlug;
      if (!existing?.slug || slugify(name) !== slugify(existing.slug)) {
        slug = baseSlug;
        let suffix = 1;
        while (true) {
          const { data: conflict } = await supabase
            .from("offers")
            .select("id")
            .eq("slug", slug)
            .neq("id", id)
            .maybeSingle();
          if (!conflict) break;
          slug = `${baseSlug}-${suffix++}`;
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from("offers")
        .update({
          offer_name: name,
          slug,
          start_date: start_date,
          end_date: end_date,
          offer_details: details,
          is_active: active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update offer" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, offer: updated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const { data: conflict } = await supabase
        .from("offers")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!conflict) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    const { data: created, error: insertError } = await supabase
      .from("offers")
      .insert({
        offer_name: name,
        slug,
        start_date: start_date,
        end_date: end_date,
        offer_details: details,
        is_active: active,
        created_by: adminId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create offer" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, offer: created }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
