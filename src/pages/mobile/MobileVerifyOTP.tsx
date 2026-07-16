import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Smartphone, RefreshCw, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function MobileVerifyOTP() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { userId, email, mobileNumber, fromLogin } = location.state || {};

  const [mobileOTP, setMobileOTP] = useState(['', '', '', '', '', '']);
  const [emailOTP, setEmailOTP] = useState(['', '', '', '', '', '']);
  const [mobileTimer, setMobileTimer] = useState(30);
  const [emailTimer, setEmailTimer] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errors, setErrors] = useState({ mobile: '', email: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!userId || !email || !mobileNumber) {
      navigate(fromLogin ? '/mobile/login' : '/mobile/register');
    }
  }, [userId, email, mobileNumber, fromLogin, navigate]);

  useEffect(() => {
    if (mobileTimer > 0) { const t = setTimeout(() => setMobileTimer(mobileTimer - 1), 1000); return () => clearTimeout(t); }
  }, [mobileTimer]);

  useEffect(() => {
    if (emailTimer > 0) { const t = setTimeout(() => setEmailTimer(emailTimer - 1), 1000); return () => clearTimeout(t); }
  }, [emailTimer]);

  const handleOTPChange = (value: string, index: number, setter: React.Dispatch<React.SetStateAction<string[]>>, otp: string[], prefix: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp]; next[index] = value; setter(next);
    if (value && index < 5) {
      document.getElementById(`${prefix}-otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, otp: string[], prefix: string) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`${prefix}-otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setter(pasted.split('').concat(Array(6).fill('')).slice(0, 6));
  };

  const handleResend = async (type: 'mobile' | 'email') => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend OTP');
      if (type === 'mobile') { setMobileTimer(30); setMobileOTP(['', '', '', '', '', '']); }
      else { setEmailTimer(30); setEmailOTP(['', '', '', '', '', '']); }
      setSuccess(`OTP resent to your ${type === 'mobile' ? 'mobile' : 'email'}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleVerify = async () => {
    const mStr = mobileOTP.join('');
    const eStr = emailOTP.join('');
    const e = { mobile: '', email: '' };
    if (mStr.length !== 6) e.mobile = 'Enter complete mobile OTP';
    if (eStr.length !== 6) e.email = 'Enter complete email OTP';
    if (e.mobile || e.email) { setErrors(e); return; }

    setIsVerifying(true); setErrors({ mobile: '', email: '' }); setError(''); setSuccess('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mobileOTP: mStr, emailOTP: eStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed');
      login(userId, email);
      navigate('/mobile/kyc-verification', { state: { userId, userEmail: email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const otpInput = (digit: string, index: number, setter: any, otp: string[], prefix: string) => (
    <input
      key={index} id={`${prefix}-otp-${index}`} type="text" inputMode="numeric" maxLength={1}
      value={digit}
      onChange={(e) => handleOTPChange(e.target.value, index, setter, otp, prefix)}
      onKeyDown={(e) => handleKeyDown(e, index, otp, prefix)}
      onPaste={(e) => handlePaste(e, setter)}
      className="w-10 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent"
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-20 pb-8">
      <div className="max-w-sm w-full mx-auto">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify Your Account</h1>
          <p className="text-sm text-gray-500 mt-1">
            {fromLogin ? 'Verify your mobile and email to continue' : 'Codes sent to your mobile and email'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-300 rounded-xl p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#8c76f0]" />
                <label className="text-xs font-semibold text-gray-900">Mobile OTP</label>
              </div>
              <span className="text-xs text-gray-500">{mobileNumber}</span>
            </div>
            <div className="flex justify-center gap-2 mb-2">
              {mobileOTP.map((d, i) => otpInput(d, i, setMobileOTP, mobileOTP, 'mobile'))}
            </div>
            {errors.mobile && <p className="text-red-600 text-xs text-center">{errors.mobile}</p>}
            <div className="text-center">
              {mobileTimer > 0 ? (
                <p className="text-xs text-gray-500">Resend in {mobileTimer}s</p>
              ) : (
                <button onClick={() => handleResend('mobile')} className="text-xs text-[#8c76f0] font-semibold inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />Resend Mobile OTP
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#8c76f0]" />
                <label className="text-xs font-semibold text-gray-900">Email OTP</label>
              </div>
              <span className="text-xs text-gray-500 truncate max-w-[140px]">{email}</span>
            </div>
            <div className="flex justify-center gap-2 mb-2">
              {emailOTP.map((d, i) => otpInput(d, i, setEmailOTP, emailOTP, 'email'))}
            </div>
            {errors.email && <p className="text-red-600 text-xs text-center">{errors.email}</p>}
            <div className="text-center">
              {emailTimer > 0 ? (
                <p className="text-xs text-gray-500">Resend in {emailTimer}s</p>
              ) : (
                <button onClick={() => handleResend('email')} className="text-xs text-[#8c76f0] font-semibold inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />Resend Email OTP
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleVerify} disabled={isVerifying}
            className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {isVerifying ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
