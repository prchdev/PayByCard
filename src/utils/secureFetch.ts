const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const originalFetch = window.fetch.bind(window);

function isSupabaseEdgeFunction(url: string): boolean {
  return url.startsWith(SUPABASE_URL) && url.includes('/functions/v1/');
}

function mergeHeaders(init?: RequestInit): Record<string, string> {
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

  return originalFetch(input, { ...init, headers: mergeHeaders(init) });
}

export function installWaf(): void {
  window.fetch = interceptedFetch as typeof window.fetch;
}
