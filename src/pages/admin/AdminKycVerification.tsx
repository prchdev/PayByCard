import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Users, Clock, XCircle, CheckCircle, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminKyc } from './useAdminKyc';
import { KycUserEntry, KycStatus } from './types';
import KycStatusBadge from './KycStatusBadge';
import ReviewModal from './ReviewModal';
import { useAdminPermission } from './useAdminPermission';
import { downloadCsv } from '../../utils/csvExport';
import { useTableSort, SortableTh } from './TableSort';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Users' },
  { value: 'verification_pending', label: 'Needs Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'pending', label: 'Pending' },
];

function getOverallStatus(entry: KycUserEntry): KycStatus {
  const panStatus = entry.pan?.status;
  const addressStatus = entry.address?.status;
  const businessStatus = entry.business?.status;

  if (!panStatus || !addressStatus) return 'pending';

  if (panStatus === 'rejected' || addressStatus === 'rejected') return 'rejected';

  const hasBusinessDocs = entry.business?.incorporation_certificate_url || entry.business?.company_pan_photo_url || entry.business?.gst_certificate_url || entry.business?.loa_url;
  if (hasBusinessDocs && businessStatus === 'rejected') return 'rejected';

  if (panStatus === 'verification_pending' || addressStatus === 'verification_pending') {
    return 'verification_pending';
  }

  if (hasBusinessDocs && businessStatus === 'verification_pending') {
    return 'verification_pending';
  }

  if (panStatus === 'verified' && addressStatus === 'verified') {
    if (hasBusinessDocs) {
      return businessStatus === 'verified' ? 'verified' : 'verification_pending';
    }
    return 'verified';
  }

  return 'pending';
}

