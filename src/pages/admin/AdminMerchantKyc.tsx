import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Users, Clock, XCircle, CheckCircle, Search,
  ChevronLeft, ChevronRight, ShieldCheck, X, ZoomIn, Eye,
  AlertCircle, Loader2, FileCode2, Globe, CalendarCheck, ScanFace, CreditCard,
  Download,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';
import { downloadCsv } from '../../utils/csvExport';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function extractKycFilePath(url: string): string | null {
  const marker = '/storage/v1/object/public/kyc-documents/';
  const signMarker = '/storage/v1/object/sign/kyc-documents/';
  let rawPath: string | null = null;
  if (url.includes(marker)) {
    rawPath = url.split(marker)[1];
  } else if (url.includes(signMarker)) {
    rawPath = url.split(signMarker)[1];
  }
  if (!rawPath) return null;
  return rawPath.split('?')[0];
}

function useKycDownload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (url: string) => {
    const filePath = extractKycFilePath(url);
    if (!filePath) return null;
    const adminId = sessionStorage.getItem('adminId') ?? '';
    if (!adminId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/download-kyc-file?filePath=${encodeURIComponent(filePath)}&adminId=${encodeURIComponent(adminId)}`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Download failed');
      return data.signedUrl as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { download, loading, error };
}

type MerchantStatus = 'pending' | 'submitted' | 'verified' | 'rejected' | 'expired' | 'refunded';

interface MerchantRecord {
  id: string;
  token: string;
  payment_id: string | null;
  beneficiary_id: string | null;
  full_name: string;
  email: string;
  mobile: string;
  pan_number: string | null;
  pan_photo_url: string | null;
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  sender_name: string | null;
  category_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  status: MerchantStatus;
  expires_at: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  payment_reference: string | null;
  amount: number | null;
  kyc_method: string | null;
  digilocker_verified: boolean | null;
  digilocker_provider: string | null;
  address_proof_type: string | null;
  ip_address: string | null;
  kyc_completed_at: string | null;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'KYC In Review' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

function StatusBadge({ status }: { status: MerchantStatus }) {
  const map: Record<MerchantStatus, { label: string; cls: string }> = {
    pending:   { label: 'Pending',        cls: 'bg-gray-100 text-gray-700' },
    submitted: { label: 'KYC In Review',  cls: 'bg-amber-100 text-amber-700' },
    verified:  { label: 'KYC Approved',   cls: 'bg-green-100 text-green-700' },
    rejected:  { label: 'KYC Rejected',   cls: 'bg-red-100 text-red-700' },
    expired:   { label: 'Expired',        cls: 'bg-slate-100 text-slateate-600' },
    refunded:  { label: 'Refunded',       cls: 'bg-blue-100 text-blue-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function PanImage({ url, digilockerVerified }: { url: string | null; digilockerVerified?: boolean | null }) {
  const [zoomed, setZoomed] = useState(false);
  const { download, loading, error } = useKycDownload();
  if (!url) {
    if (digilockerVerified) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-800 font-medium">DigiLocker Verified</span>
          <span className="text-xs text-emerald-600">(document not stored)</span>
        </div>
      );
    }
    return <p className="text-sm text-gray-400 italic">No image uploaded</p>;
  }
  const lower = url.toLowerCase();
  const isPdf = lower.includes('.pdf');
  const isXml = lower.endsWith('.xml') || lower.includes('.xml?');
  const isJson = lower.endsWith('.json') || lower.includes('.json?');
  const isDigiLockerDoc = isPdf || isXml || isJson;

  if (isDigiLockerDoc) {
    const label = isXml ? 'XML' : isJson ? 'JSON' : 'PDF';
    return (
      <div className="space-y-1.5">
        <button
          onClick={async () => {
            const signed = await download(url);
            if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode2 className="w-4 h-4" />}
          {loading ? 'Generating...' : `View ${label}`}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  return (
    <>
      <div className="relative group cursor-pointer w-full max-w-xs" onClick={() => setZoomed(true)}>
        <img src={url} alt="PAN Card" className="w-full h-40 object-cover rounded-xl border-2 border-gray-200 group-hover:opacity-90 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-xl">
          <ZoomIn className="w-6 h-6 text-white" />
        </div>
      </div>
      {zoomed && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setZoomed(false)}>
          <div className="relative max-w-3xl w-full">
            <button onClick={() => setZoomed(false)} className="absolute -top-10 right-0 text-white hover:text-gray-300">
              <X className="w-7 h-7" />
            </button>
            <img src={url} alt="PAN Card" className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}

type PayoutResult = { payout: string; error?: string } | null;
type RefundResult = { refund: 'initiated' | 'failed' | 'no_payment' | 'notified'; refund_id?: string; refund_error?: string; message?: string } | null;

function DigiLockerDocLinks({ docs }: { docs: { label: string; subtitle: string; url: string }[] }) {
  const { download, loading } = useKycDownload();
  const [errorIdx, setErrorIdx] = useState<number | null>(null);

  const handleClick = async (e: React.MouseEvent, url: string, idx: number) => {
    e.preventDefault();
    setErrorIdx(null);
    const signed = await download(url);
    if (signed) {
      window.open(signed, '_blank', 'noopener,noreferrer');
    } else {
      setErrorIdx(idx);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
        KYC Documents
      </p>
      <div className="space-y-2">
        {docs.map((doc, idx) => (
          <div key={doc.url}>
            <a
              href="#"
              onClick={(e) => handleClick(e, doc.url, idx)}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors group cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" /> : <FileCode2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800">{doc.label}</p>
                <p className="text-xs text-blue-600 truncate">{doc.subtitle}</p>
              </div>
              <Download className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600 flex-shrink-0" />
            </a>
            {errorIdx === idx && <p className="text-xs text-red-600 mt-1 ml-3">Failed to generate download link</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewModal({
  record,
  onClose,
  onReview,
  canEdit,
}: {
  record: MerchantRecord;
  onClose: () => void;
  onReview: (id: string, action: 'verified' | 'rejected', reason?: string) => Promise<{ payout?: string; refund?: string; refund_id?: string; refund_error?: string; message?: string; error?: string } | null>;
  canEdit: boolean;
}) {
  const [action, setAction] = useState<'verified' | 'rejected' | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payoutResult, setPayoutResult] = useState<PayoutResult>(null);
  const [refundResult, setRefundResult] = useState<RefundResult>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!action) return;
    if (action === 'rejected' && !reason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await onReview(record.id, action, reason.trim() || undefined);
      if (action === 'verified') {
        setPayoutResult(result ? { payout: result.payout ?? '', error: result.error } : null);
        setDone(true);
      } else {
        setRefundResult(result ? {
          refund: (result.refund ?? 'notified') as 'initiated' | 'failed' | 'no_payment' | 'notified',
          refund_id: result.refund_id,
          refund_error: result.refund_error,
          message: result.message,
        } : null);
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const PAYOUT_MESSAGES: Record<string, { label: string; cls: string }> = {
    auto_payout_initiated:           { label: 'Payout initiated automatically via payment gateway.', cls: 'text-green-700 bg-green-50 border-green-200' },
    manual_settlement_pending:       { label: 'Payment queued for manual settlement. Visit Manual Payout to process.', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    auto_payout_failed:              { label: 'Auto-payout failed. Payment queued for manual settlement.', cls: 'text-red-700 bg-red-50 border-red-200' },
    unknown_gateway_manual_fallback: { label: 'Unknown gateway — payment queued for manual settlement.', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    no_payment_linked:               { label: 'KYC approved. No payment linked to this record.', cls: 'text-gray-700 bg-gray-50 border-gray-200' },
    payment_not_found:               { label: 'KYC approved. Associated payment record not found.', cls: 'text-gray-700 bg-gray-50 border-gray-200' },
  };

  const REFUND_MESSAGES: Record<string, { label: string; cls: string }> = {
    initiated:  { label: 'Refund initiated via payment gateway. Amount will reflect in sender\'s account within a few business days.', cls: 'text-green-700 bg-green-50 border-green-200' },
    failed:     { label: 'Gateway refund call failed. Payment has been marked as refunded — please process the refund manually.', cls: 'text-red-700 bg-red-50 border-red-200' },
    no_payment: { label: 'KYC rejected. No linked payment found — no refund required.', cls: 'text-gray-700 bg-gray-50 border-gray-200' },
    notified:   { label: 'KYC rejected. Beneficiary has been notified via email and SMS to re-submit KYC within the remaining time. No refund initiated.', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Merchant KYC Review</h2>
              <p className="text-xs text-gray-500">{record.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Payment & Bank Info */}
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0]/30 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Payment &amp; Bank Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Sender</p>
                <p className="font-medium text-gray-900">{record.sender_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Category</p>
                <p className="font-medium text-gray-900">{record.category_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Reference</p>
                <p className="font-medium text-gray-900 font-mono text-xs">{record.payment_reference || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Amount</p>
                <p className="font-medium text-gray-900">{record.amount != null ? `₹${Number(record.amount).toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Account Number</p>
                <p className="font-medium text-gray-900 font-mono">{record.bank_account_number || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">IFSC Code</p>
                <p className="font-medium text-gray-900 font-mono">{record.bank_ifsc || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Bank Name</p>
                <p className="font-medium text-gray-900">{record.bank_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Branch Name</p>
                <p className="font-medium text-gray-900">{record.bank_branch || '—'}</p>
              </div>
            </div>
          </div>

          {/* Beneficiary Info */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Beneficiary Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Full Name</p>
                <p className="font-medium text-gray-900">{record.full_name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Email</p>
                <p className="font-medium text-gray-900">{record.email || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Mobile</p>
                <p className="font-medium text-gray-900">{record.mobile || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">PAN Number</p>
                <p className="font-medium text-gray-900 font-mono tracking-wider">{record.pan_number || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Status</p>
                <StatusBadge status={record.status} />
              </div>
            </div>
          </div>

          {/* Manual KYC Details */}
          {record.kyc_method !== 'digilocker' && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-800">Manual KYC Details</h3>
                <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Manual Upload</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${record.kyc_completed_at ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CalendarCheck className={`w-4 h-4 flex-shrink-0 mt-0.5 ${record.kyc_completed_at ? 'text-gray-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">KYC Uploaded At</p>
                    <p className="text-gray-900 font-medium text-xs mt-0.5">
                      {record.kyc_completed_at
                        ? new Date(record.kyc_completed_at).toLocaleString('en-IN', {
                            dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata',
                          }) + ' IST'
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${record.ip_address ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                  <Globe className={`w-4 h-4 flex-shrink-0 mt-0.5 ${record.ip_address ? 'text-gray-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">User IP Address</p>
                    <p className="text-gray-900 font-mono text-xs mt-0.5">{record.ip_address || '—'}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">PAN Card Document</p>
                <PanImage url={record.pan_photo_url} digilockerVerified={record.digilocker_verified} />
              </div>
            </div>
          )}

          {/* DigiLocker KYC Details */}
          {record.kyc_method === 'digilocker' && (
            <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-800">DigiLocker KYC Details</h3>
                <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {record.digilocker_provider || 'DigiLocker'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* KYC Datetime */}
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${record.kyc_completed_at ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CalendarCheck className={`w-4 h-4 flex-shrink-0 mt-0.5 ${record.kyc_completed_at ? 'text-gray-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">KYC Completed At</p>
                    <p className="text-gray-900 font-medium text-xs mt-0.5">
                      {record.kyc_completed_at
                        ? new Date(record.kyc_completed_at).toLocaleString('en-IN', {
                            dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata',
                          }) + ' IST'
                        : record.verified_at
                          ? new Date(record.verified_at).toLocaleString('en-IN', {
                              dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata',
                            }) + ' IST'
                          : '—'}
                    </p>
                  </div>
                </div>

                {/* IP Address */}
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${record.ip_address ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                  <Globe className={`w-4 h-4 flex-shrink-0 mt-0.5 ${record.ip_address ? 'text-gray-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">User IP Address</p>
                    <p className="text-gray-900 font-mono text-xs mt-0.5">{record.ip_address || '—'}</p>
                  </div>
                </div>
              </div>

              {/* KYC Documents (XML for DigiLocker direct, JSON for CashFree) */}
              {(() => {
                const isCashFree = (record.digilocker_provider || '').includes('CashFree');
                const docLabel = (url: string) => {
                  if (url.endsWith('.json')) return 'JSON';
                  if (url.endsWith('.xml')) return 'XML';
                  return 'File';
                };
                const docs: { label: string; subtitle: string; url: string }[] = [];
                if (record.pan_photo_url && (record.pan_photo_url.endsWith('.xml') || record.pan_photo_url.endsWith('.json'))) {
                  docs.push({
                    label: isCashFree ? `PAN Data (${docLabel(record.pan_photo_url)})` : `PAN ${docLabel(record.pan_photo_url)}`,
                    subtitle: isCashFree ? 'CashFree PAN response' : 'pan_photo.xml',
                    url: record.pan_photo_url,
                  });
                }
                if (record.aadhaar_front_url) {
                  const proofLabel =
                    record.address_proof_type === 'passport' ? 'Passport' :
                    record.address_proof_type === 'voter_id' ? 'Voter ID' :
                    record.address_proof_type === 'driving_license' ? 'Driving License' : 'Aadhaar';
                  docs.push({
                    label: isCashFree ? `Aadhaar Data (${docLabel(record.aadhaar_front_url)})` : `${proofLabel} ${docLabel(record.aadhaar_front_url)} (Front)`,
                    subtitle: isCashFree ? 'CashFree Aadhaar response' : `${record.address_proof_type || 'aadhar'}_front.xml`,
                    url: record.aadhaar_front_url,
                  });
                }
                if (record.aadhaar_back_url && record.aadhaar_back_url !== record.aadhaar_front_url) {
                  const proofLabel =
                    record.address_proof_type === 'passport' ? 'Passport' :
                    record.address_proof_type === 'voter_id' ? 'Voter ID' :
                    record.address_proof_type === 'driving_license' ? 'Driving License' : 'Aadhaar';
                  docs.push({
                    label: `${proofLabel} ${docLabel(record.aadhaar_back_url)} (Back)`,
                    subtitle: `${record.address_proof_type || 'aadhar'}_back.xml`,
                    url: record.aadhaar_back_url,
                  });
                }
                if (docs.length === 0) {
                  return (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                        KYC Documents
                      </p>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                        <FileCode2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-emerald-800">DigiLocker Verified</p>
                          <p className="text-xs text-emerald-600">Documents were not stored. KYC data was verified via {record.digilocker_provider || 'DigiLocker'}.</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <DigiLockerDocLinks docs={docs} />
                );
              })()}
            </div>
          )}

          {/* Link expiry */}
          {record.expires_at && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              Link expires: {new Date(record.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
            </div>
          )}

          {/* Payout result after approval */}
          {done && action === 'verified' && payoutResult && (
            <div className={`flex flex-col gap-2 text-sm border rounded-xl px-4 py-3 ${
              PAYOUT_MESSAGES[payoutResult.payout]?.cls ?? 'text-gray-700 bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                KYC Approved
              </div>
              <p>{PAYOUT_MESSAGES[payoutResult.payout]?.label ?? `Payout status: ${payoutResult.payout}`}</p>
              {payoutResult.error && <p className="text-xs opacity-75">Detail: {payoutResult.error}</p>}
              <button onClick={onClose} className="mt-1 self-end text-xs font-semibold underline">Close</button>
            </div>
          )}

          {/* Rejection result */}
          {done && action === 'rejected' && refundResult && (
            <div className={`flex flex-col gap-2 text-sm border rounded-xl px-4 py-3 ${
              REFUND_MESSAGES[refundResult.refund]?.cls ?? 'text-gray-700 bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                KYC Rejected
              </div>
              <p>{refundResult.message || REFUND_MESSAGES[refundResult.refund]?.label}</p>
              {refundResult.refund_id && (
                <p className="text-xs opacity-75">Refund ID: {refundResult.refund_id}</p>
              )}
              {refundResult.refund_error && (
                <p className="text-xs opacity-75">Error: {refundResult.refund_error}</p>
              )}
              <button onClick={onClose} className="mt-1 self-end text-xs font-semibold underline">Close</button>
            </div>
          )}

          {/* Action selector — for submitted (KYC In Review) or rejected (re-review after re-submission) records */}
          {(record.status === 'submitted' || record.status === 'rejected') && !done && canEdit && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Decision</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setAction('verified'); setError(''); }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                    action === 'verified'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Approve KYC
                </button>
                <button
                  onClick={() => { setAction('rejected'); setError(''); }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                    action === 'rejected'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <XCircle className="w-4 h-4" /> Reject KYC
                </button>
              </div>

              {action === 'rejected' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Explain why the KYC is being rejected..."
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl text-sm focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-none"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!action || saving}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Submit Decision'}
              </button>
            </div>
          )}

          {/* Pending — KYC not yet submitted by merchant */}
          {record.status === 'pending' && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <Clock className="w-4 h-4 flex-shrink-0" />
              Awaiting merchant to submit KYC details via the onboarding link.
            </div>
          )}

          {/* Already actioned */}
          {record.status === 'verified' && !done && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              KYC approved on {record.verified_at ? new Date(record.verified_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—'}
            </div>
          )}
          {record.status === 'rejected' && record.rejection_reason && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div><strong>Rejection reason:</strong> {record.rejection_reason}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminMerchantKyc() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const { loading: permLoading, canEdit } = useAdminPermission('merchant-kyc');

  const [records, setRecords] = useState<MerchantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MerchantRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  useEffect(() => {
    if (!adminId) { navigate('/admin/login'); return; }
    fetchRecords();
  }, [adminId, statusFilter]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, search, recordsPerPage]);

  const fetchRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-get-merchant-kyc`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, statusFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRecords(data.records || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string, action: 'verified' | 'rejected', reason?: string) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-review-merchant-kyc`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, recordId: id, action, rejectionReason: reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Action failed');
    await fetchRecords();
    return {
      payout: data.payout,
      refund: data.refund,
      refund_id: data.refund_id,
      refund_error: data.refund_error,
      message: data.message,
      error: data.error,
    };
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.full_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.mobile.toLowerCase().includes(q) ||
      (r.pan_number || '').toLowerCase().includes(q) ||
      (r.payment_reference || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    all: records.length,
    submitted: records.filter((r) => r.status === 'submitted').length,
    pending: records.filter((r) => r.status === 'pending').length,
    verified: records.filter((r) => r.status === 'verified').length,
    rejected: records.filter((r) => r.status === 'rejected').length,
    expired: records.filter((r) => r.status === 'expired').length,
  };

  const totalPages = Math.ceil(filtered.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + recordsPerPage);

  const handleDownloadCsv = () => {
    const headers = [
      'Full Name', 'Email', 'Mobile Number', 'Joined Date',
      'PAN Number', 'Payment Reference', 'Category', 'Sender Name',
      'Amount', 'Bank Account Number', 'Bank IFSC', 'Bank Name',
      'KYC Method', 'Status', 'Expires At', 'Verified At', 'Rejection Reason',
    ];
    const rows = filtered.map((r) => [
      r.full_name,
      r.email,
      r.mobile,
      new Date(r.created_at).toLocaleDateString('en-IN'),
      r.pan_number ?? '',
      r.payment_reference ?? '',
      r.category_name ?? '',
      r.sender_name ?? '',
      r.amount != null ? Number(r.amount).toFixed(2) : '',
      r.bank_account_number ?? '',
      r.bank_ifsc ?? '',
      r.bank_name ?? '',
      r.kyc_method ?? '',
      r.status,
      r.expires_at ? new Date(r.expires_at).toLocaleDateString('en-IN') : '',
      r.verified_at ? new Date(r.verified_at).toLocaleDateString('en-IN') : '',
      r.rejection_reason ?? '',
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`merchant-kyc-report-${dateStr}.csv`, headers, rows);
  };

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Merchant KYC Verification</h1>
          <p className="text-gray-600 mt-1">Review and approve merchant onboarding KYC submissions</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{counts.all}</p>
            <p className="text-sm text-gray-500 mt-1">Total submissions</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-amber-300 hover:border-amber-400 p-6 transition-all hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review</span>
            </div>
            <p className="text-3xl font-bold text-amber-700">{counts.submitted}</p>
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

        {/* Table card */}
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
                  placeholder="Search..."
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
                onClick={fetchRecords}
                disabled={loading}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-100">{error}</div>
          )}

          {loading && records.length === 0 ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#8c76f0]" />
              <p className="text-gray-600">Loading merchant KYC data...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-900 font-medium">No records found</p>
              <p className="text-sm mt-1 text-gray-600">Try changing the filter or search query</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Beneficiary</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Contact</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Payment</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">PAN</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Submitted</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map((rec) => (
                      <tr key={rec.id} className="hover:bg-purple-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{rec.full_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{rec.sender_name ? `From: ${rec.sender_name}` : ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900">{rec.email || '—'}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{rec.mobile || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900 font-mono text-xs">{rec.payment_reference || '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{rec.category_name || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-gray-800 tracking-wider">{rec.pan_number || '—'}</p>
                          {rec.pan_photo_url && (
                            <a href={rec.pan_photo_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline mt-0.5 block">
                              View doc
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600">
                            {new Date(rec.created_at).toLocaleDateString('en-IN')}
                          </p>
                          {rec.expires_at && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              Exp: {new Date(rec.expires_at).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={rec.status} />
                          {rec.kyc_method === 'digilocker' && (
                            <span className="mt-1 inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              <ScanFace className="w-3 h-3" /> DigiLocker
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelected(rec)}
                            className={`px-3 py-2 font-medium rounded-lg text-xs transition-opacity hover:opacity-90 ${
                              rec.status === 'submitted'
                                ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {rec.status === 'submitted' && canEdit ? 'Review' : 'View'}
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
                      {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span>records per page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 mr-2">
                      Showing {startIndex + 1}–{Math.min(startIndex + recordsPerPage, filtered.length)} of {filtered.length}
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
                          let pageNum: number;
                          if (totalPages <= 5) pageNum = i + 1;
                          else if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = currentPage - 2 + i;
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

      {selected && (
        <ReviewModal
          record={selected}
          onClose={() => setSelected(null)}
          onReview={handleReview}
          canEdit={canEdit}
        />
      )}
    </AdminLayout>
  );
}
