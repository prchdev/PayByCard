import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

function fmtAmt(n: number | string | null | undefined): string {
  return parseFloat(String(n || 0)).toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function trunc(s: string | null | undefined, max: number): string {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max) + "..." : str || "—";
}

function safeText(text: string | null | undefined): string {
  return String(text || "").replace(/[^\x00-\x7F]/g, "?");
}

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invoice } = await supabase
      .from("finance_invoices")
      .select(`
        *,
        vendor:finance_vendors(*),
        line_items:finance_invoice_line_items(*),
        payments:finance_invoice_payments(*)
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company } = await supabase
      .from("master_settings")
      .select("company_name, address, cin, gst_number, pan, website_url, support_email, phone_number")
      .limit(1)
      .maybeSingle();

    const co = company || {};
    const vendor = invoice.vendor || {};
    const lineItems = invoice.line_items || [];
    const payments = invoice.payments || [];

    const pdfDoc = await PDFDocument.create();
    const pg = pdfDoc.addPage([595.28, 841.89]);
    const W = 595.28, H = 841.89;

    const reg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bld = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const ML = 50, RX = W - 50, CW = RX - ML;
    const DARK = rgb(0.059, 0.090, 0.161);
    const GRAY = rgb(0.392, 0.455, 0.545);
    const LGRAY = rgb(0.886, 0.898, 0.914);
    const BGFAINT = rgb(0.973, 0.980, 0.992);
    const WHITE = rgb(1, 1, 1);

    const R = (x: number, topY: number, w: number, h: number, fill: any, stroke?: any) =>
      pg.drawRectangle({ x, y: H - topY - h, width: w, height: h, color: fill,
        ...(stroke ? { borderColor: stroke, borderWidth: 0.5 } : {}) });

    const T = (text: string | null | undefined, x: number, baselineFromTop: number, sz: number,
      f = reg, col = DARK) => {
      const s = safeText(text);
      if (s.trim()) pg.drawText(s, { x, y: H - baselineFromTop, size: sz, font: f, color: col });
    };

    const L = (x1: number, y1: number, x2: number, y2: number, thick = 0.5, col = LGRAY) =>
      pg.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, thickness: thick, color: col });

    const TW = (text: string | null | undefined, sz: number, f = reg) =>
      f.widthOfTextAtSize(safeText(text), sz);

    let y = 50;

    // Header
    const coName = co.company_name || "PayByCard Technologies Pvt Ltd";
    T(coName, ML, y + 13, 13, bld);
    y += 18;
    if (co.address) { T(trunc(co.address, 70), ML, y + 9, 8, reg, GRAY); y += 12; }
    T(`${co.website_url || "paybycard.in"}  |  ${co.support_email || "support@paybycard.in"}`, ML, y + 9, 8, reg, GRAY);
    y += 12;
    if (co.phone_number) { T(co.phone_number, ML, y + 9, 8, reg, GRAY); y += 12; }

    // INVOICE title
    const titleSz = 22;
    T("VENDOR INVOICE", RX - TW("VENDOR INVOICE", titleSz, bld), 50 + titleSz - 2, titleSz, bld);

    let ry = 50 + titleSz + 4;
    const metaRows: [string, string][] = [];
    metaRows.push(["Invoice No.", invoice.invoice_id_code]);
    metaRows.push(["Vendor Invoice #", invoice.invoice_number || "—"]);
    if (invoice.po_number) metaRows.push(["PO Number", invoice.po_number]);
    metaRows.push(["Invoice Date", fmtDate(invoice.invoice_date)]);
    if (invoice.due_date) metaRows.push(["Due Date", fmtDate(invoice.due_date)]);
    for (const [lbl, val] of metaRows) {
      T(lbl, RX - 220, ry + 8, 8, reg, GRAY);
      T(val, RX - TW(val, 8, bld), ry + 8, 8, bld);
      ry += 13;
    }

    // Status badge
    const statusLabel = invoice.invoice_status ? invoice.invoice_status.replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Draft";
    const sbW = TW(statusLabel, 8, bld) + 16;
    R(RX - sbW, ry + 2, sbW, 14, rgb(0.941, 0.996, 0.957));
    T(statusLabel, RX - sbW + 8, ry + 12, 8, bld, rgb(0.086, 0.627, 0.310));
    ry += 20;

    y = Math.max(y, ry) + 8;

    // Divider
    R(ML, y, CW, 2, DARK);
    y += 14;

    // Bill From / Bill To
    const COL2 = CW / 2;
    T("BILL FROM", ML, y + 8, 7, bld, GRAY);
    T("BILL TO (VENDOR)", ML + COL2 + 16, y + 8, 7, bld, GRAY);
    y += 14;

    T(coName, ML, y + 10, 10, bld);
    y += 14;
    if (co.gst_number) { T(`GST: ${co.gst_number}`, ML, y + 9, 8, reg, GRAY); y += 12; }
    if (co.pan) { T(`PAN: ${co.pan}`, ML, y + 9, 8, reg, GRAY); y += 12; }
    if (co.cin) { T(`CIN: ${co.cin}`, ML, y + 9, 8, reg, GRAY); y += 12; }

    let toY = y - 14 * 3 - 14;
    const toX = ML + COL2 + 16;
    T(trunc(vendor.legal_name, 32), toX, toY + 10, 10, bld);
    toY += 14;
    if (vendor.address) { T(trunc(vendor.address, 38), toX, toY + 9, 8, reg, GRAY); toY += 12; }
    if (vendor.gst_number) { T(`GST: ${vendor.gst_number}`, toX, toY + 9, 8, reg, GRAY); toY += 12; }
    if (vendor.pan_number) { T(`PAN: ${vendor.pan_number}`, toX, toY + 9, 8, reg, GRAY); toY += 12; }
    if (vendor.email) { T(`Email: ${vendor.email}`, toX, toY + 9, 8, reg, GRAY); toY += 12; }
    if (vendor.phone) { T(`Phone: ${vendor.phone}`, toX, toY + 9, 8, reg, GRAY); toY += 12; }

    y = Math.max(y, toY) + 14;

    // Line Items Table
    T("LINE ITEMS", ML, y + 8, 7, bld, GRAY);
    y += 14;

    const cols = ["Description", "HSN/SAC", "Qty", "Rate", "Taxable", "SGST", "CGST", "IGST", "Total"];
    const colWidths = [150, 50, 35, 50, 55, 45, 45, 45, 55];
    let xPos = ML;

    R(ML, y, CW, 18, LGRAY);
    for (let i = 0; i < cols.length; i++) {
      T(cols[i], xPos + 4, y + 13, 7, bld, GRAY);
      xPos += colWidths[i];
    }
    y += 18;

    for (const li of lineItems) {
      const taxable = (Number(li.quantity) || 0) * (Number(li.amount_per_unit) || 0);
      const vals = [
        trunc(li.description, 28),
        li.hsn_sac || "—",
        String(li.quantity),
        fmtAmt(li.amount_per_unit),
        fmtAmt(taxable),
        fmtAmt(li.sgst_amount),
        fmtAmt(li.cgst_amount),
        fmtAmt(li.igst_amount),
        fmtAmt(li.total_amount),
      ];
      xPos = ML;
      R(ML, y, CW, 16, BGFAINT);
      for (let i = 0; i < vals.length; i++) {
        T(vals[i], xPos + 4, y + 11, 7, reg, DARK);
        xPos += colWidths[i];
      }
      L(ML, y + 16, RX, y + 16, 0.4, rgb(0.94, 0.95, 0.97));
      y += 16;
    }

    y += 8;

    // Totals
    const totalStr = `Rs. ${fmtAmt(invoice.grand_total)}`;
    R(ML, y, CW, 22, DARK);
    T("GRAND TOTAL", ML + 8, y + 16, 11, bld, WHITE);
    T(totalStr, RX - TW(totalStr, 13, bld) - 8, y + 16, 13, bld, WHITE);
    y += 22;

    if (Number(invoice.total_paid) > 0) {
      y += 8;
      const paidStr = `Rs. ${fmtAmt(invoice.total_paid)}`;
      R(ML, y, CW, 16, rgb(0.941, 0.996, 0.957));
      T("Total Paid", ML + 8, y + 12, 9, bld, rgb(0.086, 0.627, 0.310));
      T(paidStr, RX - TW(paidStr, 9, bld) - 8, y + 12, 9, bld, rgb(0.086, 0.627, 0.310));
      y += 16;

      const pending = Number(invoice.grand_total) - Number(invoice.total_paid);
      if (pending > 0) {
        const pendStr = `Rs. ${fmtAmt(pending)}`;
        R(ML, y, CW, 16, rgb(1.0, 0.929, 0.902));
        T("Pending Amount", ML + 8, y + 12, 9, bld, rgb(0.914, 0.353, 0.078));
        T(pendStr, RX - TW(pendStr, 9, bld) - 8, y + 12, 9, bld, rgb(0.914, 0.353, 0.078));
        y += 16;
      }
    }

    // Payments
    if (payments.length > 0) {
      y += 14;
      T("PAYMENTS", ML, y + 8, 7, bld, GRAY);
      y += 14;

      const pCols = ["Code", "Date", "Mode", "Amount", "Status"];
      const pWidths = [80, 70, 80, 70, 70];
      R(ML, y, CW, 16, LGRAY);
      xPos = ML;
      for (let i = 0; i < pCols.length; i++) {
        T(pCols[i], xPos + 4, y + 12, 7, bld, GRAY);
        xPos += pWidths[i];
      }
      y += 16;

      for (const pay of payments) {
        const pVals = [
          pay.payment_id_code || "—",
          fmtDate(pay.payment_date),
          (pay.payment_mode || "—").replace("_", " "),
          fmtAmt(pay.amount_paid),
          (pay.payment_status || "—").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        ];
        xPos = ML;
        R(ML, y, CW, 14, BGFAINT);
        for (let i = 0; i < pVals.length; i++) {
          T(pVals[i], xPos + 4, y + 10, 7, reg, DARK);
          xPos += pWidths[i];
        }
        L(ML, y + 14, RX, y + 14, 0.4, rgb(0.94, 0.95, 0.97));
        y += 14;
      }
    }

    // Footer
    y += 14;
    L(ML, y, RX, y, 0.5, LGRAY);
    y += 10;
    T("This is a computer-generated invoice.", ML, y + 8, 7.5, reg, GRAY);
    const genStr = `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
    T(genStr, RX - TW(genStr, 7), y + 8, 7, reg, rgb(0.78, 0.82, 0.87));

    const pdfBytes = await pdfDoc.save();
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
    const pdf_base64 = btoa(binary);

    return new Response(JSON.stringify({ success: true, pdf_base64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin-generate-finance-invoice-pdf error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
