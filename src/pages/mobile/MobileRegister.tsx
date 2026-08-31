import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, X, FileText, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { validatePassword, PASSWORD_REQUIREMENTS } from '../../utils/passwordValidation';
import { setUserSessionToken } from '../../utils/session';
import TermsOfService from '../TermsOfService';
import Privacy from '../Privacy';

interface FormData {
  firstName: string; middleName: string; lastName: string;
  mobileNumber: string; email: string; password: string; confirmPassword: string;
  agreeToTerms: boolean;
}

type ModalType = 'terms' | 'privacy' | null;

export default function MobileRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    firstName: '', middleName: '', lastName: '', mobileNumber: '', email: '',
    password: '', confirmPassword: '', agreeToTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'First name is required';
    else if (!/^[A-Za-z ]+$/.test(formData.firstName)) e.firstName = 'Letters and spaces only';
    else if (formData.firstName.length > 30) e.firstName = 'Max 30 characters';

    if (formData.middleName.trim() && (!/^[A-Za-z ]+$/.test(formData.middleName) || formData.middleName.length > 30))
      e.middleName = 'Letters and spaces only, max 30';

    if (!formData.lastName.trim()) e.lastName = 'Last name is required';
    else if (!/^[A-Za-z ]+$/.test(formData.lastName)) e.lastName = 'Letters and spaces only';
    else if (formData.lastName.length > 30) e.lastName = 'Max 30 characters';

    if (!formData.mobileNumber.trim()) e.mobileNumber = 'Mobile number is required';
    else if (!/^\d{10}$/.test(formData.mobileNumber)) e.mobileNumber = 'Enter a valid 10-digit number';

    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Enter a valid email';

    const pv = validatePassword(formData.password);
    if (!pv.isValid) e.password = pv.error!;

    if (!formData.confirmPassword) e.confirmPassword = 'Please confirm password';
    else if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';

    if (!formData.agreeToTerms) e.agreeToTerms = 'You must agree to the terms';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const fullName = [formData.firstName.trim(), formData.middleName.trim(), formData.lastName.trim()].filter(Boolean).join(' ');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-user`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName.trim(), middleName: formData.middleName.trim() || undefined,
          lastName: formData.lastName.trim(), fullName,
          mobileNumber: `+91${formData.mobileNumber}`, email: formData.email, password: formData.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setUserSessionToken(data.sessionToken);
      navigate('/mobile/verify-otp', {
        state: { userId: data.userId, email: formData.email, mobileNumber: `+91${formData.mobileNumber}` },
      });
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Registration failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 px-4 pt-12 pb-6">
        <div className="max-w-sm w-full mx-auto">
          <div className="text-center mb-4">
            <img src="/PayByCard-Logo.png" alt="PayByCard" className="w-28 h-14 mx-auto object-contain mb-2" />
            <h1 className="text-xl font-bold text-gray-900">Create Account</h1>
            <p className="text-xs text-gray-500 mt-0.5">Sign up for your PayByCard account</p>
          </div>

          {errors.general && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{errors.general}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                <input
                  type="text" value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm"
                  placeholder="Amit" maxLength={30}
                />
                {errors.firstName && <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text" value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm"
                  placeholder="Jha" maxLength={30}
                />
                {errors.lastName && <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Middle Name</label>
              <input
                type="text" value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm"
                placeholder="Kumar" maxLength={30}
              />
              {errors.middleName && <p className="text-red-600 text-xs mt-1">{errors.middleName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl text-gray-700 font-semibold text-sm">+91</span>
                <input
                  type="tel" value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm"
                  placeholder="9999999999" maxLength={10}
                />
              </div>
              {errors.mobileNumber && <p className="text-red-600 text-xs mt-1">{errors.mobileNumber}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
              <input
                type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/[^A-Za-z0-9@_.\-]/g, '') })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm"
                placeholder="amit.jha@example.com" maxLength={100}
              />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm pr-10"
                  placeholder="••••••••" minLength={8} maxLength={20}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'} value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm pr-10"
                  placeholder="••••••••" minLength={8} maxLength={20}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-2 font-medium">Password must contain:</p>
              <ul className="text-xs text-gray-500 space-y-0.5">
                {PASSWORD_REQUIREMENTS.map((req, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>{req}
                  </li>
                ))}
              </ul>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox" checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-[#8c76f0] border border-gray-300 rounded focus:ring-[#8c76f0]"
              />
              <span className="text-xs text-gray-700">
                I agree to the{' '}
                <button type="button" onClick={() => setActiveModal('terms')} className="text-[#8c76f0] font-semibold underline">Terms</button>
                {' '}and{' '}
                <button type="button" onClick={() => setActiveModal('privacy')} className="text-[#8c76f0] font-semibold underline">Privacy Policy</button>
              </span>
            </label>
            {errors.agreeToTerms && <p className="text-red-600 text-xs">{errors.agreeToTerms}</p>}

            <button
              type="submit" disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-3">
            Already have an account?{' '}
            <button onClick={() => navigate('/mobile/login')} className="text-[#8c76f0] font-semibold">Sign In</button>
          </p>
        </div>
      </div>

      {activeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                {activeModal === 'terms' ? <FileText className="w-5 h-5 text-[#8c76f0]" /> : <Shield className="w-5 h-5 text-[#8c76f0]" />}
                <h2 className="text-base font-bold text-gray-900">{activeModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h2>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {activeModal === 'terms' ? <TermsOfService /> : <Privacy />}
            </div>
            <div className="sticky bottom-0 px-4 py-3 border-t border-gray-200 bg-white rounded-b-2xl flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
