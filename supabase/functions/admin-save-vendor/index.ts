// Finance: Vendor save/update/status endpoint
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
    const body = await req.json();
    const adminId = body.adminId;
    const vendorId = body.id;
    const action = body.action || "save";

    if (!adminId) {
      return new Response(JSON.stringify({ error: "Missing adminId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: admin } = await supabase
      .from("admin_users").select("id, role").eq("id", adminId).maybeSingle();
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STATUS CHANGE (disable/enable/blacklist/remove_blacklist)
    if (action === "status_change") {
      if (!vendorId) {
        return new Response(JSON.stringify({ error: "Vendor ID required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const newStatus = body.newStatus;
      const reason = body.reason || null;

      // Check if vendor has invoices/payments before disabling/blacklisting
      if (newStatus === "disabled" || newStatus === "blacklisted") {
        const { count } = await supabase
          .from("finance_invoices")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", vendorId);
        if (count && count > 0) {
          // Allow status change but keep records
        }
      }

      const { data: existing } = await supabase
        .from("finance_vendors").select("status, status_reason").eq("id", vendorId).maybeSingle();

      const { data: updated, error } = await supabase
        .from("finance_vendors")
        .update({ status: newStatus, status_reason: reason, updated_at: new Date().toISOString() })
        .eq("id", vendorId).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to update vendor status" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("finance_audit_trail").insert({
        entity_type: "vendor",
        entity_id: vendorId,
        action: "status_change",
        field_name: "status",
        previous_value: existing?.status || null,
        new_value: newStatus,
        performed_by: adminId,
      });

      return new Response(JSON.stringify({ vendor: updated }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SAVE / UPDATE
    const vendorData: Record<string, any> = {
      legal_name: body.legal_name,
      trade_name: body.trade_name || null,
      contact_person: body.contact_person || null,
      address: body.address || null,
      country: body.country || "India",
      email: body.email || null,
      phone: body.phone || null,
      domestic_or_international: body.domestic_or_international || "domestic",
      registration_status: body.registration_status || "registered",
      registration_type: body.registration_type || null,
      cin_number: body.cin_number || null,
      pan_number: body.pan_number || null,
      gst_number: body.gst_number || null,
      gst_registration_state: body.gst_registration_state || null,
      bank_account_holder: body.bank_account_holder || null,
      bank_name: body.bank_name || null,
      bank_account_number: body.bank_account_number || null,
      bank_ifsc: body.bank_ifsc || null,
      bank_account_type: body.bank_account_type || null,
      payment_terms: body.payment_terms || null,
      expense_category: body.expense_category || null,
      additional_remark: body.additional_remark || null,
      updated_at: new Date().toISOString(),
    };

    if (vendorId) {
      // UPDATE
      const { data: existing } = await supabase
        .from("finance_vendors").select("*").eq("id", vendorId).maybeSingle();

      const { data: updated, error } = await supabase
        .from("finance_vendors").update(vendorData).eq("id", vendorId).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to update vendor" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Audit trail for changed fields
      for (const [key, val] of Object.entries(vendorData)) {
        const oldVal = existing ? String(existing[key as keyof typeof existing] ?? "") : "";
        const newVal = String(val ?? "");
        if (oldVal !== newVal) {
          await supabase.from("finance_audit_trail").insert({
            entity_type: "vendor",
            entity_id: vendorId,
            action: "update",
            field_name: key,
            previous_value: oldVal,
            new_value: newVal,
            performed_by: adminId,
          });
        }
      }

      return new Response(JSON.stringify({ vendor: updated }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // CREATE — generate vendor code
      const { data: seqData } = await supabase.rpc("next_vendor_code").maybeSingle();
      const seqNum = seqData || 1;
      const vendorCode = `VND-${String(seqNum).padStart(6, "0")}`;
      vendorData.vendor_code = vendorCode;
      vendorData.created_by = adminId;
      vendorData.status = "active";

      const { data: created, error } = await supabase
        .from("finance_vendors").insert(vendorData).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message || "Failed to create vendor" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("finance_audit_trail").insert({
        entity_type: "vendor",
        entity_id: created.id,
        action: "create",
        performed_by: adminId,
      });

      return new Response(JSON.stringify({ vendor: created }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
