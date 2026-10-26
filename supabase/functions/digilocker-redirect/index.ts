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

const MOBILE_SCHEME = 'paybycard://digilocker-callback';

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

function isMobileBrowser(req: Request): boolean {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const error = url.searchParams.get('error') || '';
  const state = url.searchParams.get('state') || '';

  const isMerchant = state.startsWith('m');
  const fallbackPath = isMerchant ? '/merchant-onboarding' : '/kyc-verification';
  const webAppUrl = resolveAppUrl(req, state);
  const mobile = isMobileBrowser(req);

  const paramsParts: string[] = [];
  if (code) paramsParts.push('code=' + encodeURIComponent(code));
  if (state) paramsParts.push('state=' + encodeURIComponent(state));
  if (error) paramsParts.push('error=' + encodeURIComponent(error));
  const queryParams = paramsParts.join('&');

  const mobileUrl = MOBILE_SCHEME + '?' + queryParams;
  const webFallbackUrl = webAppUrl + fallbackPath + (fallbackPath.includes('?') ? '&' : '?') + queryParams;

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
  a { color: #8c76f0; text-decoration: none; font-weight: 600; }
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

  // Popup flow (web): postMessage to opener, then close
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage({ type: 'digilocker_callback', code: code, state: state, error: error }, '*');
      setTimeout(function() {
        try { window.close(); } catch (e) {}
        setTimeout(function() {
          if (!window.closed) window.location.href = ${JSON.stringify(webFallbackUrl)};
        }, 300);
      }, 200);
      return;
    } catch (e) {
      window.location.href = ${JSON.stringify(webFallbackUrl)};
      return;
    }
  }

  // Mobile: redirect to custom scheme — the OS intercepts this and returns
  // the URL to openAuthSessionAsync. No timeout/fallback: the app is always
  // installed (the user is inside it), so the scheme always resolves.
  if (${mobile ? 'true' : 'false'}) {
    window.location.href = ${JSON.stringify(mobileUrl)};
    return;
  }

  // Desktop without opener (popup was blocked): redirect to web app
  window.location.href = ${JSON.stringify(webFallbackUrl)};
})();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });
});
