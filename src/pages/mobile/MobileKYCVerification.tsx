import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle,
  ScanFace,
  FileText,
  Info,
} from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useKycData } from '../kyc/useKycData';
import PersonalDetailsSection from '../kyc/PersonalDetailsSection';
import PanSection from '../kyc/PanSection';
import AddressSection from '../kyc/AddressSection';
import BusinessSection from '../kyc/BusinessSection';
import DigiLockerFlow, { DigiLockerResult } from '../kyc/DigiLockerFlow';

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

export default function MobileKYCVerification() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId: authUserId, userEmail: authUserEmail, logout } = useAuth();
  // Accept userId from location state (navigate from Dashboard) or fall back to auth context
  const userId = (location.state?.userId as string | undefined) || authUserId || '';
  const userEmail = (location.state?.userEmail as string | undefined) || authUserEmail || '';

  // CashFree DigiLocker redirects back to this page with ?cf_verification_id=...
  // Relay it to the opener popup, or store in sessionStorage if popup was blocked.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cfId = params.get('cf_verification_id') || params.get('verification_id');
    if (!cfId) return;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ cf_verification_id: cfId }, '*');
      window.close();
    } else {
      sessionStorage.setItem('cf_verification_id', cfId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!userId) navigate('/mobile/login', { replace: true });
  }, [userId, navigate]);

  const { kycData, loading, error, refetch } = useKycData(userId ?? null);

  const [provider, setProvider] = useState<KycProvider | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [kycMethod, setKycMethod] = useState<KycMethod>(null);
  const [digilockerDone, setDigilockerDone] = useState(false);

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
    navigate('/mobile/login', { replace: true });
  };

  const handleDigiLockerSuccess = (_result: DigiLockerResult) => {
    setDigilockerDone(true);
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

  // Determine if DigiLocker option should be shown
  const showDigilockerOption = !providerLoading && provider !== null && !alreadyVerified;

  // Auto-select DigiLocker when provider is available and KYC not done
  const effectiveMethod = kycMethod ?? (showDigilockerOption ? 'digilocker' : 'manual');

  return (
    <MobileLayout
      userId={userId}
      userEmail={userEmail}
      onLogout={handleLogout}
      showBack={true}
    >
      <div className="px-4 py-3 max-w-md mx-auto">
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">My KYC Details</h1>
              <p className="text-gray-500 text-xs mt-0">
                Complete your identity verification to start accepting and making payments.
              </p>
            </div>
          </div>
        </div>

        {/* Status banners */}
        {overallStatus === 'verification_pending' && (
          <div className="mb-3 bg-amber-50 border-2 border-amber-300 rounded-2xl px-3 py-2.5 flex items-start gap-2.5">
            <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Under Review</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Your KYC documents have been submitted and are currently under review. This
                typically takes 1–2 business days.
              </p>
            </div>
          </div>
        )}

        {overallStatus === 'rejected' && (
          <div className="mb-3 bg-red-50 border-2 border-red-300 rounded-2xl px-3 py-2.5 flex items-start gap-2.5">
            <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-800 text-sm">Verification Rejected</p>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                One or more of your documents were rejected. Please review the rejection reasons
                below and re-submit corrected documents.
              </p>
            </div>
          </div>
        )}

        {digilockerDone && (
          <div className="mb-3 bg-green-50 border-2 border-green-300 rounded-2xl px-3 py-2.5 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800 text-sm">KYC Auto-Verified via DigiLocker</p>
              <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
                Your identity has been verified automatically. Your account is now active.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-4 py-6 text-center">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={refetch}
              className="mt-3 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
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
              onSaved={refetch}
            />

            {/* KYC Method Selector — shown when a provider is enabled and KYC not yet done */}
            {showDigilockerOption && !digilockerDone && !alreadyVerified && (
              <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-violet-50">
                  <h3 className="font-semibold text-gray-900 text-sm">Select Verification Method</h3>
                  <p className="text-xs text-gray-500 mt-0">
                    Choose how you'd like to complete your KYC
                  </p>
                </div>
                <div className="p-2.5 space-y-2">
                  <button
                    onClick={() => setKycMethod('digilocker')}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all ${
                      effectiveMethod === 'digilocker'
                        ? 'border-[#8c76f0] bg-purple-50'
                        : 'border-gray-200 active:border-[#8c76f0] active:bg-purple-50/40'
                    }`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ScanFace className="w-4 h-4 text-[#8c76f0]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{provider.provider_name}</p>
                      <p className="text-xs text-gray-500 mt-0 leading-relaxed">
                        Instant, paperless verification using your DigiLocker account
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
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
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all ${
                      effectiveMethod === 'manual'
                        ? 'border-[#8c76f0] bg-purple-50'
                        : 'border-gray-200 active:border-[#8c76f0] active:bg-purple-50/40'
                    }`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#8c76f0]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">Manual Upload</p>
                      <p className="text-xs text-gray-500 mt-0 leading-relaxed">
                        Upload PAN card and address proof documents manually
                      </p>
                      <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
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
                <PanSection userId={userId} data={kycData?.pan ?? null} onSaved={refetch} />
                <AddressSection userId={userId} data={kycData?.address ?? null} onSaved={refetch} />
                <BusinessSection userId={userId} data={kycData?.business ?? null} onSaved={refetch} />
              </>
            )}

            {/* Why KYC is Required */}
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl px-3 py-2.5">
              <p className="text-sm font-semibold text-[#8c76f0] mb-1.5 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                Why KYC is Required
              </p>
              <ul className="space-y-1 text-xs text-gray-700">
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
    </MobileLayout>
  );
}
