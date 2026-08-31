import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { setAdminSessionToken } from '../../utils/session';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Step = 'credentials' | 'otp';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Credentials valid — OTP has been sent to email
      setStep('otp');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-verify-login-otp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      sessionStorage.setItem('adminId', data.adminId);
      sessionStorage.setItem('adminEmail', data.email);
      sessionStorage.setItem('adminName', data.fullName);
      sessionStorage.setItem('adminRole', data.role);
      localStorage.setItem('adminId', data.adminId);
      localStorage.setItem('adminRole', data.role);
      setAdminSessionToken(data.sessionToken);

      navigate('/admin/dashboard');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setResendSuccess('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setResendSuccess('A new verification code has been sent to your email.');
        setOtp('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to resend code');
      }
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Portal</h1>
          <p className="text-slate-500 mt-1 text-sm">PayByCard Administration</p>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-2xl shadow-sm p-8">
          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-6">
              <div className="text-center mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Sign In</h2>
                <p className="text-sm text-gray-500 mt-1">Enter your credentials to continue</p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="admin@paybycard.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-12 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:opacity-90 text-white font-medium py-3 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verifying...' : 'Continue'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/admin/forgot-password')}
                  className="text-sm text-[#8c76f0] hover:text-purple-600 font-medium transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleOtp} className="space-y-6">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-xl mb-3">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We sent a 6-digit verification code to
                </p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{email}</p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {resendSuccess && (
                <div className="bg-green-50 border-2 border-green-300 text-green-700 px-4 py-3 rounded-xl text-sm">
                  {resendSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all text-center text-2xl font-mono tracking-[0.5em]"
                  placeholder="------"
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-gray-500 mt-1.5 text-center">Valid for 10 minutes</p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:opacity-90 text-white font-medium py-3 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setOtp(''); setError(''); setResendSuccess(''); }}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="flex items-center gap-1.5 text-[#8c76f0] hover:text-purple-600 font-medium transition-colors disabled:opacity-50"
                >
                  {resending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Restricted access — authorized personnel only
        </p>
      </div>
    </div>
  );
}
