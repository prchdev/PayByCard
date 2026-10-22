import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, UserPlus, AlertCircle, X, FileText, Shield, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { validatePassword, PASSWORD_REQUIREMENTS } from '../utils/passwordValidation';
import { capitalizeName } from '../utils/nameFormat';
import TermsOfService from './TermsOfService';
import Privacy from './Privacy';

interface FormData {
  firstName: string;
  middleName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  referralCode: string;
  agreeToTerms: boolean;
}

interface FormErrors {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNumber?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreeToTerms?: string;
  general?: string;
}

type ModalType = 'terms' | 'privacy' | null;

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    middleName: '',
    lastName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Capture referral code from URL (?ref=CODE) or sessionStorage cache.
  // Cached so navigation between pages (e.g. Terms modal, login round-trip)
  // does not lose the referral attribution.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refFromUrl = urlParams.get('ref')?.trim().toUpperCase();
    if (refFromUrl) {
      try { sessionStorage.setItem('referralCode', refFromUrl); } catch (_) {}
    }
    let cached: string | null = null;
    try { cached = sessionStorage.getItem('referralCode'); } catch (_) {}
    const initial = refFromUrl || cached || '';
    if (initial) {
      setFormData((prev) => ({ ...prev, referralCode: initial }));
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (!/^[A-Za-z ]+$/.test(formData.firstName)) {
      newErrors.firstName = 'First name must contain only letters and spaces';
    } else if (formData.firstName.length > 30) {
      newErrors.firstName = 'First name must not exceed 30 characters';
    }

    if (formData.middleName.trim()) {
      if (!/^[A-Za-z ]+$/.test(formData.middleName)) {
        newErrors.middleName = 'Middle name must contain only letters and spaces';
      } else if (formData.middleName.length > 30) {
        newErrors.middleName = 'Middle name must not exceed 30 characters';
      }
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (!/^[A-Za-z ]+$/.test(formData.lastName)) {
      newErrors.lastName = 'Last name must contain only letters and spaces';
    } else if (formData.lastName.length > 30) {
      newErrors.lastName = 'Last name must not exceed 30 characters';
    }

    if (!formData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Please enter a valid 10-digit mobile number';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (formData.email.length > 100) {
      newErrors.email = 'Email must not exceed 100 characters';
    } else if (!/^[A-Za-z0-9@_.\-]+$/.test(formData.email)) {
      newErrors.email = 'Email may only contain letters, numbers, @, _, ., and -';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.error!;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-user`;

      const capFirst = capitalizeName(formData.firstName);
      const capMiddle = capitalizeName(formData.middleName);
      const capLast = capitalizeName(formData.lastName);
      const fullName = [capFirst, capMiddle, capLast].filter(Boolean).join(' ');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: capFirst,
          middleName: capMiddle || undefined,
          lastName: capLast,
          fullName,
          mobileNumber: `+91${formData.mobileNumber}`,
          email: formData.email,
          password: formData.password,
          referralCode: formData.referralCode.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Clear cached referral code on successful registration.
      try { sessionStorage.removeItem('referralCode'); } catch (_) {}

      navigate('/verify-otp', {
        state: {
          userId: data.userId,
          email: formData.email,
          mobileNumber: `+91${formData.mobileNumber}`
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setErrors({ general: msg });
      if (/referral/i.test(msg)) {
        setFormData((prev) => ({ ...prev, referralCode: '' }));
        try { sessionStorage.removeItem('referralCode'); } catch (_) {}
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 pt-24 pb-12">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-600 mt-2">Sign up for your PayByCard account</p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.general && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{errors.general}</span>
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    First Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                    placeholder="Amit"
                    maxLength={30}
                  />
                  {errors.firstName && (
                    <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.firstName}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                    placeholder="Kumar"
                    maxLength={30}
                  />
                  {errors.middleName && (
                    <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.middleName}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Last Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                    placeholder="Jha"
                    maxLength={30}
                  />
                  {errors.lastName && (
                    <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.lastName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mobile Number <span className="text-red-600">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 bg-gray-100 border-2 border-r-0 border-gray-300 rounded-l-xl text-gray-700 font-semibold">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                    placeholder="9999999999"
                    maxLength={10}
                  />
                </div>
                {errors.mobileNumber && (
                  <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.mobileNumber}</span>
                  </div>
                )}
              </div>

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
                />
                {errors.email && (
                  <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.email}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all pr-12"
                      placeholder="••••••••"
                      minLength={8}
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.confirmPassword}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-4">
                <p className="text-xs text-gray-600 mb-3 font-medium">Password must contain:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Referral Code <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.referralCode}
                    onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12) })}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent transition-all"
                    placeholder="Enter referral code (optional)"
                    maxLength={12}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Referred by a friend? Enter their code here.</p>
              </div>

              <div>
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                    className="mt-1 w-4 h-4 text-[#8c76f0] border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0]"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setActiveModal('terms')}
                      className="text-[#8c76f0] hover:text-purple-700 font-semibold underline"
                    >
                      Terms and Conditions
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setActiveModal('privacy')}
                      className="text-[#8c76f0] hover:text-purple-700 font-semibold underline"
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>
                {errors.agreeToTerms && (
                  <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.agreeToTerms}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:from-[#7d67e0] hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-[#8c76f0] hover:text-purple-700 font-semibold transition-colors"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Terms / Privacy Modal */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b-2 border-gray-200 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                {activeModal === 'terms' ? (
                  <FileText className="w-6 h-6 text-[#8c76f0]" />
                ) : (
                  <Shield className="w-6 h-6 text-[#8c76f0]" />
                )}
                <h2 className="text-xl font-bold text-gray-900">
                  {activeModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                </h2>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 purple-scrollbar">
              {activeModal === 'terms' ? <TermsOfService /> : <Privacy />}
            </div>
            <div className="sticky bottom-0 px-6 py-4 border-t-2 border-gray-200 bg-white rounded-b-2xl flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
