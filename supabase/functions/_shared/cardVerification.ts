/**
 * Shared credit card verification logic.
 *
 * Used by both poll-stale-payments and save-transaction-status so that the
 * card verification gate is enforced regardless of whether a payment is
 * resolved via the cron poller or the gateway webhook.
 *
 * Returns `{ held: true }` if the payment was held for card verification,
 * `{ refunded: true }` if the payment was refunded, or `{ proceed: true }`
 * if the payment should continue to normal settlement/KYC processing.
 */

const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function formatCurrency(v: number | string): string {
  return `₹${parseFloat(String(v)).toFixed(2)}`;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  btnText?: string,
  btnLink?: string,
) {
  try {
    await fetch(`${SUPABASE_URL()}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        body,
        body_type: "html",
        use_template: true,
        ...(btnText && btnLink
          ? { button_text: btnText, button_link: btnLink }
          : {}),
      }),
    });
  } catch (e) {
    console.error("cardVerification sendEmail error:", e);
  }
}

async function refundPaymentForCardVerification(
  supabase: any,
  payment: any,
  reason: string,
) {
  const now = new Date().toISOString();
  await supabase.from("payments").update({
    status: "refunded",
    failure_reason: reason,
    card_verification_status: "rejected",
    updated_at: now,
  }).eq("id", payment.id);

  await supabase.from("payment_logs").insert({
    payment_id: payment.id,
    status: "refunded",
    message: `Payment refunded: ${reason}`,
    metadata: { reason, source: "card_verification_check" },
  });

  try {
    await fetch(`${SUPABASE_URL()}/functions/v1/admin-gateway-refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY()}`,
      },
      body: JSON.stringify({ paymentId: payment.id, reason }),
    });
  } catch (e) {
    console.error("Gateway refund failed:", e);
  }

  EdgeRuntime.waitUntil(
    (async () => {
      const { data: user } = await supabase
        .from("users")
        .select("email, first_name, last_name")
        .eq("id", payment.user_id)
        .maybeSingle();
      if (user?.email) {
        await sendEmail(
          user.email,
          `Payment Refunded – Card Verification – Ref: ${payment.payment_reference}`,
          `<p>Dear ${user.first_name} ${user.last_name},</p>
           <p>Your payment of ${formatCurrency(payment.amount)} has been refunded.</p>
           <p><strong>Reason:</strong> ${reason}</p>
           <p>The refund will be processed back to your original payment method.</p>`,
        );
      }
    })(),
  );
}

async function sendCardVerificationEmail(
  supabase: any,
  payment: any,
  deadline: Date,
) {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("email, first_name, last_name")
      .eq("id", payment.user_id)
      .maybeSingle();
    if (!user?.email) return;

    const appUrl = (Deno.env.get("APP_URL") || "https://paybycard.in").trim();
    const deadlineStr = deadline.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

    await sendEmail(
      user.email,
      `Action Required: Verify Your Card – Ref: ${payment.payment_reference}`,
      `<p>Dear ${user.first_name} ${user.last_name},</p>
       <p>Your payment of <strong>${formatCurrency(payment.amount)}</strong> is on hold pending credit card verification.</p>
       <p>Please upload your card photos from the <strong>My Cards</strong> section in your dashboard.</p>
       <p><strong>Deadline:</strong> ${deadlineStr}</p>
       <p style="color:#d97706;font-weight:600;">If card verification is not completed within 12 hours, the payment will be refunded.</p>`,
      "Verify Card Now",
      `${appUrl}/dashboard/my-cards`,
    );
  } catch (e) {
    console.error("sendCardVerificationEmail error:", e);
  }
}

export interface CardVerificationResult {
  held: boolean;
  refunded: boolean;
  proceed: boolean;
}

/**
 * Runs the card verification gate for a successful payment.
 *
 * Caller must ensure `save-card-details` has already been called so that
 * `payment.card_last_four` is populated.
 *
 * @param supabase  Supabase client with service role
 * @param payment   The payment record (must have id, user_id, card_last_four,
 *                  payment_reference, amount)
 * @param gatewayResponse  Optional gateway response to store in the payment update
 * @returns  `{ held, refunded, proceed }` — exactly one is true
 */
export async function checkCardVerification(
  supabase: any,
  payment: any,
  gatewayResponse?: any,
): Promise<CardVerificationResult> {
  const { data: settings } = await supabase
    .from("master_settings")
    .select("enable_credit_card_verification, enable_third_party_card_usage")
    .limit(1)
    .maybeSingle();

  const cardVerificationEnabled =
    settings?.enable_credit_card_verification === true;
  const thirdPartyAllowed =
    settings?.enable_third_party_card_usage === true;

  if (!cardVerificationEnabled || !payment.card_last_four) {
    return { held: false, refunded: false, proceed: true };
  }

  const { data: userCard } = await supabase
    .from("user_cards")
    .select("id, status, card_verification_deadline")
    .eq("user_id", payment.user_id)
    .eq("card_last_four", payment.card_last_four)
    .maybeSingle();

  if (!userCard) {
    return { held: false, refunded: false, proceed: true };
  }

  // Link payment to card if not already linked
  const { data: existingLink } = await supabase
    .from("card_payment_links")
    .select("id")
    .eq("payment_id", payment.id)
    .maybeSingle();

  if (!existingLink) {
    await supabase.from("card_payment_links").insert({
      payment_id: payment.id,
      user_card_id: userCard.id,
      user_id: payment.user_id,
      verification_status: userCard.status,
    });
  }

  const cardStatus = userCard.status;

  // Check 1: Third party card when not allowed → refund
  if (cardStatus === "third_party" && !thirdPartyAllowed) {
    await refundPaymentForCardVerification(
      supabase,
      payment,
      "Third party card usage is not allowed",
    );
    return { held: false, refunded: true, proceed: false };
  }

  // Check 2: Card not yet verified or was rejected → hold for verification
  if (
    cardStatus === "not_submitted" || cardStatus === "submitted" ||
    cardStatus === "rejected"
  ) {
    const now = new Date();
    const deadline = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    if (!userCard.card_verification_deadline || cardStatus === "rejected") {
      await supabase.from("user_cards").update({
        card_verification_deadline: deadline.toISOString(),
        status: "not_submitted",
        updated_at: now.toISOString(),
      }).eq("id", userCard.id);
    } else {
      const existingDeadline = new Date(userCard.card_verification_deadline);
      if (existingDeadline < now) {
        await refundPaymentForCardVerification(
          supabase,
          payment,
          "Card verification deadline expired (12 hours)",
        );
        return { held: false, refunded: true, proceed: false };
      }
    }

    const updateData: any = {
      status: "card_verification_pending",
      card_verification_status: cardStatus,
      updated_at: now.toISOString(),
    };
    if (gatewayResponse) updateData.gateway_response = gatewayResponse;

    await supabase.from("payments").update(updateData).eq("id", payment.id);

    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: "card_verification_pending",
      message:
        `Payment held for card verification. Card status: ${cardStatus}. Deadline: ${deadline.toISOString()}`,
      metadata: {
        card_id: userCard.id,
        card_status: cardStatus,
        deadline: deadline.toISOString(),
      },
    });

    EdgeRuntime.waitUntil(
      sendCardVerificationEmail(supabase, payment, deadline),
    );
    return { held: true, refunded: false, proceed: false };
  }

  // Check 3: Card verified or third party allowed → proceed
  return { held: false, refunded: false, proceed: true };
}
