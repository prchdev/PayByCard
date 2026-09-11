import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, Upload, CheckCircle, AlertCircle, Loader2, Clock, XCircle,
  CreditCard, ScanFace, FileText, RefreshCw, ExternalLink, WifiOff,
  ShieldAlert, User, MapPin, Menu, X, Facebook, Twitter, Linkedin, Instagram,
  Mail, Phone, Building2, Landmark, Hash, Wallet,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Client-side event logger ───────────────────────────────────────────────────
function logMerchantEvent(token: string, provider: string, action: string, success: boolean, extra?: Record<string, unknown>) {
  fetch(`${SUPABASE_URL}/functions/v1/log-digilocker-event`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow: 'merchant',
      action,
      provider,
      environment: '',
      success,
      ...(extra?.error_code ? { error_code: extra.error_code } : {}),
      ...(extra?.error_message ? { error_message: extra.error_message } : {}),
      raw_response: extra ? { ...extra, error_code: undefined, error_message: undefined, token: '[REDACTED]' } : undefined,
    }),
  }).catch(() => { /* non-critical */ });
}

const AUTH_HEADERS = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

interface OnboardingData {
  id: string;
  sender_name: string;
  category_name: string;
  beneficiary_name: string;
  email: string;
  mobile: string;
  pan_number: string;
  pan_photo_url: string;
  expires_at: string;
  bank_name?: string;
  bank_branch?: string;
  bank_ifsc?: string;
  bank_account_number?: string;
}

interface KycProvider {
  id: string;
  provider_name: string;
  environment: string;
  is_enabled: boolean;
  is_default: boolean;
}

interface KycData {
  pan_number: string;
  full_name: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  id_number: string;
}

type KycMethod = 'digilocker' | 'manual' | null;

// ── Inline DigiLocker flow (token-based, not userId-based) ──────────────────
type DlStep = 'idle' | 'loading_url' | 'waiting_popup' | 'polling' | 'verifying' | 'success' | 'error' | 'pan_mismatch';

const POLL_INTERVAL = 3000;
const MAX_POLLS = 100;
const isCashFree = (name: string) => name === 'CashFree DigiLocker';

interface MerchantDlFlowProps {
  token: string;
  providerName: string;
  expectedPan: string;
  onSuccess: (kycData: KycData) => void;
  onFallback: (reason: string) => void;
}

