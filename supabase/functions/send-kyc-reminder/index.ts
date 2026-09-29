import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { serveUser } from "../_shared/session.ts";
/**
 * send-kyc-reminder
 *
 * Background job triggered every 6 hours via pg_cron.
 *
 * Finds merchant_onboarding records where:
 *   - status = 'pending' (merchant has not started KYC)
 *   - expires_at is still in the future (link not expired)
 *   - last_reminder_sent_at is null OR more than 6 hours ago
 *
 * For each eligible record:
 *   1. Sends a reminder email to the merchant/beneficiary with the KYC link,
 *      payment details, and expiry date/time.
 *   2. Sends an email to the sender user informing them that merchant KYC
 *      is still pending, with the expiry date/time.
 *   3. Updates last_reminder_sent_at to now.
 *
 * This does NOT modify payment status, merchant_onboarding status, or any
 * other existing data — it only sends emails and updates the tracking column.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = () => Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function fmtIN(date: Date): string {
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

function fmtMoney(v: number | string): string {
  return `₹${parseFloat(String(v)).toFixed(2)}`;
}

async function sendEmail(to: string, subject: string, body: string, buttonText?: string, buttonLink?: string) {
  try {
    await fetch(`${SUPABASE_URL()}/functions/v1/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        body,
        body_type: "html",
        use_template: true,
        ...(buttonText ? { button_text: buttonText } : {}),
        ...(buttonLink ? { button_link: buttonLink } : {}),
      }),
    });
  } catch (e) {
    console.error("sendEmail error:", e);
  }
}

serveUser(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startedAt = Date.now();
  const results: { id: string; action: string; error?: string }[] = [];

  try {
    const supabase = createClient(SUPABASE_URL(), SERVICE_ROLE_KEY());

    // Find pending merchant onboarding records where the link hasn't expired
    // and either no reminder has been sent or the last one was > 6 hours ago.
    const sixHoursAgo = new Date(Date.now() - REMINDER_INTERVAL_MS).toISOString();
    const now = new Date().toISOString();

    const { data: candidates, error: fetchErr } = await supabase
      .from("merchant_onboarding")
      .select("*")
      .eq("status", "pending")
      .gt("expires_at", now)
      .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${sixHoursAgo}`)
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);
    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending KYC reminders due", processed: 0, durationMs: Date.now() - startedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the base URL for the KYC link
    const siteUrl = "https://paybycard.in";

    for (const onboarding of candidates) {
      try {
        const kycLink = `${siteUrl}/merchant-onboarding?token=${onboarding.token}`;
        const expiryDate = new Date(onboarding.expires_at);
        const expiryFormatted = fmtIN(expiryDate);

        // Fetch payment details if payment_id exists
        let paymentInfo: { payment_reference?: string; amount?: string; category_name?: string } = {};
        if (onboarding.payment_id) {
          const { data: payment } = await supabase
            .from("payments")
            .select("payment_reference, amount, category_details")
            .eq("id", onboarding.payment_id)
            .maybeSingle();
          if (payment) {
            paymentInfo = {
              payment_reference: payment.payment_reference,
              amount: payment.amount,
              category_name: payment.category_details?.category_name || onboarding.category_name || "",
            };
          }
        }

        // Fetch sender user email
        let senderEmail: string | null = null;
        let senderName = onboarding.sender_name || "Sender";
        if (onboarding.payment_id) {
          const { data: payment } = await supabase
            .from("payments")
            .select("user_id")
            .eq("id", onboarding.payment_id)
            .maybeSingle();
          if (payment?.user_id) {
            const { data: user } = await supabase
              .from("users")
              .select("email, first_name, last_name")
              .eq("id", payment.user_id)
              .maybeSingle();
            if (user) {
              senderEmail = user.email;
              senderName = `${user.first_name} ${user.last_name}`.trim() || senderName;
            }
          }
        }

        const merchantName = onboarding.beneficiary_name || "Merchant";
        const merchantEmail = onboarding.email || null;
        const categoryName = paymentInfo.category_name || onboarding.category_name || "Payment";
        const paymentRef = paymentInfo.payment_reference || "N/A";
        const amount = paymentInfo.amount ? fmtMoney(paymentInfo.amount) : "N/A";

        // 1. Send reminder email to merchant/beneficiary
        if (merchantEmail) {
          const merchantSubject = `Action Required: Complete Your KYC – Payment ${paymentRef}`;
          const merchantBody = `
            <p>Dear ${merchantName},</p>
            <p>This is a reminder to complete your KYC verification. A payment of <strong>${amount}</strong>
            from <strong>${senderName}</strong> for <strong>${categoryName}</strong> is pending your KYC completion.</p>
            <p><strong>Payment Reference:</strong> ${paymentRef}</p>
            <p><strong>Amount:</strong> ${amount}</p>
            <p><strong>KYC Link Expiry:</strong> ${expiryFormatted}</p>
            <p>Please complete your KYC verification before the link expires to receive the payment.
            Click the button below to start the process.</p>
            <p style="color:#dc2626;font-weight:600;">If you do not complete KYC before the expiry time, the payment will be automatically refunded to the sender.</p>
          `;
          await sendEmail(merchantEmail, merchantSubject, merchantBody, "Complete KYC Now", kycLink);
        }

        // 2. Send email to sender user
        if (senderEmail) {
          const senderSubject = `Merchant KYC Pending – Payment ${paymentRef}`;
          const senderBody = `
            <p>Dear ${senderName},</p>
            <p>The beneficiary (<strong>${merchantName}</strong>) has not yet completed their KYC verification
            for the payment of <strong>${amount}</strong> (Reference: ${paymentRef}).</p>
            <p><strong>KYC Link Expiry:</strong> ${expiryFormatted}</p>
            <p>The beneficiary has been sent a reminder email with instructions to complete KYC.
            If the KYC is not completed before the expiry time, the payment will be automatically refunded to you.</p>
            <p style="color:#6b7280;font-size:13px;">No action is required from your end at this time.</p>
          `;
          await sendEmail(senderEmail, senderSubject, senderBody);
        }

        // 3. Update last_reminder_sent_at
        await supabase
          .from("merchant_onboarding")
          .update({ last_reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", onboarding.id);

        results.push({ id: onboarding.id, action: "reminder_sent" });
      } catch (err: any) {
        console.error(`Error sending reminder for onboarding ${onboarding.id}:`, err);
        results.push({ id: onboarding.id, action: "error", error: err?.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results, durationMs: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-kyc-reminder fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// redeploy
// redeploy-1790387697
