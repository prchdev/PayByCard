import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { isInternalCall, unauthorized } from "../_shared/session.ts";
import { decryptGateway, getGatewayEncryptionKey } from "../_shared/gatewayCredentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

/**
 * save-card-details
 *
 * Internal-only endpoint called after a payment gateway returns a successful
 * transaction status. Extracts card payment method details (last 4, network,
 * bank name, card type, card id, auth code) from the gateway response and
 * saves them to the payments table and the user_cards table.
 *
 * Called by save-transaction-status, check-payment-status, and
 * poll-stale-payments after a successful gateway poll.
 */

interface CardDetails {
  card_last_four: string | null;
  card_network: string | null;
  card_type: string | null;
  bank_name: string | null;
  card_id: string | null;
  auth_code: string | null;
  name_on_card: string | null;
}

function extractCardDetails(gatewayName: string | undefined, gatewayResponse: any): CardDetails {
  const details: CardDetails = {
    card_last_four: null,
    card_network: null,
    card_type: null,
    bank_name: null,
    card_id: null,
    auth_code: null,
    name_on_card: null,
  };

  if (!gatewayResponse) return details;
  const gw = gatewayName?.toLowerCase();

  // Razorpay: payment object has card entity
  if (gw === "razorpay") {
    const card = gatewayResponse?.payment?.card ?? gatewayResponse?.card;
    if (card) {
      details.card_last_four = card.last4 ?? null;
      details.card_network = card.network ?? card.card_network ?? null;
      details.card_type = card.type ?? card.card_type ?? null;
      details.bank_name = card.issuer ?? card.issuing_bank ?? null;
      details.card_id = card.id ?? null;
    }
    // Auth code might be in payment object
    const authCode = gatewayResponse?.payment?.auth_code ?? gatewayResponse?.auth_code;
    if (authCode) details.auth_code = String(authCode);
    // Name on card
    const name = gatewayResponse?.payment?.name_on_card ?? gatewayResponse?.name_on_card;
    if (name) details.name_on_card = name;
  }

  // CashFree: order response has payment details
  if (gw === "cashfree") {
    const payments = gatewayResponse?.payments ?? gatewayResponse?.payment_details;
    if (Array.isArray(payments) && payments.length > 0) {
      const pmt = payments.find((p: any) => p.payment_group === "upi") ?? payments[0];
      const card = pmt?.card;
      if (card) {
        details.card_last_four = card.card_number?.slice(-4) ?? card.last4 ?? null;
        details.card_network = card.card_network ?? card.network ?? null;
        details.card_type = card.card_type ?? card.type ?? null;
        details.bank_name = card.card_issuer ?? card.issuer ?? null;
        details.card_id = card.card_id ?? null;
      }
      if (pmt?.auth_code) details.auth_code = String(pmt.auth_code);
    }
    // CF order_status PAID response
    const orderCard = gatewayResponse?.order_meta;
    if (!details.card_last_four && orderCard) {
      details.card_last_four = orderCard.card_last4 ?? null;
    }
  }

  // PayU: transaction_details has card details
  if (gw === "payu") {
    const txnKey = Object.keys(gatewayResponse?.transaction_details ?? {})[0];
    const txn = txnKey ? gatewayResponse.transaction_details[txnKey] : null;
    if (txn) {
      details.card_last_four = txn.card_no?.slice(-4) ?? null;
      details.card_network = txn.card_type ? mapPayuCardType(txn.card_type) : null;
      details.bank_name = txn.bank_ref_num ? txn.issuing_bank ?? null : null;
      if (txn.mode === "CC") details.card_type = "credit_card";
      if (txn.mode === "DC") details.card_type = "debit_card";
      if (txn.txn_auth_code) details.auth_code = String(txn.txn_auth_code);
    }
  }

  // EaseBuzz
  if (gw === "easebuzz") {
    const data = gatewayResponse?.data ?? gatewayResponse;
    details.card_last_four = data?.card_no?.slice(-4) ?? data?.card_last4 ?? null;
    details.card_network = data?.card_type ? mapEasebuzzCardType(data.card_type) : null;
    details.bank_name = data?.bank_name ?? null;
    if (data?.mode === "credit") details.card_type = "credit_card";
    if (data?.mode === "debit") details.card_type = "debit_card";
  }

  // PhonePe
  if (gw === "phonepe") {
    const data = gatewayResponse?.data;
    if (data?.paymentInstrument) {
      const pi = data.paymentInstrument;
      if (pi.type === "CARD") {
        details.card_last_four = pi.cardLast4Digits ?? pi.card_last_4 ?? null;
        details.card_network = pi.cardNetwork ?? pi.card_network ?? null;
        details.card_type = pi.cardType ?? pi.card_type ?? null;
        details.bank_name = pi.issuerBank ?? pi.issuer_bank ?? null;
        details.card_id = pi.cardToken ?? pi.card_token ?? null;
      }
    }
  }

  return details;
}

