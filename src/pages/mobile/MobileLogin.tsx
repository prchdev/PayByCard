import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function MobileLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const validateForm = (): boolean => {
    const e = { email: '', password: '' };
    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Enter a valid email';
    if (!formData.password) e.password = 'Password is required';
    else if (formData.password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return !e.email && !e.password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setError('');
    setIsLocked(false);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.isLocked) setIsLocked(true);
        throw new Error(data.error || 'Login failed');
      }
      if (data.needsVerification) {
        navigate('/mobile/verify-otp', {
          state: { userId: data.userId, email: data.email, mobileNumber: data.mobileNumber, fromLogin: true },
        });
      } else {
        login(data.userId, data.email);
        if (data.isRestricted) sessionStorage.setItem('isRestricted', 'true');
        else sessionStorage.removeItem('isRestricted');
        if (!data.kycCompleted) {
          navigate('/mobile/kyc-verification', { state: { userId: data.userId, userEmail: data.email } });
        } else {
          navigate('/mobile/dashboard', { state: { userId: data.userId, userEmail: data.email } });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 pt-12 pb-6">
      <div className="flex-1 max-w-sm w-full mx-auto">
        <div className="text-center mb-4">
          <img src="/PayByCard-Logo.png" alt="PayByCard" className="w-28 h-14 mx-auto object-contain mb-2" />
          <h1 className="text-xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-xs text-gray-500 mt-0.5">Sign in to your PayByCard account</p>
        </div>

        {error && (
          <div className={`mb-4 rounded-xl p-3 ${isLocked ? 'bg-orange-50 border border-orange-300' : 'bg-red-50 border border-red-300'}`}>
            <div className="flex items-start gap-2">
              <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isLocked ? 'text-orange-600' : 'text-red-600'}`} />
              <div>
                <p className={`text-sm font-semibold ${isLocked ? 'text-orange-900' : 'text-red-900'}`}>
                  {isLocked ? 'Account Locked' : 'Error'}
                </p>
                <p className={`text-xs mt-0.5 ${isLocked ? 'text-orange-800' : 'text-red-800'}`}>{error}</p>
                {isLocked && (
                  <button onClick={() => navigate('/mobile/forgot-password')} className="text-xs font-semibold text-orange-700 underline mt-1">
                    Reset your password
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/[^A-Za-z0-9@_.\-]/g, '') })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent text-sm"
              placeholder="amit.jha@example.com"
              maxLength={100}
              autoComplete="email"
            />
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent text-sm pr-10"
                placeholder="••••••••"
                minLength={8}
                maxLength={20}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password}</p>}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => navigate('/mobile/forgot-password')} className="text-xs text-[#8c76f0] font-medium">
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-3">
          Don't have an account?{' '}
          <button onClick={() => navigate('/mobile/register')} className="text-[#8c76f0] font-semibold">
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}
