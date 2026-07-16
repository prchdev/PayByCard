import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle, ArrowUpRight, Users, Clock, AlertCircle, XCircle,
  RefreshCw, History, TrendingUp, Hourglass, Hash, Landmark,
} from 'lucide-react';import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';

interface RecentTxn {
  id: string; payment_reference: string; amount: string; total_amount: string;
  status: string; display_status: string; card_type: string | null; created_at: string;
  beneficiary_details: any; selected_payment_option: any;
}

const DISPLAY_STATUS: Record<string, { label: string; color: string; dot: string; icon: React.ElementType }> = {
  completed: { label: 'Completed', color: 'text-green-700', dot: 'bg-green-500', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-600', dot: 'bg-red-500', icon: XCircle },
  cancelled: { label: 'Failed', color: 'text-gray-500', dot: 'bg-gray-400', icon: XCircle },
  processing: { label: 'Processing', color: 'text-blue-600', dot: 'bg-blue-500', icon: RefreshCw },
  pending: { label: 'Processing', color: 'text-blue-600', dot: 'bg-blue-500', icon: RefreshCw },
  kyc_pending: { label: 'KYC Required', color: 'text-amber-600', dot: 'bg-amber-500', icon: Clock },
  merchant_kyc_review: { label: 'Merchant KYC', color: 'text-amber-600', dot: 'bg-amber-500', icon: Clock },
  settlement_pending: { label: 'Settlement', color: 'text-blue-600', dot: 'bg-blue-400', icon: RefreshCw },
  settlement_in_progress: { label: 'Settlement', color: 'text-blue-600', dot: 'bg-blue-400', icon: RefreshCw },
  refunded: { label: 'Refunded', color: 'text-orange-600', dot: 'bg-orange-400', icon: AlertCircle },
  refund_pending: { label: 'Refund Pending', color: 'text-rose-600', dot: 'bg-rose-500', icon: AlertCircle },
};

function fmtAmt(v: string | number) {
  return parseFloat(String(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MobileDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const { logout } = useAuth();
  const [kycStatus, setKycStatus] = useState<{ isVerified: boolean; status: string } | null>(null);
  const [isCheckingKyc, setIsCheckingKyc] = useState(true);
  const [recentTxns, setRecentTxns] = useState<RecentTxn[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [stats, setStats] = useState<{ amount_processed: number; amount_in_settlement: number; total_transactions: number } | null>(null);

  useEffect(() => {
    if (!userId) { navigate('/mobile/login', { replace: true }); return; }
    checkKycStatus(); fetchRecentTransactions(); fetchStats();
  }, [userId, navigate]);

  const checkKycStatus = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-kyc-status`, {
        method: 'POST', headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const result = await res.json();
      if (res.ok) setKycStatus(result);
    } catch { /* ignore */ } finally { setIsCheckingKyc(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-stats`, {
        method: 'POST', headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch { /* ignore */ }
  };

  const fetchRecentTransactions = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-transactions`, {
        method: 'POST', headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, page: 1, limit: 5, status: 'all' }),
      });
      const data = await res.json();
      if (res.ok) setRecentTxns(data.payments || []);
    } catch { /* ignore */ } finally { setLoadingTxns(false); }
  };

  const handleLogout = () => { logout(); navigate('/mobile/login', { replace: true }); };
  if (!userId) return null;

  const quickActions = [
    { icon: Users, label: 'Add Payee', path: '/mobile/my-beneficiaries' },
    { icon: ArrowUpRight, label: 'Make Payment', path: '/mobile/make-payment' },
    { icon: Landmark, label: 'My Bank Account', path: '/mobile/my-bank-accounts' },
    { icon: History, label: 'Payment History', path: '/mobile/my-transactions' },
  ];

  return (
    <MobileLayout userId={userId} userEmail={userEmail} onLogout={handleLogout}>
      <div className="px-4 py-3 space-y-3">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Welcome back!</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's your account overview</p>
        </div>

        {/* KYC Banner */}
        {!isCheckingKyc && kycStatus && (
          <>
            {kycStatus.isVerified ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-400 rounded-xl p-3 flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-900">Account Verified</p>
                  <p className="text-xs text-green-700 mt-0.5">KYC complete. All features unlocked.</p>
                </div>
              </div>
            ) : kycStatus.status === 'pending' ? (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-400 rounded-xl p-3 flex items-start gap-2.5">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900">KYC Under Review</p>
                  <p className="text-xs text-blue-700 mt-0.5">Your documents are being reviewed.</p>
                  <button onClick={() => navigate('/mobile/kyc-verification', { state: { userId, userEmail } })}
                    className="mt-1.5 text-xs font-semibold text-blue-700 underline">View Status</button>
                </div>
              </div>
            ) : kycStatus.status === 'rejected' ? (
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-400 rounded-xl p-3 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">KYC Rejected</p>
                  <p className="text-xs text-red-700 mt-0.5">Please review and resubmit.</p>
                  <button onClick={() => navigate('/mobile/kyc-verification', { state: { userId, userEmail } })}
                    className="mt-1.5 text-xs font-semibold text-red-700 underline">Review & Resubmit</button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-400 rounded-xl p-3 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900">Complete KYC Verification</p>
                  <p className="text-xs text-yellow-700 mt-0.5">Required to access payment features.</p>
                  <button onClick={() => navigate('/mobile/kyc-verification', { state: { userId, userEmail } })}
                    className="mt-1.5 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-medium">Complete KYC</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-200 p-2.5">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#8c76f0]" />
            </div>
            {stats ? (
              <p className="text-base font-bold text-gray-900">₹{stats.amount_processed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            ) : <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />}
            <p className="text-[10px] text-gray-500 mt-0.5">Processed</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-2.5">
            <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center mb-1.5">
              <Hourglass className="w-3.5 h-3.5 text-amber-500" />
            </div>
            {stats ? (
              <p className="text-base font-bold text-gray-900">₹{stats.amount_in_settlement.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            ) : <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />}
            <p className="text-[10px] text-gray-500 mt-0.5">In Settlement</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-2.5">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center mb-1.5">
              <Hash className="w-3.5 h-3.5 text-blue-500" />
            </div>
            {stats ? (
              <p className="text-base font-bold text-gray-900">{stats.total_transactions}</p>
            ) : <div className="h-5 w-10 bg-gray-100 rounded animate-pulse" />}
            <p className="text-[10px] text-gray-500 mt-0.5">Transactions</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-1.5">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.path, { state: { userId, userEmail } })}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-sm active:scale-95 transition-transform bg-white border border-gray-200 text-gray-700 hover:border-[#8c76f0] hover:text-[#8c76f0]"
              >
                <a.icon className="w-4 h-4 flex-shrink-0" />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-bold text-gray-900">Recent Activity</h2>
            <button onClick={() => navigate('/mobile/my-transactions', { state: { userId, userEmail } })}
              className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <History className="w-3 h-3" />View All
            </button>
          </div>

          {loadingTxns ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center">
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mb-1.5" />
              <p className="text-xs text-gray-500">Loading transactions...</p>
            </div>
          ) : recentTxns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <Clock className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
              <p className="text-sm text-gray-700 font-medium">No transactions yet</p>
              <button onClick={() => navigate('/mobile/make-payment', { state: { userId, userEmail } })}
                className="mt-2 px-4 py-1.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-lg text-xs font-medium">Make First Payment</button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {recentTxns.map((txn) => {
                const ds = txn.display_status || txn.status;
                const cfg = DISPLAY_STATUS[ds] || DISPLAY_STATUS.processing;
                const Icon = cfg.icon;
                return (
                  <div
                    key={txn.id}
                    onClick={() => navigate('/mobile/my-transactions', { state: { userId, userEmail } })}
                    className="flex items-center gap-3 p-2.5 active:bg-gray-50 cursor-pointer"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ds === 'completed' ? 'bg-green-50' : ds === 'failed' || ds === 'cancelled' ? 'bg-red-50' :
                      ds === 'kyc_pending' || ds === 'refund_pending' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {txn.beneficiary_details?.full_name || 'Unknown'}
                      </p>
                      <p className="font-mono text-[10px] text-blue-600">{txn.payment_reference}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">₹{fmtAmt(txn.total_amount)}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
