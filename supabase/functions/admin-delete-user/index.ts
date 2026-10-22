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
    const { adminId, userId } = await req.json();

    if (!adminId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user exists
    const { data: user } = await supabase
      .from("users")
      .select("id, email, mobile_number")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Collect payment IDs before deletion (for merchant_onboarding cleanup)
    const { data: userPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", userId);

    const paymentIds = (userPayments ?? []).map((p) => p.id);

    // Collect support ticket IDs before deletion (for storage cleanup)
    const { data: userTickets } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("user_id", userId);

    const ticketIds = (userTickets ?? []).map((t) => t.id);

    // 1. Delete from transactions (RESTRICT FK — must happen before user deletion)
    await supabase.from("transactions").delete().eq("user_id", userId);

    // 2. Delete from tables without FK constraints to users
    await Promise.all([
      supabase.from("mobile_notifications").delete().eq("user_id", userId),
      supabase.from("mobile_notification_logs").delete().eq("user_id", userId),
      supabase.from("coupon_usages").delete().eq("user_id", userId),
      supabase.from("bulk_campaign_recipients").delete().eq("user_id", userId),
    ]);

    // 3. Delete merchant_onboarding records that reference this user's payments
    if (paymentIds.length > 0) {
      await supabase
        .from("merchant_onboarding")
        .delete()
        .in("payment_id", paymentIds);
    }

    // 4. Clean up KYC documents from storage
    try {
      const { data: kycObjects } = await supabase
        .storage
        .from("kyc-documents")
        .list(userId, { limit: 1000 });

      if (kycObjects && kycObjects.length > 0) {
        const paths = kycObjects.map((o) => `${userId}/${o.name}`);
        await supabase.storage.from("kyc-documents").remove(paths);
      }
    } catch (storageErr) {
      console.error("Failed to remove KYC storage files:", storageErr);
    }

    // 5. Clean up support ticket attachments from storage
    for (const ticketId of ticketIds) {
      try {
        const { data: ticketFiles } = await supabase
          .storage
          .from("ticket-attachments")
          .list(ticketId, { limit: 1000 });

        if (ticketFiles && ticketFiles.length > 0) {
          const paths = ticketFiles.map((o) => `${ticketId}/${o.name}`);
          await supabase.storage.from("ticket-attachments").remove(paths);
        }
      } catch (storageErr) {
        console.error(`Failed to remove ticket attachments for ${ticketId}:`, storageErr);
      }
    }

    // 6. Delete the user row — all CASCADE FKs handle the rest:
    //    beneficiaries, payments, payouts, transaction_status, user_bank_accounts,
    //    otp_verification, user_password_reset_otps, user_permissions,
    //    kyc_pan_verification, kyc_address_proof, kyc_business_info,
    //    support_tickets (→ support_ticket_replies, support_ticket_attachments),
    //    mobile_push_tokens
    //    referred_by is SET NULL on other users
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, userId, email: user.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("admin-delete-user error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
