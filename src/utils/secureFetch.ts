const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const WAF_ENDPOINT = `${SUPABASE_URL}/functions/v1/waf-validate`;

const SESSION_INVALID_CODE = 'SESSION_INVALID';

let onSessionInvalid: (() => void) | null = null;

export function configureSessionInvalidHandler(handler: () => void): void {
  onSessionInvalid = handler;
}

import { getUserSessionToken, getAdminSessionToken } from './session';

const originalFetch = window.fetch.bind(window);

function isSupabaseEdgeFunction(url: string): boolean {
  return url.startsWith(SUPABASE_URL) && url.includes('/functions/v1/');
}

function mergeHeaders(init?: RequestInit): Record<string, string> {
  const buildBase = (): Record<string, string> => {
    if (!init?.headers) return { apikey: SUPABASE_ANON_KEY };
    if (init.headers instanceof Headers) {
      const result: Record<string, string> = {};
      init.headers.forEach((value, key) => { result[key] = value; });
      result['apikey'] = SUPABASE_ANON_KEY;
      return result;
    }
    if (Array.isArray(init.headers)) {
      const result: Record<string, string> = Object.fromEntries(init.headers);
      result['apikey'] = SUPABASE_ANON_KEY;
      return result;
    }
    return { ...(init.headers as Record<string, string>), apikey: SUPABASE_ANON_KEY };
  };

  const headers = buildBase();

  // Attach session tokens for server-side identity verification.
  // We read lazily on every request so login/logout is reflected immediately.
  const userToken = getUserSessionToken();
  if (userToken && !headers['x-pbc-session']) headers['x-pbc-session'] = userToken;
  const adminToken = getAdminSessionToken();
  if (adminToken && !headers['x-pbc-admin-session']) headers['x-pbc-admin-session'] = adminToken;

  return headers;
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

  // Don't WAF-check the WAF itself
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

  const response = await originalFetch(input, { ...init, headers: mergeHeaders(init) });

  // If the server says the session is invalid, clear tokens and notify the app
  // so it can redirect to the login page.
  if (response.status === 401) {
    try {
      const clone = response.clone();
      const data = await clone.json();
      if (data?.code === SESSION_INVALID_CODE && onSessionInvalid) onSessionInvalid();
    } catch {
      // not JSON or no body — ignore
    }
  }

  return response;
}

export function installWaf(): void {
  window.fetch = interceptedFetch as typeof window.fetch;
}