export default function AdminKycVerification() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const { loading: permLoading, canEdit } = useAdminPermission('kyc');

  const { entries, loading, error, fetchList, reviewKyc } = useAdminKyc(adminId);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<KycUserEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [clearKycLoading, setClearKycLoading] = useState(false);

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    fetchList(statusFilter);
  }, [adminId, statusFilter]);

  const handleReview = async (recordId: string, table: string, action: 'verified' | 'rejected', reason?: string, surgeCharge?: number) => {
    try {
      await reviewKyc(recordId, table, action, reason, surgeCharge);
      await fetchList(statusFilter);
    } catch (error) {
      throw error;
    }
  };

  const handleAccountAction = async (userId: string, action: string, reason?: string) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-toggle-account-status`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({ adminId, userId, action, reason }),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Action failed');

    await fetchList(statusFilter);
  };

  const handleClearKyc = async (userId: string) => {
    setClearKycLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-clear-kyc`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
          },
          body: JSON.stringify({ adminId, userId }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to clear KYC');
      await fetchList(statusFilter);
    } finally {
      setClearKycLoading(false);
    }
  };

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      e.user.first_name.toLowerCase().includes(q) ||
      e.user.last_name.toLowerCase().includes(q) ||
      e.user.email.toLowerCase().includes(q) ||
      e.user.mobile_number.toLowerCase().includes(q)
    );
  });

  const { sortedData, sortConfig, handleSort } = useTableSort<KycUserEntry>(filtered, (item, key) => {
    switch (key) {
      case 'user':
        return `${item.user.first_name} ${item.user.last_name}`;
      case 'contact':
        return item.user.email;
      case 'pan':
        return item.pan?.status ?? null;
      case 'address':
        return item.address?.status ?? null;
      case 'business':
        return item.business?.status ?? null;
      case 'overall':
        return getOverallStatus(item);
      default:
        return null;
    }
  });

  const totalPages = Math.ceil(filtered.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedEntries = sortedData.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, search, recordsPerPage]);

  // Update selected entry when entries change
  useEffect(() => {
    if (selectedEntry) {
      const updated = entries.find((e) => e.user.id === selectedEntry.user.id);
      if (updated) {
        setSelectedEntry(updated);
      }
    }
  }, [entries]);

  const counts = {
    all: entries.length,
    verification_pending: entries.filter((e) => getOverallStatus(e) === 'verification_pending').length,
    verified: entries.filter((e) => getOverallStatus(e) === 'verified').length,
    rejected: entries.filter((e) => getOverallStatus(e) === 'rejected').length,
    pending: entries.filter((e) => getOverallStatus(e) === 'pending').length,
  };

  const handleDownloadCsv = () => {
    const headers = [
      'First Name', 'Middle Name', 'Last Name', 'Email', 'Mobile Number', 'Joined Date',
      'PAN Number', 'PAN Status', 'PAN Verification Date',
      'Address Proof Type', 'Address Status', 'Address Verification Date',
      'Business Name', 'Business PAN', 'GST Number', 'Business Status',
      'Referred By Name', 'Referred By Email', 'Referred By Mobile Number',
      'Overall Status',
    ];
    const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '');
    const rows = filtered.map((e) => [
      e.user.first_name,
      e.user.middle_name ?? '',
      e.user.last_name,
      e.user.email,
      e.user.mobile_number,
      new Date(e.user.created_at).toLocaleDateString('en-IN'),
      e.pan?.pan_number ?? '',
      e.pan?.status ?? '',
      fmtDate(e.pan?.approval_at),
      e.address?.proof_type ?? '',
      e.address?.status ?? '',
      fmtDate(e.address?.approval_at),
      e.business?.business_name ?? '',
      e.business?.business_pan ?? '',
      e.business?.gst_number ?? '',
      e.business?.status ?? '',
      e.referrer?.name ?? '',
      e.referrer?.email ?? '',
      e.referrer?.mobile_number ?? '',
      getOverallStatus(e),
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`kyc-verification-report-${dateStr}.csv`, headers, rows);
  };

  if (permLoading || !adminId) return null;

  return (
    <AdminLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
          <p className="text-gray-600 mt-1">Review and approve user KYC submissions</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{counts.all}</p>
            <p className="text-sm text-gray-500 mt-1">Total users</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-amber-300 hover:border-amber-400 p-6 transition-all hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review</span>
            </div>
            <p className="text-3xl font-bold text-amber-700">{counts.verification_pending}</p>
            <p className="text-sm text-gray-500 mt-1">Needs review</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-green-300 hover:border-green-400 p-6 transition-all hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Verified</span>
            </div>
            <p className="text-3xl font-bold text-green-700">{counts.verified}</p>
            <p className="text-sm text-gray-500 mt-1">Verified</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-red-300 hover:border-red-400 p-6 transition-all hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rejected</span>
            </div>
            <p className="text-3xl font-bold text-red-700">{counts.rejected}</p>
            <p className="text-sm text-gray-500 mt-1">Rejected</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:shadow-xl">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    statusFilter === f.value ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {counts[f.value as keyof typeof counts] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full sm:w-56 pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8c76f0]"
                />
              </div>
              <button
                onClick={handleDownloadCsv}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Download CSV report"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download Report CSV</span>
              </button>
              <button
                onClick={() => fetchList(statusFilter)}
                disabled={loading}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-100">
              {error}
            </div>
          )}

          {loading && entries.length === 0 ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#8c76f0]" />
              <p className="text-gray-600">Loading KYC data...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-900 font-medium">No users found</p>
              <p className="text-sm mt-1 text-gray-600">Try changing the filter or search query</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-gray-200">
                      <SortableTh label="User" sortKey="user" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide" />
                      <SortableTh label="Contact" sortKey="contact" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide" />
                      <SortableTh label="PAN" sortKey="pan" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide" />
                      <SortableTh label="Address" sortKey="address" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide" />
                      <SortableTh label="Business" sortKey="business" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide" />
                      <SortableTh label="Overall" sortKey="overall" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide" />
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedEntries.map((entry) => (
                      <tr key={entry.user.id} className="hover:bg-purple-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{[entry.user.first_name, entry.user.middle_name, entry.user.last_name].filter(Boolean).join(' ')}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Joined {new Date(entry.user.created_at).toLocaleDateString('en-IN')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900">{entry.user.email}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{entry.user.mobile_number}</p>
                        </td>
                        <td className="px-4 py-3">
                          {entry.pan ? <KycStatusBadge status={entry.pan.status} /> : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {entry.address ? <KycStatusBadge status={entry.address.status} /> : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {entry.business ? <KycStatusBadge status={entry.business.status} /> : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <KycStatusBadge status={getOverallStatus(entry)} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="px-3 py-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:opacity-90 text-white font-medium rounded-lg text-xs transition-opacity"
                          >
                            {canEdit ? 'Review' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filtered.length > 0 && (
                <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>Show</span>
                    <select
                      value={recordsPerPage}
                      onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8c76f0]"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span>records per page</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 mr-2">
                      Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length}
                    </span>
                    {totalPages > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white border-[#8c76f0]'
                                  : 'border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedEntry && (
        <ReviewModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onReview={handleReview}
          onAccountAction={handleAccountAction}
          onClearKyc={handleClearKyc}
          canEdit={canEdit}
        />
      )}
    </AdminLayout>
  );
}