function mapPayuCardType(type: string): string | null {
  const t = type.toLowerCase();
  if (t.includes("visa")) return "visa";
  if (t.includes("master")) return "mastercard";
  if (t.includes("rupay")) return "rupay";
  if (t.includes("amex") || t.includes("american")) return "amex";
  if (t.includes("diners")) return "diners";
  if (t.includes("maestro")) return "maestro";
  return type;
}

function mapEasebuzzCardType(type: string): string | null {
  const t = type.toLowerCase();
  if (t.includes("visa")) return "visa";
  if (t.includes("master")) return "mastercard";
  if (t.includes("rupay")) return "rupay";
  if (t.includes("amex")) return "amex";
  return type;
}

/**
 * When the gateway response from a Razorpay client callback only contains
 * razorpay_payment_id / razorpay_order_id (no card entity), fetch the full
 * payment object from the Razorpay API to extract card details.
 */
async function fetchRazorpayCardDetails(
  supabase: any,
  paymentId: string,
  razorpayPaymentId: string,
): Promise<CardDetails | null> {
  const { data: payment } = await supabase
    .from("payments")
    .select("*, payment_gateway_settings(*)")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment?.payment_gateway_settings) return null;

  const encryptionKey = await getGatewayEncryptionKey(supabase);
  const gateway = await decryptGateway(payment.payment_gateway_settings, encryptionKey);
  const isTestMode = payment.gateway_environment === "test";
  const keyId = isTestMode ? gateway.test_api_key : gateway.production_api_key;
  const keySecret = isTestMode ? gateway.test_api_secret : gateway.production_api_secret;

  if (!keyId || !keySecret) return null;

  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();

  if (!data || data.error) return null;

  const card = data.card;
  if (!card) return null;

  return {
    card_last_four: card.last4 ?? null,
    card_network: card.network ?? null,
    card_type: card.type ?? null,
    bank_name: card.issuer ?? null,
    card_id: card.id ?? null,
    auth_code: data.auth_code ? String(data.auth_code) : null,
    name_on_card: data.name_on_card ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!isInternalCall(req)) {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const { paymentId, userId, gatewayName, gatewayResponse } = body;

    if (!paymentId || !userId) {
      return new Response(
        JSON.stringify({ error: "paymentId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let card = extractCardDetails(gatewayName, gatewayResponse);

    // If no card details were found in the gateway response (common with
    // Razorpay client callbacks that only carry IDs), try fetching from the
    // Razorpay API using the payment_id from the gateway response.
    if (!card.card_last_four && !card.card_network && !card.bank_name) {
      const razorpayPaymentId =
        gatewayResponse?.razorpay_payment_id ??
        (typeof gatewayResponse === "object" && gatewayResponse?.id?.startsWith("pay_") ? gatewayResponse.id : null);
      if (razorpayPaymentId) {
        try {
          const fetched = await fetchRazorpayCardDetails(supabase, paymentId, razorpayPaymentId);
          if (fetched) card = fetched;
        } catch (e) {
          console.error("fetchRazorpayCardDetails fallback failed:", e);
        }
      }
    }

    // Only proceed if we found card-related data
    if (!card.card_last_four && !card.card_network && !card.bank_name) {
      return new Response(
        JSON.stringify({ success: true, message: "No card details found in gateway response", card: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update payment record with card details
    await supabase.from("payments").update({
      card_last_four: card.card_last_four,
      card_network: card.card_network,
      card_bank_name: card.bank_name,
      card_id: card.card_id,
      card_auth_code: card.auth_code,
      card_name_on_card: card.name_on_card,
      card_type: card.card_type || undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);

    // Create or update user_cards entry (unique per user + last 4)
    if (card.card_last_four) {
      const { data: existingCard } = await supabase
        .from("user_cards")
        .select("id, status")
        .eq("user_id", userId)
        .eq("card_last_four", card.card_last_four)
        .maybeSingle();

      if (existingCard) {
        // Update existing card with any new gateway info
        await supabase.from("user_cards").update({
          card_network: card.card_network ?? undefined,
          card_type: card.card_type ?? undefined,
          bank_name: card.bank_name ?? undefined,
          card_id: card.card_id ?? undefined,
          auth_code: card.auth_code ?? undefined,
          updated_at: new Date().toISOString(),
        }).eq("id", existingCard.id);
      } else {
        // Create new card entry with status not_submitted
        await supabase.from("user_cards").insert({
          user_id: userId,
          card_last_four: card.card_last_four,
          card_network: card.card_network,
          card_type: card.card_type,
          bank_name: card.bank_name,
          card_id: card.card_id,
          auth_code: card.auth_code,
          status: "not_submitted",
        });
      }

      // Link payment to card
      const { data: userCard } = await supabase
        .from("user_cards")
        .select("id, status")
        .eq("user_id", userId)
        .eq("card_last_four", card.card_last_four)
        .maybeSingle();

      if (userCard) {
        const { data: existingLink } = await supabase
          .from("card_payment_links")
          .select("id")
          .eq("payment_id", paymentId)
          .maybeSingle();

        if (!existingLink) {
          await supabase.from("card_payment_links").insert({
            payment_id: paymentId,
            user_card_id: userCard.id,
            user_id: userId,
            verification_status: userCard.status,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, card }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("save-card-details error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
