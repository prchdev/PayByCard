import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Smartphone, RefreshCw, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function VerifyOTP() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { userId, email, mobileNumber, fromLogin } = location.state || {};

  const [mobileOTP, setMobileOTP] = useState(['', '', '', '', '', '']);
  const [emailOTP, setEmailOTP] = useState(['', '', '', '', '', '']);
  const [mobileResendTimer, setMobileResendTimer] = useState(30);
  const [emailResendTimer, setEmailResendTimer] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errors, setErrors] = useState({ mobile: '', email: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!userId || !email || !mobileNumber) {
      if (fromLogin) {
        navigate('/login');
      } else {
        navigate('/register');
      }
      return;
    }
  }, [userId, email, mobileNumber, fromLogin, navigate]);

  useEffect(() => {
    if (mobileResendTimer > 0) {
      const timer = setTimeout(() => setMobileResendTimer(mobileResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [mobileResendTimer]);

  useEffect(() => {
    if (emailResendTimer > 0) {
      const timer = setTimeout(() => setEmailResendTimer(emailResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailResendTimer]);

  const handleOTPChange = (
    value: string,
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    otpArray: string[]
  ) => {
    if (!/^\d*$/.test(value)) return;

    const newOTP = [...otpArray];
    newOTP[index] = value;
    setter(newOTP);

    if (value && index < 5) {
      const nextInput = document.getElementById(
        setter === setMobileOTP ? `mobile-otp-${index + 1}` : `email-otp-${index + 1}`
      );
      nextInput?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    otpArray: string[]
  ) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      const prevInput = document.getElementById(
        setter === setMobileOTP ? `mobile-otp-${index - 1}` : `email-otp-${index - 1}`
      );
      prevInput?.focus();
    }
  };

  const handlePaste = (
    e: React.ClipboardEvent,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOTP = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setter(newOTP);
  };

  const handleResendOTP = async (type: 'mobile' | 'email') => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-otp`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend OTP');
      }

      if (type === 'mobile') {
        setMobileResendTimer(30);
        setMobileOTP(['', '', '', '', '', '']);
      } else {
        setEmailResendTimer(30);
        setEmailOTP(['', '', '', '', '', '']);
      }

      setSuccess(`OTP has been resent to your ${type === 'mobile' ? 'mobile number' : 'email'}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to resend OTP');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleVerify = async () => {
    const mobileOTPString = mobileOTP.join('');
    const emailOTPString = emailOTP.join('');

    const newErrors = { mobile: '', email: '' };

    if (mobileOTPString.length !== 6) {
      newErrors.mobile = 'Please enter complete mobile OTP';
    }

    if (emailOTPString.length !== 6) {
      newErrors.email = 'Please enter complete email OTP';
    }

    if (newErrors.mobile || newErrors.email) {
      setErrors(newErrors);
      return;
    }

    setIsVerifying(true);
    setErrors({ mobile: '', email: '' });
    setError('');
    setSuccess('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          mobileOTP: mobileOTPString,
          emailOTP: emailOTPString,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'OTP verification failed');
      }

      if (data.sessionToken) sessionStorage.setItem('pbc_session', data.sessionToken);
      login(userId, email);
      navigate('/kyc-verification', { state: { userId, userEmail: email } });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'OTP verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 pt-28 pb-12">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Account</h1>
          <p className="text-gray-600">
            {fromLogin
              ? 'Please verify your mobile number and email address to continue'
              : "We've sent verification codes to your mobile number and email address"
            }
          </p>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-xl p-8">
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

          {success && (
            <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-xl px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">Success</p>
                  <p className="text-sm text-green-800 mt-0.5">{success}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-[#8c76f0]" />
                  <label className="text-sm font-semibold text-gray-900">
                    Mobile OTP <span className="text-red-600">*</span>
                  </label>
                </div>
                <span className="text-sm text-gray-600">{mobileNumber}</span>
              </div>

              <div className="flex justify-center space-x-3 mb-3">
                {mobileOTP.map((digit, index) => (
                  <input
                    key={index}
                    id={`mobile-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(e.target.value, index, setMobileOTP, mobileOTP)}
                    onKeyDown={(e) => handleKeyDown(e, index, setMobileOTP, mobileOTP)}
                    onPaste={(e) => handlePaste(e, setMobileOTP)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                  />
                ))}
              </div>

              {errors.mobile && (
                <p className="text-red-600 text-sm text-center mb-2">{errors.mobile}</p>
              )}

              <div className="text-center">
                {mobileResendTimer > 0 ? (
                  <p className="text-sm text-gray-600">
                    Resend OTP in {mobileResendTimer}s
                  </p>
                ) : (
                  <button
                    onClick={() => handleResendOTP('mobile')}
                    className="text-sm text-[#8c76f0] hover:text-purple-700 font-semibold inline-flex items-center space-x-1 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Resend Mobile OTP</span>
                  </button>
                )}
              </div>
            </div>

            <div className="border-t-2 border-gray-200"></div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-[#8c76f0]" />
                  <label className="text-sm font-semibold text-gray-900">
                    Email OTP <span className="text-red-600">*</span>
                  </label>
                </div>
                <span className="text-sm text-gray-600">{email}</span>
              </div>

              <div className="flex justify-center space-x-3 mb-3">
                {emailOTP.map((digit, index) => (
                  <input
                    key={index}
                    id={`email-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(e.target.value, index, setEmailOTP, emailOTP)}
                    onKeyDown={(e) => handleKeyDown(e, index, setEmailOTP, emailOTP)}
                    onPaste={(e) => handlePaste(e, setEmailOTP)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                  />
                ))}
              </div>

              {errors.email && (
                <p className="text-red-600 text-sm text-center mb-2">{errors.email}</p>
              )}

              <div className="text-center">
                {emailResendTimer > 0 ? (
                  <p className="text-sm text-gray-600">
                    Resend OTP in {emailResendTimer}s
                  </p>
                ) : (
                  <button
                    onClick={() => handleResendOTP('email')}
                    className="text-sm text-[#8c76f0] hover:text-purple-700 font-semibold inline-flex items-center space-x-1 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Resend Email OTP</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="w-full mt-8 bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:from-[#7d67e0] hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
