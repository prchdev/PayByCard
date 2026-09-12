import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScanFace, Loader2, CheckCircle, AlertCircle, RefreshCw, ShieldCheck, ExternalLink, WifiOff, UserX, CheckCircle2, XCircle, File as FileEdit } from 'lucide-react';
import { getClientIp } from '../../utils/getClientIp';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface DigiLockerFlowProps {
  userId: string;
  providerName: string;
  authToken: string;
  onSuccess: (data: DigiLockerResult) => void;
  onFallback: (reason: string) => void;
}

export interface DigiLockerResult {
  pan_number: string;
  full_name: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  id_number: string;
  autoApproved: boolean;
}

type Step =
  | 'idle'
  | 'loading_url'
  | 'waiting_popup'
  | 'polling'
  | 'verifying'
  | 'success'
  | 'error'
  | 'name_mismatch'
  | 'dl_unavailable';

interface NameMismatch {
  registeredName: string;
  kycName: string;
  firstMatch: boolean;
  middleMatch: boolean;
  lastMatch: boolean;
  firstName: string;
  middleName: string;
  lastName: string;
}

const isCashFree = (name: string) => name === 'CashFree DigiLocker';

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateCodeVerifier(): string {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const POLL_INTERVAL = 3000;
const MAX_POLLS = 100;

// ── Client-side event logger ───────────────────────────────────────────────────
function logEvent(userId: string, provider: string, action: string, success: boolean, extra?: Record<string, unknown>) {
  fetch(`${SUPABASE_URL}/functions/v1/log-digilocker-event`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      flow: 'user',
      action,
      provider,
      environment: '',
      success,
      ...(extra?.error_code ? { error_code: extra.error_code } : {}),
      ...(extra?.error_message ? { error_message: extra.error_message } : {}),
      raw_response: extra ? { ...extra, error_code: undefined, error_message: undefined } : undefined,
    }),
  }).catch(() => { /* non-critical */ });
}

