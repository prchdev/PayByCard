import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  Search,
  Filter,
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
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

const RECEIPT_ALLOWED_STATUSES = new Set(['completed', 'refunded']);

function canDownloadReceipt(displayStatus: string): boolean {
  return RECEIPT_ALLOWED_STATUSES.has(displayStatus);
}

export default function MyTransactions() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const { logout } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    if (!userId) navigate('/login', { replace: true });
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
    navigate('/login', { replace: true });
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
          currentPage="my-transactions"
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Transactions</h1>
            <p className="text-sm text-gray-500 mt-1">View and download receipts for all your payment transactions.</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by reference, name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="settlement_pending">Settlement In Progress</option>
                <option value="kyc_pending">Beneficiary KYC Pending</option>
                <option value="failed">Transaction Failed</option>
                <option value="refunded">Refunded</option>
                <option value="refund_pending">Refund Pending</option>
                <option value="cancelled">Transaction Failed</option>
                <option value="processing">Processing</option>
              </select>
            </div>
            <button
              onClick={fetchTransactions}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Summary strip */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {total > 0 ? `${total} transaction${total !== 1 ? 's' : ''} found` : ''}
            </p>
            {totalPages > 1 && (
              <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-500">Loading transactions...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-gray-700 font-medium">No transactions found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {search ? 'Try a different search term.' : 'Your payment history will appear here.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Reference</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Beneficiary</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Category</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Amount</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Date</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTransactions.map(txn => (
                      <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-blue-700">{txn.payment_reference}</span>
                          {txn.gateway_transaction_id && (
                            <p className="text-xs text-gray-400 mt-0.5 font-mono">{txn.gateway_transaction_id}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[130px]">
                            {txn.beneficiary_details?.full_name || '—'}
                          </p>
                          <p className="text-xs text-gray-400 truncate max-w-[130px]">
                            {txn.beneficiary_details?.bank_name || ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-sm text-gray-700 truncate max-w-[110px]">
                            {txn.selected_payment_option?.card_type || txn.category_details?.category_name || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-bold text-gray-900">₹{fmt(txn.total_amount)}</p>
                          <p className="text-xs text-gray-400">₹{fmt(txn.amount)} + charges</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={txn.display_status || txn.status} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <p className="text-xs text-gray-600">{fmtDate(txn.created_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const ds = txn.display_status || txn.status;
                            const canDl = canDownloadReceipt(ds);
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setSelectedTxn(txn)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {canDl ? (
                                  <button
                                    onClick={() => handleDownloadReceipt(txn)}
                                    disabled={downloadingId === txn.id}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                                    title="Download Receipt"
                                  >
                                    {downloadingId === txn.id
                                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                                      : <Download className="w-4 h-4" />}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      pg === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>
      </div>

      <Footer />

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTxn(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Transaction Details</h2>
                <p className="text-xs text-blue-700 font-mono mt-0.5">{selectedTxn.payment_reference}</p>
              </div>
              <div className="flex items-center gap-2">
                {canDownloadReceipt(selectedTxn.display_status || selectedTxn.status) && (
                  <button
                    onClick={() => handleDownloadReceipt(selectedTxn)}
                    disabled={downloadingId === selectedTxn.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {downloadingId === selectedTxn.id
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    Receipt
                  </button>
                )}
                <button
                  onClick={() => setSelectedTxn(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <StatusBadge status={selectedTxn.display_status || selectedTxn.status} />
                <span className="text-xs text-gray-500">{fmtDate(selectedTxn.created_at)}</span>
              </div>

              {selectedTxn.failure_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <strong>Reason:</strong> {selectedTxn.failure_reason}
                </div>
              )}

              {/* Amount Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Amount Breakdown</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Transfer Amount</span>
                    <span className="font-medium">₹{fmt(selectedTxn.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Platform Charges</span>
                    <span className="font-medium">₹{fmt(selectedTxn.charges)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST on Charges</span>
                    <span className="font-medium">₹{fmt(selectedTxn.gst)}</span>
                  </div>
                  {parseFloat(selectedTxn.discount || '0') > 0 && (
                    <div className="flex justify-between text-sm text-green-700">
                      <span>Discount</span>
                      <span className="font-medium">-₹{fmt(selectedTxn.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                    <span className="font-bold text-gray-900">Total Charged</span>
                    <span className="font-bold text-blue-700 text-lg">₹{fmt(selectedTxn.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Beneficiary */}
              {selectedTxn.beneficiary_details && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Beneficiary</h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ['Name', selectedTxn.beneficiary_details.full_name],
                      ['Email', selectedTxn.beneficiary_details.email],
                      ['Mobile', selectedTxn.beneficiary_details.mobile],
                      ['Bank', selectedTxn.beneficiary_details.bank_name],
                      ['Account No.', selectedTxn.beneficiary_details.bank_account],
                      ['IFSC', selectedTxn.beneficiary_details.ifsc],
                      ['Account Type', selectedTxn.beneficiary_details.account_type],
                      ['PAN', selectedTxn.beneficiary_details.pan_number],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span className="text-gray-500 flex-shrink-0">{label}</span>
                        <span className="font-medium text-gray-900 text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Refunded To — shown for refund transactions */}
              {(selectedTxn.display_status === 'refunded' || selectedTxn.display_status === 'refund_pending') && (selectedTxn.selected_payment_option?.card_type || selectedTxn.card_type) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Refunded To</h3>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ['Payment Mode', selectedTxn.selected_payment_option?.card_type || selectedTxn.card_type],
                      ['Refund Reference', selectedTxn.payout?.payout_reference ?? null],
                      ['Refund Reason', selectedTxn.payout?.refund_reason ?? null],
                      ['Refunded On', selectedTxn.payout?.refunded_at ? fmtDate(selectedTxn.payout.refunded_at) : (selectedTxn.payout?.completed_at ? fmtDate(selectedTxn.payout.completed_at) : null)],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span className="text-gray-500 flex-shrink-0">{label}</span>
                        <span className="font-medium text-gray-900 text-right">{value}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-orange-200">
                      <p className="text-xs text-orange-700">Refund will be credited to the original payment method. Processing time may vary by bank (typically 5–7 business days).</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status description */}
              {(() => {
                const ds = selectedTxn.display_status || selectedTxn.status;
                const cfg = STATUS_CONFIG[ds];
                return cfg?.description ? (
                  <div className={`flex items-start gap-2 rounded-lg p-3 border text-xs ${cfg.color}`}>
                    <cfg.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{cfg.description}</span>
                  </div>
                ) : null;
              })()}

              {/* Transaction Info */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction Info</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  {[
                    ['Category', selectedTxn.category_details?.category_name],
                    ['Payment Option', selectedTxn.selected_payment_option?.card_type || selectedTxn.card_type],
                    ['Gateway', selectedTxn.payment_gateway_settings?.gateway_name],
                    ['Gateway Ref.', selectedTxn.gateway_transaction_id],
                    ['Environment', selectedTxn.gateway_environment === 'test' ? 'Test Mode' : selectedTxn.gateway_environment === 'production' ? 'Live' : null],
                    ['Completed At', selectedTxn.completed_at ? fmtDate(selectedTxn.completed_at) : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-gray-500 flex-shrink-0">{label}</span>
                      <span className="font-medium text-gray-900 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payout Info */}
              {selectedTxn.payout && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settlement / Payout</h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ['Payout Reference', selectedTxn.payout.payout_reference],
                      ['Payout Status', selectedTxn.payout.status ? (selectedTxn.payout.status.charAt(0).toUpperCase() + selectedTxn.payout.status.slice(1)) : null],
                      ['UTR Number', selectedTxn.payout.utr_number],
                      ['Payout Gateway Ref.', selectedTxn.payout.gateway_transaction_id],
                      ['Payout Completed', selectedTxn.payout.completed_at ? fmtDate(selectedTxn.payout.completed_at) : null],
                      ['Payout Failure', selectedTxn.payout.failure_reason],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span className="text-gray-500 flex-shrink-0">{label}</span>
                        <span className="font-medium text-gray-900 text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gateway details */}
              {selectedTxn.payment_gateway_settings?.registered_name && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Processor</h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ['Registered Name', selectedTxn.payment_gateway_settings.registered_name],
                      ['GST No.', selectedTxn.payment_gateway_settings.gst_number],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span className="text-gray-500 flex-shrink-0">{label}</span>
                        <span className="font-medium text-gray-900 text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Company info strip */}
              {(company.company_name || company.gst_number) && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Building2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
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
    </div>
  );
}
