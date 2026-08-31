import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { validatePassword } from '../_shared/passwordValidation.ts';
import { withAdminSession } from "../_shared/session.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session',
};

interface RequestBody {
  admin_id: string;
  current_password: string;
  new_password: string;
}

const __pbcHandler = (async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { admin_id, current_password, new_password }: RequestBody = await req.json();

    if (!admin_id || !current_password || !new_password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.isValid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.error }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('id, password_hash')
      .eq('id', admin_id)
      .maybeSingle();

    if (adminError || !admin) {
      return new Response(
        JSON.stringify({ error: 'Admin not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const encoder = new TextEncoder();
    const currentPasswordData = encoder.encode(current_password);
    const currentPasswordHash = await crypto.subtle.digest('SHA-256', currentPasswordData);
    const currentPasswordHashArray = Array.from(new Uint8Array(currentPasswordHash));
    const currentPasswordHashHex = currentPasswordHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (currentPasswordHashHex !== admin.password_hash) {
      return new Response(
        JSON.stringify({ error: 'Current password is incorrect' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const newPasswordData = encoder.encode(new_password);
    const newPasswordHash = await crypto.subtle.digest('SHA-256', newPasswordData);
    const newPasswordHashArray = Array.from(new Uint8Array(newPasswordHash));
    const newPasswordHashHex = newPasswordHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password_hash: newPasswordHashHex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', admin_id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in admin-change-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

Deno.serve(withAdminSession(__pbcHandler as (req: Request) => Promise<Response>));
