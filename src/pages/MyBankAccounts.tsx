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
} from 'lucide-react';
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { getClientIp } from '../utils/getClientIp';

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

export default function MyBankAccounts() {
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [kycStatus, setKycStatus] = useState<{ isVerified: boolean; status: string; isRestricted?: boolean } | null>(null);
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

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!userId) return null;

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
            currentPage="bank-accounts"
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
            currentPage="bank-accounts"
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
                  Your account has been restricted by our compliance team. You are unable to manage bank accounts at this time. Please raise a support ticket for assistance.
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
          currentPage="bank-accounts"
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-6xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">My Bank Accounts</h1>
                  </div>
                  <p className="text-gray-500 text-sm mt-1 ml-[52px]">
                    Manage your bank accounts for receiving payments and settlements
                  </p>
                </div>
                <button
                  onClick={openAddModal}
                  className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Add Bank Account
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

            {/* Mobile add button */}
            <button
              onClick={openAddModal}
              className="md:hidden w-full flex items-center justify-center gap-2 mb-6 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add New Bank Account
            </button>

            {/* Account Cards */}
            {isLoading ? (
              <div className="bg-white rounded-2xl border-2 border-gray-300 p-12 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-[#8c76f0] animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 text-sm">Loading bank accounts...</p>
                </div>
              </div>
            ) : accounts.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-12 text-center transition-all hover:shadow-xl">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-50 to-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Landmark className="w-8 h-8 text-[#8c76f0]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No bank accounts yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Add your bank account to receive payments and settlements directly to your account
                </p>
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-5 h-5" />
                  Add Bank Account
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`bg-white rounded-2xl border-2 p-6 transition-all hover:shadow-xl ${
                      account.is_default
                        ? 'border-[#8c76f0] ring-2 ring-purple-100'
                        : 'border-gray-300 hover:border-[#8c76f0]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                        <Landmark className="w-6 h-6 text-[#8c76f0]" />
                      </div>
                      <div className="flex items-center gap-2">
                        {account.is_default && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#8c76f0] text-white text-xs font-semibold rounded-lg">
                            <Star className="w-3 h-3 fill-current" />
                            Default
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                            account.status === 'Active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {account.status}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-4">{account.full_name}</h3>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="text-gray-900 font-medium">{account.bank_name}</p>
                          <p className="text-gray-600">{account.branch_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="text-gray-900 font-medium font-mono">
                            {account.bank_account_number}
                          </p>
                          <p className="text-gray-600">
                            {account.ifsc} &bull; {account.account_type}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-sm text-gray-900">{account.email}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-sm text-gray-900">{account.mobile}</p>
                      </div>

                      {account.pan_number && (
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <p className="text-sm text-gray-900">{account.pan_number}</p>
                        </div>
                      )}
                    </div>

                    {!account.is_default && (
                      <button
                        onClick={() => handleSetDefault(account.id)}
                        disabled={isSettingDefault === account.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all border-2 border-gray-300 text-gray-700 hover:border-[#8c76f0] hover:bg-purple-50 hover:text-[#8c76f0] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSettingDefault === account.id ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Setting as default...
                          </>
                        ) : (
                          <>
                            <Star className="w-5 h-5" />
                            Set as Default
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Info card */}
            <div className="mt-8 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-2xl px-6 py-5 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-900">About Bank Accounts</p>
                  <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
                    <li>
                      Add your own bank accounts for receiving payments and settlements. Your default account will be used for all settlements.
                    </li>
                    <li>
                      If any sender transfers money to these accounts through our platform, your account will be treated as KYC-verified merchants without requiring any additional information.
                    </li>
                  </ul>
                  <div className="bg-white/60 border border-[#8c76f0]/30 rounded-xl px-4 py-3 mt-2">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      Any account added will be treated as whitelisted across the platform, allowing all users to send funds to it on your behalf. Separate KYC verification or vendor onboarding will not be required for individual payment senders to link or use this account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl purple-scrollbar">
            <div className="sticky top-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Add Bank Account</h2>
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

            <form onSubmit={handleSubmit} className="p-8">
              {error && (
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
                {/* User Details */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Account Holder Details
                  </h3>
                  {isLoadingProfile ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading your details...
                    </div>
                  ) : userProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={getDisplayName()}
                          disabled
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={userProfile.email}
                          disabled
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 cursor-not-allowed truncate"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={userProfile.mobile || ''}
                          disabled
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          PAN Number
                        </label>
                        <input
                          type="text"
                          value={userProfile.pan_number || 'Not available'}
                          disabled
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-600">
                      Unable to load profile. Please close and try again.
                    </p>
                  )}
                </div>

                {/* Bank Details */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Bank Details
                  </h3>
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
                              <p className="text-sm font-bold text-green-900">
                                {formData.bank_name}
                              </p>
                              <p className="text-sm text-green-700 mt-1">
                                {formData.branch_name}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank Account Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.bank_account_number}
                        onChange={(e) =>
                          setFormData({ ...formData, bank_account_number: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '').slice(0, 20) })
                        }
                        maxLength={20}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono"
                        placeholder="Enter account number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Account Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.confirm_account_number}
                        onChange={(e) =>
                          setFormData({ ...formData, confirm_account_number: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '').slice(0, 20) })
                        }
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white font-mono ${
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
                          <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Account numbers do not match
                          </p>
                        )}
                      {formData.confirm_account_number &&
                        formData.bank_account_number === formData.confirm_account_number && (
                          <p className="mt-1.5 text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Account numbers match
                          </p>
                        )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                      >
                        <option value="Saving">Saving Account</option>
                        <option value="Current">Current Account</option>
                      </select>
                      {formData.account_type === 'Current' && userProfile?.business_name && (
                        <p className="text-xs text-[#8c76f0] mt-1.5 font-medium">
                          Business name will be used as account holder name for current accounts
                        </p>
                      )}
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
                  }}
                  className="flex-1 px-6 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
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
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding Account...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Bank Account
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
