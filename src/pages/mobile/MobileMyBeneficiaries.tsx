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
  Trash2,
  ChevronDown,
} from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';
import { getClientIp } from '../../utils/getClientIp';

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

export default function MobileMyBeneficiaries() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const { logout } = useAuth();

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Beneficiary | null>(null);

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
      navigate('/mobile/login', { replace: true });
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

  const resetForm = () => {
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
    setError('');
    setSuccess('');
    setIsSelfTransferError(false);
    setIfscError('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
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
        body: JSON.stringify({ ...formData, userId, ipAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.self_transfer) {
          setIsSelfTransferError(true);
        }
        throw new Error(data.error || 'Failed to save beneficiary');
      }

      setSuccess('Payee added successfully!');
      resetForm();

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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-beneficiary`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ beneficiary_id: deleteTarget.id, userId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete beneficiary');
      }
      setDeleteTarget(null);
      fetchBeneficiaries();
    } catch (err: any) {
      setError(err.message || 'Failed to delete beneficiary');
      setDeleteTarget(null);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/mobile/login', { replace: true });
  };

  if (!userId) {
    return null;
  }

  // KYC checking state
  if (isCheckingKyc) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-[#8c76f0] animate-spin mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Checking verification status...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // KYC not verified
  if (kycStatus && !kycStatus.isVerified) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="px-4 py-8">
          <div className="max-w-md mx-auto bg-white rounded-2xl border-2 border-yellow-300 p-6 text-center">
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-yellow-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">KYC Verification Required</h2>
            <p className="text-gray-700 text-sm mb-6">
              {kycStatus.status === 'not_submitted' &&
                'Please complete your KYC verification to manage beneficiaries. You need to submit your PAN and Address details.'}
              {kycStatus.status === 'incomplete' &&
                'Your KYC submission is incomplete. Please complete all required sections to proceed.'}
              {kycStatus.status === 'pending' &&
                'Your KYC documents are under review. Please wait for admin approval before managing beneficiaries.'}
              {kycStatus.status === 'rejected' &&
                'Your KYC verification was rejected. Please review the feedback and resubmit your documents.'}
            </p>
            <button
              onClick={() => navigate('/mobile/kyc-verification', { state: { userId, userEmail } })}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium active:opacity-90 transition-opacity"
            >
              Go to KYC Verification
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Account restricted
  if (kycStatus?.isRestricted) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="px-4 py-8">
          <div className="max-w-md mx-auto bg-white rounded-2xl border-2 border-red-300 p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Account Restricted</h2>
            <p className="text-gray-700 text-sm mb-6">
              Your account has been restricted by our compliance team. You are unable to add beneficiaries at this time. Please raise a support ticket for assistance.
            </p>
            <button
              onClick={() => navigate('/mobile/help-support', { state: { userId, userEmail } })}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium active:opacity-90 transition-opacity"
            >
              Raise Support Ticket
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout
      userId={userId}
      userEmail={userEmail}
      onLogout={handleLogout}
      showBack={true}
    >
      <div className="px-4 py-4">
        {/* Error banner */}
        {error && !isModalOpen && (
          <div className="mb-4 bg-red-50 border-2 border-red-500 rounded-xl px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">My Payees</h1>
              <p className="text-gray-500 text-xs">Manage saved accounts</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium text-sm active:opacity-90 transition-opacity shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-10 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-[#8c76f0] animate-spin mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Loading beneficiaries...</p>
            </div>
          </div>
        ) : beneficiaries.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
            <div className="w-14 h-14 bg-gradient-to-r from-purple-50 to-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-[#8c76f0]" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">No payees yet</h3>
            <p className="text-gray-600 text-sm mb-5 max-w-xs mx-auto">
              Add your first payee to start sending payments quickly and securely
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium text-sm active:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Payee
            </button>
          </div>
        ) : (
          /* Beneficiary cards - single column */
          <div className="space-y-3">
            {beneficiaries.map((beneficiary) => {
              const isExpanded = expandedId === beneficiary.id;
              const isActive = beneficiary.status === 'Active';
              return (
                <div
                  key={beneficiary.id}
                  className={`bg-white rounded-2xl border-2 transition-all ${
                    isActive ? 'border-gray-200' : 'border-gray-200 opacity-75'
                  }`}
                >
                  {/* Card header - tap target */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : beneficiary.id)}
                    className="w-full flex items-center gap-3 p-4 text-left active:bg-gray-50 rounded-2xl transition-colors"
                  >
                    <div className="w-11 h-11 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 truncate">{beneficiary.full_name}</h3>
                        {beneficiary.is_verified_merchant && (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate mt-0.5">
                        {beneficiary.bank_name} • ••••{beneficiary.bank_account.slice(-4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {beneficiary.status}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-3">
                          <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="text-gray-900 font-medium">{beneficiary.bank_name}</p>
                            <p className="text-gray-600 text-xs">{beneficiary.branch_name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="text-gray-900 font-medium">{beneficiary.bank_account}</p>
                            <p className="text-gray-600 text-xs">{beneficiary.ifsc} • {beneficiary.account_type}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <p className="text-sm text-gray-900 truncate">{beneficiary.email}</p>
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

                      {/* Toggle switch + Delete */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => toggleStatus(beneficiary.id, beneficiary.status)}
                            role="switch"
                            aria-checked={isActive}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                              isActive ? 'bg-[#8c76f0]' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                isActive ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className="text-sm font-medium text-gray-700">
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <button
                          onClick={() => setDeleteTarget(beneficiary)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 active:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info banner */}
        <div className="mt-5 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-2xl px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4.5 h-4.5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">About Payees</p>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                Save frequently used bank accounts for quick payments. Only active payees will be available for transactions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Beneficiary Bottom Sheet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />

          {/* Bottom sheet */}
          <div className="relative bg-white w-full max-h-[92vh] rounded-t-3xl shadow-2xl flex flex-col animate-slide-up">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-4.5 h-4.5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Add Payee</h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-gray-500 active:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 pb-24">
              {/* Self-transfer error */}
              {error && isSelfTransferError && (
                <div className="mb-4 bg-red-50 border-2 border-red-400 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-4.5 h-4.5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-red-800 font-bold text-sm">Self-Transfer Prohibited</p>
                      <p className="text-red-700 text-xs mt-1 leading-relaxed">
                        Sending money to your own account using this platform is <strong>strictly prohibited as per RBI norms</strong>. {error.replace('Sending money to your own account using this platform is strictly prohibited as per RBI norms. ', '')}
                      </p>
                      <p className="text-xs text-red-600 mt-1.5 font-medium">
                        Please enter details of a different account holder.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Generic error */}
              {error && !isSelfTransferError && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4.5 h-4.5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="mb-4 bg-green-50 border-l-4 border-green-500 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4.5 h-4.5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </div>
                </div>
              )}

              {/* Beneficiary Information */}
              <div className="bg-gray-50 p-4 rounded-xl mb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Payee Information
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Full Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={90}
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value.replace(/[^A-Za-z ]/g, '') })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white text-base"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email Address <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={100}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/[^A-Za-z0-9@_.\-]/g, '') })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white text-base"
                      placeholder="Enter email"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Mobile Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white text-base"
                      placeholder="Enter 10-digit mobile number"
                      autoComplete="tel"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      PAN Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.pan_number}
                      onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white text-base"
                      placeholder="Enter PAN number"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-gray-50 p-4 rounded-xl mb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Bank Details
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      IFSC Code <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={formData.ifsc}
                      onChange={(e) => handleIFSCChange(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono tracking-wider text-base"
                      placeholder="Enter IFSC code"
                      autoCapitalize="characters"
                      autoCorrect="off"
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
                      <div className="mt-2.5 p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle className="w-4.5 h-4.5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-green-900">{formData.bank_name}</p>
                            <p className="text-xs text-green-700 mt-0.5">{formData.branch_name}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Bank Account Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={20}
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '') })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono text-base"
                      placeholder="Enter account number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Account Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={formData.account_type}
                      onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white text-base"
                    >
                      <option value="Saving">Saving Account</option>
                      <option value="Current">Current Account</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-5 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold active:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isValidatingIFSC || !formData.bank_name}
                  className="flex-1 px-5 py-3.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold active:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding Payee...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Payee
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Payee?</h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              Are you sure you want to delete <strong>{deleteTarget.full_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold active:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold active:opacity-90 transition-opacity shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
