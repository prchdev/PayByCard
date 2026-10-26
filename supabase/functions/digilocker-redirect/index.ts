const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session',
};

const APP_DOMAINS = new Set([
  'paybycard.in',
  'www.paybycard.in',
  'app.paybycard.in',
  'api.paybycard.in',
]);

// Mobile app custom scheme — registered in app.json (iOS CFBundleURLSchemes +
// Android intentFilters). expo-web-browser's openAuthSessionAsync intercepts
// redirects to this scheme and returns the full URL to the app.
const MOBILE_CALLBACK_SCHEME = 'paybycard://digilocker-callback';

function resolveAppUrl(req: Request, state: string): string {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';

  for (const headerVal of [origin, referer]) {
    if (!headerVal) continue;
    try {
      const parsed = new URL(headerVal);
      const host = parsed.hostname.toLowerCase();
      if (APP_DOMAINS.has(host)) return parsed.origin;
    } catch { /* not a valid URL */ }
  }

  if (state.startsWith('m')) return 'https://app.paybycard.in';
  return 'https://paybycard.in';
}

// State encoding:
//   u<userid>   → user KYC, web
//   mu<userid>  → user KYC, mobile
//   m<recordid> → merchant KYC, web
//   mm<recordid>→ merchant KYC, mobile
function isMobileState(state: string): boolean {
  return state.startsWith('mu') || state.startsWith('mm');
}

function isMerchantState(state: string): boolean {
  return state.startsWith('mm') || (state.startsWith('m') && !state.startsWith('mu'));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const error = url.searchParams.get('error') || '';
  const state = url.searchParams.get('state') || '';

  const isMerchant = isMerchantState(state);
  const isMobile = isMobileState(state);
  const fallbackPath = isMerchant ? '/merchant-onboarding' : '/kyc-verification';

  const appUrl = resolveAppUrl(req, state);

  // Build query params for the redirect target
  const params: string[] = [];
  if (code) params.push('code=' + encodeURIComponent(code));
  if (state) params.push('state=' + encodeURIComponent(state));
  if (error) params.push('error=' + encodeURIComponent(error));
  const queryString = params.length > 0 ? '?' + params.join('&') : '';

  // ── Mobile: redirect to the custom app scheme ──────────────────────────────
  // expo-web-browser's openAuthSessionAsync intercepts this and returns the
  // full URL (paybycard://digilocker-callback?code=...&state=...) to the app,
  // which then extracts the code and calls auto_approve.
  if (isMobile) {
    const mobileRedirect = MOBILE_CALLBACK_SCHEME + queryString;
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: mobileRedirect },
    });
  }

  // ── Web: serve the HTML bridge page ─────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DigiLocker Redirect</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
  .card { text-align: center; padding: 2rem; }
  .spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #8c76f0; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { color: #6b7280; font-size: 0.875rem; }
</style>
</head>
<body>
<div class="card">
  <div class="spinner"></div>
  <p>Completing DigiLocker authorization…</p>
</div>
<script>
(function() {
  var code = ${JSON.stringify(code)};
  var error = ${JSON.stringify(error)};
  var state = ${JSON.stringify(state)};
  var fallbackPath = ${JSON.stringify(fallbackPath)};
  var appUrl = ${JSON.stringify(appUrl)};

  function redirectFallback() {
    var sep = fallbackPath.indexOf('?') >= 0 ? '&' : '?';
    var params = [];
    if (code) params.push('code=' + encodeURIComponent(code));
    if (state) params.push('state=' + encodeURIComponent(state));
    if (error) params.push('error=' + encodeURIComponent(error));
    window.location.href = appUrl + fallbackPath + sep + params.join('&');
  }

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage({ type: 'digilocker_callback', code: code, state: state, error: error }, '*');
      setTimeout(function() {
        try { window.close(); } catch (e) {}
        setTimeout(function() {
          if (!window.closed) redirectFallback();
        }, 300);
      }, 200);
      return;
    } catch (e) {
      redirectFallback();
      return;
    }
  }

  redirectFallback();
})();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });
});
