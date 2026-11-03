import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-admin-session",
};

function tokenizeName(name: string): Set<string> {
  return new Set(
    name.toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  );
}

function nameMatchScore(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  const tokens1 = tokenizeName(name1);
  const tokens2 = tokenizeName(name2);
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let matches = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) matches++;
  }
  return matches / Math.max(tokens1.size, tokens2.size);
}

/**
 * admin-verify-card
 *
 * Admin action to approve, reject, or mark a card as third party.
 * Updates the card status, records the admin who reviewed it, and
 * updates all linked payments' card_verification_status.
 *
 * When a card is approved:
 *   - All pending payments linked to this card proceed to next step.
 *   - card_payment_links verification_status updated to "verified".
 * When a card is rejected:
 *   - All pending payments linked to this card are refunded.
 *   - card_payment_links verification_status updated to "rejected".
 * When marked as third party:
 *   - If third party usage is disabled, linked payments are refunded.
 *   - Otherwise, payments proceed to next step.
 */
serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { adminId, cardId, action, isThirdParty, rejectionReason, adminCardName } = body;

    if (!adminId || !cardId || !action) {
      return new Response(
        JSON.stringify({ error: "adminId, cardId, and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be 'approve' or 'reject'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "approve" && (!adminCardName || adminCardName.trim().length < 4)) {
      return new Response(
        JSON.stringify({ error: "Admin must enter the name on card (at least 4 characters) before approving" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin exists and has permission
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id, role, is_active")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin || !admin.is_active) {
      return new Response(
        JSON.stringify({ error: "Admin not found or inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the card
    const { data: card, error: cardErr } = await supabase
      .from("user_cards")
      .select("*")
      .eq("id", cardId)
      .maybeSingle();

    if (cardErr || !card) {
      return new Response(
        JSON.stringify({ error: "Card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();
    let newStatus: string;
    let cardNameUpdate: string | null = null;
    let matchScore: number | null = null;

    if (action === "approve") {
      newStatus = isThirdParty ? "third_party" : "verified";
      cardNameUpdate = adminCardName.trim();
      // Compute name match score against KYC name
      const { data: user } = await supabase
        .from("users")
        .select("first_name, middle_name, last_name")
        .eq("id", card.user_id)
        .maybeSingle();
      const kycName = user ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ").trim() : "";
      matchScore = nameMatchScore(cardNameUpdate, kycName);

      // Update ai_verification_result with admin-entered name and score
      const existingResult = card.ai_verification_result || {};
      const updatedResult = {
        ...existingResult,
        name_on_card: cardNameUpdate,
        kyc_name: kycName,
        name_match_score: matchScore,
        admin_entered_name: true,
        admin_verified_at: now,
      };
      await supabase.from("user_cards").update({
        status: newStatus,
        name_on_card: cardNameUpdate,
        admin_verified_by: adminId,
        admin_verified_at: now,
        admin_rejection_reason: null,
        ai_verification_result: updatedResult,
        updated_at: now,
      }).eq("id", cardId);
    } else {
      newStatus = "rejected";
      await supabase.from("user_cards").update({
        status: newStatus,
        admin_verified_by: adminId,
        admin_verified_at: now,
        admin_rejection_reason: rejectionReason || "Rejected by admin",
        updated_at: now,
      }).eq("id", cardId);
    }

    // Update card_payment_links
    await supabase.from("card_payment_links")
      .update({ verification_status: newStatus })
      .eq("user_card_id", cardId);

    // Fetch master settings to check third party usage
    const { data: settings } = await supabase
      .from("master_settings")
      .select("enable_third_party_card_usage")
      .limit(1)
      .maybeSingle();

    const thirdPartyAllowed = settings?.enable_third_party_card_usage === true;

    // Process linked payments
    const { data: links } = await supabase
      .from("card_payment_links")
      .select("payment_id")
      .eq("user_card_id", cardId);

    if (links && links.length > 0) {
      const paymentIds = links.map((l: any) => l.payment_id);

      if (action === "approve") {
        // If approved as third party but third party not allowed, refund
        if (newStatus === "third_party" && !thirdPartyAllowed) {
          await refundPayments(supabase, paymentIds, "Third party card usage is not allowed");
        } else {
          // Approve: update payments' card_verification_status, let poll-stale-payments proceed them
          await supabase.from("payments")
            .update({ card_verification_status: newStatus })
            .in("id", paymentIds);
        }
      } else if (action === "reject") {
        // Reject: refund all linked pending payments
        await refundPayments(supabase, paymentIds, rejectionReason || "Card verification rejected by admin");
      }
    }

    // Send rejection email to user with reason
    if (action === "reject") {
      EdgeRuntime.waitUntil(
        (async () => {
          const { data: user } = await supabase
            .from("users")
            .select("email, first_name, last_name")
            .eq("id", card.user_id)
            .maybeSingle();
          if (user?.email) {
            const appUrl = (Deno.env.get("APP_URL") || "https://paybycard.in").trim();
            const reasonText = rejectionReason || "Card verification rejected by admin";
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: user.email,
                subject: `Card Verification Rejected – Card ending in ${card.card_last_four}`,
                body: `<p>Dear ${user.first_name} ${user.last_name},</p>
                  <p>Your card verification for the card ending in <strong>${card.card_last_four}</strong> has been <strong>rejected</strong>.</p>
                  <p><strong>Reason:</strong> ${reasonText}</p>
                  <p>You can re-upload your card photos with the necessary corrections from the <strong>My Cards</strong> section in your dashboard.</p>`,
                body_type: "html",
                use_template: true,
                button_text: "Go to My Cards",
                button_link: `${appUrl}/dashboard/my-cards`,
              }),
            });
          }
        })()
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        cardId,
        newStatus,
        paymentsAffected: links?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("admin-verify-card error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function refundPayments(supabase: any, paymentIds: string[], reason: string) {
  // Get payments that are in card_verification_pending status
  const { data: payments } = await supabase
    .from("payments")
    .select("id, payment_reference, amount, user_id, status, payment_gateway_id, gateway_environment")
    .in("id", paymentIds)
    .in("status", ["card_verification_pending", "kyc_pending", "settlement_pending", "pending", "processing"]);

  if (!payments || payments.length === 0) return;

  const now = new Date().toISOString();

  for (const payment of payments) {
    // Update payment status to refunded
    await supabase.from("payments").update({
      status: "refunded",
      failure_reason: reason,
      card_verification_status: "rejected",
      updated_at: now,
    }).eq("id", payment.id);

    // Log the refund
    await supabase.from("payment_logs").insert({
      payment_id: payment.id,
      status: "refunded",
      message: `Payment refunded: ${reason}`,
      metadata: { reason, refunded_by: "card_verification_system" },
    });

    // Trigger actual refund via gateway
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/admin-gateway-refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          paymentId: payment.id,
          reason,
        }),
      });
    } catch (e) {
      console.error(`Refund failed for payment ${payment.id}:`, e);
    }

    // Send email notification
    try {
      const { data: user } = await supabase
        .from("users")
        .select("email, first_name, last_name")
        .eq("id", payment.user_id)
        .maybeSingle();

      if (user?.email) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: user.email,
            subject: `Payment Refunded – Card Verification Failed – Ref: ${payment.payment_reference}`,
            body: `<p>Dear ${user.first_name} ${user.last_name},</p>
              <p>Your payment of ₹${parseFloat(String(payment.amount)).toFixed(2)} has been refunded.</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <p>The refund will be processed back to your original payment method.</p>`,
            body_type: "html",
            use_template: true,
          }),
        });
      }
    } catch (e) {
      console.error("Email send error:", e);
    }
  }
}
