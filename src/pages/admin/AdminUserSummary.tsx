import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserSearch,
  Search,
  User,
  CreditCard,
  Building2,
  FileText,
  MessageSquare,
  Landmark,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  BadgeCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Hash,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Loader2,
  CalendarDays,
  IndianRupee,
  ExternalLink,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';
import { useTableSort, SortableTh } from './TableSort';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  mobile: string;
  mobile_number: string;
  created_at: string;

  is_restricted?: boolean;
  is_disabled?: boolean;
  kyc_completed?: boolean;
  is_mobile_verified?: boolean;
  is_email_verified?: boolean;
}

interface KycData {
  pan_info: any;
  address_info: any;
  business_info: any;
}

interface Summary {
  user: UserProfile;
  kyc: KycData;
  beneficiaries: any[];
  bankAccounts: any[];
  transactions: any[];
  supportTickets: any[];
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-blue-100 text-blue-700',
  kyc_pending: 'bg-amber-100 text-amber-700',
  settlement_pending: 'bg-blue-100 text-blue-700',
  refunded: 'bg-orange-100 text-orange-700',
  refund_pending: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Transaction Failed',
  processing: 'Processing',
  pending: 'Processing',
  kyc_pending: 'KYC Pending',
  settlement_pending: 'Settlement Pending',
  refunded: 'Refunded',
  refund_pending: 'Refund Pending',
};

const TX_PAGE_SIZE = 10;
const TICKET_PAGE_SIZE = 10;

