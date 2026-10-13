import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";
import {
  isSupportedGateway,
} from "../_shared/settlementApi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const action = body.action || "get";

    // ─── GET: return settlement settings for supported gateways only ──────
    if (action === "get") {
      const { data: settings, error: sErr } = await supabase
        .from("gateway_settlement_settings")
        .select(`
          id, gateway_name, on_demand_settlement_enabled,
          settlement_trigger_minutes,
          last_settlement_at, last_settlement_status, last_settlement_amount,
          created_at, updated_at
        `)
        .order("gateway_name");

      if (sErr) throw new Error(`Settings query failed: ${sErr.message}`);

      // Filter to only supported gateways
      const supportedSettings = (settings || []).filter((s: any) => isSupportedGateway(s.gateway_name));

      const { data: gateways, error: gErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .order("gateway_name");

      if (gErr) throw new Error(`Gateway query failed: ${gErr.message}`);

      const supportedGateways = (gateways || []).filter((g: any) => isSupportedGateway(g.gateway_name));

      const rows = [];
      for (const s of supportedSettings) {
        const gw = supportedGateways.find((g: any) => g.gateway_name === s.gateway_name);

        rows.push({
          ...s,
          gateway_enabled: gw?.is_enabled ?? false,
        });
      }

      return new Response(
        JSON.stringify({ success: true, settings: rows }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SAVE: update a single gateway's settlement settings ───────────────
    if (action === "save") {
      const { gateway_name, on_demand_settlement_enabled, settlement_trigger_minutes } = body;

      if (!gateway_name) {
        return new Response(
          JSON.stringify({ success: false, error: "Gateway name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!isSupportedGateway(gateway_name)) {
        return new Response(
          JSON.stringify({ success: false, error: "On-demand settlement is not supported for this gateway" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (typeof on_demand_settlement_enabled === "boolean") {
        updates.on_demand_settlement_enabled = on_demand_settlement_enabled;
      }
      if (settlement_trigger_minutes !== undefined && settlement_trigger_minutes !== null) {
        const mins = Number(settlement_trigger_minutes);
        if (!isNaN(mins) && mins >= 1) {
          updates.settlement_trigger_minutes = Math.round(mins);
        }
      }

      if (body.adminId) updates.updated_by = body.adminId;
      if (body.adminIp) updates.updated_by_ip = body.adminIp;

      const { data, error } = await supabase
        .from("gateway_settlement_settings")
        .update(updates)
        .eq("gateway_name", gateway_name)
        .select()
        .maybeSingle();

      if (error) throw new Error(`Update failed: ${error.message}`);

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: "Gateway settlement settings not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, settings: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("admin-gateway-settlement error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
