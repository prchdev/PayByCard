import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, ShieldCheck, AlertCircle, Eye, EyeOff, Smartphone, RefreshCw, CheckCircle } from 'lucide-react';
import { validatePassword, PASSWORD_REQUIREMENTS } from '../../utils/passwordValidation';

export default function MobileForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', '']);
  const [mobileOtp, setMobileOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [emailTimer, setEmailTimer] = useState(0);
  const [mobileTimer, setMobileTimer] = useState(0);

  const emailRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));
  const mobileRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));

  useEffect(() => {
    if (emailTimer > 0) { const t = setTimeout(() => setEmailTimer(v => v - 1), 1000); return () => clearTimeout(t); }
  }, [emailTimer]);
  useEffect(() => {
    if (mobileTimer > 0) { const t = setTimeout(() => setMobileTimer(v => v - 1), 1000); return () => clearTimeout(t); }
  }, [mobileTimer]);
  useEffect(() => {
    if (step === 'otp') setTimeout(() => emailRefs.current[0]?.focus(), 50);
  }, [step]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-forgot-password`, {
        method: 'POST', headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setMaskedMobile(data.maskedMobile || '');
      setSuccess('OTPs sent to your email and mobile');
      setEmailTimer(30); setMobileTimer(30); setStep('otp');
    } catch (err) { setError(err instanceof Error ? err.message : 'An error occurred'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (val: string, idx: number, setter: any, refs: any) => {
    if (!/^\d*$/.test(val)) return;
    setter((prev: string[]) => { const n = [...prev]; n[idx] = val.slice(-1); return n; });
    if (val && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent, idx: number, otp: string[], refs: any) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) refs.current[idx - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent, setter: any, refs: any) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setter(pasted.split('').concat(Array(6).fill('')).slice(0, 6));
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleResend = async (type: 'email' | 'mobile') => {
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-forgot-password`, {
        method: 'POST', headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      if (type === 'email') { setEmailOtp(['', '', '', '', '', '']); setEmailTimer(30); emailRefs.current[0]?.focus(); }
      else { setMobileOtp(['', '', '', '', '', '']); setMobileTimer(30); mobileRefs.current[0]?.focus(); }
      setSuccess(`OTP resent to your ${type}`); setTimeout(() => setSuccess(''), 5000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to resend'); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const eStr = emailOtp.join(''), mStr = mobileOtp.join('');
    if (eStr.length !== 6) { setError('Enter complete email OTP'); return; }
    if (mStr.length !== 6) { setError('Enter complete mobile OTP'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-verify-reset-otp`, {
        method: 'POST', headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, emailOtp: eStr, mobileOtp: mStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');
      setSuccess('OTPs verified'); setStep('password');
    } catch (err) { setError(err instanceof Error ? err.message : 'An error occurred'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const pv = validatePassword(newPassword);
    if (!pv.isValid) { setError(pv.error!); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-reset-password`, {
        method: 'POST', headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: emailOtp.join(''), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setSuccess('Password reset! Redirecting to login...');
      setTimeout(() => navigate('/mobile/login'), 2000);
    } catch (err) { setError(err instanceof Error ? err.message : 'An error occurred'); }
    finally { setLoading(false); }
  };

  const otpRow = (otp: string[], setter: any, refs: any) => (
    <div className="flex justify-center gap-2">
      {otp.map((d, i) => (
        <input
          key={i} ref={(el: HTMLInputElement | null) => { refs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={(e) => handleOtpChange(e.target.value, i, setter, refs)}
          onKeyDown={(e) => handleOtpKeyDown(e, i, otp, refs)}
          onPaste={(e) => handleOtpPaste(e, setter, refs)}
          className="w-9 h-11 text-center text-base font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8c76f0]"
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-12 pb-6">
      <div className="max-w-sm w-full mx-auto">
        <button onClick={() => navigate('/mobile/login')} className="mb-3 flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Login
        </button>

        <div className="text-center mb-4">
          <img src="/PayByCard-Logo.png" alt="PayByCard" className="w-20 h-20 object-contain mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-900">
            {step === 'email' && 'Forgot Password'}
            {step === 'otp' && 'Verify OTPs'}
            {step === 'password' && 'Reset Password'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {step === 'email' && 'Enter your email to receive codes'}
            {step === 'otp' && `Codes sent to email${maskedMobile ? ` and ${maskedMobile}` : ' and mobile'}`}
            {step === 'password' && 'Create a new password'}
          </p>
        </div>

        {success && (
          <div className="mb-4 bg-green-50 border border-green-300 rounded-xl p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm"
                  placeholder="john.doe@example.com" autoComplete="email"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 active:scale-95 transition-transform">
                {loading ? 'Sending...' : 'Send OTPs'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-[#8c76f0]" />
                  <label className="text-xs font-semibold text-gray-900">Email OTP</label>
                </div>
                {otpRow(emailOtp, setEmailOtp, emailRefs)}
                <div className="text-center mt-2">
                  {emailTimer > 0 ? <p className="text-xs text-gray-500">Resend in {emailTimer}s</p> :
                    <button type="button" onClick={() => handleResend('email')} className="text-xs text-[#8c76f0] font-semibold inline-flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />Resend Email OTP
                    </button>}
                </div>
              </div>
              <div className="border-t border-gray-100" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-[#8c76f0]" />
                  <label className="text-xs font-semibold text-gray-900">Mobile OTP</label>
                </div>
                {otpRow(mobileOtp, setMobileOtp, mobileRefs)}
                <div className="text-center mt-2">
                  {mobileTimer > 0 ? <p className="text-xs text-gray-500">Resend in {mobileTimer}s</p> :
                    <button type="button" onClick={() => handleResend('mobile')} className="text-xs text-[#8c76f0] font-semibold inline-flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />Resend Mobile OTP
                    </button>}
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 active:scale-95 transition-transform">
                {loading ? 'Verifying...' : 'Verify OTPs'}
              </button>
              <button type="button" onClick={() => { setStep('email'); setSuccess(''); setError(''); }}
                className="w-full text-xs text-gray-500">Didn't receive codes? Go back</button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {PASSWORD_REQUIREMENTS.map((req, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-[#8c76f0] rounded-full"></span>{req}
                    </li>
                  ))}
                </ul>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 active:scale-95 transition-transform">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
