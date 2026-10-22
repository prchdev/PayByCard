import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  ArrowUpRight,
  Users,
  CreditCard,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  History,
  TrendingUp,
  Hourglass,
  Hash,
  Landmark,
  Info,
  AlertTriangle,
  Gift,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react';
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

interface RecentTransaction {
  id: string;
  payment_reference: string;
  amount: string;
  total_amount: string;
  status: string;
  display_status: string;
  card_type: string | null;
  created_at: string;
  beneficiary_details: any;
  selected_payment_option: any;
  category_details: any;
}

const DISPLAY_STATUS: Record<string, { label: string; color: string; dot: string; icon: React.ElementType }> = {
  completed:             { label: 'Completed',                   color: 'text-green-700',  dot: 'bg-green-500',  icon: CheckCircle },
  failed:                { label: 'Failed',                      color: 'text-red-600',    dot: 'bg-red-500',    icon: XCircle },
  cancelled:             { label: 'Transaction Failed',          color: 'text-gray-500',   dot: 'bg-gray-400',   icon: XCircle },
  processing:            { label: 'Processing',                  color: 'text-blue-600',   dot: 'bg-blue-500',   icon: RefreshCw },
  pending:               { label: 'Processing',                  color: 'text-blue-600',   dot: 'bg-blue-500',   icon: RefreshCw },
  kyc_pending:           { label: 'Merchant Onboarding Required', color: 'text-amber-600', dot: 'bg-amber-500',  icon: Clock },
  merchant_kyc_review:   { label: 'Merchant KYC Pending',        color: 'text-amber-600', dot: 'bg-amber-500',  icon: Clock },
  settlement_pending:    { label: 'Settlement In Progress',      color: 'text-blue-600',   dot: 'bg-blue-400',   icon: RefreshCw },
  settlement_in_progress:{ label: 'Settlement In Progress',      color: 'text-blue-600',   dot: 'bg-blue-400',   icon: RefreshCw },
  refunded:              { label: 'Refunded',                    color: 'text-orange-600', dot: 'bg-orange-400', icon: AlertCircle },
  refund_pending:        { label: 'Refund Pending',              color: 'text-rose-600',   dot: 'bg-rose-500',   icon: AlertCircle },
};

