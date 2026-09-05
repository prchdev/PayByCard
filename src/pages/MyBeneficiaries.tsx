import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  X,
  Building2,
  CreditCard,
  Mail,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { getClientIp } from '../utils/getClientIp';
import { isCreditCardIfsc, looksLikeCreditCardNumber } from '../utils/beneficiaryValidation';
import { capitalizeName } from '../utils/nameFormat';

interface Beneficiary {
  id: string;
  full_name: string;
  bank_account: string;
  ifsc: string;
  bank_name: string;
  branch_name: string;
  account_type: string;
  email: string;
  mobile: string;
  pan_number: string | null;
  status: string;
  created_at: string;
  created_ip?: string;
  created_timestamp?: string;
  updated_ip?: string;
  updated_timestamp?: string;
  is_verified_merchant?: boolean;
}

export default function MyBeneficiaries() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSelfTransferError, setIsSelfTransferError] = useState(false);
  const [success, setSuccess] = useState('');
  const [isValidatingIFSC, setIsValidatingIFSC] = useState(false);
  const [ifscError, setIfscError] = useState('');
  const [kycStatus, setKycStatus] = useState<{ isVerified: boolean; status: string; isRestricted?: boolean } | null>(null);
  const [isCheckingKyc, setIsCheckingKyc] = useState(true);

  const [formData, setFormData] = useState({
    full_name: '',
    bank_account: '',
    ifsc: '',
    bank_name: '',
    branch_name: '',
    account_type: 'Saving',
    email: '',
    mobile: '',
    pan_number: '',
  });

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
    } else {
      checkKycStatus();
    }
  }, [userId, navigate]);

  const checkKycStatus = async () => {
    try {
      setIsCheckingKyc(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-kyc-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();
      if (response.ok) {
        setKycStatus(result);
        if (result.isVerified) {
          fetchBeneficiaries();
        }
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    } finally {
      setIsCheckingKyc(false);
    }
  };

  const fetchBeneficiaries = async () => {
    try {
      setIsLoading(true);
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-beneficiaries`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch beneficiaries');
      }

      setBeneficiaries(data.beneficiaries);
    } catch (err: any) {
      setError(err.message || 'Failed to load beneficiaries');
    } finally {
      setIsLoading(false);
    }
  };

  const validateIFSC = async (ifscCode: string) => {
    if (!ifscCode || ifscCode.length !== 11) {
      setIfscError('IFSC code must be 11 characters');
      return;
    }

    try {
      setIsValidatingIFSC(true);
      setIfscError('');
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-ifsc`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ifsc: ifscCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid IFSC code');
      }

      setFormData(prev => ({
        ...prev,
        bank_name: data.bank,
        branch_name: data.branch,
      }));
    } catch (err: any) {
      setIfscError(err.message || 'Failed to validate IFSC code');
      setFormData(prev => ({
        ...prev,
        bank_name: '',
        branch_name: '',
      }));
    } finally {
      setIsValidatingIFSC(false);
    }
  };

  const handleIFSCChange = (value: string) => {
    const upperValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    setFormData(prev => ({ ...prev, ifsc: upperValue }));

    if (upperValue.length === 11) {
      validateIFSC(upperValue);
    } else {
      setIfscError('');
      setFormData(prev => ({
        ...prev,
        bank_name: '',
        branch_name: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSelfTransferError(false);

    if (!formData.full_name.trim()) {
      setError('Full Name is required.'); return;
    }
    if (!/^[A-Za-z ]+$/.test(formData.full_name)) {
      setError('Full Name must contain only letters and spaces.'); return;
    }
    if (formData.full_name.trim().split(/\s+/).length < 2) {
      setError('Please enter your full name (First Name and Last Name).'); return;
    }
    if (formData.full_name.length > 90) {
      setError('Full Name must not exceed 90 characters.'); return;
    }

    if (!formData.email.trim()) {
      setError('Email Address is required.'); return;
    }
    if (!/^[A-Za-z0-9@_.\-]+$/.test(formData.email)) {
      setError('Email may only contain letters, numbers, @, _, ., and -.'); return;
    }
    if (formData.email.length > 100) {
      setError('Email must not exceed 100 characters.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address.'); return;
    }

    if (!formData.mobile.trim()) {
      setError('Mobile Number is required.'); return;
    }
    if (!/^\d{10}$/.test(formData.mobile)) {
      setError('Mobile Number must be exactly 10 digits.'); return;
    }

    if (!formData.ifsc.trim()) {
      setError('IFSC Code is required.'); return;
    }
    if (!/^[A-Z0-9]{11}$/.test(formData.ifsc)) {
      setError('IFSC Code must be exactly 11 characters (letters A-Z and numbers only).'); return;
    }

    if (!formData.bank_account.trim()) {
      setError('Account Number is required.'); return;
    }
    if (!/^[A-Za-z0-9\- ]+$/.test(formData.bank_account)) {
      setError('Account Number may only contain letters, numbers, -, and spaces.'); return;
    }
    if (formData.bank_account.length > 20) {
      setError('Account Number must not exceed 20 characters.'); return;
    }

    if (!formData.bank_name || !formData.branch_name) {
      setError('Please validate IFSC code before submitting');
      return;
    }

    if (ifscError) {
      setError('Please fix IFSC code errors before submitting');
      return;
    }

    if (isCreditCardIfsc(formData.ifsc)) {
      setError('This IFSC code is for credit card bill payments. Adding credit card accounts as beneficiaries is not allowed.');
      return;
    }

    if (looksLikeCreditCardNumber(formData.bank_account)) {
      setError('The account number entered appears to be a credit card number. Credit card bill payments are not allowed through this platform.');
      return;
    }

    try {
      setIsSubmitting(true);
      const ipAddress = await getClientIp();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-beneficiary`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, full_name: capitalizeName(formData.full_name), userId, ipAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.self_transfer) {
          setIsSelfTransferError(true);
        }
        throw new Error(data.error || 'Failed to save beneficiary');
      }

      setSuccess('Beneficiary added successfully!');
      setFormData({
        full_name: '',
        bank_account: '',
        ifsc: '',
        bank_name: '',
        branch_name: '',
        account_type: 'Saving',
        email: '',
        mobile: '',
        pan_number: '',
      });

      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess('');
        fetchBeneficiaries();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to add beneficiary');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (beneficiaryId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-beneficiary-status`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          beneficiary_id: beneficiaryId,
          status: newStatus,
          userId: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      fetchBeneficiaries();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!userId) {
    return null;
  }

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isCheckingKyc) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavigation
          userEmail={userEmail}
          userId={userId}
          onLogout={handleLogout}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </div>
    );
  }

  if (kycStatus && !kycStatus.isVerified) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavigation
          userEmail={userEmail}
          userId={userId}
          onLogout={handleLogout}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <div className="flex max-w-7xl mx-auto">
          <DashboardSidebar
            userId={userId}
            userEmail={userEmail}
            currentPage="beneficiaries"
            isMobileMenuOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            onLogout={handleLogout}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border-2 border-yellow-300 p-8 text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">KYC Verification Required</h2>
                <p className="text-gray-700 mb-6">
                  {kycStatus.status === 'not_submitted' &&
                    'Please complete your KYC verification to manage beneficiaries. You need to submit your PAN and Address details.'
                  }
                  {kycStatus.status === 'incomplete' &&
                    'Your KYC submission is incomplete. Please complete all required sections to proceed.'
                  }
                  {kycStatus.status === 'pending' &&
                    'Your KYC documents are under review. Please wait for admin approval before managing beneficiaries.'
                  }
                  {kycStatus.status === 'rejected' &&
                    'Your KYC verification was rejected. Please review the feedback and resubmit your documents.'
                  }
                </p>
                <button
                  onClick={() => navigate('/kyc-verification', { state: { userId, userEmail } })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  Go to KYC Verification
                </button>
              </div>
            </div>
          </main>
        </div>

        <Footer />
      </div>
    );
  }

  if (kycStatus?.isRestricted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavigation
          userEmail={userEmail}
          userId={userId}
          onLogout={handleLogout}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <div className="flex max-w-7xl mx-auto">
          <DashboardSidebar
            userId={userId}
            userEmail={userEmail}
            currentPage="beneficiaries"
            isMobileMenuOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            onLogout={handleLogout}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border-2 border-red-300 p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Account Restricted</h2>
                <p className="text-gray-700 mb-6">
                  Your account has been restricted by our compliance team. You are unable to add beneficiaries at this time. Please raise a support ticket for assistance.
                </p>
                <button
                  onClick={() => navigate('/help-support', { state: { userId, userEmail } })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  Raise Support Ticket
                </button>
              </div>
            </div>
          </main>
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavigation
        userEmail={userEmail}
        userId={userId}
        onLogout={handleLogout}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex max-w-7xl mx-auto">
        <DashboardSidebar
          userId={userId}
          userEmail={userEmail}
          currentPage="beneficiaries"
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-6xl">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">My Beneficiaries</h1>
                  </div>
                  <p className="text-gray-500 text-sm mt-1 ml-[52px]">
                    Manage your saved beneficiary accounts for quick and easy payments
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Add Beneficiary
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-xl px-6 py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="md:hidden w-full flex items-center justify-center gap-2 mb-6 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add New Beneficiary
            </button>

            {isLoading ? (
              <div className="bg-white rounded-2xl border-2 border-gray-300 p-12 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-[#8c76f0] animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 text-sm">Loading beneficiaries...</p>
                </div>
              </div>
            ) : beneficiaries.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-12 text-center transition-all hover:shadow-xl">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-50 to-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-[#8c76f0]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No beneficiaries yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Add your first beneficiary to start sending payments quickly and securely
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-5 h-5" />
                  Add Beneficiary
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {beneficiaries.map((beneficiary) => (
              <div
                key={beneficiary.id}
                className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#8c76f0]" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        beneficiary.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {beneficiary.status}
                    </span>
                    {beneficiary.is_verified_merchant && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified Merchant
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-4">{beneficiary.full_name}</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">{beneficiary.bank_name}</p>
                      <p className="text-gray-600">{beneficiary.branch_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">{beneficiary.bank_account}</p>
                      <p className="text-gray-600">{beneficiary.ifsc} • {beneficiary.account_type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="text-sm text-gray-900">{beneficiary.email}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="text-sm text-gray-900">{beneficiary.mobile}</p>
                  </div>

                  {beneficiary.pan_number && (
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-900">{beneficiary.pan_number}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => toggleStatus(beneficiary.id, beneficiary.status)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all mt-6 ${
                    beneficiary.status === 'Active'
                      ? 'border-2 border-gray-300 text-gray-700 hover:border-red-500 hover:bg-red-50 hover:text-red-700'
                      : 'border-2 border-gray-300 text-gray-700 hover:border-green-500 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  {beneficiary.status === 'Active' ? (
                    <>
                      <XCircle className="w-5 h-5" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Activate
                    </>
                  )}
                </button>
              </div>
            ))}
              </div>
            )}

            <div className="mt-8 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-2xl px-6 py-4 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">About Beneficiaries</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Save frequently used bank accounts for quick and easy payments. You can activate or deactivate beneficiaries at any time. Only active beneficiaries will be available for transactions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl purple-scrollbar">
            <div className="sticky top-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Add New Beneficiary</h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setError('');
                  setSuccess('');
                  setIsSelfTransferError(false);
                }}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              {error && isSelfTransferError && (
                <div className="mb-6 bg-red-50 border-2 border-red-400 rounded-xl px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-red-800 font-bold text-sm">Self-Transfer Prohibited</p>
                      <p className="text-red-700 text-sm mt-1 leading-relaxed">
                        Sending money to your own account using this platform is <strong>strictly prohibited as per RBI norms</strong>. {error.replace('Sending money to your own account using this platform is strictly prohibited as per RBI norms. ', '')}
                      </p>
                      <p className="text-xs text-red-600 mt-2 font-medium">
                        Please enter details of a different account holder.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && !isSelfTransferError && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg px-5 py-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-6 bg-green-50 border-l-4 border-green-500 rounded-lg px-5 py-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Beneficiary Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={90}
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          maxLength={100}
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/[^A-Za-z0-9@_.\-]/g, '') })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                          placeholder="Enter email"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Mobile Number <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                          placeholder="Enter 10-digit mobile number"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PAN Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.pan_number}
                        onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                        placeholder="Enter PAN number"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Bank Details
                  </h3>

                  <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-medium text-amber-800 leading-relaxed">
                        Transfer of Money to Your Own Bank Account and Credit Card Bill Payments Are Not Allowed.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        IFSC Code <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={formData.ifsc}
                        onChange={(e) => handleIFSCChange(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono tracking-wider"
                        placeholder="Enter IFSC code"
                      />
                      {isValidatingIFSC && (
                        <div className="flex items-center gap-2 mt-2 text-[#8c76f0] text-sm font-medium">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Validating IFSC...
                        </div>
                      )}
                      {ifscError && (
                        <div className="mt-2 text-red-600 text-sm font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {ifscError}
                        </div>
                      )}
                      {formData.bank_name && formData.branch_name && (
                        <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-green-900">{formData.bank_name}</p>
                              <p className="text-sm text-green-700 mt-1">{formData.branch_name}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bank Account Number <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={20}
                          value={formData.bank_account}
                          onChange={(e) => setFormData({ ...formData, bank_account: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '') })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono"
                          placeholder="Enter account number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Account Type <span className="text-red-600">*</span>
                        </label>
                        <select
                          required
                          value={formData.account_type}
                          onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                        >
                          <option value="Saving">Saving Account</option>
                          <option value="Current">Current Account</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 mt-6 border-t-2 border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setError('');
                    setSuccess('');
                    setIsSelfTransferError(false);
                  }}
                  className="flex-1 px-6 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isValidatingIFSC || !formData.bank_name}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding Beneficiary...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Beneficiary
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
