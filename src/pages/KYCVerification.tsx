import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle,
  ScanFace,
  FileText,
} from 'lucide-react';
import { useKycData } from './kyc/useKycData';
import PanSection from './kyc/PanSection';
import AddressSection from './kyc/AddressSection';
import BusinessSection from './kyc/BusinessSection';
import PersonalDetailsSection from './kyc/PersonalDetailsSection';
import DigiLockerFlow, { DigiLockerResult } from './kyc/DigiLockerFlow';
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import { useAuth } from '../contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface KycProvider {
  id: string;
  provider_name: string;
  environment: string;
  is_enabled: boolean;
  is_default: boolean;
}

type KycMethod = 'digilocker' | 'manual' | null;

export default function KYCVerification() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId: authUserId, userEmail: authUserEmail } = useAuth();
  // Accept userId from location state (navigate from Dashboard) or fall back to auth context
  const userId = (location.state?.userId as string | undefined) || authUserId || '';
  const userEmail = (location.state?.userEmail as string | undefined) || authUserEmail || '';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // CashFree DigiLocker redirects back to this page with ?cf_verification_id=...
  // Bridge-based DigiLocker redirect falls back to ?code=...&state=... when popup is blocked.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cfId = params.get('cf_verification_id') || params.get('verification_id');
    const code = params.get('code');

    if (cfId) {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ cf_verification_id: cfId }, '*');
        window.close();
      } else {
        sessionStorage.setItem('cf_verification_id', cfId);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (code) {
      sessionStorage.setItem('digilocker_code', code);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!userId) navigate('/login', { replace: true });
  }, [userId, navigate]);

  const { kycData, loading, error, refetch, refresh } = useKycData(userId ?? null);
  const { logout } = useAuth();

  const [provider, setProvider] = useState<KycProvider | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [kycMethod, setKycMethod] = useState<KycMethod>(null);
  const [digilockerDone, setDigilockerDone] = useState(false);
  const [kycNavRefreshKey, setKycNavRefreshKey] = useState(0);

  useEffect(() => {
    fetchProvider();
  }, []);

  const fetchProvider = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-kyc-provider`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setProvider(data.provider || null);
    } catch {
      setProvider(null);
    } finally {
      setProviderLoading(false);
    }
  };

  if (!userId) return null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleDigiLockerSuccess = (_result: DigiLockerResult) => {
    setDigilockerDone(true);
    setKycNavRefreshKey(k => k + 1);
    refetch();
  };

  const handleDigiLockerFallback = (_reason: string) => {
    setKycMethod('manual');
  };

  const overallStatus = (() => {
    if (!kycData) return null;
    const panStatus = kycData.pan?.status;
    const addrStatus = kycData.address?.status;
    const bizStatus = kycData.business?.status;
    const hasBusinessDocs =
      kycData.business?.incorporation_certificate_url || kycData.business?.gst_certificate_url;

    if (
      panStatus === 'rejected' ||
      addrStatus === 'rejected' ||
      (hasBusinessDocs && bizStatus === 'rejected')
    ) {
      return 'rejected';
    }
    if (
      panStatus === 'verification_pending' ||
      addrStatus === 'verification_pending' ||
      (hasBusinessDocs && bizStatus === 'verification_pending')
    ) {
      return 'verification_pending';
    }
    return 'pending';
  })();

  const alreadyVerified =
    kycData?.pan?.status === 'verified' && kycData?.address?.status === 'verified';

  const showDigilockerOption = !providerLoading && provider !== null && !alreadyVerified;

  const effectiveMethod = kycMethod ?? (showDigilockerOption ? 'digilocker' : 'manual');

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavigation
        userEmail={userEmail}
        userId={userId}
        onLogout={handleLogout}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        kycRefreshKey={kycNavRefreshKey}
      />

      <div className="flex max-w-7xl mx-auto">
        <DashboardSidebar
          userId={userId}
          userEmail={userEmail}
          currentPage="kyc"
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-3xl">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">My KYC Details</h1>
              </div>
              <p className="text-gray-500 text-sm mt-1 ml-[52px]">
                Complete your identity verification to start accepting and making payments.
              </p>
            </div>

            {overallStatus === 'verification_pending' && (
              <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800">Under Review</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    Your KYC documents have been submitted and are currently under review. This
                    typically takes 1–2 business days.
                  </p>
                </div>
              </div>
            )}

            {overallStatus === 'rejected' && (
              <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-800">Verification Rejected</p>
                  <p className="text-sm text-red-700 mt-0.5">
                    One or more of your documents were rejected. Please review the rejection reasons
                    below and re-submit corrected documents.
                  </p>
                </div>
              </div>
            )}

            {digilockerDone && (
              <div className="mb-6 bg-green-50 border-2 border-green-300 rounded-2xl px-5 py-4 flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800">KYC Auto-Verified via DigiLocker</p>
                  <p className="text-sm text-green-700 mt-0.5">
                    Your identity has been verified automatically. Your account is now active.
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-6 text-center">
                <p className="text-red-700 text-sm">{error}</p>
                <button
                  onClick={refetch}
                  className="mt-3 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Personal Details — always visible, above method selector */}
                <PersonalDetailsSection
                  userId={userId}
                  profile={kycData?.userProfile ?? null}
                  kycLocked={
                    kycData?.pan?.status === 'verified' ||
                    kycData?.pan?.status === 'verification_pending' ||
                    kycData?.address?.status === 'verified' ||
                    kycData?.address?.status === 'verification_pending'
                  }
                  onSaved={refresh}
                />

                {/* KYC Method Selector — shown when a provider is enabled and KYC not yet done */}
                {showDigilockerOption && !digilockerDone && !alreadyVerified && (
                  <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] overflow-hidden transition-all hover:shadow-xl">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-violet-50">
                      <h3 className="font-semibold text-gray-900 text-sm">Select Verification Method</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Choose how you'd like to complete your KYC
                      </p>
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
                        <div className="w-9 h-9 bg-gradient-to-r from-purple-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <ScanFace className="w-5 h-5 text-[#8c76f0]" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{provider.provider_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Instant, paperless verification using your DigiLocker account
                          </p>
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
                        <div className="w-9 h-9 bg-gradient-to-r from-purple-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-[#8c76f0]" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">Manual Upload</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Upload PAN card and address proof documents manually
                          </p>
                          <span className="inline-block mt-1.5 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            Upto 48 Working Hours for Approval
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* DigiLocker Flow */}
                {effectiveMethod === 'digilocker' && provider && !digilockerDone && (
                  <DigiLockerFlow
                    userId={userId}
                    providerName={provider.provider_name}
                    authToken=""
                    onSuccess={handleDigiLockerSuccess}
                    onFallback={handleDigiLockerFallback}
                  />
                )}

                {/* Manual KYC sections */}
                {(effectiveMethod === 'manual' || !showDigilockerOption || digilockerDone) && (
                  <>
                    <PanSection userId={userId} data={kycData?.pan ?? null} onSaved={refresh} />
                    <AddressSection userId={userId} data={kycData?.address ?? null} onSaved={refresh} />
                    <BusinessSection userId={userId} data={kycData?.business ?? null} onSaved={refresh} />
                  </>
                )}

                <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl px-5 py-4">
                  <p className="text-sm font-semibold text-[#8c76f0] mb-2">Why KYC is Required</p>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8c76f0] flex-shrink-0" />
                      Comply with regulatory requirements and prevent fraud
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8c76f0] flex-shrink-0" />
                      Enable secure payment processing and settlements
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8c76f0] flex-shrink-0" />
                      Access higher transaction limits and premium features
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
