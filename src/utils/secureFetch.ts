const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const WAF_ENDPOINT = `${SUPABASE_URL}/functions/v1/waf-validate`;

const originalFetch = window.fetch.bind(window);

function extractAuthHeader(options?: RequestInit): string | undefined {
  if (!options?.headers) return undefined;
  if (options.headers instanceof Headers) {
    return options.headers.get("Authorization") || undefined;
  }
  if (Array.isArray(options.headers)) {
    const entry = options.headers.find(
      ([key]) => key.toLowerCase() === "authorization"
    );
    return entry?.[1];
  }
  return (options.headers as Record<string, string>)["Authorization"];
}

async function wafInterceptedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  const isEdgeFunctionCall =
    url.includes("/functions/v1/") && url.includes(SUPABASE_URL);
  const isWafCall = url.includes("/functions/v1/waf-validate");

  if (!isEdgeFunctionCall || isWafCall) {
    return originalFetch(input, init);
  }

  try {
    let bodyForScan: Record<string, unknown> | undefined;
    if (init?.body && typeof init.body === "string") {
      try {
        bodyForScan = JSON.parse(init.body);
      } catch {
        // not JSON
      }
    }

    const wafPayload: Record<string, unknown> = { url };
    if (bodyForScan) {
      wafPayload.body = bodyForScan;
    }

    const authHeader = extractAuthHeader(init) || `Bearer ${SUPABASE_ANON_KEY}`;

    const wafRes = await originalFetch(WAF_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wafPayload),
    });

    if (wafRes.ok) {
      const wafData = await wafRes.json();
      if (wafData.blocked) {
        return new Response(
          JSON.stringify({
            error: wafData.message || "Request blocked by security filter",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
  } catch {
    // WAF unavailable should never block legitimate requests
  }

  return originalFetch(input, init);
}

export function installWaf(): void {
  window.fetch = wafInterceptedFetch as typeof window.fetch;
}
