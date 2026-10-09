import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, Users, ShieldCheck, Clock, XCircle, CheckCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdminKyc } from './useAdminKyc';
import { KycUserEntry, KycStatus } from './types';
import KycStatusBadge from './KycStatusBadge';
import ReviewModal from './ReviewModal';
import { useTableSort, SortableTh } from './TableSort';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Users' },
  { value: 'verification_pending', label: 'Needs Review' },
  { value: 'invoice_pending', label: 'Invoice Pending' },
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

  const hasBusinessDocs = entry.business?.incorporation_certificate_url || entry.business?.gst_certificate_url;
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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const adminName = sessionStorage.getItem('adminName') ?? 'Admin';
  const adminEmail = sessionStorage.getItem('adminEmail') ?? '';

  const { entries, loading, error, fetchList, reviewKyc } = useAdminKyc(adminId);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<KycUserEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    const sessionToken = sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session');
    if (!sessionToken) {
      sessionStorage.clear();
      localStorage.removeItem('adminId');
      localStorage.removeItem('adminRole');
      navigate('/admin/login');
      return;
    }
    fetchList(statusFilter);
  }, [adminId, statusFilter]);

  const handleLogout = () => {
    sessionStorage.removeItem('adminId');
    sessionStorage.removeItem('adminEmail');
    sessionStorage.removeItem('adminName');
    navigate('/admin/login');
  };

  const handleReview = async (recordId: string, table: string, action: 'verified' | 'rejected', reason?: string) => {
    await reviewKyc(recordId, table, action, reason);
    await fetchList(statusFilter);
    if (selectedEntry) {
      const updated = entries.find((e) => e.user.id === selectedEntry.user.id);
      if (updated) setSelectedEntry(updated);
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

  const { sortedData, sortConfig, handleSort } = useTableSort(filtered, (entry: KycUserEntry, key: string) => {
    switch (key) {
      case 'user': return `${entry.user.first_name} ${entry.user.last_name}`;
      case 'contact': return entry.user.email;
      case 'pan': return entry.pan?.status ?? '';
      case 'address': return entry.address?.status ?? '';
      case 'business': return entry.business?.status ?? '';
      case 'overall': return getOverallStatus(entry);
      default: return '';
    }
  });

  const totalPages = Math.ceil(filtered.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedEntries = sortedData.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, search, recordsPerPage]);

  const counts = {
    all: entries.length,
    verification_pending: entries.filter((e) => getOverallStatus(e) === 'verification_pending').length,
    invoice_pending: entries.filter((e) => e.invoice_status === 'pending_verification').length,
    verified: entries.filter((e) => getOverallStatus(e) === 'verified').length,
    rejected: entries.filter((e) => getOverallStatus(e) === 'rejected').length,
    pending: entries.filter((e) => getOverallStatus(e) === 'pending').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 rounded-lg p-1.5">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-white font-bold text-lg">PayByCard</span>
                <span className="text-slate-400 text-sm ml-2">Admin</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-white text-sm font-medium">{adminName}</p>
                <p className="text-slate-400 text-xs">{adminEmail}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">KYC Verification Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Review and approve user KYC submissions</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="bg-slate-100 rounded-lg p-2">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.all}</p>
              <p className="text-xs text-slate-500">Total Users</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-3">
            <div className="bg-amber-100 rounded-lg p-2">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{counts.verification_pending}</p>
              <p className="text-xs text-slate-500">Needs Review</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-4 flex items-center gap-3">
            <div className="bg-emerald-100 rounded-lg p-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{counts.verified}</p>
              <p className="text-xs text-slate-500">Verified</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 flex items-center gap-3">
            <div className="bg-red-100 rounded-lg p-2">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{counts.rejected}</p>
              <p className="text-xs text-slate-500">Rejected</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    statusFilter === f.value ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {counts[f.value as keyof typeof counts] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full sm:w-56 pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => fetchList(statusFilter)}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
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
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
              <p>Loading KYC data...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-slate-500 font-medium">No users found</p>
              <p className="text-sm mt-1">Try changing the filter or search query</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <SortableTh label="User" sortKey="user" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" />
                      <SortableTh label="Contact" sortKey="contact" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" />
                      <SortableTh label="PAN" sortKey="pan" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" />
                      <SortableTh label="Address" sortKey="address" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" />
                      <SortableTh label="Business" sortKey="business" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" />
                      <SortableTh label="Overall" sortKey="overall" sortConfig={sortConfig} onSort={handleSort} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" />
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEntries.map((entry) => (
                      <tr key={entry.user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{entry.user.first_name} {entry.user.last_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Joined {new Date(entry.user.created_at).toLocaleDateString('en-IN')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700">{entry.user.email}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{entry.user.mobile_number}</p>
                        </td>
                        <td className="px-4 py-3">
                          {entry.pan ? <KycStatusBadge status={entry.pan.status} /> : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {entry.address ? <KycStatusBadge status={entry.address.status} /> : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {entry.business ? <KycStatusBadge status={entry.business.status} /> : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <KycStatusBadge status={getOverallStatus(entry)} />
                          {entry.invoice_status === 'pending_verification' && (
                            <span className="mt-1 block">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                Invoice Pending
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg text-xs transition-colors"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>Show</span>
                    <select
                      value={recordsPerPage}
                      onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                      className="px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <span className="text-sm text-slate-600 mr-2">
                      Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {selectedEntry && (
        <ReviewModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onReview={handleReview}
        />
      )}
    </div>
  );
}
