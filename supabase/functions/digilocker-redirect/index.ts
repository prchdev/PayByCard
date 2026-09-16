const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  let appUrl = 'https://paybycard.in';
  if (origin) {
    try { appUrl = new URL(origin).origin; } catch { /* keep default */ }
  }
  if (appUrl.includes('supabase')) appUrl = 'https://paybycard.in';

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
