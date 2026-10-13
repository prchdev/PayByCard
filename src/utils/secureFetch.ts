const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const WAF_ENDPOINT = `${SUPABASE_URL}/functions/v1/waf-validate`;

const originalFetch = window.fetch.bind(window);

function isSupabaseEdgeFunction(url: string): boolean {
  return url.startsWith(SUPABASE_URL) && url.includes('/functions/v1/');
}

async function interceptedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : input.url;

  if (!isSupabaseEdgeFunction(url)) {
    return originalFetch(input, init);
  }

  const isWafCall = url.includes('/functions/v1/waf-validate');

  if (!isWafCall) {
    try {
      let bodyForScan: unknown;
      if (init?.body && typeof init.body === 'string') {
        try { bodyForScan = JSON.parse(init.body); } catch { /* not JSON */ }
      }

      const wafRes = await originalFetch(WAF_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ url, ...(bodyForScan ? { body: bodyForScan } : {}) }),
      });

      if (wafRes.ok) {
        const wafData = await wafRes.json();
        if (wafData.blocked) {
          return new Response(
            JSON.stringify({ error: wafData.message || 'Request blocked by security filter' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch {
      // WAF failure never blocks legitimate requests
    }
  }

  return originalFetch(input, attachSessionHeaders(input, init));
}

// Edge functions now require a server-issued session token rather than trusting an
// identifier in the request body. Attach whichever tokens this browser holds to every
// edge function call so existing call sites keep working unchanged.
function attachSessionHeaders(
  input: RequestInfo | URL,
  init?: RequestInit
): RequestInit | undefined {
  let userToken: string | null = null;
  let adminToken: string | null = null;
  try {
    userToken = sessionStorage.getItem('pbc_session') || localStorage.getItem('pbc_session');
    adminToken =
      sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session');
  } catch {
    // storage unavailable
  }

  const headers = new Headers(
    init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined)
  );

  // Supabase's API gateway requires an apikey header on every edge-function call.
  // Some call sites omit it (they only send Authorization), so add it here centrally.
  if (!headers.has('apikey')) {
    headers.set('apikey', SUPABASE_ANON_KEY);
  }

  // Ensure Authorization is set to the anon key for gateway authentication.
  // Call sites that set their own Authorization (e.g. Bearer <anon_key>) are left alone.
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
  }

  if (!userToken && !adminToken) return { ...(init || {}), headers };

  if (userToken && !headers.has('x-pbc-session')) headers.set('x-pbc-session', userToken);
  if (adminToken && !headers.has('x-pbc-admin-session')) {
    headers.set('x-pbc-admin-session', adminToken);
  }
  return { ...(init || {}), headers };
}

export function installWaf(): void {
  window.fetch = interceptedFetch as typeof window.fetch;
}
