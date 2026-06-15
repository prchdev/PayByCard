import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileCheck, Wallet, CreditCard, CheckCircle, Clock,
  IndianRupee, MessageSquare, AlertTriangle, Settings, ArrowRight, RefreshCw,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface DashboardStats {
  totalUsers: number;
  pendingKycReviews: number;
  pendingPayouts: number;
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  totalRevenue: string;
  openSupportTickets: number;
  nonKycedTransactions: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  onClick?: () => void;
  badge?: number;
}

function StatCard({ title, value, subtitle, icon, color, borderColor, onClick, badge }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border-2 ${borderColor} p-6 transition-all hover:shadow-xl ${onClick ? 'cursor-pointer group' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
              {badge}
            </span>
          )}
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      {onClick && (
        <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-gray-400 group-hover:text-gray-700 transition-colors">
          View details <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading } = useAdminPermission('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-dashboard-stats`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load stats');
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    const adminRole = sessionStorage.getItem('adminRole');
    if (adminRole) {
      localStorage.setItem('adminId', adminId);
      localStorage.setItem('adminRole', adminRole);
    }
    fetchStats();
  }, [adminId, navigate]);

  if (permLoading) return null;

  const fmt = (n: number | undefined) =>
    loading ? '—' : (n ?? 0).toLocaleString('en-IN');

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's an overview of your system.</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Primary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Users"
            value={fmt(stats?.totalUsers)}
            subtitle="Registered accounts"
            icon={<Users className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50"
            borderColor="border-blue-200 hover:border-blue-400"
            onClick={() => navigate('/admin/kyc-verification')}
          />
          <StatCard
            title="KYC Reviews"
            value={fmt(stats?.pendingKycReviews)}
            subtitle="Awaiting review"
            icon={<FileCheck className="w-5 h-5 text-amber-600" />}
            color="bg-amber-50"
            borderColor="border-amber-200 hover:border-amber-400"
            badge={stats?.pendingKycReviews}
            onClick={() => navigate('/admin/kyc-verification')}
          />
          <StatCard
            title="Pending Payouts"
            value={fmt(stats?.pendingPayouts)}
            subtitle="Awaiting processing"
            icon={<Wallet className="w-5 h-5 text-emerald-600" />}
            color="bg-emerald-50"
            borderColor="border-emerald-200 hover:border-emerald-400"
            badge={stats?.pendingPayouts}
            onClick={() => navigate('/admin/manual-payout')}
          />
          <StatCard
            title="Support Tickets"
            value={fmt(stats?.openSupportTickets)}
            subtitle="Open tickets"
            icon={<MessageSquare className="w-5 h-5 text-rose-600" />}
            color="bg-rose-50"
            borderColor="border-rose-200 hover:border-rose-400"
            badge={stats?.openSupportTickets}
            onClick={() => navigate('/admin/support-tickets')}
          />
        </div>

        {/* Payment Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Payments"
            value={fmt(stats?.totalPayments)}
            subtitle="All time"
            icon={<CreditCard className="w-5 h-5 text-gray-600" />}
            color="bg-gray-50"
            borderColor="border-gray-200 hover:border-gray-400"
          />
          <StatCard
            title="Completed"
            value={fmt(stats?.completedPayments)}
            subtitle="Successful payments"
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            color="bg-green-50"
            borderColor="border-green-200 hover:border-green-400"
          />
          <StatCard
            title="In Progress"
            value={fmt(stats?.pendingPayments)}
            subtitle="Pending / processing"
            icon={<Clock className="w-5 h-5 text-orange-600" />}
            color="bg-orange-50"
            borderColor="border-orange-200 hover:border-orange-400"
          />
          <StatCard
            title="Total Payments Processed"
            value={loading ? '—' : `₹${parseFloat(stats?.totalRevenue ?? '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            subtitle="Completed + settled + refunded"
            icon={<IndianRupee className="w-5 h-5 text-teal-600" />}
            color="bg-teal-50"
            borderColor="border-teal-200 hover:border-teal-400"
          />
        </div>

        {/* Action Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Non-KYCed Transactions — highlighted */}
          <div
            onClick={() => navigate('/admin/non-kyced-transactions')}
            className={`relative bg-white rounded-2xl border-2 p-6 transition-all hover:shadow-xl cursor-pointer group ${
              (stats?.nonKycedTransactions ?? 0) > 0
                ? 'border-amber-400 bg-amber-50'
                : 'border-gray-200 hover:border-amber-300'
            }`}
          >
            {(stats?.nonKycedTransactions ?? 0) > 0 && (
              <span className="absolute top-3 right-3 px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-full animate-pulse">
                Action Required
              </span>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{fmt(stats?.nonKycedTransactions)}</p>
            <p className="font-semibold text-gray-800">Non-KYCed Transactions</p>
            <p className="text-sm text-gray-500 mt-1">KYC required but not completed after refund window</p>
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-amber-600 group-hover:text-amber-700 transition-colors">
              Review now <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Master Settings */}
          <div
            onClick={() => navigate('/admin/master-settings')}
            className="bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-400 p-6 transition-all hover:shadow-xl cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
            </div>
            <p className="font-semibold text-gray-800 text-lg">Master Settings</p>
            <p className="text-sm text-gray-500 mt-1">Configure company info, branding, and system-wide settings</p>
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-gray-400 group-hover:text-gray-700 transition-colors">
              Open settings <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Manual Payout */}
          <div
            onClick={() => navigate('/admin/manual-payout')}
            className="bg-white rounded-2xl border-2 border-gray-200 hover:border-emerald-400 p-6 transition-all hover:shadow-xl cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              {(stats?.pendingPayouts ?? 0) > 0 && (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                  {fmt(stats?.pendingPayouts)} pending
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-800 text-lg">Manual Payout</p>
            <p className="text-sm text-gray-500 mt-1">Process and manage pending payout requests</p>
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-gray-400 group-hover:text-emerald-600 transition-colors">
              Manage payouts <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
