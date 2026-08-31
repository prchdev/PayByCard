import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { setUserSessionToken } from '../utils/session';

interface LoginData {
  email: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const validateForm = (): boolean => {
    const newErrors = { email: '', password: '' };

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (formData.email.length > 100) {
      newErrors.email = 'Email must not exceed 100 characters';
    } else if (!/^[A-Za-z0-9@_.\-]+$/.test(formData.email)) {
      newErrors.email = 'Email may only contain letters, numbers, @, _, ., and -';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (formData.password.length > 20) {
      newErrors.password = 'Password must not exceed 20 characters';
    }

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setIsLocked(false);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isLocked) {
          setIsLocked(true);
        }
        throw new Error(data.error || 'Login failed');
      }

      if (data.needsVerification) {
        setUserSessionToken(data.sessionToken);
        navigate('/verify-otp', {
          state: {
            userId: data.userId,
            email: data.email,
            mobileNumber: data.mobileNumber,
            fromLogin: true
          }
        });
      } else {
        login(data.userId, data.email, data.sessionToken);
        if (data.isRestricted) {
          sessionStorage.setItem('isRestricted', 'true');
        } else {
          sessionStorage.removeItem('isRestricted');
        }
        if (!data.kycCompleted) {
          navigate('/kyc-verification', { state: { userId: data.userId, userEmail: data.email } });
        } else {
          navigate('/dashboard', { state: { userId: data.userId, userEmail: data.email } });
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-28 pb-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Sign in to your PayByCard account</p>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-xl p-8">
          {error && (
            <div className={`mb-6 border-2 rounded-xl px-6 py-4 ${isLocked ? 'bg-orange-50 border-orange-500' : 'bg-red-50 border-red-500'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isLocked ? 'bg-orange-600' : 'bg-red-600'}`}>
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className={`font-semibold ${isLocked ? 'text-orange-900' : 'text-red-900'}`}>
                    {isLocked ? 'Account Locked' : 'Error'}
                  </p>
                  <p className={`text-sm mt-0.5 ${isLocked ? 'text-orange-800' : 'text-red-800'}`}>{error}</p>
                  {isLocked && (
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="mt-2 text-sm font-semibold text-orange-700 underline hover:text-orange-900 transition-colors"
                    >
                      Reset your password now
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/[^A-Za-z0-9@_.\-]/g, '') })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                placeholder="amit.jha@example.com"
                maxLength={100}
                autoComplete="email"
              />
              {errors.email && (
                <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all pr-12"
                  placeholder="••••••••"
                  minLength={8}
                  maxLength={20}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.password}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-[#8c76f0] hover:text-purple-700 font-medium transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:from-[#7d67e0] hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-[#8c76f0] hover:text-purple-700 font-semibold transition-colors"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
