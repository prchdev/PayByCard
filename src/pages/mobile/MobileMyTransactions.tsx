import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Building2,
  RefreshCw,
} from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';

interface Transaction {
  id: string;
  payment_reference: string;
  amount: string;
  charges: string;
  gst: string;
  discount: string;
  total_amount: string;
  status: string;
  display_status: string;
  card_type: string | null;
  gateway_transaction_id: string | null;
  failure_reason: string | null;
  bill_file_url: string | null;
  gateway_environment: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  beneficiary_details: any;
  category_details: any;
  selected_payment_option: any;
  transaction_summary: any;
  payment_gateway_settings: {
    gateway_name: string;
    registered_name: string;
    gst_number: string;
  } | null;
  payout: {
    id: string;
    status: string;
    payout_reference: string;
    completed_at: string | null;
    utr_number: string | null;
    gateway_transaction_id: string | null;
    failure_reason: string | null;
    payout_type: string | null;
    refund_reason: string | null;
    refunded_at: string | null;
  } | null;
}

interface CompanySettings {
  company_name: string;
  address: string;
  cin: string;
  gst_number: string;
  pan: string;
  tan: string;
  company_logo_url: string;
  website_url: string;
  support_email: string;
  phone_number: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; description?: string }> = {
  completed:             { label: 'Completed',                    color: 'text-green-700 bg-green-50 border-green-200',   icon: CheckCircle, description: 'Payment and payout have been completed successfully.' },
  failed:                { label: 'Transaction Failed',           color: 'text-red-700 bg-red-50 border-red-200',         icon: XCircle,     description: 'The payment gateway transaction failed.' },
  cancelled:             { label: 'Transaction Failed',           color: 'text-red-700 bg-red-50 border-red-200',         icon: XCircle,     description: 'Transaction was cancelled.' },
  processing:            { label: 'Processing',                   color: 'text-blue-700 bg-blue-50 border-blue-200',       icon: RefreshCw,   description: 'Payment is being processed.' },
  pending:               { label: 'Processing',                   color: 'text-blue-700 bg-blue-50 border-blue-200',       icon: RefreshCw,   description: 'Payment is being processed.' },
  kyc_pending:           { label: 'Merchant Onboarding Required', color: 'text-amber-700 bg-amber-50 border-amber-200',   icon: Clock,       description: 'Payment received. The beneficiary needs to complete merchant onboarding and KYC verification before funds can be released.' },
  merchant_kyc_review:   { label: 'Merchant KYC Pending',        color: 'text-amber-700 bg-amber-50 border-amber-200',   icon: Clock,       description: 'Beneficiary has submitted KYC documents. Settlement will proceed once the KYC is approved.' },
  settlement_pending:    { label: 'Settlement In Progress',       color: 'text-blue-700 bg-blue-50 border-blue-200',       icon: RefreshCw,   description: 'Payment received. Settlement/payout to beneficiary is in progress.' },
  settlement_in_progress:{ label: 'Settlement In Progress',       color: 'text-blue-700 bg-blue-50 border-blue-200',       icon: RefreshCw,   description: 'Payout to beneficiary is being processed by the gateway.' },
  refunded:              { label: 'Refunded',                     color: 'text-orange-700 bg-orange-50 border-orange-200', icon: AlertCircle, description: 'KYC window expired and refund payout has been completed.' },
  refund_pending:        { label: 'Refund Pending',               color: 'text-rose-700 bg-rose-50 border-rose-200',       icon: AlertCircle, description: 'KYC window expired. Refund is pending initiation.' },
};

const FILTER_PILLS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'settlement_pending', label: 'Settlement' },
  { value: 'kyc_pending', label: 'KYC Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'refund_pending', label: 'Refund Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'processing', label: 'Processing' },
];

