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

  return originalFetch(input, init);
}

export function installWaf(): void {
  window.fetch = interceptedFetch as typeof window.fetch;
}