export default function DigiLockerFlow({ userId, providerName, authToken, onSuccess, onFallback }: DigiLockerFlowProps) {
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [addrError, setAddrError] = useState<'DRIVING_LICENSE_UNAVAILABLE' | 'ADDRESS_PROOF_UNAVAILABLE' | null>(null);
  const [ipWhitelistIp, setIpWhitelistIp] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const [nameMismatch, setNameMismatch] = useState<NameMismatch | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(step);
  const verificationIdRef = useRef(verificationId);
  const redirectUriRef = useRef(redirectUri);
  const codeReceivedRef = useRef(false);
  const codeVerifierRef = useRef<string>('');

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { verificationIdRef.current = verificationId; }, [verificationId]);
  useEffect(() => { redirectUriRef.current = redirectUri; }, [redirectUri]);

  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  // ── On mount: recover from same-tab redirect fallback (sessionStorage) ──────
  useEffect(() => {
    const cfId = sessionStorage.getItem('cf_verification_id');
    const oauthCode = sessionStorage.getItem('digilocker_oauth_code') || sessionStorage.getItem('digilocker_code');
    const storedRedirectUri = sessionStorage.getItem('digilocker_redirect_uri') || '';
    const storedCodeVerifier = sessionStorage.getItem('digilocker_code_verifier') || '';

    if (storedRedirectUri) {
      setRedirectUri(storedRedirectUri);
      redirectUriRef.current = storedRedirectUri;
    }
    if (storedCodeVerifier) {
      codeVerifierRef.current = storedCodeVerifier;
    }

    if (cfId) {
      sessionStorage.removeItem('cf_verification_id');
      setVerificationId(cfId);
      verificationIdRef.current = cfId;
      logEvent(userId, providerName, 'session_restore_cf', true, { cf_verification_id: '[present]' });
      startPolling(cfId);
    } else if (oauthCode) {
      sessionStorage.removeItem('digilocker_oauth_code');
      sessionStorage.removeItem('digilocker_code');
      sessionStorage.removeItem('digilocker_redirect_uri');
      logEvent(userId, providerName, 'session_restore_code', true, {
        redirect_uri: storedRedirectUri || '[empty]',
        has_code_verifier: !!storedCodeVerifier,
      });
      runAutoApprove(oauthCode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Single-use code handler — all paths funnel through here to prevent double-use ──
  // OAuth codes are single-use; calling runAutoApprove twice with the same code causes
  // "Authorization code doesn't exist or is invalid" on the second attempt.
  const handleCode = useCallback((code: string, source: string) => {
    if (codeReceivedRef.current) return; // already processing
    if (stepRef.current !== 'waiting_popup') return;
    codeReceivedRef.current = true;
    localStorage.removeItem('digilocker_code');
    logEvent(userId, providerName, 'localstorage_code', true, { source });
    runAutoApprove(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── postMessage listener (secondary channel) ─────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    const d = event.data;
    if (!d || typeof d !== 'object') return;

    // Bridge-based callback: digilocker-redirect edge function sends { type: 'digilocker_callback', code, state }
    if (d.type === 'digilocker_callback') {
      if (d.error) {
        if (stepRef.current === 'waiting_popup') {
          logEvent(userId, providerName, 'bridge_postmessage_error', false, {
            error_code: 'DIGILOCKER_ERROR',
            error_message: d.error,
            source: 'bridge_postMessage',
          });
          setStep('error');
          setError('DigiLocker authorization was denied or failed. Please try again.');
        }
        return;
      }
      if (d.code && typeof d.code === 'string') {
        handleCode(d.code, 'bridge_postMessage');
      }
      return;
    }

    const cfId = d.cf_verification_id;
    if (cfId && typeof cfId === 'string') {
      if (stepRef.current === 'waiting_popup' || stepRef.current === 'polling') {
        logEvent(userId, providerName, 'postmessage_cf_id', true, { source: 'postMessage' });
        startPolling(cfId);
      }
      return;
    }

    const oauthCode = d.code || d.authCode || d.authorization_code;
    if (oauthCode && typeof oauthCode === 'string') {
      handleCode(oauthCode, 'postMessage');
    }
  }, [handleCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // ── Primary channel: localStorage polling + storage event ────────────────────
  useEffect(() => {
    if (step !== 'waiting_popup') return;

    localStorage.removeItem('digilocker_code');
    localStorage.removeItem('digilocker_error');

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'digilocker_code' && e.newValue) {
        handleCode(e.newValue, 'storage_event');
      }
      if (e.key === 'digilocker_error' && e.newValue) {
        localStorage.removeItem('digilocker_error');
        if (stepRef.current === 'waiting_popup') {
          const errVal = e.newValue;
          logEvent(userId, providerName, 'localstorage_error', false, {
            error_code: 'DIGILOCKER_ERROR',
            error_message: errVal,
            source: 'storage_event',
          });
          setStep('error');
          setError('DigiLocker authorization was denied or failed. Please try again.');
        }
      }
    };

    // Poll every 500ms — storage events don't fire in the same tab that wrote the value
    const pollInterval = setInterval(() => {
      const code = localStorage.getItem('digilocker_code');
      if (code) {
        handleCode(code, 'poll_interval');
        return;
      }
      const err = localStorage.getItem('digilocker_error');
      if (err) {
        localStorage.removeItem('digilocker_error');
        if (stepRef.current === 'waiting_popup') {
          logEvent(userId, providerName, 'localstorage_error', false, {
            error_code: 'DIGILOCKER_ERROR',
            error_message: err,
            source: 'poll_interval',
          });
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

  // ── Popup closed watcher ──────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'waiting_popup') return;
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(interval);
        setTimeout(() => {
          if (codeReceivedRef.current) return;
          const code = localStorage.getItem('digilocker_code');
          if (code) {
            handleCode(code, 'popup_closed_check');
            return;
          }
          if (isCashFree(providerName) && verificationIdRef.current) {
            logEvent(userId, providerName, 'popup_closed_polling', true, {});
            startPolling(verificationIdRef.current);
          } else if (!isCashFree(providerName) && stepRef.current === 'waiting_popup') {
            logEvent(userId, providerName, 'popup_closed_no_code', false, {
              error_code: 'POPUP_CLOSED',
              error_message: 'Popup closed without completing authorization',
            });
            setStep('error');
            setError('DigiLocker authorization window was closed before completing. Please try again.');
          }
        }, 1500);
      }
    }, 600);
    return () => clearInterval(interval);
  }, [step, providerName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start authorization ───────────────────────────────────────────────────────
  const startAuth = async () => {
    setStep('loading_url');
    setError('');
    setManualCode('');
    setShowManualInput(false);
    setNameMismatch(null);
    try {
      // Generate PKCE — required by DigiLocker when openid scope is enabled
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      codeVerifierRef.current = codeVerifier;
      sessionStorage.setItem('digilocker_code_verifier', codeVerifier);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/digilocker-kyc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'get_auth_url', codeChallenge, platform: 'web' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get authorization URL');

      const url: string = data.authUrl;
      const vid: string = data.verificationId || '';
      const rUri: string = data.redirectUri || '';

      setAuthUrl(url);
      setVerificationId(vid);
      verificationIdRef.current = vid;
      setRedirectUri(rUri);
      redirectUriRef.current = rUri;
      // Persist so it survives a same-tab redirect back to this page
      if (rUri) sessionStorage.setItem('digilocker_redirect_uri', rUri);

      const w = 500, h = 700;
      const left = Math.max(0, (window.screen.width - w) / 2 + window.screenX);
      const top = Math.max(0, (window.screen.height - h) / 2 + window.screenY);
      const popup = window.open(
        url,
        'DigiLockerAuth',
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`,
      );

      if (!popup || popup.closed) {
        // Popup blocked — redirect current page; KYCVerification will capture code/state from URL params
        sessionStorage.setItem('digilocker_redirect_uri', rUri);
        sessionStorage.setItem('digilocker_code_verifier', codeVerifier);
        logEvent(userId, providerName, 'popup_blocked_redirect', true, { redirect_uri: rUri });
        window.location.href = url;
        return;
      } else {
        popupRef.current = popup;
        logEvent(userId, providerName, 'popup_opened', true, { redirect_uri: rUri });
        setStep('waiting_popup');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to connect to DigiLocker';
      logEvent(userId, providerName, 'get_auth_url_error', false, {
        error_code: 'GET_AUTH_URL_FAILED',
        error_message: msg,
      });
      if (msg.startsWith('IP_WHITELIST_ERROR:')) {
        const parts = msg.split(':');
        setIpWhitelistIp(parts[1] || '');
        setError('ip_whitelist');
      } else {
        setError(msg);
      }
      setStep('error');
    }
  };

  // ── CashFree: poll check_status ───────────────────────────────────────────────
  const startPolling = (vid: string) => {
    setStep('polling');
    setPollCount(0);
    schedulePoll(vid, 0);
  };

  const schedulePoll = (vid: string, count: number) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(() => doPoll(vid, count), POLL_INTERVAL);
  };

  const doPoll = async (vid: string, count: number) => {
    if (count >= MAX_POLLS) {
      logEvent(userId, providerName, 'poll_timeout', false, {
        error_code: 'POLL_TIMEOUT',
        error_message: `Timed out after ${count} polls`,
        poll_count: count,
      });
      setStep('error');
      setError('DigiLocker authorization timed out. Please try again.');
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/digilocker-kyc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'check_status', verificationId: vid }),
      });
      const data = await res.json();
      const status: string = (data.status || '').toUpperCase();

      setPollCount(count + 1);

      if (status === 'AUTHENTICATED' || status === 'COMPLETED' || status === 'SUCCESS') {
        logEvent(userId, providerName, 'poll_authenticated', true, { status, poll_count: count + 1 });
        runAutoApprove(vid);
      } else if (status === 'CONSENT_DENIED') {
        logEvent(userId, providerName, 'poll_consent_denied', false, {
          error_code: 'CONSENT_DENIED',
          error_message: 'User denied consent in DigiLocker',
          poll_count: count + 1,
        });
        setStep('error');
        setError('You denied consent in DigiLocker. Please try again or use Manual KYC.');
      } else if (status === 'EXPIRED') {
        logEvent(userId, providerName, 'poll_expired', false, {
          error_code: 'SESSION_EXPIRED',
          error_message: 'DigiLocker authorization link expired',
          poll_count: count + 1,
        });
        setStep('error');
        setError('DigiLocker authorization link expired. Please start again.');
      } else {
        schedulePoll(vid, count + 1);
      }
    } catch (_e) {
      schedulePoll(vid, count + 1);
    }
  };

  // ── Auto approve ──────────────────────────────────────────────────────────────
  const runAutoApprove = async (code: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStep('verifying');
    setError('');

    // Resolve redirectUri and codeVerifier — survive same-tab reload via sessionStorage
    const resolvedRedirectUri =
      redirectUriRef.current ||
      sessionStorage.getItem('digilocker_redirect_uri') ||
      undefined;

    const resolvedCodeVerifier =
      codeVerifierRef.current ||
      sessionStorage.getItem('digilocker_code_verifier') ||
      undefined;

    logEvent(userId, providerName, 'auto_approve_start', true, {
      has_redirect_uri: !!resolvedRedirectUri,
      redirect_uri: resolvedRedirectUri || '[empty]',
      has_code_verifier: !!resolvedCodeVerifier,
    });

    try {
      const t0 = Date.now();
      const ipAddress = await getClientIp();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/digilocker-kyc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'auto_approve',
          authCode: code,
          redirectUri: resolvedRedirectUri,
          codeVerifier: resolvedCodeVerifier,
          ipAddress,
        }),
      });
      const data = await res.json();
      const duration_ms = Date.now() - t0;

      if (!res.ok) {
        throw new Error(data.error || 'DigiLocker verification failed');
      }

      if (data.autoApproved) {
        logEvent(userId, providerName, 'auto_approve_success', true, {
          duration_ms,
          has_pan: !!(data.kycData?.pan_number),
          has_id: !!(data.kycData?.id_number),
        });
        setStep('success');
        onSuccess({ ...data.kycData, autoApproved: true });
      } else if (data.error === 'DRIVING_LICENSE_UNAVAILABLE' || data.error === 'ADDRESS_PROOF_UNAVAILABLE') {
        logEvent(userId, providerName, 'auto_approve_addr_unavailable', false, {
          error_code: data.error,
          duration_ms,
        });
        setAddrError(data.error);
        setStep('dl_unavailable');
      } else if ((data.nameMatches === false || data.nameMismatch) && data.nameMismatch) {
        logEvent(userId, providerName, 'auto_approve_name_mismatch', false, {
          error_code: 'NAME_MISMATCH',
          registered_name: data.nameMismatch?.registeredName,
          kyc_name: data.nameMismatch?.kycName,
          duration_ms,
        });
        setNameMismatch(data.nameMismatch);
        setStep('name_mismatch');
      } else {
        logEvent(userId, providerName, 'auto_approve_failed', false, {
          error_code: data.error ? 'BUSINESS_ERROR' : 'UNKNOWN',
          error_message: data.error || 'No autoApproved flag and no nameMismatch',
          http_status: res.status,
          duration_ms,
          raw_response_keys: Object.keys(data),
        });
        setStep('error');
        setError(data.error || 'DigiLocker verification could not be completed.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      logEvent(userId, providerName, 'auto_approve_exception', false, {
        error_code: 'FETCH_EXCEPTION',
        error_message: msg,
      });
      setStep('error');
      setError(msg);
    }
  };

  const retry = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStep('idle');
    setError('');
    setAddrError(null);
    setManualCode('');
    setShowManualInput(false);
    setNameMismatch(null);
    setVerificationId('');
    setAuthUrl('');
    setRedirectUri('');
    redirectUriRef.current = '';
    setPollCount(0);
    popupRef.current = null;
    codeReceivedRef.current = false;
    codeVerifierRef.current = '';
    localStorage.removeItem('digilocker_code');
    localStorage.removeItem('digilocker_error');
    sessionStorage.removeItem('digilocker_redirect_uri');
    sessionStorage.removeItem('digilocker_oauth_code');
    sessionStorage.removeItem('digilocker_code');
    sessionStorage.removeItem('digilocker_code_verifier');
  };

  // ── DL Unavailable state ─────────────────────────────────────────────────────
  if (step === 'dl_unavailable') {
    const isDlSpecific = addrError === 'DRIVING_LICENSE_UNAVAILABLE';
    return (
      <div className="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {isDlSpecific ? 'Driving License Unavailable' : 'Address Proof Unavailable'}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {isDlSpecific
                ? 'Your Driving License could not be retrieved from DigiLocker.'
                : 'Address proof documents could not be retrieved from DigiLocker.'}
            </p>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            {isDlSpecific
              ? 'Driver License is not available in DigiLocker. Please proceed with uploading address proof manually or connect your driving license with DigiLocker and verify again.'
              : 'Address proof documents are not available in your DigiLocker account. Please upload your address proof manually or ensure your documents (Aadhaar, Passport, Driving License, or Voter ID) are linked to DigiLocker and try again.'}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onFallback('dl_unavailable')}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Upload Address Proof Manually
            </button>
            <button
              onClick={retry}
              className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl border-2 border-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {isDlSpecific ? 'Connect DL to DigiLocker & Retry' : 'Link Documents to DigiLocker & Retry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Name mismatch state ───────────────────────────────────────────────────────
  if (step === 'name_mismatch' && nameMismatch) {
    const fields = [
      { label: 'First Name', registered: nameMismatch.firstName, matched: nameMismatch.firstMatch },
      ...(nameMismatch.middleName
        ? [{ label: 'Middle Name', registered: nameMismatch.middleName, matched: nameMismatch.middleMatch }]
        : []),
      { label: 'Last Name', registered: nameMismatch.lastName, matched: nameMismatch.lastMatch },
    ];

    return (
      <div className="bg-white border-2 border-red-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-red-50 border-b border-red-200 flex items-start gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <UserX className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">Name Mismatch Detected</p>
            <p className="text-xs text-red-600 mt-0.5">
              Your DigiLocker name does not match your registration details.
            </p>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Registered Name</p>
              <p className="text-sm font-semibold text-gray-900 break-words">{nameMismatch.registeredName}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-2">DigiLocker Name</p>
              <p className="text-sm font-semibold text-red-800 break-words">{nameMismatch.kycName || 'Not available'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Field Breakdown</p>
            {fields.map(({ label, registered, matched }) => (
              <div
                key={label}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm ${
                  matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {matched
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  }
                  <span className={matched ? 'text-gray-700' : 'text-red-700'}>
                    <span className="font-medium">{label}:</span>{' '}
                    <span className="font-mono">{registered}</span>
                  </span>
                </div>
                <span className={`text-xs font-semibold ${matched ? 'text-green-700' : 'text-red-600'}`}>
                  {matched ? 'Matched' : 'Not matched'}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <p className="font-medium mb-1">What to do next</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              The name in your DigiLocker / Aadhaar or PAN must match the name you registered with.
              If there is a genuine discrepancy, please submit your KYC manually with supporting documents,
              or contact support to update your account name.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onFallback('name_mismatch')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-sm shadow-purple-500/20"
            >
              <FileEdit className="w-4 h-4" />
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

  // ── Success state ─────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-2xl px-5 py-5">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">KYC Verified via {providerName}</p>
            <p className="text-sm text-green-700 mt-1">
              Your identity has been automatically verified using DigiLocker. No further action required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main card ─────────────────────────────────────────────────────────────────
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

        {/* ── Idle / Error ── */}
        {(step === 'idle' || step === 'error') && (
          <>
            {step === 'error' && error === 'ip_whitelist' ? (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Server IP Not Whitelisted</p>
                    <p className="text-sm text-amber-700 mt-1">
                      CashFree requires this server's IP to be whitelisted before it can call the DigiLocker API.
                    </p>
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
                <p className="text-xs text-amber-600">
                  Add this IP in your CashFree dashboard under <strong>Settings &rarr; IP Whitelist</strong>.
                </p>
                <a
                  href="https://www.cashfree.com/docs/secure-id/get-started/integration/ip-whitelisting-verification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#8c76f0] hover:underline font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  CashFree IP Whitelisting Guide
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
                ['2', 'Log in to DigiLocker and authorize access to your Aadhaar and PAN.'],
                ['3', 'Close the popup after authorizing — your KYC will complete automatically.'],
              ].map(([num, text]) => (
                <div key={num} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-[#8c76f0] text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">
                    {num}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: text }} />
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

        {/* ── Loading URL ── */}
        {step === 'loading_url' && (
          <div className="flex items-center justify-center gap-3 py-6 text-[#8c76f0]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Opening DigiLocker…</span>
          </div>
        )}

        {/* ── Waiting for popup ── */}
        {step === 'waiting_popup' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 py-3">
              <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-[#8c76f0]" />
              <div>
                <p className="text-sm font-medium text-gray-800">Waiting for DigiLocker authorization…</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Complete the authorization in the popup window, then come back here.
                </p>
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
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.trim())}
                  placeholder={isCashFree(providerName) ? 'Paste verification ID' : 'Paste authorization code'}
                  className="w-full px-3.5 py-2.5 border-2 border-gray-300 rounded-xl text-sm focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none transition-colors font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter' && manualCode.trim()) runAutoApprove(manualCode); }}
                />
                <button
                  onClick={() => runAutoApprove(manualCode)}
                  disabled={!manualCode.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm shadow-purple-500/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verify KYC
                </button>
              </div>
            )}

            <button
              onClick={retry}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline w-full text-center"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Polling ── */}
        {step === 'polling' && (
          <div className="flex items-center gap-3 py-3">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-[#8c76f0]" />
            <div>
              <p className="text-sm font-medium text-gray-800">Checking authorization status…</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Waiting for DigiLocker consent confirmation
                {pollCount > 0 ? ` (${pollCount})` : ''}
              </p>
            </div>
          </div>
        )}

        {/* ── Verifying ── */}
        {step === 'verifying' && (
          <div className="flex items-center gap-3 py-3">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-[#8c76f0]" />
            <div>
              <p className="text-sm font-medium text-gray-800">Verifying your identity…</p>
              <p className="text-xs text-gray-500 mt-0.5">Fetching your Aadhaar and PAN from DigiLocker</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
