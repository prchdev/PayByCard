import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Camera,
  ShieldCheck,
  Info,
  ChevronDown,
} from 'lucide-react';
import { useDashboardContext } from '../hooks/useDashboardContext';

interface CardPayment {
  payment_id: string;
  payment_reference: string;
  amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface UserCard {
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
  admin_rejection_reason: string | null;
  card_verification_deadline: string | null;
  created_at: string;
  updated_at: string;
  payment_count: number;
  payments: CardPayment[];
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: any }> = {
  not_submitted: { label: 'Not Submitted', badgeClass: 'bg-gray-50 text-gray-700 border border-gray-200', icon: AlertCircle },
  submitted: { label: 'Submitted for Review', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200', icon: Clock },
  verified: { label: 'Verified', badgeClass: 'bg-green-50 text-green-700 border border-green-200', icon: CheckCircle },
  third_party: { label: 'Third Party Card', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200', icon: ShieldCheck },
  rejected: { label: 'Rejected', badgeClass: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle },
};

const TXN_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border border-green-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border border-red-200' },
  cancelled: { label: 'Failed', className: 'bg-red-50 text-red-700 border border-red-200' },
  processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  pending: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  settlement_pending: { label: 'Settlement', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  settlement_in_progress: { label: 'Settlement', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  kyc_pending: { label: 'KYC Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  refunded: { label: 'Refunded', className: 'bg-orange-50 text-orange-700 border border-orange-200' },
  refund_pending: { label: 'Refund Pending', className: 'bg-rose-50 text-rose-700 border border-rose-200' },
  card_verification_pending: { label: 'Card Verification', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

function TxnStatusBadge({ status }: { status: string }) {
  const cfg = TXN_STATUS_CONFIG[status] || { label: status, className: 'bg-gray-50 text-gray-700 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function MyCards() {
  const navigate = useNavigate();
  const { userId } = useDashboardContext();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
  const [uploadSide, setUploadSide] = useState<'front' | 'back'>('front');
  const [nameOnCard, setNameOnCard] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }
    fetchCards();
  }, [userId, navigate]);

  const fetchCards = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-cards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-session': sessionStorage.getItem('pbc_session') || localStorage.getItem('pbc_session') || '',
        },
        body: JSON.stringify({ userId }),
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

  const handleUploadClick = (card: UserCard, side: 'front' | 'back') => {
    setSelectedCard(card);
    setUploadSide(side);
    setNameOnCard(card.name_on_card || '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCard || !userId) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must not exceed 5 MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('File must be a JPEG, PNG, or WebP image');
      return;
    }

    try {
      setIsUploading(true);
      setError('');
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('cardId', selectedCard.id);
      formData.append('side', uploadSide);
      formData.append('file', file);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-card-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-pbc-session': sessionStorage.getItem('pbc_session') || localStorage.getItem('pbc_session') || '',
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Update name on card if provided
      if (nameOnCard && nameOnCard !== selectedCard.name_on_card) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-card-name`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-pbc-session': sessionStorage.getItem('pbc_session') || localStorage.getItem('pbc_session') || '',
          },
          body: JSON.stringify({ userId, cardId: selectedCard.id, nameOnCard }),
        });
      }

      setSuccess(`${uploadSide === 'front' ? 'Front' : 'Back'} photo uploaded successfully`);
      setSelectedCard(null);
      await fetchCards();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerify = async (card: UserCard) => {
    if (!userId) return;
    if (!card.name_on_card) {
      setError('Please enter the name on card before verification. Click the upload button to add it.');
      return;
    }
    if (card.name_on_card.length > 100) {
      setError('Name on card is too long (maximum 100 characters).');
      return;
    }
    if (!/^[A-Za-z\s.\-']+$/.test(card.name_on_card)) {
      setError('Name on card contains invalid characters. Only letters, spaces, dots, hyphens, and apostrophes are allowed.');
      return;
    }
    try {
      setIsVerifying(true);
      setError('');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-card-ai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-session': sessionStorage.getItem('pbc_session') || localStorage.getItem('pbc_session') || '',
        },
        body: JSON.stringify({ userId, cardId: card.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      if (data.status === 'verified') {
        setSuccess('Card verified successfully!');
      } else if (data.status === 'third_party') {
        setSuccess('Card marked as third party. Please wait for admin review.');
      } else {
        setSuccess('Card submitted for admin review.');
      }
      await fetchCards();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveName = async (card: UserCard) => {
    if (!userId || !nameOnCard.trim()) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-card-name`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-session': sessionStorage.getItem('pbc_session') || localStorage.getItem('pbc_session') || '',
        },
        body: JSON.stringify({ userId, cardId: card.id, nameOnCard: nameOnCard.trim() }),
      });
      if (!res.ok) throw new Error('Failed to save name');
      setSuccess('Name on card saved');
      setSelectedCard(null);
      await fetchCards();
    } catch (err: any) {
      setError(err.message || 'Failed to save name');
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#8c76f0]" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
      <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Cards</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage and verify cards used for your transactions</p>
      </div>

      {/* Instructions Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Card Verification Instructions</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Upload a <strong>masked photo</strong> of your card where only the <strong>last 4 digits</strong> and the <strong>name on card</strong> are clearly visible.
              All other digits, expiry date, and CVV must be <strong>masked/covered</strong>.
              Our AI will verify that the last 4 digits match the transaction and the name matches your KYC profile.
            </p>
            <div className="mt-3 flex items-center gap-4 text-sm text-blue-700">
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Last 4 digits visible</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Name clearly visible</span>
              <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> All other digits masked</span>
              <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Expiry & CVV masked</span>
            </div>
          </div>
        </div>
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

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No cards yet</h3>
          <p className="text-gray-500 mt-1">Cards used in your transactions will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const statusCfg = STATUS_CONFIG[card.status] || STATUS_CONFIG.not_submitted;
            const StatusIcon = statusCfg.icon;
            return (
              <div key={card.id} className="bg-white rounded-2xl border-2 border-gray-200 hover:border-[#8c76f0] hover:shadow-xl transition-all p-6">
                {/* Card Visual */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 mb-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-white/60 text-xs uppercase tracking-wide">{card.card_type?.replace('_', ' ') || 'Card'}</span>
                    {card.card_network && <span className="text-white font-semibold text-sm capitalize">{card.card_network}</span>}
                  </div>
                  <p className="text-white/80 text-sm tracking-widest mb-3">•••• •••• •••• {card.card_last_four}</p>
                  <p className="text-white/70 text-xs uppercase">{card.name_on_card || 'Name not set'}</p>
                  {card.bank_name && <p className="text-white/50 text-xs mt-1">{card.bank_name}</p>}
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusCfg.badgeClass}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusCfg.label}
                  </span>
                  {card.payment_count > 0 && (
                    <button
                      onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                      className="text-xs text-gray-500 hover:text-[#8c76f0] transition-colors flex items-center gap-1"
                    >
                      {card.payment_count} transaction{card.payment_count !== 1 ? 's' : ''}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedCard === card.id ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {card.payment_count === 0 && (
                    <span className="text-xs text-gray-400">No transactions</span>
                  )}
                </div>

                {/* Transaction Details */}
                {expandedCard === card.id && card.payments && card.payments.length > 0 && (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 mb-4 max-h-48 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction History</p>
                    <div className="space-y-2">
                      {card.payments.map((pmt) => (
                        <div key={pmt.payment_id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-700 truncate">{pmt.payment_reference}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(pmt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <TxnStatusBadge status={pmt.status} />
                            <span className="text-xs font-semibold text-gray-700">₹{pmt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deadline */}
                {card.card_verification_deadline && card.status === 'not_submitted' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-700">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      Deadline: {new Date(card.card_verification_deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                )}

                {/* Admin rejection reason */}
                {card.status === 'rejected' && card.admin_rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-red-700 mb-1">Rejection Reason:</p>
                    <p className="text-xs text-red-600">{card.admin_rejection_reason}</p>
                    <p className="text-xs text-red-500 mt-2">Please re-upload corrected photos and verify again.</p>
                  </div>
                )}

                {/* AI verification result */}
                {card.ai_verification_result && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-600">
                      Name match: {Math.round((card.ai_verification_result.name_match_score || 0) * 100)}%
                      {card.ai_verification_result.last4_match ? ' • Last 4: Matched' : ''}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUploadClick(card, 'front')}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    {card.front_photo_url ? 'Front' : 'Front'}
                  </button>
                  <button
                    onClick={() => handleUploadClick(card, 'back')}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    {card.back_photo_url ? 'Back' : 'Back'}
                  </button>
                  {card.front_photo_url && card.back_photo_url && card.name_on_card && (card.status === 'not_submitted' || card.status === 'submitted' || card.status === 'rejected') && (
                    <button
                      onClick={() => handleVerify(card)}
                      disabled={isVerifying}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#8c76f0] to-purple-600 hover:from-[#7a66e0] hover:to-purple-700 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Verify
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCard(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Upload {uploadSide === 'front' ? 'Front' : 'Back'} Photo</h3>
              <button onClick={() => setSelectedCard(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Card ending in <strong>{selectedCard.card_last_four}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name on Card</label>
              <input
                type="text"
                value={nameOnCard}
                onChange={(e) => setNameOnCard(e.target.value)}
                placeholder="Enter name as printed on card"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">This will be compared with your KYC name for verification.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-700">
                Ensure only last 4 digits and name are visible. Mask all other digits, expiry, and CVV before photographing.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full px-4 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-medium rounded-xl hover:from-[#7a66e0] hover:to-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {isUploading ? 'Uploading...' : 'Select Photo'}
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
