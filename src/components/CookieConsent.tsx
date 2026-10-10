import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'pbc_cookie_consent';
const CONSENT_EXPIRY_DAYS = 180;

interface ConsentState {
  accepted: boolean;
  analytics: boolean;
  timestamp: number;
}

function loadConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (Date.now() - parsed.timestamp > CONSENT_EXPIRY_DAYS * 86400000) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(analytics: boolean): void {
  const state: ConsentState = { accepted: true, analytics, timestamp: Date.now() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
}

function applyConsent(analytics: boolean): void {
  if (typeof window === 'undefined') return;
  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied',
    });
  }
}

export function initDefaultConsent(): void {
  if (typeof window === 'undefined') return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  if (typeof (window as any).gtag !== 'function') {
    (window as any).gtag = function () { (window as any).dataLayer.push(arguments); };
  }
  (window as any).gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });

  const existing = loadConsent();
  if (existing) {
    applyConsent(existing.analytics);
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    saveConsent(true);
    applyConsent(true);
    setVisible(false);
  };

  const handleRejectAll = () => {
    saveConsent(false);
    applyConsent(false);
    setVisible(false);
  };

  const handleSavePrefs = () => {
    saveConsent(analyticsEnabled);
    applyConsent(analyticsEnabled);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in fade-in slide-in-from-bottom duration-300">
      <div className="mx-auto max-w-3xl m-3 sm:m-4 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Cookie className="w-4 h-4 text-blue-600" />
          </div>
          <p className="flex-1 text-xs sm:text-sm text-gray-600 leading-snug">
            We use essential cookies for checkout. Optional analytics cookies help us improve.{' '}
            <Link to="/privacy" className="text-blue-600 hover:underline font-medium" onClick={() => setVisible(false)}>
              Learn more
            </Link>
          </p>
          <button
            onClick={handleRejectAll}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="Close"
            aria-label="Close cookie banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showPrefs && (
          <div className="px-4 pb-2 border-t border-gray-100 pt-3">
            <label className="flex items-center justify-between py-1.5 cursor-pointer">
              <div>
                <span className="text-xs font-medium text-gray-900">Essential</span>
                <p className="text-[11px] text-gray-500">Required for login and checkout. Always active.</p>
              </div>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Required</span>
            </label>
            <label className="flex items-center justify-between py-1.5 cursor-pointer">
              <div>
                <span className="text-xs font-medium text-gray-900">Analytics</span>
                <p className="text-[11px] text-gray-500">Google Analytics to improve the platform.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analyticsEnabled}
                onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${analyticsEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${analyticsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          {!showPrefs ? (
            <>
              <button
                onClick={handleRejectAll}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => setShowPrefs(true)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-white transition-colors"
              >
                Customize
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
              >
                Accept All
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowPrefs(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSavePrefs}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
