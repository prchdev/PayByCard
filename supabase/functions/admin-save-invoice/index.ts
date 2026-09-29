// Finance: Invoice save/update/cancel/payment endpoint
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const calcTotals = (lineItems: any[]) => {
  let subtotal = 0, totalSgst = 0, totalCgst = 0, totalIgst = 0, totalTax = 0, grandTotal = 0;
  for (const item of lineItems) {
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.amount_per_unit) || 0;
    const taxable = qty * unitPrice;
    const sgst = Number(item.sgst_amount) || 0;
    const cgst = Number(item.cgst_amount) || 0;
    const igst = Number(item.igst_amount) || 0;
    const otherTax = Number(item.other_tax_amount) || 0;
    const lineTotal = taxable + sgst + cgst + igst + otherTax;
    subtotal += taxable;
    totalSgst += sgst;
    totalCgst += cgst;
    totalIgst += igst;
    totalTax += sgst + cgst + igst + otherTax;
    grandTotal += lineTotal;
  }
  return { subtotal, totalSgst, totalCgst, totalIgst, totalTax, grandTotal };
}

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const adminId = body.adminId;
    const invoiceId = body.id;
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

    // CANCEL INVOICE
    if (action === "cancel") {
      const { data: existing } = await supabase
        .from("finance_invoices").select("invoice_status").eq("id", invoiceId).maybeSingle();

      const { data: updated, error } = await supabase
        .from("finance_invoices")
        .update({ invoice_status: "cancelled", cancellation_reason: body.reason || null, updated_at: new Date().toISOString() })
        .eq("id", invoiceId).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to cancel invoice" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("finance_audit_trail").insert({
        entity_type: "invoice", entity_id: invoiceId, action: "cancel",
        field_name: "invoice_status", previous_value: existing?.invoice_status || null,
        new_value: "cancelled", performed_by: adminId,
      });

      return new Response(JSON.stringify({ invoice: updated }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SAVE / UPDATE PAYMENT
    if (action === "save_payment") {
      const paymentId = body.paymentId;
      const paymentData: Record<string, any> = {
        invoice_id: invoiceId,
        payment_date: body.payment_date,
        payment_mode: body.payment_mode,
        paid_from: body.paid_from,
        payment_source: body.payment_source || null,
        transaction_id: body.transaction_id || null,
        amount_paid: Number(body.amount_paid) || 0,
        receipt_number: body.receipt_number || null,
        payment_status: body.payment_status || "pending",
        payment_remark: body.payment_remark || null,
        updated_at: new Date().toISOString(),
      };

      if (paymentId) {
        const { data: existing } = await supabase
          .from("finance_invoice_payments").select("*").eq("id", paymentId).maybeSingle();

        const { data: updated, error } = await supabase
          .from("finance_invoice_payments").update(paymentData).eq("id", paymentId).select().single();

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to update payment" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (const [key, val] of Object.entries(paymentData)) {
          if (key === "updated_at") continue;
          const oldVal = existing ? String(existing[key as keyof typeof existing] ?? "") : "";
          const newVal = String(val ?? "");
          if (oldVal !== newVal) {
            await supabase.from("finance_audit_trail").insert({
              entity_type: "payment", entity_id: paymentId, action: "update",
              field_name: key, previous_value: oldVal, new_value: newVal, performed_by: adminId,
            });
          }
        }

        // Recalculate invoice totals
        await recalcInvoiceTotals(supabase, invoiceId, adminId);
        return new Response(JSON.stringify({ payment: updated }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const { data: seqData } = await supabase.rpc("nextval", { sequence_name: "finance_payment_code_seq" }).maybeSingle();
        const seqNum = seqData || 1;
        paymentData.payment_id_code = `PAY-${String(seqNum).padStart(6, "0")}`;
        paymentData.created_by = adminId;

        const { data: created, error } = await supabase
          .from("finance_invoice_payments").insert(paymentData).select().single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message || "Failed to create payment" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("finance_audit_trail").insert({
          entity_type: "payment", entity_id: created.id, action: "create", performed_by: adminId,
        });

        await recalcInvoiceTotals(supabase, invoiceId, adminId);
        return new Response(JSON.stringify({ payment: created }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // CANCEL PAYMENT
    if (action === "cancel_payment") {
      const paymentId = body.paymentId;
      const { data: updated, error } = await supabase
        .from("finance_invoice_payments")
        .update({ payment_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", paymentId).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to cancel payment" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("finance_audit_trail").insert({
        entity_type: "payment", entity_id: paymentId, action: "cancel",
        field_name: "payment_status", previous_value: "active", new_value: "cancelled", performed_by: adminId,
      });

      await recalcInvoiceTotals(supabase, invoiceId, adminId);
      return new Response(JSON.stringify({ payment: updated }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SAVE / UPDATE INVOICE
    const lineItems = body.line_items || [];
    const totals = calcTotals(lineItems);

    const invoiceData: Record<string, any> = {
      vendor_id: body.vendor_id,
      invoice_number: body.invoice_number,
      invoice_date: body.invoice_date,
      due_date: body.due_date || null,
      po_number: body.po_number || null,
      currency: body.currency || "INR",
      place_of_supply: body.place_of_supply || null,
      expense_category: body.expense_category || null,
      additional_remark: body.additional_remark || null,
      subtotal: totals.subtotal,
      total_sgst: totals.totalSgst,
      total_cgst: totals.totalCgst,
      total_igst: totals.totalIgst,
      total_tax: totals.totalTax,
      grand_total: totals.grandTotal,
      invoice_status: body.invoice_status || "draft",
      updated_at: new Date().toISOString(),
    };

    // Duplicate check: vendor + invoice_number
    const { data: dupes } = await supabase
      .from("finance_invoices")
      .select("id, invoice_id_code, invoice_date, grand_total")
      .eq("vendor_id", body.vendor_id)
      .eq("invoice_number", body.invoice_number)
      .neq("id", invoiceId || "00000000-0000-0000-0000-000000000000");

    if (dupes && dupes.length > 0 && !body.forceSave) {
      return new Response(JSON.stringify({
        error: "duplicate_warning",
        duplicates: dupes,
        message: `A similar invoice already exists: ${dupes[0].invoice_id_code}`,
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoiceId) {
      // UPDATE
      const { data: existing } = await supabase
        .from("finance_invoices").select("*").eq("id", invoiceId).maybeSingle();

      const { data: updated, error } = await supabase
        .from("finance_invoices").update(invoiceData).eq("id", invoiceId).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to update invoice" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Replace line items
      await supabase.from("finance_invoice_line_items").delete().eq("invoice_id", invoiceId);
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.amount_per_unit) || 0;
        const taxable = qty * unitPrice;
        await supabase.from("finance_invoice_line_items").insert({
          invoice_id: invoiceId,
          description: item.description,
          hsn_sac: item.hsn_sac || null,
          quantity: qty,
          amount_per_unit: unitPrice,
          taxable_amount: taxable,
          sgst_amount: Number(item.sgst_amount) || 0,
          cgst_amount: Number(item.cgst_amount) || 0,
          igst_amount: Number(item.igst_amount) || 0,
          other_tax_amount: Number(item.other_tax_amount) || 0,
          total_amount: taxable + (Number(item.sgst_amount) || 0) + (Number(item.cgst_amount) || 0) + (Number(item.igst_amount) || 0) + (Number(item.other_tax_amount) || 0),
          display_order: i,
        });
      }

      // Audit
      for (const [key, val] of Object.entries(invoiceData)) {
        const oldVal = existing ? String(existing[key as keyof typeof existing] ?? "") : "";
        const newVal = String(val ?? "");
        if (oldVal !== newVal) {
          await supabase.from("finance_audit_trail").insert({
            entity_type: "invoice", entity_id: invoiceId, action: "update",
            field_name: key, previous_value: oldVal, new_value: newVal, performed_by: adminId,
          });
        }
      }

      await recalcInvoiceTotals(supabase, invoiceId, adminId);
      return new Response(JSON.stringify({ invoice: updated }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // CREATE
      const { data: seqData } = await supabase.rpc("nextval", { sequence_name: "finance_invoice_code_seq" }).maybeSingle();
      const seqNum = seqData || 1;
      invoiceData.invoice_id_code = `INV-${String(seqNum).padStart(6, "0")}`;
      invoiceData.created_by = adminId;
      invoiceData.total_paid = 0;
      invoiceData.payment_status = "no_payment";

      const { data: created, error } = await supabase
        .from("finance_invoices").insert(invoiceData).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message || "Failed to create invoice" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert line items
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.amount_per_unit) || 0;
        const taxable = qty * unitPrice;
        await supabase.from("finance_invoice_line_items").insert({
          invoice_id: created.id,
          description: item.description,
          hsn_sac: item.hsn_sac || null,
          quantity: qty,
          amount_per_unit: unitPrice,
          taxable_amount: taxable,
          sgst_amount: Number(item.sgst_amount) || 0,
          cgst_amount: Number(item.cgst_amount) || 0,
          igst_amount: Number(item.igst_amount) || 0,
          other_tax_amount: Number(item.other_tax_amount) || 0,
          total_amount: taxable + (Number(item.sgst_amount) || 0) + (Number(item.cgst_amount) || 0) + (Number(item.igst_amount) || 0) + (Number(item.other_tax_amount) || 0),
          display_order: i,
        });
      }

      await supabase.from("finance_audit_trail").insert({
        entity_type: "invoice", entity_id: created.id, action: "create", performed_by: adminId,
      });

      return new Response(JSON.stringify({ invoice: created }), {
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

const recalcInvoiceTotals = async (supabase: any, invoiceId: string, adminId: string) => {
  const { data: payments } = await supabase
    .from("finance_invoice_payments")
    .select("amount_paid, payment_status")
    .eq("invoice_id", invoiceId)
    .neq("payment_status", "cancelled");

  const totalPaid = (payments || []).reduce((sum: number, p: any) => {
    if (p.payment_status === "successful") return sum + Number(p.amount_paid);
    return sum;
  }, 0);

  const { data: invoice } = await supabase
    .from("finance_invoices").select("grand_total, invoice_status").eq("id", invoiceId).maybeSingle();

  if (!invoice) return;

  const pending = Number(invoice.grand_total) - totalPaid;
  let paymentStatus = "no_payment";
  let invoiceStatus = invoice.invoice_status;

  if (totalPaid <= 0) {
    paymentStatus = "no_payment";
  } else if (pending <= 0) {
    paymentStatus = "fully_paid";
    if (invoiceStatus !== "cancelled") invoiceStatus = "fully_paid";
  } else {
    paymentStatus = "partially_paid";
    if (invoiceStatus !== "cancelled") invoiceStatus = "partially_paid";
  }

  await supabase.from("finance_invoices")
    .update({ total_paid: totalPaid, payment_status: paymentStatus, invoice_status: invoiceStatus, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
}
