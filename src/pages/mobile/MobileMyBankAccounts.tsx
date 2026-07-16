import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Landmark,
  Plus,
  X,
  Building2,
  CreditCard,
  Mail,
  Phone,
  FileText,
  CheckCircle,
  Loader2,
  AlertCircle,
  Star,
  Trash2,
} from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';
import { getClientIp } from '../../utils/getClientIp';

interface BankAccount {
  id: string;
  bank_account_number: string;
  ifsc: string;
  bank_name: string;
  branch_name: string;
  account_type: string;
  full_name: string;
  email: string;
  mobile: string;
  pan_number: string | null;
  is_default: boolean;
  status: string;
  created_at: string;
}

interface UserProfile {
  full_name: string;
  email: string;
  mobile: string;
  pan_number: string;
  business_name?: string;
}

interface KycStatus {
  isVerified: boolean;
  status: string;
  isRestricted?: boolean;
}

export default function MobileMyBankAccounts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const { logout } = useAuth();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isValidatingIFSC, setIsValidatingIFSC] = useState(false);
  const [ifscError, setIfscError] = useState('');
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [isCheckingKyc, setIsCheckingKyc] = useState(true);

  const [formData, setFormData] = useState({
    bank_account_number: '',
    confirm_account_number: '',
    ifsc: '',
    bank_name: '',
    branch_name: '',
    account_type: 'Saving',
    full_name: '',
    mobile: '',
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
          fetchAccounts();
        }
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    } finally {
      setIsCheckingKyc(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-bank-accounts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch accounts');
      setAccounts(data.accounts);
    } catch (err: any) {
      setError(err.message || 'Failed to load bank accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-profile-for-bank`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setUserProfile(data);
        setFormData((prev) => ({
          ...prev,
          full_name: data.full_name || prev.full_name,
          mobile: data.mobile || prev.mobile,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      bank_account_number: '',
      confirm_account_number: '',
      ifsc: '',
      bank_name: '',
      branch_name: '',
      account_type: 'Saving',
      full_name: userProfile?.full_name || '',
      mobile: userProfile?.mobile || '',
    });
    setError('');
    setSuccess('');
    setIfscError('');
    setIsModalOpen(true);
    if (!userProfile) {
      fetchUserProfile();
    }
  };

  const getDisplayName = () => {
    if (formData.account_type === 'Current' && userProfile?.business_name) {
      return userProfile.business_name;
    }
    return userProfile?.full_name || '';
  };

  const validateIFSC = async (ifscCode: string) => {
    if (!ifscCode || ifscCode.length !== 11) {
      setIfscError('IFSC code must be 11 characters');
      return;
    }

    try {
      setIsValidatingIFSC(true);
      setIfscError('');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-ifsc`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ifsc: ifscCode }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid IFSC code');

      setFormData((prev) => ({
        ...prev,
        bank_name: data.bank,
        branch_name: data.branch,
      }));
    } catch (err: any) {
      setIfscError(err.message || 'Failed to validate IFSC code');
      setFormData((prev) => ({ ...prev, bank_name: '', branch_name: '' }));
    } finally {
      setIsValidatingIFSC(false);
    }
  };

  const handleIFSCChange = (value: string) => {
    const upperValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    setFormData((prev) => ({ ...prev, ifsc: upperValue }));

    if (upperValue.length === 11) {
      validateIFSC(upperValue);
    } else {
      setIfscError('');
      setFormData((prev) => ({ ...prev, bank_name: '', branch_name: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.bank_account_number.trim()) {
      setError('Account Number is required.');
      return;
    }
    if (!/^[A-Za-z0-9\- ]+$/.test(formData.bank_account_number)) {
      setError('Account Number may only contain letters, numbers, -, and spaces.');
      return;
    }
    if (formData.bank_account_number.length > 20) {
      setError('Account Number must not exceed 20 characters.');
      return;
    }

    if (formData.bank_account_number !== formData.confirm_account_number) {
      setError('Account numbers do not match');
      return;
    }

    if (!formData.ifsc.trim() || !/^[A-Z0-9]{11}$/.test(formData.ifsc)) {
      setError('IFSC Code must be exactly 11 characters (letters A-Z and numbers only).');
      return;
    }

    if (!formData.bank_name || !formData.branch_name) {
      setError('Please validate IFSC code before submitting');
      return;
    }

    if (ifscError) {
      setError('Please fix IFSC code errors before submitting');
      return;
    }

    if (!userProfile) {
      setError('Unable to load user profile. Please try again.');
      return;
    }

    if (!getDisplayName().trim() || !userProfile?.mobile?.trim()) {
      setError('Full Name and Mobile Number are required. Please complete your profile.');
      return;
    }

    try {
      setIsSubmitting(true);
      const ipAddress = await getClientIp();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-user-bank-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            bank_account_number: formData.bank_account_number,
            ifsc: formData.ifsc,
            bank_name: formData.bank_name,
            branch_name: formData.branch_name,
            account_type: formData.account_type,
            full_name: getDisplayName(),
            email: userProfile.email,
            mobile: userProfile.mobile,
            pan_number: userProfile.pan_number,
            ipAddress,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save bank account');

      setSuccess('Bank account added successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess('');
        fetchAccounts();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to add bank account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      setIsSettingDefault(accountId);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-default-bank-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, accountId }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to set default');

      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to set default account');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSettingDefault(null);
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      setIsDeleting(accountId);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-bank-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, accountId }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete bank account');

      setDeleteTarget(null);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to delete bank account');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/mobile/login', { replace: true });
  };

  if (!userId) return null;

  // --- KYC checking screen ---
  if (isCheckingKyc) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  // --- KYC not verified screen ---
  if (kycStatus && !kycStatus.isVerified) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="px-4 py-6">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl border-2 border-yellow-300 p-6 text-center">
              <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-yellow-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">KYC Verification Required</h2>
              <p className="text-sm text-gray-700 mb-6 leading-relaxed">
                {kycStatus.status === 'not_submitted' &&
                  'Please complete your KYC verification to manage bank accounts. You need to submit your PAN and Address details.'
                }
                {kycStatus.status === 'incomplete' &&
                  'Your KYC submission is incomplete. Please complete all required sections to proceed.'
                }
                {kycStatus.status === 'pending' &&
                  'Your KYC documents are under review. Please wait for admin approval before managing bank accounts.'
                }
                {kycStatus.status === 'rejected' &&
                  'Your KYC verification was rejected. Please review the feedback and resubmit your documents.'
                }
              </p>
              <button
                onClick={() => navigate('/mobile/kyc-verification', { state: { userId, userEmail } })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Go to KYC Verification
              </button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // --- Restricted account screen ---
  if (kycStatus?.isRestricted) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="px-4 py-6">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl border-2 border-red-300 p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Account Restricted</h2>
              <p className="text-sm text-gray-700 mb-6 leading-relaxed">
                Your account has been restricted by our compliance team. You are unable to manage bank accounts at this time. Please raise a support ticket for assistance.
              </p>
              <button
                onClick={() => navigate('/mobile/help-support', { state: { userId, userEmail } })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Raise Support Ticket
              </button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // --- Main screen ---
  return (
    <MobileLayout
      userId={userId}
      userEmail={userEmail}
      onLogout={handleLogout}
      showBack={true}
    >
      <div className="px-4 py-4 pb-28">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
                <Landmark className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">My Bank Accounts</h1>
                <p className="text-xs text-gray-500">Manage your bank accounts for settlements</p>
              </div>
            </div>
          </div>

          {/* Add button */}
          <button
            onClick={openAddModal}
            className="w-full flex items-center justify-center gap-2 mb-4 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add New Bank Account
          </button>

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            </div>
          )}

          {/* Account Cards */}
          {isLoading ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-10 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin mx-auto mb-3" />
                <p className="text-gray-600 text-xs">Loading bank accounts...</p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-purple-50 to-violet-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Landmark className="w-7 h-7 text-[#8c76f0]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">No bank accounts yet</h3>
              <p className="text-xs text-gray-600 mb-5 max-w-xs mx-auto">
                Add your bank account to receive payments and settlements directly to your account
              </p>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add Bank Account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    account.is_default
                      ? 'border-[#8c76f0] ring-2 ring-purple-100'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Top row: icon + badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {account.is_default && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#8c76f0] text-white text-[10px] font-semibold rounded">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Default
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          account.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {account.status}
                      </span>
                    </div>
                  </div>

                  {/* Account holder name */}
                  <h3 className="text-sm font-bold text-gray-900 mb-3">{account.full_name}</h3>

                  {/* Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs min-w-0">
                        <p className="text-gray-900 font-medium truncate">{account.bank_name}</p>
                        <p className="text-gray-600 truncate">{account.branch_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div className="text-xs min-w-0">
                        <p className="text-gray-900 font-medium font-mono truncate">
                          {account.bank_account_number}
                        </p>
                        <p className="text-gray-600">
                          {account.ifsc} &bull; {account.account_type}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-900 truncate">{account.email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-900">{account.mobile}</p>
                    </div>

                    {account.pan_number && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-900">{account.pan_number}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {!account.is_default ? (
                      <button
                        onClick={() => handleSetDefault(account.id)}
                        disabled={isSettingDefault === account.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-medium transition-all border-2 border-gray-200 text-gray-700 text-xs hover:border-[#8c76f0] hover:bg-purple-50 hover:text-[#8c76f0] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSettingDefault === account.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Setting...
                          </>
                        ) : (
                          <>
                            <Star className="w-4 h-4" />
                            Set Default
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-purple-50 text-[#8c76f0] text-xs font-semibold">
                        <Star className="w-4 h-4 fill-current" />
                        Default Account
                      </div>
                    )}

                    <button
                      onClick={() => setDeleteTarget(account)}
                      disabled={isDeleting === account.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-medium transition-all border-2 border-gray-200 text-gray-600 text-xs hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting === account.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info card */}
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl px-4 py-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#8c76f0] mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-900">About Bank Accounts</p>
                <ul className="text-xs text-gray-700 space-y-1.5 list-disc pl-4">
                  <li>
                    Add your own bank accounts for receiving payments and settlements. Your default account will be used for all settlements.
                  </li>
                  <li>
                    If any sender transfers money to these accounts through our platform, your account will be treated as KYC-verified merchants without requiring any additional information.
                  </li>
                </ul>
                <div className="bg-white/60 border border-[#8c76f0]/30 rounded-lg px-3 py-2 mt-1.5">
                  <p className="text-[11px] text-gray-700 leading-relaxed">
                    Any account added will be treated as whitelisted across the platform, allowing all users to send funds to it on your behalf. Separate KYC verification or vendor onboarding will not be required for individual payment senders to link or use this account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Bank Account Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 pb-16">
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 px-4 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-white">Add Bank Account</h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setError('');
                  setSuccess('');
                }}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drag handle */}
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              {error && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-lg px-3 py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-xs font-medium">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-50 border-l-4 border-green-500 rounded-lg px-3 py-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-green-700 text-xs font-medium">{success}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Account Holder Details */}
                <div className="bg-gray-50 p-3 rounded-xl">
                  <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Account Holder Details
                  </h3>
                  {isLoadingProfile ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading your details...
                    </div>
                  ) : userProfile ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={getDisplayName()}
                          disabled
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-700 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={userProfile.email}
                          disabled
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-700 cursor-not-allowed truncate"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={userProfile.mobile || ''}
                          disabled
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-700 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          PAN Number
                        </label>
                        <input
                          type="text"
                          value={userProfile.pan_number || 'Not available'}
                          disabled
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-red-600">
                      Unable to load profile. Please close and try again.
                    </p>
                  )}
                </div>

                {/* Bank Details */}
                <div className="bg-gray-50 p-3 rounded-xl">
                  <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Bank Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        IFSC Code <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={formData.ifsc}
                        onChange={(e) => handleIFSCChange(e.target.value)}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono tracking-wider text-sm"
                        placeholder="Enter IFSC code"
                      />
                      {isValidatingIFSC && (
                        <div className="flex items-center gap-2 mt-1.5 text-[#8c76f0] text-xs font-medium">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Validating IFSC...
                        </div>
                      )}
                      {ifscError && (
                        <div className="mt-1.5 text-red-600 text-xs font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {ifscError}
                        </div>
                      )}
                      {formData.bank_name && formData.branch_name && (
                        <div className="mt-2 p-2.5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-green-900">
                                {formData.bank_name}
                              </p>
                              <p className="text-xs text-green-700 mt-0.5">
                                {formData.branch_name}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Bank Account Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        value={formData.bank_account_number}
                        onChange={(e) =>
                          setFormData({ ...formData, bank_account_number: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '').slice(0, 20) })
                        }
                        maxLength={20}
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono text-sm"
                        placeholder="Enter account number"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Confirm Account Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        value={formData.confirm_account_number}
                        onChange={(e) =>
                          setFormData({ ...formData, confirm_account_number: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '').slice(0, 20) })
                        }
                        className={`w-full px-3 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono text-sm ${
                          formData.confirm_account_number &&
                          formData.bank_account_number !== formData.confirm_account_number
                            ? 'border-red-400 focus:border-red-500'
                            : formData.confirm_account_number &&
                                formData.bank_account_number === formData.confirm_account_number
                              ? 'border-green-400 focus:border-green-500'
                              : 'border-gray-300 focus:border-[#8c76f0]'
                        }`}
                        placeholder="Re-enter account number"
                      />
                      {formData.confirm_account_number &&
                        formData.bank_account_number !== formData.confirm_account_number && (
                          <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Account numbers do not match
                          </p>
                        )}
                      {formData.confirm_account_number &&
                        formData.bank_account_number === formData.confirm_account_number && (
                          <p className="mt-1 text-[11px] text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Account numbers match
                          </p>
                        )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Account Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        required
                        value={formData.account_type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            account_type: newType,
                            full_name: newType === 'Current' && userProfile?.business_name
                              ? userProfile.business_name
                              : userProfile?.full_name || prev.full_name,
                          }));
                        }}
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white text-sm"
                      >
                        <option value="Saving">Saving Account</option>
                        <option value="Current">Current Account</option>
                      </select>
                      {formData.account_type === 'Current' && userProfile?.business_name && (
                        <p className="text-[11px] text-[#8c76f0] mt-1 font-medium">
                          Business name will be used as account holder name for current accounts
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4 mt-4 border-t-2 border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    isValidatingIFSC ||
                    !formData.bank_name ||
                    !formData.bank_account_number ||
                    formData.bank_account_number !== formData.confirm_account_number ||
                    !userProfile
                  }
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Account
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl">
            <div className="p-5">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 text-center mb-2">Delete Bank Account?</h3>
              <p className="text-xs text-gray-600 text-center mb-1 leading-relaxed">
                Are you sure you want to delete the account ending in
              </p>
              <p className="text-sm font-mono font-bold text-gray-900 text-center mb-5">
                {deleteTarget.bank_account_number.slice(-4).padStart(deleteTarget.bank_account_number.length, '•')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting === deleteTarget.id}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget.id)}
                  disabled={isDeleting === deleteTarget.id}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting === deleteTarget.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
