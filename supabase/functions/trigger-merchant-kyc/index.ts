import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = () => Deno.env.get("SUPABASE_ANON_KEY")!;

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  buttonText?: string,
  buttonLink?: string,
  cc?: string,
) {
  try {
    await fetch(`${SUPABASE_URL()}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ANON_KEY()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to, subject, body, body_type: "html", use_template: true,
        ...(cc ? { cc } : {}),
        ...(buttonText && buttonLink ? { button_text: buttonText, button_link: buttonLink } : {}),
      }),
    });
  } catch (err) {
    console.error("Email send error:", err);
  }
}

function formatCurrency(amount: number | string): string {
  return `₹${parseFloat(String(amount)).toFixed(2)}`;
}

function receiptTable(rows: [string, string][]): string {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;font-size:14px;text-align:right;">${value}</td>
    </tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin:16px 0;">${rowsHtml}</table>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { paymentId } = await req.json();

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: "paymentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL(), SERVICE_KEY());

    // Fetch the full payment record
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (payError || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify KYC is actually required for this payment
    const kycRequired = payment.category_details?.receiver_kyc_required === true ||
      payment.selected_payment_option?.receiver_kyc_required === true;
    if (!kycRequired) {
      return new Response(
        JSON.stringify({ error: "Merchant KYC is not required for this payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if beneficiary is already a verified merchant
    const isVerifiedMerchant = payment.beneficiary_details?.is_verified_merchant === true;
    if (isVerifiedMerchant) {
      return new Response(
        JSON.stringify({ message: "Beneficiary is already a verified merchant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update payment status to kyc_pending (service role bypasses the guard trigger)
    if (payment.status !== "kyc_pending") {
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "kyc_pending", updated_at: new Date().toISOString() })
        .eq("id", paymentId);

      if (updateError) {
        console.error("Failed to update payment status:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update payment status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("payment_logs").insert({
        payment_id: paymentId,
        status: "kyc_pending",
        message: "Payment status changed to kyc_pending to trigger merchant KYC flow.",
        metadata: { triggered_by: "trigger-merchant-kyc" },
      });
    }

    // ── Send KYC email and SMS to the beneficiary ──────────────────────────
    const beneficiaryDetails = payment.beneficiary_details || {};
    const receiverName = beneficiaryDetails.full_name || "Beneficiary";
    const receiverEmail = beneficiaryDetails.email;
    const receiverMobile = beneficiaryDetails.mobile || "";

    // Fetch sender name
    const { data: senderUser } = await supabase
      .from("users")
      .select("first_name, last_name, middle_name, email")
      .eq("id", payment.user_id)
      .maybeSingle();
    const senderName = senderUser
      ? [senderUser.first_name, senderUser.middle_name, senderUser.last_name].filter(Boolean).join(" ").trim()
      : "Sender";
    const senderEmail = senderUser?.email || undefined;

    const categoryName = payment.category_details?.category_name || "Payment";
    const refundHours = payment.category_details?.refund_after_hours || 48;
    const expiryHours = refundHours ? Number(refundHours) : 72;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

    const token = crypto.randomUUID();

    // Check for existing pending onboarding record
    const { data: existing } = await supabase
      .from("merchant_onboarding")
      .select("id, token")
      .eq("payment_id", payment.id)
      .in("status", ["pending", "submitted"])
      .maybeSingle();

    let onboardingToken = token;

    if (existing) {
      onboardingToken = existing.token;
    } else {
      const { error: insertErr } = await supabase
        .from("merchant_onboarding")
        .insert({
          payment_id: payment.id,
          beneficiary_id: payment.beneficiary_id || null,
          full_name: receiverName,
          email: receiverEmail || "",
          mobile: receiverMobile,
          sender_name: senderName,
          category_name: categoryName,
          token: token,
          status: "pending",
          expires_at: expiresAt,
        });

      if (insertErr) {
        console.error("Failed to create merchant_onboarding record:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to create merchant onboarding record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const appUrl = (Deno.env.get("APP_URL") || "https://paybycard.in").trim();
    const onboardingLink = `${appUrl}/merchant-onboarding?token=${onboardingToken}`;

    const refundNote = `<p style="color:#d97706;font-weight:600;margin-top:16px;">Note: If KYC is not completed within ${refundHours} hours, the payment will be refunded to the sender after deducting convenience charges.</p>`;

    // Send email to beneficiary
    if (receiverEmail) {
      const kycBody = `
        <p>Dear ${receiverName},</p>
        <p>A payment of <strong>${formatCurrency(payment.amount)}</strong> has been initiated for you by <strong>${senderName}</strong>. To receive the funds in your bank account, you must complete your <strong>Merchant KYC / Merchant Onboarding</strong> verification.</p>
        ${receiptTable([
          ["Payment Reference", payment.payment_reference || "N/A"],
          ["Amount to Receive", formatCurrency(payment.amount)],
          ["Category", categoryName],
          ["Link Expires", new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })],
        ])}
        <p>Click the button below to complete your KYC verification and receive your payment.</p>
        <p style="color:#6b7280;font-size:13px;margin-top:8px;">Or copy this link: <a href="${onboardingLink}" style="color:#2563eb;">${onboardingLink}</a></p>
        ${refundNote}
        <p style="color:#6b7280;font-size:13px;margin-top:16px;">Merchant KYC collection is carried out in accordance with applicable RBI guidelines. We maintain the confidentiality of merchant information and <strong>do not share it with the Income Tax Department</strong> or any other government agency, except where disclosure is required by applicable law or a lawful order.</p>
        <p style="color:#6b7280;font-size:13px;margin-top:20px;">If you have already submitted your KYC, please wait for verification. Contact our support team if you need assistance.</p>
      `;
      await sendEmail(
        receiverEmail,
        `Action Required: Complete KYC to Receive Payment – Ref: ${payment.payment_reference || "N/A"}`,
        kycBody,
        "Complete KYC Verification",
        onboardingLink,
        senderEmail,
      );
    }

    // Send SMS to beneficiary
    if (receiverMobile) {
      try {
        await fetch(`${SUPABASE_URL()}/functions/v1/send-sms`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SERVICE_KEY()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mobile: receiverMobile,
            message: "",
            message_type: "merchant_onboarding",
            variables: { var1: onboardingToken },
          }),
        });
      } catch (smsErr) {
        console.error("SMS send error:", smsErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Merchant KYC triggered successfully",
        payment_id: paymentId,
        onboarding_token: onboardingToken,
        email_sent: !!receiverEmail,
        sms_sent: !!receiverMobile,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Exception in trigger-merchant-kyc:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
