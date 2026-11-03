import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  Search,
  Loader2,
  X,
  User,
  Mail,
  Phone,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface AdminCard {
  id: string;
  card_last_four: string;
  card_network: string | null;
  card_type: string | null;
  bank_name: string | null;
  name_on_card: string | null;
  front_photo_url: string | null;
  back_photo_url: string | null;
  status: string;
  ai_verification_result: any;
  admin_verified_by: string | null;
  admin_verified_at: string | null;
  admin_rejection_reason: string | null;
  card_verification_deadline: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    mobile_number: string;
  };
  payment_count: number;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Needs Review' },
  { value: 'not_submitted', label: 'Not Submitted' },
  { value: 'verified', label: 'Verified' },
  { value: 'third_party', label: 'Third Party' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  not_submitted: { label: 'Not Submitted', color: 'gray', icon: AlertCircle },
  submitted: { label: 'Submitted', color: 'blue', icon: Clock },
  verified: { label: 'Verified', color: 'green', icon: CheckCircle },
  third_party: { label: 'Third Party', color: 'amber', icon: ShieldCheck },
  rejected: { label: 'Rejected', color: 'red', icon: XCircle },
};

export default function AdminVerifyCards() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const { loading: permLoading, canEdit } = useAdminPermission('verify-cards');

  const [cards, setCards] = useState<AdminCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [search, setSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState<AdminCard | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [success, setSuccess] = useState('');
  const [adminCardName, setAdminCardName] = useState('');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    fetchCards();
  }, [adminId, navigate, statusFilter]);

  const fetchCards = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-cards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({ adminId, status: statusFilter, search }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch cards');
      setCards(data.cards || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load cards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedCard || !adminId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-verify-card`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({
          adminId,
          cardId: selectedCard.id,
          action,
          isThirdParty: action === 'approve' ? isThirdParty : false,
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
          adminCardName: action === 'approve' ? adminCardName.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setSuccess(`Card ${action === 'approve' ? (isThirdParty ? 'marked as third party' : 'approved') : 'rejected'} successfully`);
      setSelectedCard(null);
      setIsThirdParty(false);
      setRejectionReason('');
      setAdminCardName('');
      await fetchCards();
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = useCallback(() => {
    if (!search) return cards;
    const q = search.toLowerCase();
    return cards.filter((c) =>
      c.user?.full_name?.toLowerCase().includes(q) ||
      c.user?.email?.toLowerCase().includes(q) ||
      c.card_last_four?.includes(q),
    );
  }, [cards, search])();

  if (permLoading || !adminId) return null;

  const counts = {
    all: cards.length,
    submitted: cards.filter((c) => c.status === 'submitted').length,
    verified: cards.filter((c) => c.status === 'verified').length,
    third_party: cards.filter((c) => c.status === 'third_party').length,
    rejected: cards.filter((c) => c.status === 'rejected').length,
    not_submitted: cards.filter((c) => c.status === 'not_submitted').length,
  };

  return (
    <AdminLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Verify Cards</h1>
          <p className="text-gray-600 mt-1">Review and verify user credit/debit card submissions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {STATUS_FILTERS.map((f) => {
            const cfg = STATUS_CONFIG[f.value];
            const Icon = cfg?.icon || CreditCard;
            return (
              <div key={f.value} className="bg-white rounded-2xl border-2 border-gray-200 hover:border-[#8c76f0] p-4 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-4 h-4 text-${cfg?.color || 'gray'}-600`} />
                  <span className="text-xs font-semibold text-gray-500">{f.label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{counts[f.value as keyof typeof counts] ?? 0}</p>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 mb-6">
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
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or last 4..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Cards Table */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-[#8c76f0]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">No cards found</h3>
            <p className="text-gray-500 mt-1">No card submissions match your filters.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Card</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name on Card</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name Match</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((card) => {
                    const statusCfg = STATUS_CONFIG[card.status] || STATUS_CONFIG.not_submitted;
                    const StatusIcon = statusCfg.icon;
                    const aiScore = card.ai_verification_result?.name_match_score;
                    return (
                      <tr key={card.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 text-sm">{card.user?.full_name || 'Unknown'}</span>
                            <span className="text-xs text-gray-500">{card.user?.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-gray-400" />
                            <div>
                              <span className="font-medium text-gray-900 text-sm">•••• {card.card_last_four}</span>
                              {card.card_network && <span className="text-xs text-gray-500 block capitalize">{card.card_network}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{card.bank_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{card.name_on_card || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${statusCfg.color}-50 text-${statusCfg.color}-700 border border-${statusCfg.color}-200`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {aiScore !== undefined ? `${Math.round(aiScore * 100)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedCard(card);
                              setIsThirdParty(card.status === 'third_party');
                              setRejectionReason('');
                              setAdminCardName(card.name_on_card || '');
                            }}
                            disabled={!canEdit && card.status !== 'submitted' && card.status !== 'not_submitted' && card.status !== 'third_party'}
                            className="px-3 py-1.5 text-sm font-medium text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {selectedCard && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCard(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Card Review</h3>
                <button onClick={() => setSelectedCard(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              {/* User Info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">KYC Name</p>
                      <p className="font-medium text-gray-900 text-sm">{selectedCard.user?.full_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900 text-sm">{selectedCard.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Mobile</p>
                      <p className="font-medium text-gray-900 text-sm">{selectedCard.user?.mobile_number || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Card</p>
                      <p className="font-medium text-gray-900 text-sm">•••• {selectedCard.card_last_four} {selectedCard.card_network && `(${selectedCard.card_network})`}</p>
                    </div>
                  </div>
                </div>
                {selectedCard.bank_name && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">Issuing Bank</p>
                    <p className="font-medium text-gray-900 text-sm">{selectedCard.bank_name}</p>
                  </div>
                )}
              </div>

              {/* Card Photos */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Front Photo</p>
                  {selectedCard.front_photo_url ? (
                    <img src={selectedCard.front_photo_url} alt="Card front" className="w-full rounded-xl border border-gray-200" />
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                      <span className="text-sm text-gray-400">No photo uploaded</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Back Photo</p>
                  {selectedCard.back_photo_url ? (
                    <img src={selectedCard.back_photo_url} alt="Card back" className="w-full rounded-xl border border-gray-200" />
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                      <span className="text-sm text-gray-400">No photo uploaded</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Details */}
              {selectedCard.ai_verification_result && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm font-medium text-blue-900 mb-2">Verification Details</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Last 4 Digits Match:</span>
                      <span className={`font-medium ${selectedCard.ai_verification_result.last4_match ? 'text-green-700' : 'text-red-700'}`}>
                        {selectedCard.ai_verification_result.last4_match ? 'Matched' : 'Not matched'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Name on Card:</span>
                      <span className="font-medium text-blue-900">{selectedCard.ai_verification_result.name_on_card || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">KYC Name:</span>
                      <span className="font-medium text-blue-900">{selectedCard.ai_verification_result.kyc_name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Name Match:</span>
                      <span className={`font-medium ${(selectedCard.ai_verification_result.name_match_score || 0) >= 0.5 ? 'text-green-700' : 'text-red-700'}`}>
                        {Math.round((selectedCard.ai_verification_result.name_match_score || 0) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Name on card — admin enters from photo */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name on Card <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={adminCardName}
                  onChange={(e) => setAdminCardName(e.target.value.replace(/[^A-Za-z\s]/g, ''))}
                  maxLength={50}
                  placeholder="Read the name from the card photo and enter it here"
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-xl text-sm focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none transition-colors"
                />
                {(() => {
                  const kycName = selectedCard.user?.full_name || '';
                  const score = (() => {
                    if (!adminCardName.trim() || !kycName.trim()) return 0;
                    const t1 = new Set(adminCardName.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter((w) => w.length >= 2));
                    const t2 = new Set(kycName.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter((w) => w.length >= 2));
                    if (t1.size === 0 || t2.size === 0) return 0;
                    let m = 0;
                    t1.forEach((t) => { if (t2.has(t)) m++; });
                    return m / Math.max(t1.size, t2.size);
                  })();
                  const pct = Math.round(score * 100);
                  return (
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-gray-500">KYC Name: <span className="font-medium text-gray-700">{kycName}</span></span>
                      <span className={`font-medium ${pct >= 50 ? 'text-green-600' : 'text-red-600'}`}>Name Match: {pct}%</span>
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              {canEdit ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isThirdParty}
                      onChange={(e) => setIsThirdParty(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#8c76f0] focus:ring-[#8c76f0]"
                    />
                    <span className="text-sm font-medium text-gray-700">Mark as Third Party Card</span>
                  </label>

                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Rejection reason (required for reject)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent"
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {isThirdParty ? 'Approve as Third Party' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">You have view-only permission for this page.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