function fmt(amount: string | number) {
  return parseFloat(String(amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

const RECEIPT_ALLOWED_STATUSES = new Set(['completed', 'refunded']);

function canDownloadReceipt(displayStatus: string): boolean {
  return RECEIPT_ALLOWED_STATUSES.has(displayStatus);
}

export default function MobileMyTransactions() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const { logout } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [company, setCompany] = useState<CompanySettings>({} as CompanySettings);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const LIMIT = 10;

  useEffect(() => {
    if (!userId) navigate('/mobile/login', { replace: true });
  }, [userId, navigate]);

  useEffect(() => {
    fetchCompany();
  }, []);

  useEffect(() => {
    if (userId) fetchTransactions();
  }, [userId, page, statusFilter]);

  const fetchCompany = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-company-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.settings) setCompany(data.settings);
    } catch (_) {}
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, page, limit: LIMIT, status: statusFilter }),
      });
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.payments || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/mobile/login', { replace: true });
  };

  const handleDownloadReceipt = async (txn: Transaction) => {
    setDownloadingId(txn.id);
    try {
      const isRefund = (txn.display_status || txn.status) === 'refunded';
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice-html`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payment_id: txn.id, invoice_type: isRefund ? 'refund' : 'settlement' }),
      });
      const data = await res.json();
      if (!data.html_base64) return;
      const html = atob(data.html_base64);
      const win = window.open('', '_blank', 'width=800,height=900');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (_) {
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredTransactions = transactions.filter(txn => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      txn.payment_reference.toLowerCase().includes(q) ||
      (txn.gateway_transaction_id || '').toLowerCase().includes(q) ||
      (txn.beneficiary_details?.full_name || '').toLowerCase().includes(q) ||
      (txn.beneficiary_details?.email || '').toLowerCase().includes(q)
    );
  });

  if (!userId) return null;

  return (
    <MobileLayout
      userId={userId}
      userEmail={userEmail}
      onLogout={handleLogout}
      showBack={true}
      title="My Transactions"
    >
      <div className="px-3 py-3">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search reference, name, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent"
          />
        </div>

        {/* Status filter pills - horizontal scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-3 px-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {FILTER_PILLS.map(pill => (
            <button
              key={pill.value}
              onClick={() => { setStatusFilter(pill.value); setPage(1); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === pill.value
                  ? 'bg-[#8c76f0] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Refresh + summary */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-gray-500">
            {total > 0 ? `${total} txn${total !== 1 ? 's' : ''}` : ''}
          </p>
          <button
            onClick={fetchTransactions}
            className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-600 active:bg-gray-50"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {/* Transaction cards */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-[#8c76f0] animate-spin mb-2" />
            <p className="text-xs text-gray-500">Loading...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-700 text-sm font-medium">No transactions found</p>
            <p className="text-[11px] text-gray-400 mt-1 text-center">
              {search ? 'Try a different search term.' : 'Your payment history will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.map(txn => {
              const ds = txn.display_status || txn.status;
              const cardType = txn.selected_payment_option?.card_type || txn.card_type || txn.category_details?.category_name || '—';
              return (
                <div
                  key={txn.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 active:bg-gray-50 transition-colors"
                >
                  {/* Top row: reference + amount */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[11px] font-semibold text-[#8c76f0] truncate flex-1">
                      {txn.payment_reference}
                    </span>
                    <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                      ₹{fmt(txn.total_amount)}
                    </span>
                  </div>

                  {/* Beneficiary name */}
                  <p className="text-xs font-medium text-gray-900 truncate mb-1">
                    {txn.beneficiary_details?.full_name || '—'}
                  </p>

                  {/* Status + date */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <StatusBadge status={ds} />
                    <span className="text-[10px] text-gray-400">{fmtDate(txn.created_at)}</span>
                  </div>

                  {/* Card type + actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[11px] text-gray-500 truncate">
                      {cardType}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedTxn(txn)}
                        className="p-1.5 rounded-lg text-gray-500 active:bg-[#8c76f0]/10 active:text-[#8c76f0]"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {canDownloadReceipt(ds) && (
                        <button
                          onClick={() => handleDownloadReceipt(txn)}
                          disabled={downloadingId === txn.id}
                          className="p-1.5 rounded-lg text-gray-500 active:bg-green-50 active:text-green-600 disabled:opacity-50"
                          title="Download Receipt"
                        >
                          {downloadingId === txn.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Download className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Compact pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 active:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    pg === page
                      ? 'bg-[#8c76f0] text-white'
                      : 'border border-gray-200 text-gray-600 active:bg-gray-50'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 active:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedTxn(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b border-gray-200 z-10">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-gray-900">Transaction Details</h2>
                <p className="text-[10px] text-[#8c76f0] font-mono mt-0.5 truncate">{selectedTxn.payment_reference}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canDownloadReceipt(selectedTxn.display_status || selectedTxn.status) && (
                  <button
                    onClick={() => handleDownloadReceipt(selectedTxn)}
                    disabled={downloadingId === selectedTxn.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium active:bg-green-700 disabled:opacity-50"
                  >
                    {downloadingId === selectedTxn.id
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : <Download className="w-3 h-3" />}
                    Receipt
                  </button>
                )}
                <button
                  onClick={() => setSelectedTxn(null)}
                  className="p-1.5 rounded-lg text-gray-400 active:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <StatusBadge status={selectedTxn.display_status || selectedTxn.status} />
                <span className="text-[10px] text-gray-500">{fmtDate(selectedTxn.created_at)}</span>
              </div>

              {selectedTxn.failure_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">
                  <strong>Reason:</strong> {selectedTxn.failure_reason}
                </div>
              )}

              {/* Amount Breakdown */}
              <div>
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount Breakdown</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Transfer Amount</span>
                    <span className="font-medium">₹{fmt(selectedTxn.amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Platform Charges</span>
                    <span className="font-medium">₹{fmt(selectedTxn.charges)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">GST on Charges</span>
                    <span className="font-medium">₹{fmt(selectedTxn.gst)}</span>
                  </div>
                  {parseFloat(selectedTxn.discount || '0') > 0 && (
                    <div className="flex justify-between text-xs text-green-700">
                      <span>Discount</span>
                      <span className="font-medium">-₹{fmt(selectedTxn.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                    <span className="font-bold text-gray-900 text-xs">Total Charged</span>
                    <span className="font-bold text-[#8c76f0] text-sm">₹{fmt(selectedTxn.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Beneficiary */}
              {selectedTxn.beneficiary_details && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Beneficiary</h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                    {([
                      ['Name', selectedTxn.beneficiary_details.full_name],
                      ['Email', selectedTxn.beneficiary_details.email],
                      ['Mobile', selectedTxn.beneficiary_details.mobile],
                      ['Bank', selectedTxn.beneficiary_details.bank_name],
                      ['Account No.', selectedTxn.beneficiary_details.bank_account],
                      ['IFSC', selectedTxn.beneficiary_details.ifsc],
                      ['Account Type', selectedTxn.beneficiary_details.account_type],
                      ['PAN', selectedTxn.beneficiary_details.pan_number],
                    ] as [string, any][])
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <span className="text-gray-500 flex-shrink-0">{label}</span>
                          <span className="font-medium text-gray-900 text-right break-all">{value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Refunded To */}
              {(selectedTxn.display_status === 'refunded' || selectedTxn.display_status === 'refund_pending') && (selectedTxn.selected_payment_option?.card_type || selectedTxn.card_type) && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Refunded To</h3>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1.5 text-xs">
                    {([
                      ['Payment Mode', selectedTxn.selected_payment_option?.card_type || selectedTxn.card_type],
                      ['Refund Reference', selectedTxn.payout?.payout_reference ?? null],
                      ['Refund Reason', selectedTxn.payout?.refund_reason ?? null],
                      ['Refunded On', selectedTxn.payout?.refunded_at ? fmtDate(selectedTxn.payout.refunded_at) : (selectedTxn.payout?.completed_at ? fmtDate(selectedTxn.payout.completed_at) : null)],
                    ] as [string, any][])
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <span className="text-gray-500 flex-shrink-0">{label}</span>
                          <span className="font-medium text-gray-900 text-right break-all">{value}</span>
                        </div>
                      ))}
                    <div className="pt-1.5 border-t border-orange-200">
                      <p className="text-[10px] text-orange-700">Refund will be credited to the original payment method. Processing time may vary by bank (typically 5–7 business days).</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status description */}
              {(() => {
                const ds = selectedTxn.display_status || selectedTxn.status;
                const cfg = STATUS_CONFIG[ds];
                return cfg?.description ? (
                  <div className={`flex items-start gap-2 rounded-lg p-2.5 border text-[11px] ${cfg.color}`}>
                    <cfg.icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{cfg.description}</span>
                  </div>
                ) : null;
              })()}

              {/* Transaction Info */}
              <div>
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Transaction Info</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                  {([
                    ['Category', selectedTxn.category_details?.category_name],
                    ['Payment Option', selectedTxn.selected_payment_option?.card_type || selectedTxn.card_type],
                    ['Gateway', selectedTxn.payment_gateway_settings?.gateway_name],
                    ['Gateway Ref.', selectedTxn.gateway_transaction_id],
                    ['Environment', selectedTxn.gateway_environment === 'test' ? 'Test Mode' : selectedTxn.gateway_environment === 'production' ? 'Live' : null],
                    ['Completed At', selectedTxn.completed_at ? fmtDate(selectedTxn.completed_at) : null],
                  ] as [string, any][])
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <span className="text-gray-500 flex-shrink-0">{label}</span>
                        <span className="font-medium text-gray-900 text-right break-all">{value}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Payout Info */}
              {selectedTxn.payout && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Settlement / Payout</h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                    {([
                      ['Payout Reference', selectedTxn.payout.payout_reference],
                      ['Payout Status', selectedTxn.payout.status ? (selectedTxn.payout.status.charAt(0).toUpperCase() + selectedTxn.payout.status.slice(1)) : null],
                      ['UTR Number', selectedTxn.payout.utr_number],
                      ['Payout Gateway Ref.', selectedTxn.payout.gateway_transaction_id],
                      ['Payout Completed', selectedTxn.payout.completed_at ? fmtDate(selectedTxn.payout.completed_at) : null],
                      ['Payout Failure', selectedTxn.payout.failure_reason],
                    ] as [string, any][])
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <span className="text-gray-500 flex-shrink-0">{label}</span>
                          <span className="font-medium text-gray-900 text-right break-all">{value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Gateway details */}
              {selectedTxn.payment_gateway_settings?.registered_name && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Payment Processor</h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                    {([
                      ['Registered Name', selectedTxn.payment_gateway_settings.registered_name],
                      ['GST No.', selectedTxn.payment_gateway_settings.gst_number],
                    ] as [string, any][])
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <span className="text-gray-500 flex-shrink-0">{label}</span>
                          <span className="font-medium text-gray-900 text-right break-all">{value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Company info strip */}
              {(company.company_name || company.gst_number) && (
                <div className="flex items-start gap-2 bg-[#8c76f0]/5 border border-[#8c76f0]/20 rounded-lg p-2.5">
                  <Building2 className="w-3.5 h-3.5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
                  <div className="text-[10px] text-[#8c76f0]">
                    <p className="font-semibold">{company.company_name}</p>
                    {company.gst_number && <p>GST: {company.gst_number}</p>}
                    {company.support_email && <p>{company.support_email}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
