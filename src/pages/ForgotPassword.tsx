import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, ShieldCheck, AlertCircle, Eye, EyeOff, Smartphone, RefreshCw, CheckCircle } from 'lucide-react';
import { validatePassword, PASSWORD_REQUIREMENTS } from '../utils/passwordValidation';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', '']);
  const [mobileOtp, setMobileOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [mobileResendTimer, setMobileResendTimer] = useState(0);
  const [resending, setResending] = useState(false);

  // Refs for each OTP input box — stable across renders, no remount focus loss
  const emailRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));
  const mobileRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));

  useEffect(() => {
    if (emailResendTimer > 0) {
      const t = setTimeout(() => setEmailResendTimer(v => v - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [emailResendTimer]);

  useEffect(() => {
    if (mobileResendTimer > 0) {
      const t = setTimeout(() => setMobileResendTimer(v => v - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [mobileResendTimer]);

  // Auto-focus first email OTP box when step changes to otp
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => emailRefs.current[0]?.focus(), 50);
    }
  }, [step]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-forgot-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setMaskedMobile(data.maskedMobile || '');
      setSuccessMessage('OTPs sent to your email and registered mobile number');
      setEmailResendTimer(30);
      setMobileResendTimer(30);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (
    value: string,
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<Array<HTMLInputElement | null>>
  ) => {
    if (!/^\d*$/.test(value)) return;
    setter(prev => {
      const next = [...prev];
      next[index] = value.slice(-1); // only last char if pasted single digit
      return next;
    });
    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    otp: string[],
    refs: React.MutableRefObject<Array<HTMLInputElement | null>>
  ) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (
    e: React.ClipboardEvent,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<Array<HTMLInputElement | null>>
  ) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setter(next);
    // Focus last filled box or first empty
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
  };

  const handleResend = async (type: 'email' | 'mobile') => {
    setResending(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-forgot-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to resend OTP');
      if (type === 'email') {
        setEmailOtp(['', '', '', '', '', '']);
        setEmailResendTimer(30);
        emailRefs.current[0]?.focus();
      } else {
        setMobileOtp(['', '', '', '', '', '']);
        setMobileResendTimer(30);
        mobileRefs.current[0]?.focus();
      }
      setSuccessMessage(`OTP resent to your ${type === 'email' ? 'email' : 'mobile number'}`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailOtpStr = emailOtp.join('');
    const mobileOtpStr = mobileOtp.join('');

    if (emailOtpStr.length !== 6) {
      setError('Please enter the complete email OTP');
      return;
    }
    if (mobileOtpStr.length !== 6) {
      setError('Please enter the complete mobile OTP');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-verify-reset-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, emailOtp: emailOtpStr, mobileOtp: mobileOtpStr }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      setSuccessMessage('OTPs verified successfully');
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error!);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp: emailOtp.join(''), newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccessMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-28 pb-12">
      <div className="max-w-md w-full">
        <button
          onClick={() => navigate('/login')}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Login
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              {step === 'email' && <Mail className="w-8 h-8 text-white" />}
              {step === 'otp' && <ShieldCheck className="w-8 h-8 text-white" />}
              {step === 'password' && <Lock className="w-8 h-8 text-white" />}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {step === 'email' && 'Forgot Password'}
            {step === 'otp' && 'Verify OTPs'}
            {step === 'password' && 'Reset Password'}
          </h1>
          <p className="text-gray-600 mt-2">
            {step === 'email' && 'Enter your email to receive verification codes'}
            {step === 'otp' && `Enter the 6-digit codes sent to your email${maskedMobile ? ` and mobile ${maskedMobile}` : ' and mobile number'}`}
            {step === 'password' && 'Create a new password for your account'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-xl p-8">
          {successMessage && (
            <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-xl px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">Success</p>
                  <p className="text-sm text-green-800 mt-0.5">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-xl px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-800 mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                  placeholder="john.doe@example.com"
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:from-[#7d67e0] hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send OTPs'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-8">
              {/* Email OTP */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-[#8c76f0]" />
                    <label className="text-sm font-semibold text-gray-900">
                      Email OTP <span className="text-red-600">*</span>
                    </label>
                  </div>
                  <span className="text-sm text-gray-600 truncate max-w-[160px]">{email}</span>
                </div>
                <div className="flex justify-center space-x-3 mb-3">
                  {emailOtp.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => { emailRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(e.target.value, index, setEmailOtp, emailRefs)}
                      onKeyDown={e => handleOtpKeyDown(e, index, emailOtp, emailRefs)}
                      onPaste={e => handleOtpPaste(e, setEmailOtp, emailRefs)}
                      className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                    />
                  ))}
                </div>
                <div className="text-center">
                  {emailResendTimer > 0 ? (
                    <p className="text-sm text-gray-600">Resend OTP in {emailResendTimer}s</p>
                  ) : (
                    <button
                      type="button"
                      disabled={resending}
                      onClick={() => handleResend('email')}
                      className="text-sm text-[#8c76f0] hover:text-purple-700 font-semibold inline-flex items-center space-x-1 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Resend Email OTP</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t-2 border-gray-200" />

              {/* Mobile OTP */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-[#8c76f0]" />
                    <label className="text-sm font-semibold text-gray-900">
                      Mobile OTP <span className="text-red-600">*</span>
                    </label>
                  </div>
                  {maskedMobile && <span className="text-sm text-gray-600">{maskedMobile}</span>}
                </div>
                <div className="flex justify-center space-x-3 mb-3">
                  {mobileOtp.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => { mobileRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(e.target.value, index, setMobileOtp, mobileRefs)}
                      onKeyDown={e => handleOtpKeyDown(e, index, mobileOtp, mobileRefs)}
                      onPaste={e => handleOtpPaste(e, setMobileOtp, mobileRefs)}
                      className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                    />
                  ))}
                </div>
                <div className="text-center">
                  {mobileResendTimer > 0 ? (
                    <p className="text-sm text-gray-600">Resend OTP in {mobileResendTimer}s</p>
                  ) : (
                    <button
                      type="button"
                      disabled={resending}
                      onClick={() => handleResend('mobile')}
                      className="text-sm text-[#8c76f0] hover:text-purple-700 font-semibold inline-flex items-center space-x-1 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Resend Mobile OTP</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:from-[#7d67e0] hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify OTPs'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setSuccessMessage(''); setError(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Didn't receive codes? Go back and resend
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-600 mb-3 font-medium">Password must contain:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#8c76f0] rounded-full flex-shrink-0"></span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:from-[#7d67e0] hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
