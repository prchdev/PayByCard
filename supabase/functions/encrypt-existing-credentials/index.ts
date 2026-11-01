import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { encrypt, isEncrypted } from "../_shared/crypto.ts";
import { PAYOUT_SECRET_FIELDS } from "../_shared/gatewayCredentials.ts";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const ENCRYPTED_FIELDS = [
  "test_api_key",
  "test_api_secret",
  "production_api_key",
  "production_api_secret",
  "secret_key",
  "test_payout_client_id",
  "production_payout_client_id",
  "test_payout_client_secret",
  "production_payout_client_secret",
] as const;

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { adminId } = await req.json();
    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Admin ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: admin } = await supabase
      .from("admin_users")
      .select("id, is_active")
      .eq("id", adminId)
      .maybeSingle();
    if (!admin || !admin.is_active) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settings } = await supabase
      .from("master_settings")
      .select("gateway_encryption_key")
      .limit(1)
      .maybeSingle();

    const encryptionKey = settings?.gateway_encryption_key;
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: "No encryption key configured. Set one in Master Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: gateways, error } = await supabase
      .from("payment_gateway_settings")
      .select("*");

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch gateways" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let encryptedCount = 0;
    let skippedCount = 0;

    // Encrypt payment gateway settings
    for (const gateway of gateways || []) {
      const update: Record<string, string> = {};
      let hasChanges = false;

      for (const field of ENCRYPTED_FIELDS) {
        const value = gateway[field];
        if (value && typeof value === "string" && !isEncrypted(value)) {
          update[field] = await encrypt(value, encryptionKey);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        const { error: updateError } = await supabase
          .from("payment_gateway_settings")
          .update(update)
          .eq("id", gateway.id);
        if (updateError) {
          console.error(`Failed to encrypt gateway ${gateway.gateway_name}:`, updateError);
        } else {
          encryptedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    // Encrypt payout settings
    const { data: payoutSettings } = await supabase
      .from("payout_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    let payoutEncrypted = 0;
    if (payoutSettings) {
      const payoutUpdate: Record<string, string> = {};
      let payoutHasChanges = false;

      for (const field of PAYOUT_SECRET_FIELDS) {
        const value = payoutSettings[field];
        if (value && typeof value === "string" && !isEncrypted(value)) {
          payoutUpdate[field] = await encrypt(value, encryptionKey);
          payoutHasChanges = true;
        }
      }

      if (payoutHasChanges) {
        const { error: payoutUpdateError } = await supabase
          .from("payout_settings")
          .update(payoutUpdate)
          .eq("id", payoutSettings.id);
        if (payoutUpdateError) {
          console.error("Failed to encrypt payout settings:", payoutUpdateError);
        } else {
          payoutEncrypted = 1;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Encrypted ${encryptedCount} gateway(s), ${skippedCount} already encrypted or empty, ${payoutEncrypted} payout settings`,
        encrypted: encryptedCount,
        skipped: skippedCount,
        payoutEncrypted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("encrypt-existing-credentials error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