function fmt(v: string | number) {
  return parseFloat(String(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function KycStatusBadge({ status }: { status: string }) {
  if (status === 'verified' || status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
        <BadgeCheck className="w-3 h-3" />Verified
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
        <Clock className="w-3 h-3" />Pending
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
        <XCircle className="w-3 h-3" />Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
      <ShieldAlert className="w-3 h-3" />{status || 'Not Submitted'}
    </span>
  );
}

function KycField({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true, count }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#f3f0fe] rounded-lg flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#8c76f0]" />
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
          {count !== undefined && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function Paginator({ total, page, pageSize, onChange }: { total: number; page: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg border-2 border-gray-200 text-gray-500 hover:border-[#8c76f0] hover:bg-[#f3f0fe] disabled:opacity-40 transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
          return (
            <button
              key={pg}
              onClick={() => onChange(pg)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${pg === page ? 'bg-[#8c76f0] text-white border-2 border-[#8c76f0]' : 'border-2 border-gray-200 text-gray-600 hover:border-[#8c76f0] hover:bg-[#f3f0fe]'}`}
            >
              {pg}
            </button>
          );
        })}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border-2 border-gray-200 text-gray-500 hover:border-[#8c76f0] hover:bg-[#f3f0fe] disabled:opacity-40 transition-all"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AdminUserSummary() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? localStorage.getItem('adminId');
  const { loading: permLoading } = useAdminPermission('user-summary');

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [ticketPage, setTicketPage] = useState(1);

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const benAccessor = useCallback((b: any, key: string) => {
    switch (key) {
      case 'name': return b.full_name || b.beneficiary_name || b.name;
      case 'bank': return b.bank_name;
      case 'account': return b.bank_account || b.account_number || b.bank_account_number;
      case 'ifsc': return b.ifsc || b.ifsc_code;
      case 'status': return b.status;
      case 'verified': return b.is_verified_merchant ?? b.merchant_verified ?? b.is_verified;
      default: return null;
    }
  }, []);

  const { sortedData: sortedBeneficiaries, sortConfig: benSortConfig, handleSort: handleBenSort } = useTableSort<any>(
    summary?.beneficiaries ?? [],
    benAccessor,
  );

  const txAccessor = useCallback((t: any, key: string) => {
    switch (key) {
      case 'reference': return t.payment_reference;
      case 'date': return t.created_at ? new Date(t.created_at).getTime() : null;
      case 'beneficiary': return t.beneficiary_details?.full_name || t.beneficiary_details?.beneficiary_name;
      case 'cardType': return t.selected_payment_option?.card_type || t.card_type;
      case 'amount': return Number(t.amount);
      case 'total': return Number(t.total_amount);
      case 'status': return t.display_status || t.status;
      default: return null;
    }
  }, []);

  const { sortedData: sortedTransactions, sortConfig: txSortConfig, handleSort: handleTxSort } = useTableSort<any>(
    summary?.transactions ?? [],
    txAccessor,
  );

  if (!adminId) return null;

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setUserList([]);
    setSummary(null);
    setTxPage(1);
    setTicketPage(1);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-user-summary`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId, query: q }),
        }
      );
      const data = await res.json();

      // 404 means no users found — treat as empty list, not an error
      if (res.status === 404) {
        setUserList([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Search failed');

      const users: UserProfile[] = data.users || [];
      setUserList(users);

      // Auto-load if only one result
      if (users.length === 1) {
        handleSelectUser(users[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user: UserProfile) => {
    setDetailLoading(true);
    setError('');
    setSummary(null);
    setTxPage(1);
    setTicketPage(1);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-user-summary`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId, query: '', userId: user.id }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load user details');
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user details');
    } finally {
      setDetailLoading(false);
    }
  };

  const u = summary?.user;
  const kyc = summary?.kyc;

  const txSlice = sortedTransactions.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);
  const ticketSlice = summary ? summary.supportTickets.slice((ticketPage - 1) * TICKET_PAGE_SIZE, ticketPage * TICKET_PAGE_SIZE) : [];

  const searched = !loading && query.trim().length > 0 && userList.length === 0 && !summary && !detailLoading && !error;

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-r from-[#8c76f0] to-[#7c63e0] rounded-xl flex items-center justify-center">
                  <UserSearch className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">User Summary</h1>
              </div>
              <p className="text-gray-500 text-sm mt-1 ml-[52px]">
                Search a user to view their complete profile, KYC, transactions and support history
              </p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Search User</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name, email or mobile number..."
                className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-[#f3f0fe] outline-none transition-all text-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-[#7c63e0] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border-2 border-red-500 rounded-xl px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-800 mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          )}

          {searched && (
            <div className="mt-4 flex items-center gap-3 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <Search className="w-4 h-4 flex-shrink-0" />
              No users found matching <span className="font-semibold text-gray-700">"{query}"</span>. Try a different name, email or mobile.
            </div>
          )}
        </div>

        {/* User list (search results) */}
        {userList.length > 1 && !summary && !detailLoading && (
          <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#f3f0fe] rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-[#8c76f0]" />
                </div>
                <span className="font-semibold text-gray-900">
                  {userList.length} users found
                </span>
                <span className="text-xs text-gray-500">— select one to view full details</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {userList.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#f3f0fe] transition-colors text-left group"
                >
                  <div className="w-10 h-10 bg-[#f3f0fe] group-hover:bg-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                    <User className="w-5 h-5 text-[#8c76f0]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—'}</p>
                      {user.is_restricted || user.is_disabled ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Restricted</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</span>
                      {user.mobile && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.mobile}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#8c76f0] flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detail loading */}
        {detailLoading && (
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-16 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-[#8c76f0] animate-spin" />
            <p className="text-gray-500 text-sm">Loading user details...</p>
          </div>
        )}

        {/* Full summary */}
        {summary && u && (
          <>
            {/* Back to results */}
            {userList.length > 1 && (
              <button
                onClick={() => setSummary(null)}
                className="flex items-center gap-2 text-sm text-[#8c76f0] hover:text-[#7c63e0] mb-4 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to search results
              </button>
            )}

            {/* User profile card */}
            <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 mb-6">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 bg-[#f3f0fe] rounded-2xl flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 text-[#8c76f0]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-900">
                      {u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim()}
                    </h2>
                    {u.is_restricted || u.is_disabled ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold">Restricted</span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">Active</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />{u.email}</span>
                    {u.mobile && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{u.mobile}</span>}
                    <span className="flex items-center gap-1.5 text-gray-400"><Hash className="w-3.5 h-3.5" />{u.id.slice(0, 12)}...</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Joined {fmtDate(u.created_at)}</span>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{summary.transactions.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Transactions</p>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{summary.beneficiaries.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Beneficiaries</p>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{summary.supportTickets.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Tickets</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* KYC — PAN */}
              <Section title="PAN / Identity" icon={BadgeCheck} defaultOpen>
                {!kyc?.pan_info ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    <BadgeCheck className="w-4 h-4" />Not submitted
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <KycStatusBadge status={kyc.pan_info.status || ''} />
                      {kyc.pan_info.rejection_reason && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1">{kyc.pan_info.rejection_reason}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KycField label="PAN Number" value={kyc.pan_info.pan_number} mono />
                      <KycField label="Submitted On" value={fmtDate(kyc.pan_info.created_at)} />
                      {kyc.pan_info.approval_at && <KycField label="Approved On" value={fmtDate(kyc.pan_info.approval_at)} />}
                    </div>
                  </div>
                )}
              </Section>

              {/* KYC — Address */}
              <Section title="Address Proof" icon={BadgeCheck} defaultOpen>
                {!kyc?.address_info ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    <BadgeCheck className="w-4 h-4" />Not submitted
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <KycStatusBadge status={kyc.address_info.status || ''} />
                      {kyc.address_info.rejection_reason && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1">{kyc.address_info.rejection_reason}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KycField label="Document Type" value={kyc.address_info.proof_type?.replace(/_/g, ' ')} />
                      <KycField
                        label={
                          kyc.address_info.proof_type === 'aadhar' ? 'Aadhaar Number' :
                          kyc.address_info.proof_type === 'passport' ? 'Passport Number' :
                          kyc.address_info.proof_type === 'voter_id' ? 'Voter ID Number' :
                          kyc.address_info.proof_type === 'driving_license' ? 'Licence Number' :
                          'ID Number'
                        }
                        value={kyc.address_info.id_number}
                        mono
                      />
                      <KycField label="Address" value={kyc.address_info.address} />
                      <KycField label="City" value={kyc.address_info.city} />
                      <KycField label="State" value={kyc.address_info.state} />
                      <KycField label="Pincode" value={kyc.address_info.pincode} mono />
                      <KycField label="Submitted On" value={fmtDate(kyc.address_info.created_at)} />
                      {kyc.address_info.approval_at && <KycField label="Approved On" value={fmtDate(kyc.address_info.approval_at)} />}
                    </div>
                  </div>
                )}
              </Section>

              {/* KYC — Business */}
              <Section title="Business Details" icon={Building2} defaultOpen>
                {!kyc?.business_info ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    <Building2 className="w-4 h-4" />Not submitted
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <KycStatusBadge status={kyc.business_info.status || ''} />
                      {kyc.business_info.rejection_reason && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1">{kyc.business_info.rejection_reason}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KycField label="Business Name" value={kyc.business_info.business_name} />
                      <KycField label="Company Type" value={kyc.business_info.company_type} />
                      <KycField label="Incorporation Number" value={kyc.business_info.incorporation_number} mono />
                      <KycField label="GST Number" value={kyc.business_info.gst_number} mono />
                      <KycField label="Submitted On" value={fmtDate(kyc.business_info.created_at)} />
                      {kyc.business_info.approval_at && <KycField label="Approved On" value={fmtDate(kyc.business_info.approval_at)} />}
                    </div>
                  </div>
                )}
              </Section>

              {/* Bank Accounts */}
              <Section title="Bank Accounts" icon={Landmark} defaultOpen={false} count={summary.bankAccounts.length}>
                {summary.bankAccounts.length === 0 ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    <Landmark className="w-4 h-4" />No bank accounts added.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {summary.bankAccounts.map((acct: any) => (
                      <div key={acct.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{acct.account_holder_name}</p>
                          <p className="text-sm text-gray-600 mt-0.5">{acct.bank_name}</p>
                          <p className="font-mono text-sm text-gray-700 mt-0.5">{acct.bank_account_number}</p>
                          <p className="font-mono text-xs text-gray-400 mt-0.5">{acct.ifsc_code}</p>
                        </div>
                        {acct.is_default && (
                          <span className="text-xs bg-[#f3f0fe] text-[#8c76f0] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Default</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Beneficiaries */}
              <Section title="Beneficiaries" icon={Building2} defaultOpen={false} count={summary.beneficiaries.length}>
                {summary.beneficiaries.length === 0 ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    <Building2 className="w-4 h-4" />No beneficiaries added.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <SortableTh label="Name" sortKey="name" sortConfig={benSortConfig} onSort={handleBenSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                          <SortableTh label="Bank" sortKey="bank" sortConfig={benSortConfig} onSort={handleBenSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                          <SortableTh label="Account" sortKey="account" sortConfig={benSortConfig} onSort={handleBenSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                          <SortableTh label="IFSC" sortKey="ifsc" sortConfig={benSortConfig} onSort={handleBenSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                          <SortableTh label="Status" sortKey="status" sortConfig={benSortConfig} onSort={handleBenSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                          <SortableTh label="Merchant Verified" sortKey="verified" sortConfig={benSortConfig} onSort={handleBenSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedBeneficiaries.map((b: any) => (
                          <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-3 font-medium text-gray-900">{b.full_name || b.beneficiary_name || '—'}</td>
                            <td className="px-3 py-3 text-gray-600">{b.bank_name || '—'}</td>
                            <td className="px-3 py-3 font-mono text-xs text-gray-700">{b.bank_account || b.account_number || '—'}</td>
                            <td className="px-3 py-3 font-mono text-xs text-gray-600">{b.ifsc || b.ifsc_code || '—'}</td>
                            <td className="px-3 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.status === 'Active' || b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {b.status || (b.is_active ? 'Active' : 'Inactive')}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {b.is_verified_merchant
                                ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" />Verified</span>
                                : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" />KYC Pending</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Transactions */}
              <Section title="Transactions" icon={CreditCard} defaultOpen count={summary.transactions.length}>
                {summary.transactions.length === 0 ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    <CreditCard className="w-4 h-4" />No transactions found.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <SortableTh label="Reference" sortKey="reference" sortConfig={txSortConfig} onSort={handleTxSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                            <SortableTh label="Date" sortKey="date" sortConfig={txSortConfig} onSort={handleTxSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                            <SortableTh label="Beneficiary" sortKey="beneficiary" sortConfig={txSortConfig} onSort={handleTxSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                            <SortableTh label="Card Type" sortKey="cardType" sortConfig={txSortConfig} onSort={handleTxSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                            <SortableTh label="Amount" sortKey="amount" sortConfig={txSortConfig} onSort={handleTxSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                            <SortableTh label="Total" sortKey="total" sortConfig={txSortConfig} onSort={handleTxSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                            <SortableTh label="Status" sortKey="status" sortConfig={txSortConfig} onSort={handleTxSort} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {txSlice.map((t: any) => {
                            const ds = t.display_status || t.status;
                            return (
                              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-3 font-mono text-xs font-semibold text-[#8c76f0]">{t.payment_reference || '—'}</td>
                                <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDate(t.created_at)}</td>
                                <td className="px-3 py-3 text-gray-700">{t.beneficiary_details?.full_name || t.beneficiary_details?.beneficiary_name || '—'}</td>
                                <td className="px-3 py-3 text-gray-600 max-w-[120px] truncate">{t.selected_payment_option?.card_type || t.card_type || '—'}</td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1 text-gray-700">
                                    <IndianRupee className="w-3 h-3" />{fmt(t.amount)}
                                  </div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1 font-bold text-gray-900">
                                    <IndianRupee className="w-3 h-3" />{fmt(t.total_amount)}
                                  </div>
                                </td>
                                <td className="px-3 py-3"><StatusBadge status={ds} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Paginator total={summary.transactions.length} page={txPage} pageSize={TX_PAGE_SIZE} onChange={setTxPage} />
                  </>
                )}
              </Section>

              {/* Support Tickets */}
              <Section title="Support Tickets" icon={MessageSquare} defaultOpen={false} count={summary.supportTickets.length}>
                {summary.supportTickets.length === 0 ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    <MessageSquare className="w-4 h-4" />No support tickets found.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 space-y-3">
                      {ticketSlice.map((t: any) => (
                        <div key={t.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.ticket_number && <span className="font-mono text-xs text-[#8c76f0] font-semibold">#{t.ticket_number}</span>}
                                <p className="font-semibold text-gray-900">{t.category}{t.sub_category ? ` — ${t.sub_category}` : ''}</p>
                                {t.priority && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    t.priority === 'high' ? 'bg-red-100 text-red-700' :
                                    t.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-500'
                                  }`}>{t.priority}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(t.created_at)}</p>
                              {t.description && <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{t.description}</p>}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 capitalize ${
                              t.status === 'open' ? 'bg-green-100 text-green-700' :
                              t.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                              'bg-amber-100 text-amber-700'
                            }`}>{t.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Paginator total={summary.supportTickets.length} page={ticketPage} pageSize={TICKET_PAGE_SIZE} onChange={setTicketPage} />
                  </>
                )}
              </Section>

              {/* Documents */}
              <Section title="Documents" icon={FileText} defaultOpen={false}>
                <div className="mt-4 space-y-2">
                  {[
                    { label: 'PAN Card Photo', url: kyc?.pan_info?.pan_photo_url },
                    { label: 'Address Proof (Front)', url: kyc?.address_info?.front_photo_url },
                    { label: 'Address Proof (Back)', url: kyc?.address_info?.back_photo_url },
                    { label: 'Incorporation Certificate', url: kyc?.business_info?.incorporation_certificate_url },
                    { label: 'GST Certificate', url: kyc?.business_info?.gst_certificate_url },
                    { label: 'Letter of Authorization', url: kyc?.business_info?.loa_url },
                    { label: 'Memorandum of Association', url: kyc?.business_info?.moa_url },
                    { label: 'Articles of Association', url: kyc?.business_info?.aoa_url },
                  ].filter(d => d.url).map(d => (
                    <div key={d.label} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                      <span className="text-sm text-gray-700 font-medium">{d.label}</span>
                      <a href={d.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#8c76f0] hover:text-[#7c63e0] text-xs font-semibold transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />View
                      </a>
                    </div>
                  ))}
                  {!kyc?.pan_info?.pan_photo_url && !kyc?.address_info?.front_photo_url && !kyc?.business_info?.loa_url && !kyc?.business_info?.incorporation_certificate_url && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                      <FileText className="w-4 h-4" />No documents uploaded.
                    </div>
                  )}
                </div>
              </Section>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
