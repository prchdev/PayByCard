import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Landmark, Zap, BadgeIndianRupee, Building2, Lock,
  Fingerprint, LogOut, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function MobileHome() {
  const navigate = useNavigate();
  const { isRemembered, rememberedEmail, biometricUnlock, clearRememberedSession } = useAuth();
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  const highlights = [
    { icon: BadgeIndianRupee, label: 'Lowest Fees' },
    { icon: Shield, label: 'No Hidden MCC Charges' },
    { icon: Zap, label: 'Fast Settlement' },
    { icon: Building2, label: 'RBI Compliant' },
    { icon: Landmark, label: 'Registered Company' },
    { icon: Lock, label: '100% Secure' },
  ];

  const handleBiometricUnlock = async () => {
    setUnlocking(true);
    setUnlockError('');

    // Simulate biometric prompt — in native React app this will be replaced
    // with the actual Biometric / Phone lock API call.
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      biometricUnlock();
      navigate('/mobile/dashboard');
    } catch {
      setUnlockError('Biometric authentication failed. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleSwitchAccount = () => {
    clearRememberedSession();
    navigate('/mobile/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      {/* Hero */}
      <section className="relative px-4 pt-6 pb-3 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-48 h-48 bg-[#8c76f0] rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
        <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>

        <div className="relative text-center space-y-3">
          <img src="/PayByCard-Logo.png" alt="PayByCard" className="w-28 h-14 mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Pay Bills with Your{' '}
            <span className="bg-gradient-to-r from-[#8c76f0] to-purple-600 bg-clip-text text-transparent">
              Credit Card
            </span>
          </h1>
          <p className="text-sm text-gray-600 max-w-sm mx-auto">
            Use Credit Card to Pay Any Expenses By Transferring to Beneficiary Bank Account
          </p>

          {isRemembered ? (
            <div className="flex flex-col gap-2 pt-1">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#8c76f0] to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Fingerprint className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Welcome Back</p>
                  <p className="text-xs text-gray-500">{rememberedEmail}</p>
                </div>

                {unlockError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                    <p className="text-xs text-red-800">{unlockError}</p>
                  </div>
                )}

                <button
                  onClick={handleBiometricUnlock}
                  disabled={unlocking}
                  className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-5 h-5" />
                  {unlocking ? 'Authenticating...' : 'Unlock with Biometric'}
                </button>

                <button
                  onClick={handleSwitchAccount}
                  className="w-full flex items-center justify-center gap-2 text-xs text-gray-600 font-medium py-1.5 active:scale-95 transition-transform"
                >
                  <LogOut className="w-4 h-4" />
                  Switch Account
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => navigate('/mobile/register')}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-purple-500/30 active:scale-95 transition-transform"
              >
                Register
              </button>
              <button
                onClick={() => navigate('/mobile/login')}
                className="w-full border-2 border-[#8c76f0] text-[#8c76f0] font-semibold py-3 rounded-xl active:scale-95 transition-transform"
              >
                Login
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Highlights */}
      <section className="px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
          <div className="grid grid-cols-2 gap-2">
            {highlights.map((h) => (
              <div
                key={h.label}
                className="flex items-center gap-2 bg-gradient-to-br from-[#f3f0fe] to-[#ece5ff] rounded-xl px-2.5 py-2 border border-[#e0d5fb]"
              >
                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                  <h.icon className="w-4 h-4 text-[#8c76f0]" />
                </div>
                <span className="text-xs font-semibold text-gray-800">{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 pb-4 pt-3 text-center">
        <p className="text-xs text-gray-500 leading-relaxed">
          &copy; 2026 PayByCard Technologies Pvt. Ltd. All rights reserved.
          <br />
          CIN: U62099MH2025PTC462923
        </p>
      </footer>

    </div>
  );
}
