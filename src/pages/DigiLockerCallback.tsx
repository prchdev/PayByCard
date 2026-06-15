import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Relay page for DigiLocker OAuth callback — works for both user KYC and merchant flows.
// Uses localStorage as the communication channel (reliable across cross-origin navigations
// where window.opener may be cleared by the browser).
// Falls back to sessionStorage + redirect if the page was not opened as a popup.
export default function DigiLockerCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const rawState = params.get('state');

    // State is a simple alphanumeric token with a flow prefix:
    //   'u' + userId (no hyphens)  → user KYC flow
    //   'm' + merchantId (no hyphens) → merchant KYC flow
    // (Previously used JSON which caused DigiLocker invalid_request errors)
    let isMerchant = false;
    if (rawState) {
      const s = decodeURIComponent(rawState);
      if (s.startsWith('m')) isMerchant = true;
    }

    const fallbackPath = isMerchant ? '/merchant-onboarding' : '/kyc-verification';

    if (code) {
      // Always write to localStorage — parent window polls for this key
      const lsKey = isMerchant ? 'merchant_digilocker_code' : 'digilocker_code';
      localStorage.setItem(lsKey, code);

      // Also try postMessage as secondary channel (works when opener is accessible)
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ code }, '*');
        }
      } catch { /* cross-origin opener — localStorage is the primary channel */ }

      // Close the popup after a short delay so localStorage write has time to flush
      setTimeout(() => {
        try { window.close(); } catch { /* ignore */ }
        // If window.close() didn't work (not a popup), redirect
        setTimeout(() => {
          if (!window.closed) {
            const key = isMerchant ? 'merchant_digilocker_oauth_code' : 'digilocker_oauth_code';
            sessionStorage.setItem(key, code);
            window.location.replace(fallbackPath);
          }
        }, 300);
      }, 300);

    } else if (error) {
      const lsKey = isMerchant ? 'merchant_digilocker_error' : 'digilocker_error';
      localStorage.setItem(lsKey, error);

      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ digilocker_error: error }, '*');
        }
      } catch { /* ignore */ }

      setTimeout(() => {
        try { window.close(); } catch { /* ignore */ }
        setTimeout(() => {
          if (!window.closed) window.location.replace(fallbackPath);
        }, 300);
      }, 300);

    } else {
      // No code or error — just close
      try { window.close(); } catch { /* ignore */ }
      setTimeout(() => {
        if (!window.closed) window.location.replace(fallbackPath);
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-600">Completing DigiLocker authorization…</p>
      </div>
    </div>
  );
}