function MerchantDlFlow({ token, providerName, expectedPan, onSuccess, onFallback }: MerchantDlFlowProps) {
  const [step, setStep] = useState<DlStep>('idle');
  const [error, setError] = useState('');
  const [ipWhitelistIp, setIpWhitelistIp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const [panMismatch, setPanMismatch] = useState<{ expected: string; fetched: string } | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(step);
  const vidRef = useRef(verificationId);
  const redirectUriRef = useRef(redirectUri);
  const codeReceivedRef = useRef(false);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { vidRef.current = verificationId; }, [verificationId]);
  useEffect(() => { redirectUriRef.current = redirectUri; }, [redirectUri]);
  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  // Handle redirect-back tokens stored in sessionStorage (same-tab redirect fallback)
  useEffect(() => {
    const storedRedirectUri = sessionStorage.getItem('merchant_digilocker_redirect_uri') || '';
    if (storedRedirectUri) {
      setRedirectUri(storedRedirectUri);
      redirectUriRef.current = storedRedirectUri;
    }

    const cfId = sessionStorage.getItem('merchant_cf_verification_id');
    const oauthCode = sessionStorage.getItem('merchant_digilocker_oauth_code');
    if (cfId) {
      sessionStorage.removeItem('merchant_cf_verification_id');
      setVerificationId(cfId); vidRef.current = cfId;
      logMerchantEvent(token, providerName, 'session_restore_cf', true, {});
      startPolling(cfId);
    } else if (oauthCode) {
      sessionStorage.removeItem('merchant_digilocker_oauth_code');
      logMerchantEvent(token, providerName, 'session_restore_code', true, {
        redirect_uri: storedRedirectUri || '[empty]',
      });
      runAutoApprove(oauthCode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Single-use code handler — prevents double token exchange with same auth code
  const handleCode = useCallback((code: string) => {
    if (codeReceivedRef.current) return;
    if (stepRef.current !== 'waiting_popup') return;
    codeReceivedRef.current = true;
    localStorage.removeItem('merchant_digilocker_code');
    runAutoApprove(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMessage = useCallback((event: MessageEvent) => {
    const d = event.data;
    if (!d || typeof d !== 'object') return;
    const cfId = d.cf_verification_id;
    if (cfId && typeof cfId === 'string') {
      if (stepRef.current === 'waiting_popup' || stepRef.current === 'polling') startPolling(cfId);
      return;
    }
    const code = d.code || d.authCode || d.authorization_code;
    if (code && typeof code === 'string') handleCode(code);
  }, [handleCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Primary channel: localStorage polling + storage event
  useEffect(() => {
    if (step !== 'waiting_popup') return;

    localStorage.removeItem('merchant_digilocker_code');
    localStorage.removeItem('merchant_digilocker_error');

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'merchant_digilocker_code' && e.newValue) {
        handleCode(e.newValue);
      }
      if (e.key === 'merchant_digilocker_error' && e.newValue) {
        localStorage.removeItem('merchant_digilocker_error');
        if (stepRef.current === 'waiting_popup') {
          setStep('error');
          setError('DigiLocker authorization was denied or failed. Please try again.');
        }
      }
    };

    const pollInterval = setInterval(() => {
      const code = localStorage.getItem('merchant_digilocker_code');
      if (code) { handleCode(code); return; }
      const err = localStorage.getItem('merchant_digilocker_error');
      if (err) {
        localStorage.removeItem('merchant_digilocker_error');
        if (stepRef.current === 'waiting_popup') {
          setStep('error');
          setError('DigiLocker authorization was denied or failed. Please try again.');
        }
      }
    }, 500);

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, [step, handleCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for popup closed by user (without completing auth)
  useEffect(() => {
    if (step !== 'waiting_popup') return;
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(interval);
        setTimeout(() => {
          const code = localStorage.getItem('merchant_digilocker_code');
          if (code) { handleCode(code); return; }
          if (codeReceivedRef.current) return;
          if (isCashFree(providerName) && vidRef.current) {
            startPolling(vidRef.current);
          } else if (!isCashFree(providerName) && stepRef.current === 'waiting_popup') {
            setStep('error');
            setError('DigiLocker authorization window was closed before completing. Please try again.');
          }
        }, 1500);
      }
    }, 600);
    return () => clearInterval(interval);
  }, [step, providerName, handleCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const startAuth = async () => {
    setStep('loading_url');
    setError(''); setPanMismatch(null); setManualCode(''); setShowManualInput(false);
    try {
      // Generate PKCE code_verifier (96 random bytes → base64url)
      const array = new Uint8Array(96);
      crypto.getRandomValues(array);
      const codeVerifier = btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      sessionStorage.setItem('merchant_digilocker_code_verifier', codeVerifier);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/merchant-digilocker-kyc`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ token, action: 'get_auth_url', codeChallenge }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get authorization URL');

      const url: string = data.authUrl;
      const vid: string = data.verificationId || '';
      const rUri: string = data.redirectUri || '';
      setVerificationId(vid); vidRef.current = vid;
      setRedirectUri(rUri); redirectUriRef.current = rUri;
      if (rUri) sessionStorage.setItem('merchant_digilocker_redirect_uri', rUri);

      const w = 500, h = 700;
      const left = Math.max(0, (window.screen.width - w) / 2 + window.screenX);
      const top = Math.max(0, (window.screen.height - h) / 2 + window.screenY);
      const popup = window.open(url, 'DigiLockerMerchant', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);

      if (!popup || popup.closed) {
        // No noopener — callback page must be able to close the tab
        window.open(url, '_blank');
        logMerchantEvent(token, providerName, 'popup_blocked_new_tab', true, {});
        setStep('waiting_popup'); setShowManualInput(true);
      } else {
        popupRef.current = popup;
        logMerchantEvent(token, providerName, 'popup_opened', true, {});
        setStep('waiting_popup');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to connect to DigiLocker';
      logMerchantEvent(token, providerName, 'get_auth_url_error', false, {
        error_code: 'GET_AUTH_URL_FAILED',
        error_message: msg,
      });
      if (msg.startsWith('IP_WHITELIST_ERROR:')) {
        setIpWhitelistIp(msg.split(':')[1] || '');
        setError('ip_whitelist');
      } else {
        setError(msg);
      }
      setStep('error');
    }
  };

  const startPolling = (vid: string) => { setStep('polling'); setPollCount(0); schedulePoll(vid, 0); };

  const schedulePoll = (vid: string, count: number) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(() => doPoll(vid, count), POLL_INTERVAL);
  };

  const doPoll = async (vid: string, count: number) => {
    if (count >= MAX_POLLS) { setStep('error'); setError('DigiLocker authorization timed out.'); return; }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/merchant-digilocker-kyc`, {
        method: 'POST', headers: AUTH_HEADERS,
        body: JSON.stringify({ token, action: 'check_status', verificationId: vid }),
      });
      const data = await res.json();
      const s = (data.status || '').toUpperCase();
      setPollCount(count + 1);
      if (['AUTHENTICATED', 'COMPLETED', 'SUCCESS'].includes(s)) {
        runAutoApprove(vid);
      } else if (s === 'CONSENT_DENIED') {
        setStep('error'); setError('You denied consent in DigiLocker. Please try again or use Manual KYC.');
      } else if (s === 'EXPIRED') {
        setStep('error'); setError('DigiLocker authorization link expired. Please start again.');
      } else {
        schedulePoll(vid, count + 1);
      }
    } catch { schedulePoll(vid, count + 1); }
  };

  const runAutoApprove = async (code: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStep('verifying'); setError('');

    const codeVerifier = sessionStorage.getItem('merchant_digilocker_code_verifier') || undefined;
    const resolvedRedirectUri =
      redirectUriRef.current ||
      sessionStorage.getItem('merchant_digilocker_redirect_uri') ||
      undefined;

    logMerchantEvent(token, providerName, 'auto_approve_start', true, {
      has_code_verifier: !!codeVerifier,
      has_redirect_uri: !!resolvedRedirectUri,
      redirect_uri: resolvedRedirectUri || '[empty]',
    });

    try {
      const t0 = Date.now();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/merchant-digilocker-kyc`, {
        method: 'POST', headers: AUTH_HEADERS,
        body: JSON.stringify({ token, action: 'auto_approve', authCode: code, codeVerifier, redirectUri: resolvedRedirectUri }),
      });
      const data = await res.json();
      const duration_ms = Date.now() - t0;

      if (!res.ok) throw new Error(data.error || 'DigiLocker verification failed');

      if (data.autoApproved) {
        logMerchantEvent(token, providerName, 'auto_approve_success', true, { duration_ms });
        setStep('success');
        onSuccess(data.kycData);
      } else if (data.panMismatch) {
        logMerchantEvent(token, providerName, 'auto_approve_pan_mismatch', false, {
          error_code: 'PAN_MISMATCH',
          error_message: `Expected: ${data.expectedPan}, got: ${data.fetchedPan}`,
          duration_ms,
        });
        setPanMismatch({ expected: data.expectedPan, fetched: data.fetchedPan });
        setStep('pan_mismatch');
      } else {
        logMerchantEvent(token, providerName, 'auto_approve_failed', false, {
          error_code: 'BUSINESS_ERROR',
          error_message: data.error || 'Unknown',
          http_status: res.status,
          duration_ms,
          raw_response_keys: Object.keys(data),
        });
        setStep('error');
        setError(data.error || 'DigiLocker verification could not be completed.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      logMerchantEvent(token, providerName, 'auto_approve_exception', false, {
        error_code: 'FETCH_EXCEPTION',
        error_message: msg,
      });
      setStep('error');
      setError(msg);
    }
  };

  const retry = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStep('idle'); setError(''); setManualCode(''); setShowManualInput(false);
    setPanMismatch(null); setVerificationId(''); setRedirectUri('');
    redirectUriRef.current = '';
    setPollCount(0); popupRef.current = null; codeReceivedRef.current = false;
    localStorage.removeItem('merchant_digilocker_code');
    localStorage.removeItem('merchant_digilocker_error');
    sessionStorage.removeItem('merchant_digilocker_code_verifier');
    sessionStorage.removeItem('merchant_digilocker_redirect_uri');
    sessionStorage.removeItem('merchant_digilocker_oauth_code');
  };

  // PAN mismatch
  if (step === 'pan_mismatch' && panMismatch) {
    return (
      <div className="bg-white border-2 border-red-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-red-50 border-b border-red-200 flex items-start gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">PAN Number Mismatch</p>
            <p className="text-xs text-red-600 mt-0.5">The PAN from DigiLocker does not match the expected PAN.</p>
          </div>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expected PAN</p>
              <p className="font-mono font-bold text-gray-900">{panMismatch.expected || '—'}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-1.5">DigiLocker PAN</p>
              <p className="font-mono font-bold text-red-800">{panMismatch.fetched || '—'}</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <p className="font-medium mb-1">What to do next</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              The PAN retrieved from your DigiLocker does not match the PAN on record for this payment.
              Please use Manual KYC to upload your PAN card, or contact the sender to verify the details.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onFallback('pan_mismatch')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
            >
              <FileText className="w-4 h-4" />
              Submit KYC Manually
            </button>
            <button
              onClick={retry}
              className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success
  if (step === 'success') {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-2xl px-5 py-5">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">KYC Verified via {providerName}</p>
            <p className="text-sm text-green-700 mt-1">
              Your identity has been automatically verified. No further action required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-300 hover:border-[#8c76f0] rounded-2xl overflow-hidden transition-all hover:shadow-xl">
      <div className="px-5 py-4 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-gray-200 flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
          <ScanFace className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Verify via {providerName}</p>
          <p className="text-xs text-gray-500">Instant, paperless KYC using your DigiLocker documents</p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        {(step === 'idle' || step === 'error') && (
          <>
            {step === 'error' && error === 'ip_whitelist' ? (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Server IP Not Whitelisted</p>
                    <p className="text-sm text-amber-700 mt-1">CashFree requires this server's IP to be whitelisted.</p>
                  </div>
                </div>
                {ipWhitelistIp && (
                  <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-amber-600 font-medium">Server IP to whitelist</p>
                      <p className="text-sm font-mono font-bold text-gray-900 mt-0.5">{ipWhitelistIp}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(ipWhitelistIp)}
                      className="text-xs px-2.5 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors font-medium"
                    >
                      Copy
                    </button>
                  </div>
                )}
                <a href="https://www.cashfree.com/docs/secure-id/get-started/integration/ip-whitelisting-verification" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#8c76f0] hover:underline font-medium">
                  <ExternalLink className="w-3.5 h-3.5" />CashFree IP Whitelisting Guide
                </a>
              </div>
            ) : step === 'error' ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700">Verification Failed</p>
                  <p className="text-sm text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {[
                ['1', 'Click <strong>Connect DigiLocker</strong> — a secure popup window will open.'],
                ['2', 'Sign in to DigiLocker and authorize access to your Aadhaar and PAN.'],
                ['3', 'Close the popup after authorizing — your KYC will complete automatically.'],
              ].map(([n, t]) => (
                <div key={n} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-[#8c76f0] text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">{n}</span>
                  <span dangerouslySetInnerHTML={{ __html: t }} />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={startAuth}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-sm shadow-purple-500/20"
              >
                <ScanFace className="w-4 h-4" />
                Connect DigiLocker
              </button>
              {step === 'error' && (
                <button
                  onClick={() => onFallback(error)}
                  className="flex items-center gap-2 px-4 py-3 bg-amber-100 text-amber-800 border-2 border-amber-300 rounded-xl text-sm font-medium hover:bg-amber-200 transition-colors"
                >
                  Manual KYC
                </button>
              )}
            </div>
          </>
        )}

        {step === 'loading_url' && (
          <div className="flex items-center justify-center gap-3 py-6 text-[#8c76f0]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Opening DigiLocker…</span>
          </div>
        )}

        {step === 'waiting_popup' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 py-3">
              <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-[#8c76f0]" />
              <div>
                <p className="text-sm font-medium text-gray-800">Waiting for DigiLocker authorization…</p>
                <p className="text-xs text-gray-500 mt-0.5">Complete the authorization in the popup, then return here.</p>
              </div>
            </div>
            {isCashFree(providerName) && verificationId && (
              <button
                onClick={() => startPolling(verificationId)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-50 border border-[#8c76f0]/30 text-[#8c76f0] rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                I've completed authorization — check status now
              </button>
            )}
            {showManualInput && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-gray-500">
                  If the popup was blocked, complete authorization in the new tab then paste the
                  {isCashFree(providerName) ? ' verification ID' : ' authorization code'} below:
                </p>
                <input
                  type="text" value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.trim())}
                  placeholder={isCashFree(providerName) ? 'Paste verification ID' : 'Paste authorization code'}
                  className="w-full px-3.5 py-2.5 border-2 border-gray-300 rounded-xl text-sm focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none transition-colors font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter' && manualCode) runAutoApprove(manualCode); }}
                />
                <button
                  onClick={() => runAutoApprove(manualCode)}
                  disabled={!manualCode.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm shadow-purple-500/20"
                >
                  <ShieldCheck className="w-4 h-4" />Verify KYC
                </button>
              </div>
            )}
            <button onClick={retry} className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline w-full text-center">Cancel</button>
          </div>
        )}

        {step === 'polling' && (
          <div className="flex items-center gap-3 py-3">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-[#8c76f0]" />
            <div>
              <p className="text-sm font-medium text-gray-800">Checking authorization status…</p>
              <p className="text-xs text-gray-500 mt-0.5">Waiting for DigiLocker consent{pollCount > 0 ? ` (${pollCount})` : ''}</p>
            </div>
          </div>
        )}

        {step === 'verifying' && (
          <div className="flex items-center gap-3 py-3">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-[#8c76f0]" />
            <div>
              <p className="text-sm font-medium text-gray-800">Verifying your identity…</p>
              <p className="text-xs text-gray-500 mt-0.5">Fetching Aadhaar and PAN from DigiLocker</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KYC Details summary shown after DigiLocker success ───────────────────────
function KycSummaryCard({ kycData }: { kycData: KycData }) {
  const fields: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Full Name', value: kycData.full_name },
    { label: 'PAN Number', value: kycData.pan_number, mono: true },
    { label: 'Date of Birth', value: kycData.dob },
    { label: 'ID Number', value: kycData.id_number, mono: true },
    { label: 'Address', value: kycData.address },
    { label: 'City', value: kycData.city },
    { label: 'State', value: kycData.state },
    { label: 'Pincode', value: kycData.pincode, mono: true },
  ].filter(f => f.value);

  return (
    <div className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 bg-green-50 border-b border-green-200 flex items-center gap-3">
        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
          <User className="w-5 h-5 text-green-700" />
        </div>
        <div>
          <p className="font-semibold text-green-800 text-sm">Verified Identity Details</p>
          <p className="text-xs text-green-600">Fetched from DigiLocker</p>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={f.label} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{f.label}</p>
              <p className={`text-sm text-gray-800 font-medium ${f.mono ? 'font-mono' : ''}`}>{f.value}</p>
            </div>
          ))}
        </div>
        {kycData.address && (
          <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <span>Address details fetched from your Aadhaar via DigiLocker.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Standalone Header ─────────────────────────────────────────────────────────
function MerchantHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'About Us', href: '/about' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <a href="/" className="flex items-center space-x-3">
            <div className="relative">
              <img src="/PayByCard-Logo.png" alt="PayByCard Logo" className="w-20 h-10 object-contain" />
              <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-30 pointer-events-none" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#8c76f0] to-purple-600 bg-clip-text text-transparent">
              PayByCard
            </span>
          </a>

          <div className="hidden md:flex items-center space-x-6">
            <div className="flex space-x-8">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="relative px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {item.name}
                </a>
              ))}
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="/login"
                className="px-6 py-2.5 text-sm font-medium text-[#8c76f0] border-2 border-[#8c76f0] rounded-lg hover:bg-purple-50 transition-all"
              >
                Login
              </a>
              <a
                href="/register"
                className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-lg hover:shadow-lg hover:shadow-purple-500/40 transition-all"
              >
                Register
              </a>
            </div>
          </div>

          <button
            className="md:hidden text-gray-900"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 pt-2 pb-4 space-y-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="pt-2 space-y-2">
              <a
                href="/login"
                className="block w-full px-6 py-2.5 text-sm font-medium text-[#8c76f0] border-2 border-[#8c76f0] rounded-lg hover:bg-purple-50 transition-all text-center"
              >
                Login
              </a>
              <a
                href="/register"
                className="block w-full px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-lg transition-all text-center"
              >
                Register
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Standalone Footer ─────────────────────────────────────────────────────────
function MerchantFooter() {
  const footerLinks = {
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'FAQ', href: '/faq' },
    ],
    legal: [
      { name: 'Terms & Services', href: '/terms' },
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Refund Policy', href: '/refund' },
      { name: 'Fraud Reporting', href: '/fraud' },
    ],
  };

  return (
    <footer className="bg-gradient-to-b from-gray-50 to-gray-100 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img src="/PayByCard-Logo.png" alt="PayByCard Logo" className="w-20 h-10 object-contain" />
                <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-30 pointer-events-none" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-[#8c76f0] to-purple-600 bg-clip-text text-transparent">
                PayByCard
              </span>
            </div>
            <div className="space-y-2 text-gray-600 text-sm">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-[#8c76f0]" />
                <p>PayByCard Technologies Pvt. Ltd.<br />
                  3701, IRIS, Runwal Bliss, Crompton Greaves Compund, KanjurMarg East<br />
                  Mumbai, Maharashtra 400 042</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-lg">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-gray-600 hover:text-[#8c76f0] transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-lg">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-gray-600 hover:text-[#8c76f0] transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-lg">Connect With Us</h3>
            <div className="flex space-x-4 mb-4">
              <a href="https://www.facebook.com/PayByCardIn" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors"><Facebook className="w-6 h-6" /></a>
              <a href="https://x.com/PayByCardIN" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors"><Twitter className="w-6 h-6" /></a>
              <a href="https://linkedin.com/company/paybycard" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors"><Linkedin className="w-6 h-6" /></a>
              <a href="https://www.instagram.com/paybycard.in" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors"><Instagram className="w-6 h-6" /></a>
            </div>
            <div className="space-y-2 text-gray-600 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#8c76f0]" />
                <span>support@paybycard.in</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-[#8c76f0]" />
                <span>+91 88501 44143</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-300 text-center text-gray-600 text-sm">
          <p>© {new Date().getFullYear()} PayByCard Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="mt-2">CIN: U62099MH2025PTC462923</p>
        </div>
      </div>
    </footer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MerchantOnboarding() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // When DigiLocker OAuth redirects back to this page (inside popup), relay code to opener then close.
  // CashFree relays cf_verification_id; DigiLocker direct relays OAuth code.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cfId = params.get('cf_verification_id') || params.get('verification_id');
    const oauthCode = params.get('code');

    if (cfId) {
      if (window.opener) {
        window.opener.postMessage({ cf_verification_id: cfId }, '*');
        window.close();
      } else {
        sessionStorage.setItem('merchant_cf_verification_id', cfId);
        window.history.replaceState({}, '', window.location.pathname + (token ? `?token=${token}` : ''));
      }
    } else if (oauthCode) {
      if (window.opener) {
        window.opener.postMessage({ code: oauthCode }, '*');
        window.close();
      } else {
        sessionStorage.setItem('merchant_digilocker_oauth_code', oauthCode);
        window.history.replaceState({}, '', window.location.pathname + (token ? `?token=${token}` : ''));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'pending' | 'verified' | 'expired' | 'refunded' | 'rejected' | 'payment_unavailable' | 'error'>('pending');
  const [data, setData] = useState<OnboardingData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const [provider, setProvider] = useState<KycProvider | null>(null);
  const [kycMethod, setKycMethod] = useState<KycMethod>(null);
  const [digilockerDone, setDigilockerDone] = useState(false);
  const [verifiedKycData, setVerifiedKycData] = useState<KycData | null>(null);

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMessage('Invalid link. No token provided.'); setLoading(false); return; }
    Promise.all([fetchOnboardingData(), fetchProvider()]);
  }, [token]);

  const fetchOnboardingData = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-merchant-onboarding`, {
        method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ token }),
      });
      const result = await res.json();
      if (!res.ok) { setStatus('error'); setErrorMessage(result.error || 'Invalid link'); return; }

      if (result.status === 'verified') { setStatus('verified'); }
      else if (result.status === 'expired') { setStatus('expired'); }
      else if (result.status === 'refunded') { setStatus('refunded'); }
      else if (result.status === 'payment_unavailable') { setStatus('payment_unavailable'); setErrorMessage(result.message || 'KYC is no longer available for this transaction.'); }
      else if (result.status === 'rejected') {
        setStatus('rejected');
        setData(result.data);
        setEmail(result.data.email || '');
        setMobile(result.data.mobile || '');
        setPanNumber(result.data.pan_number || '');
      }
      else {
        setStatus('pending'); setData(result.data);
        setEmail(result.data.email || '');
        setMobile(result.data.mobile || '');
        setPanNumber(result.data.pan_number || '');
      }
    } catch { setStatus('error'); setErrorMessage('Failed to load onboarding data'); }
    finally { setLoading(false); }
  };

  const fetchProvider = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-kyc-provider`, {
        method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({}),
      });
      const d = await res.json();
      setProvider(d.provider || null);
    } catch { setProvider(null); }
  };

  const uploadPanPhoto = async (): Promise<string> => {
    if (!panFile) throw new Error('PAN photo is required');
    const formData = new FormData();
    formData.append('file', panFile);
    formData.append('userId', `merchant-${token}`);
    formData.append('fileKey', 'pan_photo');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-kyc-file`, {
      method: 'POST', headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, body: formData,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to upload');
    return result.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!panNumber.trim()) { setFormError('PAN number is required'); return; }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.trim())) { setFormError('Enter a valid 10-character PAN number'); return; }
    if (!panFile && !data?.pan_photo_url) { setFormError('PAN card photo is required'); return; }

    setSubmitting(true);
    try {
      let panPhotoUrl = data?.pan_photo_url || '';
      if (panFile) panPhotoUrl = await uploadPanPhoto();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-merchant-onboarding`, {
        method: 'POST', headers: AUTH_HEADERS,
        body: JSON.stringify({ token, email, mobile, pan_number: panNumber.toUpperCase(), pan_photo_url: panPhotoUrl }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');
      setSubmitted(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const handleDigiLockerSuccess = (kycData: KycData) => {
    setVerifiedKycData(kycData);
    setDigilockerDone(true);
    setSubmitted(true);
  };

  const handleDigiLockerFallback = (_reason: string) => { setKycMethod('manual'); };

  const showDigilockerOption = provider !== null;
  const effectiveMethod = kycMethod ?? (showDigilockerOption ? 'digilocker' : 'manual');

  const pageContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-[#8c76f0] animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    if (status === 'verified' || submitted) {
      return (
        <div className="flex-1 py-10 px-4">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="bg-white rounded-2xl border-2 border-green-200 p-8 text-center shadow-xl">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">KYC Verified</h2>
              <p className="text-gray-600">
                {digilockerDone
                  ? 'Your identity has been automatically verified via DigiLocker. The payment will be processed shortly.'
                  : 'Your merchant KYC has been submitted for review. The payment will be processed shortly.'}
              </p>
            </div>
            {verifiedKycData && <KycSummaryCard kycData={verifiedKycData} />}
          </div>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border-2 border-amber-200 p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h2>
            <p className="text-gray-600">This verification link has expired. The payment will be refunded to the sender.</p>
          </div>
        </div>
      );
    }

    if (status === 'refunded') {
      return (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border-2 border-red-200 p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Refunded</h2>
            <p className="text-gray-600">This payment has been refunded to the sender.</p>
          </div>
        </div>
      );
    }

    if (status === 'rejected') {
      const rejectionReason = (data as any)?.rejection_reason || 'Your KYC submission did not meet our requirements.';
      const expiresAt = (data as any)?.expires_at;
      const remainingTime = expiresAt
        ? new Date(expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : '';
      return (
        <div className="flex-1 py-10 px-4">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="bg-white rounded-2xl border-2 border-red-200 p-8 text-center shadow-xl">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">KYC Rejected</h2>
              <p className="text-gray-600 mb-4">Your KYC submission has been rejected for the following reason:</p>
              <p className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-4">{rejectionReason}</p>
              <p className="text-gray-600 mb-2">Please re-submit your KYC with the correct details.</p>
              {remainingTime && (
                <p className="text-amber-700 text-sm font-medium">
                  You have until {remainingTime} to complete your KYC. After that, the payment will be automatically refunded to the sender.
                </p>
              )}
            </div>

            {/* Payment Details Card */}
            {data && (
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-2 border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">Payment Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Sender</p>
                    <p className="font-medium text-gray-900">{data.sender_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Category</p>
                    <p className="font-medium text-gray-900">{data.category_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Beneficiary</p>
                    <p className="font-medium text-gray-900">{data.beneficiary_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Expires</p>
                    <p className="font-medium text-amber-700">{new Date(data.expires_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                {(data.bank_name || data.bank_ifsc || data.bank_account_number) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Landmark className="w-4 h-4 text-gray-600" />
                      <h4 className="font-semibold text-gray-800 text-sm">Beneficiary Bank Details</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {data.bank_name && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-gray-500">Bank Name</p>
                            <p className="font-medium text-gray-900">{data.bank_name}</p>
                          </div>
                        </div>
                      )}
                      {data.bank_branch && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-gray-500">Branch</p>
                            <p className="font-medium text-gray-900">{data.bank_branch}</p>
                          </div>
                        </div>
                      )}
                      {data.bank_ifsc && (
                        <div className="flex items-start gap-2">
                          <Hash className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-gray-500">IFSC Code</p>
                            <p className="font-mono font-medium text-gray-900">{data.bank_ifsc}</p>
                          </div>
                        </div>
                      )}
                      {data.bank_account_number && (
                        <div className="flex items-start gap-2">
                          <Wallet className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-gray-500">Account Number</p>
                            <p className="font-mono font-medium text-gray-900">{data.bank_account_number}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => { setStatus('pending'); setSubmitted(false); }}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
            >
              Re-submit KYC
            </button>
          </div>
        </div>
      );
    }

    if (status === 'payment_unavailable') {
      return (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border-2 border-gray-200 p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">KYC Unavailable</h2>
            <p className="text-gray-600">{errorMessage}</p>
          </div>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border-2 border-red-200 p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h2>
            <p className="text-gray-600">{errorMessage}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 py-10 px-4">
        <div className="max-w-lg mx-auto">
          {/* Page title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Merchant Onboarding</h1>
            <p className="text-gray-600 mt-2">Complete your KYC to receive payment</p>
          </div>

          {/* Payment Info Card */}
          {data && (
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-2 border-gray-200 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Payment Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Sender</p>
                  <p className="font-medium text-gray-900">{data.sender_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{data.category_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Beneficiary</p>
                  <p className="font-medium text-gray-900">{data.beneficiary_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Expires</p>
                  <p className="font-medium text-amber-700">{new Date(data.expires_at).toLocaleString('en-IN')}</p>
                </div>
              </div>
              {(data.bank_name || data.bank_ifsc || data.bank_account_number) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Landmark className="w-4 h-4 text-gray-600" />
                    <h4 className="font-semibold text-gray-800 text-sm">Beneficiary Bank Details</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {data.bank_name && (
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-gray-500">Bank Name</p>
                          <p className="font-medium text-gray-900">{data.bank_name}</p>
                        </div>
                      </div>
                    )}
                    {data.bank_branch && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-gray-500">Branch</p>
                          <p className="font-medium text-gray-900">{data.bank_branch}</p>
                        </div>
                      </div>
                    )}
                    {data.bank_ifsc && (
                      <div className="flex items-start gap-2">
                        <Hash className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-gray-500">IFSC Code</p>
                          <p className="font-mono font-medium text-gray-900">{data.bank_ifsc}</p>
                        </div>
                      </div>
                    )}
                    {data.bank_account_number && (
                      <div className="flex items-start gap-2">
                        <Wallet className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-gray-500">Account Number</p>
                          <p className="font-mono font-medium text-gray-900">{data.bank_account_number}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {/* KYC Method Selector */}
            {showDigilockerOption && (
              <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Select Verification Method</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Choose how you'd like to complete your KYC</p>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setKycMethod('digilocker')}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      effectiveMethod === 'digilocker'
                        ? 'border-[#8c76f0] bg-purple-50'
                        : 'border-gray-200 hover:border-[#8c76f0] hover:bg-purple-50/40'
                    }`}
                  >
                    <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ScanFace className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{provider.provider_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Instant, paperless verification</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Recommended
                        </span>
                        <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Instant
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setKycMethod('manual')}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      effectiveMethod === 'manual'
                        ? 'border-[#8c76f0] bg-purple-50'
                        : 'border-gray-200 hover:border-[#8c76f0] hover:bg-purple-50/40'
                    }`}
                  >
                    <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Manual Upload</p>
                      <p className="text-xs text-gray-500 mt-0.5">Upload your PAN card document</p>
                      <span className="inline-block mt-1.5 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Upto 48 Working Hours for Approval
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* DigiLocker Flow */}
            {effectiveMethod === 'digilocker' && provider && token && (
              <MerchantDlFlow
                token={token}
                providerName={provider.provider_name}
                expectedPan={panNumber}
                onSuccess={handleDigiLockerSuccess}
                onFallback={handleDigiLockerFallback}
              />
            )}

            {/* Manual KYC Form */}
            {effectiveMethod === 'manual' && (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-200">
                  Verification Details
                </h3>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{formError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <input
                      type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all text-sm"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
                    <input
                      type="tel" value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all text-sm"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    PAN Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text" value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                    maxLength={10}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono tracking-wider text-sm"
                    placeholder="AAAAA0000A"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    PAN Card Photo <span className="text-red-600">*</span>
                  </label>
                  <label className="flex items-center gap-3 px-5 py-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#8c76f0] hover:bg-purple-50 transition-all">
                    <Upload className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{panFile ? panFile.name : 'Upload PAN card image'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">JPG, PNG or PDF up to 2MB</p>
                    </div>
                    <input type="file" accept="image/*,.pdf"
                      onChange={(e) => setPanFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {panFile && (
                    <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />File selected: {panFile.name}
                    </p>
                  )}
                </div>

                <button
                  type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</>
                  ) : (
                    <><ShieldCheck className="w-5 h-5" />Submit KYC</>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            This is a secure verification page. Your information is encrypted and protected.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      <MerchantHeader />
      <div className="pt-20 flex flex-col flex-1">
        {pageContent()}
      </div>
      <MerchantFooter />
    </div>
  );
}
