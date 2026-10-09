// Finance: Invoice list endpoint
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
    const search = body.search || "";
    const invoiceStatus = body.invoiceStatus || "";
    const paymentStatus = body.paymentStatus || "";
    const vendorId = body.vendorId || "";
    const dateType = body.dateType || "invoice";
    const dateFrom = body.dateFrom || "";
    const dateTo = body.dateTo || "";

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
      .from("admin_users").select("id").eq("id", adminId).maybeSingle();
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("finance_invoices")
      .select(`
        *,
        vendor:finance_vendors(*),
        line_items:finance_invoice_line_items(*),
        payments:finance_invoice_payments(*, documents:finance_payment_documents(*)),
        documents:finance_invoice_documents(*)
      `)
      .order("created_at", { ascending: false });

    if (invoiceStatus) query = query.eq("invoice_status", invoiceStatus);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (vendorId) query = query.eq("vendor_id", vendorId);

    if (dateFrom && dateTo) {
      const dateColumn = dateType === "payment" ? "invoice_date" : "invoice_date";
      query = query.gte(dateColumn, dateFrom).lte(dateColumn, dateTo);
    } else if (dateFrom) {
      query = query.gte("invoice_date", dateFrom);
    } else if (dateTo) {
      query = query.lte("invoice_date", dateTo);
    }

    const { data: invoices, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch invoices" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enriched = invoices || [];

    // Filter by search term client-side (includes vendor name fields not queryable via .or())
    let filtered = enriched;
    if (search) {
      const q = search.toLowerCase();
      filtered = enriched.filter((inv: any) => {
        const v = inv.vendor;
        return (
          (inv.invoice_id_code || "").toLowerCase().includes(q) ||
          (inv.invoice_number || "").toLowerCase().includes(q) ||
          (inv.po_number || "").toLowerCase().includes(q) ||
          (v?.legal_name || "").toLowerCase().includes(q) ||
          (v?.trade_name || "").toLowerCase().includes(q) ||
          (v?.vendor_code || "").toLowerCase().includes(q)
        );
      });
    }

    if (filtered.length > 0) {
      const allInvoiceDocs = filtered.flatMap((inv: any) =>
        (inv.documents || []).map((d: any) => ({ id: d.id, file_url: d.file_url }))
      );
      const allPaymentDocs = filtered.flatMap((inv: any) =>
        (inv.payments || []).flatMap((p: any) =>
          (p.documents || []).map((d: any) => ({ id: d.id, file_url: d.file_url }))
        )
      );

      const invoicePaths = allInvoiceDocs.map((d: any) => d.file_url);
      const paymentPaths = allPaymentDocs.map((d: any) => d.file_url);

      let invoiceUrlMap: Record<string, string> = {};
      let paymentUrlMap: Record<string, string> = {};

      if (invoicePaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from("invoice-documents").createSignedUrls(invoicePaths, 3600);
        if (signedUrls) {
          for (let i = 0; i < allInvoiceDocs.length; i++) {
            const signed = signedUrls[i];
            if (signed?.signedUrl) invoiceUrlMap[allInvoiceDocs[i].id] = signed.signedUrl;
          }
        }
      }

      if (paymentPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from("payment-documents").createSignedUrls(paymentPaths, 3600);
        if (signedUrls) {
          for (let i = 0; i < allPaymentDocs.length; i++) {
            const signed = signedUrls[i];
            if (signed?.signedUrl) paymentUrlMap[allPaymentDocs[i].id] = signed.signedUrl;
          }
        }
      }

      for (const inv of filtered) {
        if (inv.documents) {
          for (const doc of inv.documents) {
            doc.signed_url = invoiceUrlMap[doc.id] || null;
          }
        }
        if (inv.payments) {
          for (const pay of inv.payments) {
            if (pay.documents) {
              for (const doc of pay.documents) {
                doc.signed_url = paymentUrlMap[doc.id] || null;
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ invoices: filtered }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
