import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const passwordHash = await hashPassword(password);

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("id, email, full_name, role, is_active")
      .eq("email", email)
      .eq("password_hash", passwordHash)
      .maybeSingle();

    if (error || !admin) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!admin.is_active) {
      return new Response(
        JSON.stringify({ error: "Account is inactive" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: otpError } = await supabase
      .from("admin_login_otps")
      .insert({
        admin_id: admin.id,
        email: admin.email,
        otp,
        expires_at: expiresAt.toISOString(),
      });

    if (otpError) {
      console.error("OTP insert error:", otpError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP email in the background — do not block the response
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: admin.email,
          subject: "Admin Login - Verification Code",
          body: `
            <div style="margin-bottom: 24px;">
              <h2 style="color: #1f2937; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">
                Login Verification
              </h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Hello ${admin.full_name},
              </p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                A login attempt was made to your admin account. Use the One-Time Password (OTP) below to complete your login:
              </p>
            </div>

            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #93c5fd; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
              <p style="color: #1d4ed8; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">
                Your Verification Code
              </p>
              <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; display: inline-block; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                <h1 style="color: #8c76f0; margin: 0; font-size: 42px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${otp}
                </h1>
              </div>
              <p style="color: #1d4ed8; font-size: 13px; margin: 16px 0 0 0;">
                Valid for 10 minutes
              </p>
            </div>

            <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="color: #991b1b; font-size: 14px; line-height: 1.5; margin: 0;">
                <strong>Security Alert:</strong> If you did not attempt to log in, your credentials may be compromised. Please change your password immediately and contact the system administrator.
              </p>
            </div>

            <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Never share this code with anyone. PayByCard staff will never ask for your OTP.
              </p>
            </div>
          `,
          body_type: "html",
          use_template: true,
        }),
      }).catch((emailErr) => console.error("Failed to send login OTP email:", emailErr))
    );

    return new Response(
      JSON.stringify({
        otpSent: true,
        email: admin.email,
        message: "A verification code has been sent to your email address.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-login error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