function fmtAmt(v: string | number) {
  return parseFloat(String(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateShort(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<{ isVerified: boolean; status: string } | null>(null);
  const [isCheckingKyc, setIsCheckingKyc] = useState(true);
  const [recentTxns, setRecentTxns] = useState<RecentTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [stats, setStats] = useState<{
    amount_processed: number;
    amount_in_settlement: number;
    total_transactions: number;
  } | null>(null);
  const [dashboardNotifications, setDashboardNotifications] = useState<
    { id: string; title: string; message: string; notification_type: string }[]
  >([]);
  const [referral, setReferral] = useState<{ referralCode: string; totalReferrals: number; referredBy: { name: string | null } | null } | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
    } else {
      checkKycStatus();
      fetchRecentTransactions();
      fetchStats();
      fetchDashboardNotifications();
      fetchReferralInfo();
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
      if (response.ok) setKycStatus(result);
    } catch (error) {
      console.error('Error checking KYC status:', error);
    } finally {
      setIsCheckingKyc(false);
    }
  };

  const fetchDashboardNotifications = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-notifications?action=active`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await res.json();
      if (res.ok) setDashboardNotifications(data.notifications ?? []);
    } catch (_) {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-stats`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (_) {}
  };

  const fetchRecentTransactions = async () => {
    try {
      setLoadingTxns(true);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-transactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, page: 1, limit: 5, status: 'all' }),
        }
      );
      const data = await res.json();
      if (res.ok) setRecentTxns(data.payments || []);
    } catch (_) {
    } finally {
      setLoadingTxns(false);
    }
  };

  const fetchReferralInfo = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-referral-info`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );
      const data = await res.json();
      if (res.ok && data.referralCode) setReferral(data);
    } catch (_) {}
  };

  const buildReferralMessage = () => {
    if (!referral?.referralCode) return '';
    const link = `${window.location.origin}/?ref=${referral.referralCode}`;
    return `Hi! I'm using PayByCard to manage my rent, tuition fees, vendor payment using credit card effortlessly by transferring money in bank account. Join me using my referral code ${referral.referralCode} and sign up here: ${link}`;
  };

  const handleCopyReferral = async () => {
    if (!referral?.referralCode) return;
    try {
      await navigator.clipboard.writeText(buildReferralMessage());
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    } catch (_) {}
  };

  const handleWhatsAppShare = () => {
    if (!referral?.referralCode) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(buildReferralMessage())}`, '_blank', 'noopener,noreferrer');
  };

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!userId) return null;

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
          currentPage="dashboard"
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Banner */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
            <p className="text-gray-600 mt-1">Here's what's happening with your account today.</p>
          </div>

          {/* KYC Status Banner */}
          {!isCheckingKyc && kycStatus && (
            <>
              {kycStatus.isVerified ? (
                <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-xl px-6 py-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-green-900">Account Verified Successfully</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Your KYC verification is complete. You can now accept payments, make transfers, and access all features.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {kycStatus.status === 'pending' ? (
                    <div className="mb-8 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-500 rounded-xl px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Clock className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-blue-900">KYC Verification Pending</h3>
                          <p className="text-sm text-blue-700 mt-1">
                            Your KYC documents are under review. You will be able to use payment features once approved.
                          </p>
                          <button
                            onClick={() => navigate('/kyc-verification', { state: { userId, userEmail } })}
                            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            View Status
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : kycStatus.status === 'rejected' ? (
                    <div className="mb-8 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-500 rounded-xl px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-red-900">KYC Verification Rejected</h3>
                          <p className="text-sm text-red-700 mt-1">
                            Your KYC verification was rejected. Please review the feedback and resubmit your documents.
                          </p>
                          <button
                            onClick={() => navigate('/kyc-verification', { state: { userId, userEmail } })}
                            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          >
                            Review and Resubmit
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-500 rounded-xl px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-yellow-900">Complete Your KYC Verification</h3>
                          <p className="text-sm text-yellow-700 mt-1">
                            {kycStatus.status === 'incomplete'
                              ? 'Your KYC submission is incomplete. Please complete all required sections.'
                              : 'Please complete your KYC verification to access payment and beneficiary management features.'
                            }
                          </p>
                          <button
                            onClick={() => navigate('/kyc-verification', { state: { userId, userEmail } })}
                            className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors"
                          >
                            Complete KYC Verification
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Dashboard Notifications */}
          {dashboardNotifications.length > 0 && (
            <div className="mb-8 space-y-3">
              {dashboardNotifications.map((n) => {
                const isError = n.notification_type === 'error';
                const isWarning = n.notification_type === 'warning';
                const NotifIcon = isError ? AlertCircle : isWarning ? AlertTriangle : Info;
                const containerClass = isError
                  ? 'bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-500 rounded-xl px-6 py-4'
                  : isWarning
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-500 rounded-xl px-6 py-4'
                    : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-500 rounded-xl px-6 py-4';
                const iconBgClass = isError ? 'bg-red-100' : isWarning ? 'bg-amber-100' : 'bg-blue-100';
                const iconColorClass = isError ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600';
                const titleColorClass = isError ? 'text-red-900' : isWarning ? 'text-amber-900' : 'text-blue-900';
                const bodyColorClass = isError ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-blue-700';
                return (
                  <div key={n.id} className={containerClass}>
                    <div className="flex items-start gap-3">
                      <div className={'w-10 h-10 ' + iconBgClass + ' rounded-xl flex items-center justify-center flex-shrink-0'}>
                        <NotifIcon className={'w-5 h-5 ' + iconColorClass} />
                      </div>
                      <div className="flex-1">
                        <h3 className={'text-sm font-semibold ' + titleColorClass}>{n.title}</h3>
                        <p className={'text-sm ' + bodyColorClass + ' mt-0.5 whitespace-pre-line'}>{n.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-[#8c76f0] hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount Processed</span>
              </div>
              {stats ? (
                <p className="text-3xl font-bold text-gray-900">
                  ₹{stats.amount_processed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : (
                <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
              )}
              <p className="text-sm text-gray-500 mt-1">Completed &amp; in settlement</p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-amber-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Hourglass className="w-5 h-5 text-amber-500" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">In Settlement</span>
              </div>
              {stats ? (
                <p className="text-3xl font-bold text-gray-900">
                  ₹{stats.amount_in_settlement.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : (
                <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
              )}
              <p className="text-sm text-gray-500 mt-1">Amount In Settlement</p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Hash className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transactions</span>
              </div>
              {stats ? (
                <p className="text-3xl font-bold text-gray-900">
                  {stats.total_transactions.toLocaleString('en-IN')}
                </p>
              ) : (
                <div className="h-9 w-20 bg-gray-100 rounded-lg animate-pulse" />
              )}
              <p className="text-sm text-gray-500 mt-1">Total Transactions</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <button
                    onClick={() => navigate('/my-transactions', { state: { userId, userEmail } })}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    View All
                  </button>
                </div>

                {loadingTxns ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mb-2" />
                    <p className="text-sm text-gray-500">Loading transactions...</p>
                  </div>
                ) : recentTxns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Clock className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-gray-700 font-medium">No transactions yet</p>
                    <p className="text-sm text-gray-500 mt-1 text-center">
                      Your recent transactions will appear here
                    </p>
                    <button
                      onClick={() => navigate('/make-payment', { state: { userId, userEmail } })}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Make your first payment
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentTxns.map((txn, idx) => {
                      const ds = txn.display_status || txn.status;
                      const cfg = DISPLAY_STATUS[ds] || DISPLAY_STATUS.processing;
                      const Icon = cfg.icon;
                      const paymentOptionName = txn.selected_payment_option?.card_type || txn.card_type || '—';
                      return (
                        <div
                          key={txn.id}
                          className={`flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group ${idx < recentTxns.length - 1 ? 'border-b border-gray-100' : ''}`}
                          onClick={() => navigate('/my-transactions', { state: { userId, userEmail } })}
                        >
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            ds === 'completed' ? 'bg-green-50' :
                            ds === 'failed' || ds === 'cancelled' ? 'bg-red-50' :
                            ds === 'kyc_pending' || ds === 'refund_pending' ? 'bg-amber-50' :
                            'bg-blue-50'
                          }`}>
                            <Icon className={`w-5 h-5 ${cfg.color}`} />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {txn.beneficiary_details?.full_name || 'Unknown'}
                              </p>
                              <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                                {txn.beneficiary_details?.bank_name || ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-xs text-blue-600">{txn.payment_reference}</span>
                              <span className="text-gray-300 text-xs">·</span>
                              <span className="text-xs text-gray-500 truncate">{paymentOptionName}</span>
                            </div>
                          </div>

                          {/* Amount + Status */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">₹{fmtAmt(txn.total_amount)}</p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                            </div>
                          </div>

                          {/* Date */}
                          <div className="hidden md:block text-right flex-shrink-0 w-24">
                            <p className="text-xs text-gray-400">{fmtDateShort(txn.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-3 mt-1">
                      <button
                        onClick={() => navigate('/my-transactions', { state: { userId, userEmail } })}
                        className="w-full py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-100"
                      >
                        View all transactions
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/make-payment', { state: { userId, userEmail } })}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-md"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                    Make Payment
                  </button>
                  <button
                    onClick={() => navigate('/my-transactions', { state: { userId, userEmail } })}
                    className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:border-[#8c76f0] hover:bg-purple-50 transition-all"
                  >
                    <History className="w-5 h-5 text-[#8c76f0]" />
                    My Transactions
                  </button>
                  <button
                    onClick={() => navigate('/my-beneficiaries', { state: { userId, userEmail } })}
                    className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:border-[#8c76f0] hover:bg-purple-50 transition-all"
                  >
                    <Users className="w-5 h-5 text-[#8c76f0]" />
                    Add Beneficiary
                  </button>
                  <button
                    onClick={() => navigate('/my-bank-accounts', { state: { userId, userEmail } })}
                    className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:border-[#8c76f0] hover:bg-purple-50 transition-all"
                  >
                    <Landmark className="w-5 h-5 text-[#8c76f0]" />
                    My Bank Accounts
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Referral Card */}
          {referral && (
            <div className="mt-8 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-500/30">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                    <Gift className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Refer & Earn</h3>
                    <p className="text-sm text-white/90 mt-0.5">Share your referral code with friends.</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-white/80">Your code</span>
                      <span className="px-3 py-1.5 bg-white/20 rounded-lg font-mono font-bold tracking-widest text-base backdrop-blur-sm">
                        {referral.referralCode}
                      </span>
                      {referral.totalReferrals > 0 && (
                        <span className="text-xs text-white/80">
                          {referral.totalReferrals} joined via your code
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleCopyReferral}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#8c76f0] rounded-xl font-medium text-sm hover:bg-purple-50 transition-colors"
                  >
                    {copiedReferral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedReferral ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleWhatsAppShare}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-500 text-white rounded-xl font-medium text-sm hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
