import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Calendar,
  Hash,
  IndianRupee,
  User,
  Building,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Wallet,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Upload,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';
import BulkPayoutModal from './BulkPayoutModal';

interface PayoutRecord {
  id: string;
  payment_id?: string;
  payment_reference?: string;
  amount: number;
  charges?: number | null;
  gst?: number | null;
  total_amount?: number | null;
  net_amount: number;
  payout_reference: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  bank_name: string;
  transfer_type: string;
  status: string;
  payment_status?: string | null;
  created_at: string;
  is_payment_record?: boolean;
  auto_payout_failed?: boolean;
  gateway_transaction_id?: string | null;
  card_type?: string | null;
  gateway_environment?: string | null;
  sender: { full_name: string; email: string; mobile: string } | null;
  beneficiary: { beneficiary_name: string; account_number: string; ifsc_code: string; bank_name: string; mobile?: string | null; email?: string | null } | null;
  gateway: { gateway_name: string } | null;
  merchant_kyc: { status: string; pan_number: string; pan_photo_url: string } | null;
  kyc_required?: boolean;
  payout_mode?: string | null;
  settlement_time?: string | null;
  gateway_settlement_status?: string | null;
}

interface ConfirmModalState {
  open: boolean;
  payout: PayoutRecord | null;
  action: 'confirm' | 'refund';
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatPayoutMode(mode: string | null | undefined): string {
  if (!mode) return '—';
  if (mode === 'payout') return 'Auto Payout';
  if (mode === 'payment_split') return 'Payment Split';
  if (mode === 'manual') return 'Manual';
  return mode;
}

function formatSettlementTime(t: string | null | undefined): string {
  if (!t) return '—';
  const s = t.trim().toUpperCase();
  if (s === 'INSTANT' || s === 'T+0') return 'Instant';
  if (s === 'T+1') return 'T+1 Day';
  if (s === 'T+2') return 'T+2 Days';
  return t;
}

function formatStatus(s: string | null | undefined): string {
  if (!s) return '—';
  const MAP: Record<string, string> = {
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Transaction Failed',
    processing: 'Processing',
    pending: 'Processing',
    kyc_pending: 'Merchant Onboarding Required',
    merchant_kyc_review: 'Merchant KYC Pending',
    settlement_pending: 'Settlement In Progress',
    settlement_in_progress: 'Settlement In Progress',
    refunded: 'Refunded',
    refund_pending: 'Refund Pending',
  };
  return MAP[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function statusBadgeClass(s: string | null | undefined): string {
  const v = (s || '').toLowerCase();
  if (v === 'completed') return 'bg-green-100 text-green-700';
  if (v === 'refunded') return 'bg-blue-100 text-blue-700';
  if (v === 'failed' || v === 'cancelled') return 'bg-red-100 text-red-700';
  if (v.includes('pending') || v.includes('processing')) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

function downloadCSV(records: PayoutRecord[]) {
  const headers = [
    'Reference', 'Gateway', 'Payment Status', 'Sender Name', 'Sender Email', 'Sender Mobile',
    'Beneficiary Name', 'Beneficiary Mobile', 'Beneficiary Email', 'Bank Name', 'Account Number', 'IFSC Code',
    'Base Amount', 'Charges', 'GST', 'Net Payout Amount',
    'Payout Mode', 'Settlement Time', 'Gateway Settlement Status', 'Date',
  ];
  const escape = (v: any) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const GATEWAY_STTLMT_LABELS: Record<string, string> = {
    settled: 'Settled', captured: 'Captured', paid: 'Paid',
    not_captured: 'Not Captured', not_paid: 'Not Paid',
    refunded: 'Refunded', check_failed: 'Check Failed',
    no_tx_id: 'No Tx ID', not_applicable: 'N/A',
  };
  const rows = records.map(p => [
    p.payment_reference || p.payout_reference || '',
    p.gateway?.gateway_name || '',
    p.payment_status || p.status || '',
    p.sender?.full_name || '',
    p.sender?.email || '',
    p.sender?.mobile || '',
    p.beneficiary?.beneficiary_name || p.account_holder_name || '',
    p.beneficiary?.mobile || '',
    p.beneficiary?.email || '',
    p.beneficiary?.bank_name || p.bank_name || '',
    p.beneficiary?.account_number || p.account_number || '',
    p.beneficiary?.ifsc_code || p.ifsc_code || '',
    p.amount,
    p.charges ?? '',
    p.gst ?? '',
    p.net_amount || p.amount,
    p.payout_mode || '',
    p.settlement_time || '',
    p.gateway_settlement_status ? (GATEWAY_STTLMT_LABELS[p.gateway_settlement_status] || p.gateway_settlement_status) : '',
    fmtDate(p.created_at),
  ].map(escape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manual-payouts-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtAmt(v: number) {
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function GatewaySettlementBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    settled:        { label: 'Settled',          cls: 'bg-green-100 text-green-700' },
    captured:       { label: 'Captured',         cls: 'bg-blue-100 text-blue-700' },
    paid:           { label: 'Paid',             cls: 'bg-blue-100 text-blue-700' },
    not_captured:   { label: 'Not Captured',     cls: 'bg-amber-100 text-amber-700' },
    not_paid:       { label: 'Not Paid',         cls: 'bg-amber-100 text-amber-700' },
    check_failed:   { label: 'Check Failed',     cls: 'bg-red-100 text-red-700' },
    no_tx_id:       { label: 'No Tx ID',         cls: 'bg-gray-100 text-gray-500' },
    not_applicable: { label: 'N/A',              cls: 'bg-gray-100 text-gray-500' },
  };
  const entry = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${entry.cls}`}>{entry.label}</span>;
}


function KycBadge({ payout }: { payout: PayoutRecord }) {
  const kyc = payout.merchant_kyc;
  const paymentStatus = payout.payment_status || payout.status;

  // If a merchant_onboarding record exists, its status always takes precedence
  if (kyc) {
    if (kyc.status === 'verified') {
      return <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium"><ShieldCheck className="w-3 h-3" />KYC Verified – Settlement In Progress</span>;
    }
    if (kyc.status === 'submitted') {
      return <span className="inline-flex items-center gap-1 text-xs text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full font-medium"><ShieldAlert className="w-3 h-3" />KYC In Review</span>;
    }
    if (kyc.status === 'rejected') {
      return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-medium"><XCircle className="w-3 h-3" />KYC Rejected</span>;
    }
    // pending — link sent, merchant hasn't submitted yet
    return <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium"><ShieldAlert className="w-3 h-3" />KYC Pending</span>;
  }

  // No merchant_onboarding record
  if (!payout.kyc_required) {
    if (paymentStatus === 'settlement_pending') {
      return <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium"><CheckCircle className="w-3 h-3" />Settlement In Progress</span>;
    }
    return <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium"><CheckCircle className="w-3 h-3" />KYC Not Required</span>;
  }

  return <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium"><ShieldAlert className="w-3 h-3" />KYC Pending</span>;
}

export default function ManualPayout() {
  const navigate = useNavigate();
  const { loading: permLoading, canEdit } = useAdminPermission('manual-payout');
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<ConfirmModalState>({ open: false, payout: null, action: 'confirm' });
  const [processing, setProcessing] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const [payoutDate, setPayoutDate] = useState('');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [bulkOpen, setBulkOpen] = useState(false);

  const adminId = sessionStorage.getItem('adminId') ?? localStorage.getItem('adminId');

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  useEffect(() => {
    fetchPendingPayouts();
  }, []);

  const fetchPendingPayouts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-pending-payouts`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch payouts');
      setPayouts(data.payouts || []);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payouts');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (payout: PayoutRecord, action: 'confirm' | 'refund') => {
    setModal({ open: true, payout, action });
    setPayoutDate(new Date().toISOString().split('T')[0]);
    setPayoutRef('');
    setPayoutAmount(String(payout.net_amount || payout.amount));
    setRefundReason('');
    setModalError('');
    setModalSuccess('');
  };

  const closeModal = () => setModal({ open: false, payout: null, action: 'confirm' });

  const handleProcess = async () => {
    if (!modal.payout) return;
    if (modal.action === 'confirm' && (!payoutDate || !payoutRef || !payoutAmount)) {
      setModalError('All fields are required for confirmation');
      return;
    }
    setProcessing(true);
    setModalError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-process-manual-payout`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId,
            payoutId: modal.payout.is_payment_record ? null : modal.payout.id,
            paymentId: modal.payout.is_payment_record ? modal.payout.payment_id : null,
            is_payment_record: modal.payout.is_payment_record || false,
            action: modal.action,
            payout_date: payoutDate,
            payout_reference_number: payoutRef,
            payout_confirmed_amount: payoutAmount,
            refund_reason: refundReason,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setModalSuccess(modal.action === 'confirm' ? 'Payout confirmed successfully' : 'Payout refunded successfully');
      setTimeout(() => { closeModal(); fetchPendingPayouts(); }, 1500);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const filtered = payouts.filter(p => {
    const t = searchTerm.toLowerCase();
    return !t ||
      p.payout_reference?.toLowerCase().includes(t) ||
      p.account_holder_name?.toLowerCase().includes(t) ||
      p.sender?.full_name?.toLowerCase().includes(t) ||
      p.sender?.email?.toLowerCase().includes(t) ||
      p.beneficiary?.beneficiary_name?.toLowerCase().includes(t) ||
      p.beneficiary?.ifsc_code?.toLowerCase().includes(t) ||
      p.payment_reference?.toLowerCase().includes(t);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (permLoading) return null;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#8c76f0] to-[#7c63e0] rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manual Payout</h1>
              <p className="text-gray-500 text-sm mt-0.5">Manage pending payouts that require manual confirmation</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                onClick={() => setBulkOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-[#8c76f0] rounded-xl text-sm font-medium text-[#8c76f0] hover:bg-purple-50 transition-all"
              >
                <Upload className="w-4 h-4" />
                Bulk Update Payout
              </button>
            )}
            <button
              onClick={() => downloadCSV(filtered)}
              disabled={loading || filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-green-500 hover:bg-green-50 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={fetchPendingPayouts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, reference, IFSC, email..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-300 rounded-xl text-sm focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 focus:outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500 whitespace-nowrap">
              <span className="font-semibold text-gray-800">{filtered.length}</span> pending payout{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-xs text-gray-500 whitespace-nowrap">Rows:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border-2 border-gray-300 rounded-xl px-2 py-1.5 focus:border-[#8c76f0] focus:outline-none bg-white text-sm"
              >
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-[#8c76f0] animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Loading pending payouts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-4">
              <Wallet className="w-7 h-7 text-[#8c76f0]" />
            </div>
            <p className="text-gray-700 font-semibold">No pending payouts</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm ? 'Try adjusting your search' : 'All manual payouts have been processed'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Reference', 'Gateway', 'Status', 'Gateway Sttlmt', 'Sender', 'Beneficiary', 'Beneficiary Contact', 'Bank / IFSC', 'Amount', 'Payout Mode', 'Settlement', 'Date', 'Remark', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(payout => (
                    <tr key={payout.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#8c76f0]">
                          {payout.payment_reference || payout.payout_reference || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700">{payout.gateway?.gateway_name || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const s = payout.payment_status || payout.status;
                          return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(s)}`}>{formatStatus(s)}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <GatewaySettlementBadge status={payout.gateway_settlement_status} />
                      </td>
                      <td className="px-4 py-3">
                        {payout.sender ? (
                          <>
                            <p className="font-medium text-gray-900">{payout.sender.full_name}</p>
                            <p className="text-xs text-gray-500">{payout.sender.email}</p>
                            {payout.sender.mobile && <p className="text-xs text-gray-400">{payout.sender.mobile}</p>}
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{payout.beneficiary?.beneficiary_name || payout.account_holder_name || '—'}</p>
                        <p className="text-xs text-gray-500">{payout.beneficiary?.bank_name || payout.bank_name || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        {(payout.beneficiary?.mobile || payout.beneficiary?.email) ? (
                          <>
                            {payout.beneficiary?.mobile && <p className="text-xs text-gray-700">{payout.beneficiary.mobile}</p>}
                            {payout.beneficiary?.email && <p className="text-xs text-gray-500">{payout.beneficiary.email}</p>}
                          </>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-gray-700">{payout.beneficiary?.account_number || payout.account_number || '—'}</p>
                        <p className="font-mono text-xs text-gray-400 mt-0.5">{payout.beneficiary?.ifsc_code || payout.ifsc_code || '—'}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-gray-900">₹{fmtAmt(payout.net_amount || payout.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 whitespace-nowrap">{formatPayoutMode(payout.payout_mode)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 whitespace-nowrap">{formatSettlementTime(payout.settlement_time)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(payout.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {payout.is_payment_record && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium w-fit whitespace-nowrap">Payout Not Yet Created</span>
                          )}
                          {payout.auto_payout_failed && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium w-fit whitespace-nowrap">Auto Payout Failed</span>
                          )}
                          {!payout.is_payment_record && !payout.auto_payout_failed && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                          <button
                            onClick={() => openModal(payout, 'confirm')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />Confirm
                          </button>
                          )}
                          {canEdit && (
                          <button
                            onClick={() => openModal(payout, 'refund')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />Refund
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-xl border-2 border-gray-300 text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${pg === page ? 'bg-[#8c76f0] text-white border-2 border-[#8c76f0]' : 'border-2 border-gray-300 text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50'}`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl border-2 border-gray-300 text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm / Refund Modal */}
      {modal.open && modal.payout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className={`px-6 py-5 flex items-center justify-between ${modal.action === 'confirm' ? 'bg-gradient-to-r from-[#8c76f0] to-[#7c63e0]' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  {modal.action === 'confirm' ? <CheckCircle className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
                </div>
                <h2 className="text-xl font-bold text-white">
                  {modal.action === 'confirm' ? 'Confirm Payout' : 'Refund Payout'}
                </h2>
              </div>
              <button onClick={closeModal} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700 font-medium">{modalSuccess}</p>
                </div>
              )}
              {modalError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{modalError}</p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                {/* Sender */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><User className="w-3.5 h-3.5" />Sender</span>
                  <span className="font-medium text-gray-900">{modal.payout.sender?.full_name || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 pl-5">Email</span>
                  <span className="text-gray-700">{modal.payout.sender?.email || '—'}</span>
                </div>
                {modal.payout.sender?.mobile && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 pl-5">Mobile</span>
                    <span className="text-gray-700">{modal.payout.sender.mobile}</span>
                  </div>
                )}

                {/* Beneficiary */}
                <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><Building className="w-3.5 h-3.5" />Beneficiary</span>
                  <span className="font-medium text-gray-900">{modal.payout.beneficiary?.beneficiary_name || modal.payout.account_holder_name || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 pl-5">Bank</span>
                  <span className="text-gray-700">{modal.payout.beneficiary?.bank_name || modal.payout.bank_name || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 pl-5">Account</span>
                  <span className="font-mono text-gray-900 text-xs">{modal.payout.beneficiary?.account_number || modal.payout.account_number || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 pl-5">IFSC</span>
                  <span className="font-mono text-gray-900 text-xs">{modal.payout.beneficiary?.ifsc_code || modal.payout.ifsc_code || '—'}</span>
                </div>

                {/* Gateway transaction details */}
                <div className="border-t border-gray-200 pt-2 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Gateway Details</p>
                  {modal.payout.payment_reference && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Reference</span>
                      <span className="font-mono text-xs font-semibold text-green-700">{modal.payout.payment_reference}</span>
                    </div>
                  )}
                  {modal.payout.gateway?.gateway_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Gateway</span>
                      <span className="font-medium text-gray-900">{modal.payout.gateway.gateway_name}</span>
                    </div>
                  )}
                  {modal.payout.gateway_transaction_id && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Gateway Tx ID</span>
                      <span className="font-mono text-gray-700 text-xs break-all text-right max-w-[200px]">{modal.payout.gateway_transaction_id}</span>
                    </div>
                  )}
                  {modal.payout.card_type && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Payment Option</span>
                      <span className="text-gray-700">{modal.payout.card_type}</span>
                    </div>
                  )}
                  {modal.payout.gateway_environment && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Environment</span>
                      <span className="text-gray-700 capitalize">{modal.payout.gateway_environment}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Base Amount</span>
                    <span className="text-gray-700">₹{fmtAmt(modal.payout.amount)}</span>
                  </div>
                  {(modal.payout.charges != null || modal.payout.gst != null) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Charges + GST</span>
                      <span className="text-gray-700">
                        ₹{fmtAmt(modal.payout.charges || 0)} + ₹{fmtAmt(modal.payout.gst || 0)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Net Payout Amount</span>
                  <span className="font-bold text-gray-900">₹{fmtAmt(modal.payout.net_amount || modal.payout.amount)}</span>
                </div>
              </div>

              {modal.action === 'confirm' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />Payout Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={payoutDate}
                      onChange={e => setPayoutDate(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5" />UTR / Reference Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={payoutRef}
                      onChange={e => setPayoutRef(e.target.value)}
                      placeholder="Bank UTR or transaction reference"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                      <IndianRupee className="w-3.5 h-3.5" />Confirmed Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={payoutAmount}
                      onChange={e => setPayoutAmount(e.target.value)}
                      step="0.01"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Refund Reason</label>
                  <textarea
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                    rows={3}
                    placeholder="Optional reason for refund..."
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all text-sm resize-none"
                  />
                </div>
              )}

            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={closeModal}
                disabled={processing}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={processing || !!modalSuccess}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-50 ${
                  modal.action === 'confirm'
                    ? 'bg-gradient-to-r from-[#8c76f0] to-[#7c63e0] hover:opacity-90'
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:opacity-90'
                }`}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : modal.action === 'confirm' ? (
                  <><CheckCircle className="w-4 h-4" />Confirm Payout</>
                ) : (
                  <><XCircle className="w-4 h-4" />Process Refund</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Payout Modal */}
      {bulkOpen && adminId && (
        <BulkPayoutModal
          adminId={adminId}
          onClose={() => setBulkOpen(false)}
          onSuccess={fetchPendingPayouts}
        />
      )}
    </AdminLayout>
  );
}
