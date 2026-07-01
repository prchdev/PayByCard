import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_AMOUNT = 1_000_000;
const MIN_AMOUNT = 1;
const MAX_STR = 500;

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      userId,
      beneficiaryId,
      businessCategoryId,
      paymentOptionId,
      gatewayId,
      cardType,
      amount,
      charges,
      gst,
      discount,
      totalAmount,
      billFileUrl,
      ipAddress,
      beneficiaryDetails,
      categoryDetails,
      paymentOptionDetails,
    } = await req.json();

    // ── Authenticate: verify userId exists in public.users ───────────────────
    if (!userId) return err("Unauthorized: userId is required", 401);
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id, is_disabled")
      .eq("id", userId)
      .maybeSingle();
    if (userErr || !userRow) return err("Unauthorized", 401);
    if (userRow.is_disabled) return err("Account is disabled", 403);

    if (!beneficiaryId || !paymentOptionId || !gatewayId || !cardType || !amount || !totalAmount) {
      return err("Required fields are missing");
    }

    // ── Input validation ──────────────────────────────────────────────────────
    const parsedAmount = parseFloat(amount);
    const parsedTotal  = parseFloat(totalAmount);
    if (isNaN(parsedAmount) || parsedAmount < MIN_AMOUNT || parsedAmount > MAX_AMOUNT) {
      return err(`Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}`);
    }
    if (isNaN(parsedTotal) || parsedTotal < MIN_AMOUNT || parsedTotal > MAX_AMOUNT * 1.5) {
      return err("Invalid total amount");
    }
    const parsedCharges = parseFloat(charges || 0);
    const parsedGst = parseFloat(gst || 0);
    const parsedDiscount = parseFloat(discount || 0);
    if (isNaN(parsedCharges) || parsedCharges < 0) return err("Charges must be a non-negative number");
    if (isNaN(parsedGst) || parsedGst < 0) return err("GST must be a non-negative number");
    if (isNaN(parsedDiscount) || parsedDiscount < 0) return err("Discount must be a non-negative number");
    if (billFileUrl && typeof billFileUrl === "string" && billFileUrl.length > MAX_STR) {
      return err("billFileUrl too long");
    }
    // Ensure nested details are plain objects, not arrays or primitives
    for (const [key, val] of [["beneficiaryDetails", beneficiaryDetails], ["categoryDetails", categoryDetails], ["paymentOptionDetails", paymentOptionDetails]] as const) {
      if (val !== null && val !== undefined && (typeof val !== "object" || Array.isArray(val))) {
        return err(`Invalid ${key}`);
      }
    }

    // ── Duplicate payment guard ───────────────────────────────────────────────
    // Detects double-submit within 30 s: same user + beneficiary + amount.
    const { data: isDuplicate } = await supabase.rpc("fn_check_recent_duplicate_payment", {
      p_user_id:        userId,
      p_beneficiary_id: beneficiaryId,
      p_amount:         parsedAmount,
      p_window_secs:    30,
    });
    if (isDuplicate) {
      return err("A duplicate payment was submitted within the last 30 seconds. Please wait before trying again.", 429);
    }

    const { data: gatewaySettings, error: gatewayError } = await supabase
      .from("payment_gateway_settings")
      .select("*")
      .eq("id", gatewayId)
      .maybeSingle();

    if (gatewayError || !gatewaySettings) {
      return new Response(
        JSON.stringify({ error: "Gateway not found or disabled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!gatewaySettings.is_enabled) {
      return new Response(
        JSON.stringify({ error: "Selected gateway is not enabled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allowedCards = determineAllowedCards(cardType);

    const paymentReference = await generatePaymentReference(supabase);

    const transactionSummary = {
      payment_reference: paymentReference,
      amount: parseFloat(amount),
      charges: parseFloat(charges || 0),
      gst: parseFloat(gst || 0),
      discount: parseFloat(discount || 0),
      total_amount: parseFloat(totalAmount),
      card_type: cardType,
      gateway_name: gatewaySettings.gateway_name,
      environment: gatewaySettings.environment,
      allowed_cards: allowedCards,
      initiated_at: new Date().toISOString(),
      ip_address: ipAddress || "unknown",
    };

    const validCardType = cardType ? extractSingleCardType(cardType) : null;
    // Normalize: "Testing"/"test" → "test", "Production"/"production" → "production"
    const rawEnv = (gatewaySettings.environment || "").toLowerCase();
    const normalizedEnvironment = rawEnv.startsWith("prod") ? "production" : "test";

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        beneficiary_id: beneficiaryId,
        business_category_id: businessCategoryId || null,
        payment_category_id: paymentOptionId,
        payment_gateway_id: gatewayId,
        payout_mode: gatewaySettings.payout_mode || null,
        card_type: validCardType,
        allowed_cards: allowedCards,
        gateway_environment: normalizedEnvironment,
        amount: parseFloat(amount),
        charges: parseFloat(charges || 0),
        gst: parseFloat(gst || 0),
        discount: parseFloat(discount || 0),
        total_amount: parseFloat(totalAmount),
        payment_reference: paymentReference,
        bill_file_url: billFileUrl || null,
        status: "pending",
        ip_address: ipAddress || "unknown",
        transaction_summary: transactionSummary,
        beneficiary_details: beneficiaryDetails || {},
        category_details: categoryDetails || {},
        selected_payment_option: paymentOptionDetails || {},
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      return new Response(
        JSON.stringify({
          error: "Failed to create payment",
          details: paymentError.message,
          code: paymentError.code,
          hint: paymentError.hint
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: logError } = await supabase
      .from("payment_logs")
      .insert({
        payment_id: payment.id,
        status: "pending",
        message: "Payment initiated",
        metadata: {
          user_id: userId,
          amount: amount,
          reference: paymentReference,
          gateway: gatewaySettings.gateway_name,
          environment: gatewaySettings.environment,
        },
      });

    if (logError) {
      console.error("Error creating payment log:", logError);
    }

    const gatewayConfig = await createGatewayPaymentConfig(
      gatewaySettings,
      payment,
      allowedCards,
      normalizedEnvironment
    );

    return new Response(
      JSON.stringify({
        success: true,
        payment: {
          id: payment.id,
          reference: paymentReference,
          amount: payment.amount,
          totalAmount: payment.total_amount,
          status: payment.status,
        },
        gatewayConfig: gatewayConfig,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Exception in initiate-payment:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function extractSingleCardType(cardTypeName: string): string | null {
  const normalized = cardTypeName.toLowerCase();
  if (normalized.includes('visa')) return 'visa';
  if (normalized.includes('master')) return 'mastercard';
  if (normalized.includes('rupay')) return 'rupay';
  if (normalized.includes('amex') || normalized.includes('american express')) return 'amex';
  if (normalized.includes('diners')) return 'diners';
  return null;
}

function determineAllowedCards(cardType: string): string[] {
  const lowerCardType = cardType.toLowerCase();

  if (lowerCardType.includes("visa") || lowerCardType.includes("master") || lowerCardType.includes("rupay")) {
    return ["visa", "mastercard", "rupay"];
  } else if (lowerCardType.includes("american express") || lowerCardType.includes("diners")) {
    return ["amex", "diners"];
  }

  return ["visa", "mastercard", "rupay", "amex", "diners"];
}

async function createGatewayPaymentConfig(
  gatewaySettings: any,
  payment: any,
  allowedCards: string[],
  environment: string
): Promise<any> {
  const gatewayName = gatewaySettings.gateway_name.toLowerCase();
  const isTestMode = environment === "test";
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-gateway-webhook`;

  const config = {
    gateway: gatewaySettings.gateway_name,
    environment: environment,
    allowedCards: allowedCards,
    amount: payment.total_amount,
    currency: "INR",
    orderId: payment.payment_reference,
    callbackUrl: callbackUrl,
  };

  switch (gatewayName) {
    case "razorpay": {
      const keyId = isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key;
      const keySecret = isTestMode ? gatewaySettings.test_api_secret : gatewaySettings.production_api_secret;

      if (!keyId || !keySecret) {
        throw new Error("Razorpay credentials not configured");
      }

      // Create Razorpay order
      const authString = btoa(`${keyId}:${keySecret}`);
      const orderData = {
        amount: Math.round(payment.total_amount * 100),
        currency: "INR",
        receipt: payment.payment_reference,
        notes: {
          payment_id: payment.id,
          user_id: payment.user_id
        }
      };

      const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`
        },
        body: JSON.stringify(orderData)
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error?.description || "Failed to create Razorpay order");
      }

      const orderResult = await orderResponse.json();

      // Razorpay card network filtering:
      // - Domestic/International card filtering is controlled at the merchant dashboard level
      // - To accept only Indian cards, disable "International Payments" in Razorpay Dashboard
      // - Checkout configuration only allows hiding methods, not filtering by card BIN/network
      // - Card type validation (Visa/Master/RuPay/Amex) happens at payment gateway

      const options: any = {
        key: keyId,
        amount: orderResult.amount,
        currency: orderResult.currency,
        name: "PayByCard",
        description: `Payment Reference: ${payment.payment_reference}`,
        order_id: orderResult.id,
        prefill: {
          name: "",
          email: "",
          contact: ""
        },
        theme: {
          color: "#2563eb"
        },
        modal: {
          ondismiss: function() {
            console.log('Checkout form closed');
          }
        }
      };

      return {
        ...config,
        keyId: keyId,
        sdkUrl: "https://checkout.razorpay.com/v1/checkout.js",
        options: options,
        cardType: payment.card_type
      };
    }

    case "cashfree": {
      const cashfreeApiUrl = isTestMode
        ? "https://sandbox.cashfree.com/pg/orders"
        : "https://api.cashfree.com/pg/orders";

      const clientId = isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key;
      const clientSecret = isTestMode ? gatewaySettings.test_api_secret : gatewaySettings.production_api_secret;

      if (!clientId || !clientSecret) {
        throw new Error("Cashfree credentials not configured");
      }

      const orderRequest: any = {
        order_id: payment.payment_reference,
        order_amount: parseFloat(payment.total_amount),
        order_currency: "INR",
        customer_details: {
          customer_id: payment.user_id,
          customer_phone: "9999999999"
        },
        order_meta: {
          return_url: callbackUrl,
        }
      };

      const orderResponse = await fetch(cashfreeApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-api-version": "2025-01-01"
        },
        body: JSON.stringify(orderRequest)
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.message || "Failed to create Cashfree order");
      }

      const orderData = await orderResponse.json();

      return {
        ...config,
        appId: clientId,
        environment: isTestMode ? "sandbox" : "production",
        sdkUrl: "https://sdk.cashfree.com/js/v3/cashfree.js",
        options: {
          paymentSessionId: orderData.payment_session_id,
          orderAmount: payment.total_amount,
          orderCurrency: "INR",
          returnUrl: callbackUrl,
          cardType: payment.card_type
        }
      };
    }

    case "payu": {
      const key = isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key;
      const salt = isTestMode ? gatewaySettings.test_api_secret : gatewaySettings.production_api_secret;

      // PayU hash format: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
      const hashString = `${key}|${payment.payment_reference}|${payment.total_amount}|Payment|Customer|customer@example.com|||||||||||${salt}`;

      const encoder = new TextEncoder();
      const data = encoder.encode(hashString);
      const hashBuffer = await crypto.subtle.digest('SHA-512', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Map card types to PayU's category names
      const payuCardCategories: string[] = [];
      allowedCards.forEach(card => {
        if (card === 'visa') payuCardCategories.push('CC');
        if (card === 'mastercard') payuCardCategories.push('CC');
        if (card === 'rupay') payuCardCategories.push('CC');
        if (card === 'amex') payuCardCategories.push('AMEX');
        if (card === 'diners') payuCardCategories.push('DINR');
      });

      // Remove duplicates
      const uniqueCategories = [...new Set(payuCardCategories)];

      return {
        ...config,
        merchantKey: key,
        sdkUrl: "https://jssdk.payu.in/bolt/bolt.min.js",
        options: {
          key: key,
          txnid: payment.payment_reference,
          amount: payment.total_amount,
          productinfo: "Payment",
          firstname: "Customer",
          email: "customer@example.com",
          phone: "9999999999",
          surl: callbackUrl,
          furl: callbackUrl,
          hash: hash,
          enforce_paymethod: uniqueCategories.join("|"),
        }
      };
    }

    case "ccavenue":
      return {
        ...config,
        merchantId: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
        sdkUrl: isTestMode
          ? "https://test.ccavenue.com/transaction/transaction.do"
          : "https://secure.ccavenue.com/transaction/transaction.do",
        options: {
          merchant_id: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
          order_id: payment.payment_reference,
          amount: payment.total_amount,
          currency: "INR",
          redirect_url: callbackUrl,
          cancel_url: callbackUrl,
          payment_option: "OPTCRDC",
          card_type: allowedCards.join(",")
        }
      };

    case "easebuzz":
      return {
        ...config,
        merchantKey: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
        sdkUrl: isTestMode
          ? "https://testpay.easebuzz.in/payment/v1/js/easebuzz-checkout.js"
          : "https://pay.easebuzz.in/payment/v1/js/easebuzz-checkout.js",
        options: {
          key: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
          txnid: payment.payment_reference,
          amount: payment.total_amount,
          productinfo: "Payment",
          firstname: "Customer",
          phone: "9999999999",
          email: "customer@example.com",
          surl: callbackUrl,
          furl: callbackUrl,
          show_payment_mode: "card",
          allowed_card_types: allowedCards.join(",")
        }
      };

    case "zaakpay":
      return {
        ...config,
        merchantId: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
        sdkUrl: isTestMode
          ? "https://zaakstaging.com/checkoutjs/checkoutPayment.js"
          : "https://api.zaakpay.com/checkoutjs/checkoutPayment.js",
        options: {
          merchantIdentifier: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
          orderId: payment.payment_reference,
          amount: payment.total_amount,
          currency: "INR",
          returnUrl: callbackUrl,
          paymentMode: "card",
          allowedCardTypes: allowedCards.join(",")
        }
      };

    case "enkash":
      return {
        ...config,
        apiKey: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
        sdkUrl: isTestMode
          ? "https://uat.enkash.com/sdk/enkash-checkout.js"
          : "https://api.enkash.com/sdk/enkash-checkout.js",
        options: {
          apiKey: isTestMode ? gatewaySettings.test_api_key : gatewaySettings.production_api_key,
          reference: payment.payment_reference,
          amount: payment.total_amount,
          callbackUrl: callbackUrl,
          paymentMethods: ["card"],
          allowedCardNetworks: allowedCards
        }
      };

    default:
      throw new Error(`Gateway ${gatewayName} not supported`);
  }
}

async function generatePaymentReference(supabase: any): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const reference = `PAY-${dateStr}-${randomNum}`;

    const { data } = await supabase
      .from("payments")
      .select("id")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!data) {
      return reference;
    }

    attempts++;
  }

  throw new Error("Failed to generate unique payment reference");
}
