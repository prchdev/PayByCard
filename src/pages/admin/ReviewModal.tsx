import React, { useState, useRef } from 'react';
import { X, CheckCircle, XCircle, ZoomIn, Percent, ShieldOff, Shield, Lock, Unlock, Loader2, Save, FileCode } from 'lucide-react';
import { KycUserEntry, KycStatus } from './types';
import KycStatusBadge from './KycStatusBadge';

interface ReviewModalProps {
  entry: KycUserEntry;
  onClose: () => void;
  onReview: (recordId: string, table: string, action: 'verified' | 'rejected', reason?: string, surgeCharge?: number) => Promise<void>;
  onAccountAction?: (userId: string, action: string, reason?: string) => Promise<void>;
  canEdit?: boolean;
}

function DocImage({ url, label }: { url: string | null; label: string }) {
  const [zoomed, setZoomed] = useState(false);

  if (!url) return (
    <div className="bg-slate-100 rounded-lg h-32 flex items-center justify-center text-slate-400 text-sm">
      No {label} uploaded
    </div>
  );

  const lower = url.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || lower.includes('.pdf?');
  const isXml = lower.endsWith('.xml') || lower.includes('.xml?');
  const isJson = lower.endsWith('.json') || lower.includes('.json?');

  if (isJson) {
    return (
      <div className="space-y-2">
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 flex flex-col items-center justify-center h-32">
          <FileCode className="w-12 h-12 text-blue-600 mb-2" />
          <p className="text-sm font-medium text-blue-800">DigiLocker JSON</p>
          <p className="text-xs text-blue-600 mt-0.5">Verified document</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Download {label}
        </a>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="space-y-2">
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex flex-col items-center justify-center h-32">
          <svg className="w-12 h-12 text-red-600 mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-slate-700">PDF Document</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-blue-600 hover:text-blue-700 underline"
        >
          View {label}
        </a>
      </div>
    );
  }

  if (isXml) {
    return (
      <div className="space-y-2">
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 flex flex-col items-center justify-center h-32">
          <FileCode className="w-12 h-12 text-emerald-600 mb-2" />
          <p className="text-sm font-medium text-emerald-800">DigiLocker XML</p>
          <p className="text-xs text-emerald-600 mt-0.5">Verified document</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-emerald-600 hover:text-emerald-700 underline"
        >
          Download {label} XML
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setZoomed(true)}>
        <img
          src={url}
          alt={label}
          className="w-full h-36 object-cover rounded-lg border border-slate-200 group-hover:opacity-90 transition-opacity"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
          <ZoomIn className="w-6 h-6 text-white" />
        </div>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomed(false)}
        >
          <img src={url} alt={label} className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors"
            onClick={() => setZoomed(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}

function fmtDateTime(val: string | null | undefined): string {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

interface AuditRowProps {
  uploadedAt: string | null | undefined;
  uploadIp: string | null | undefined;
  approvalAt: string | null | undefined;
  approvalIp: string | null | undefined;
  digilockerVerified: boolean | null | undefined;
  digilockerProvider: string | null | undefined;
}

function AuditInfo({ uploadedAt, uploadIp, approvalAt, approvalIp, digilockerVerified, digilockerProvider }: AuditRowProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
      {digilockerVerified && (
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 font-semibold rounded-md">
            <FileCode className="w-3 h-3" /> DigiLocker Verified
          </span>
          {digilockerProvider && <span className="text-slate-500">{digilockerProvider}</span>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Submitted At</p>
          <p className="text-slate-700">{fmtDateTime(uploadedAt)}</p>
        </div>
        <div>
          <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Submitted From IP</p>
          <p className="text-slate-700 font-mono">{uploadIp || '—'}</p>
        </div>
        {approvalAt && (
          <div>
            <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Verified At</p>
            <p className="text-slate-700">{fmtDateTime(approvalAt)}</p>
          </div>
        )}
        {approvalIp && (
          <div>
            <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Verified From IP</p>
            <p className="text-slate-700 font-mono">{approvalIp}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionReviewProps {
  title: string;
  recordId: string | undefined;
  table: string;
  status: KycStatus | undefined | null;
  rejectionReason: string | null | undefined;
  onReview: (recordId: string, table: string, action: 'verified' | 'rejected', reason?: string, surgeCharge?: number) => Promise<void>;
  children: React.ReactNode;
  hasDocuments?: boolean;
  isBusinessSection?: boolean;
  surgeChargeRef?: React.MutableRefObject<number>;
  canEdit?: boolean;
}

function SectionReview({ title, recordId, table, status, rejectionReason, onReview, children, hasDocuments, isBusinessSection = false, surgeChargeRef, canEdit = true }: SectionReviewProps) {
  const [rejReason, setRejReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<KycStatus | null>(null);
  const displayStatus = optimisticStatus ?? status;

  const handleAction = async (action: 'verified' | 'rejected') => {
    if (!recordId) {
      setError('No record ID found');
      return;
    }

    if (action === 'rejected' && !rejReason.trim()) {
      setShowRejectInput(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    setOptimisticStatus(action);

    try {
      const surgeCharge = isBusinessSection && surgeChargeRef ? surgeChargeRef.current : undefined;
      await onReview(recordId, table, action, action === 'rejected' ? rejReason : undefined, surgeCharge);
      setShowRejectInput(false);
      setRejReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
      setOptimisticStatus(null);
    } finally {
      setSubmitting(false);
    }
  };

  const canReview =
    displayStatus === 'verification_pending' ||
    (hasDocuments && (displayStatus === 'pending' || !displayStatus));

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="font-semibold text-slate-700 text-sm">{title}</span>
        <KycStatusBadge status={displayStatus} />
      </div>

      <div className="p-4 space-y-4">
        {children}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        {rejectionReason && displayStatus === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <span className="font-medium">Rejection reason:</span> {rejectionReason}
          </div>
        )}

        {canReview && !optimisticStatus && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            {showRejectInput && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rejection Reason</label>
                <textarea
                  value={rejReason}
                  onChange={(e) => setRejReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  rows={2}
                  placeholder="Explain why this document is being rejected..."
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                disabled={submitting || !canEdit}
                onClick={() => handleAction('verified')}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {submitting ? 'Approving...' : 'Approve'}
              </button>
              <button
                disabled={submitting || !canEdit}
                onClick={() => showRejectInput ? handleAction('rejected') : setShowRejectInput(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {showRejectInput ? 'Confirm Reject' : 'Reject'}
              </button>
              {showRejectInput && (
                <button
                  onClick={() => { setShowRejectInput(false); setRejReason(''); }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewModal({ entry, onClose, onReview, onAccountAction, canEdit = true }: ReviewModalProps) {
  const { user, pan, address, business } = entry;
  const surgeChargeRef = useRef<number>(business?.business_category_surge_charge ?? 0);
  const [surgeChargeInput, setSurgeChargeInput] = useState<string>(
    String(business?.business_category_surge_charge ?? 0)
  );
  const [surgeChargeSaving, setSurgeChargeSaving] = useState(false);
  const [surgeChargeSaved, setSurgeChargeSaved] = useState(false);
  const [surgeChargeError, setSurgeChargeError] = useState<string | null>(null);
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const [accountActionLoading, setAccountActionLoading] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);
  const [showReasonInput, setShowReasonInput] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');

  const hasBusinessDocs = business && (business.incorporation_certificate_url || business.company_pan_photo_url || business.gst_certificate_url || business.loa_url);

  const handleReview = async (recordId: string, table: string, action: 'verified' | 'rejected', reason?: string, surgeCharge?: number) => {
    await onReview(recordId, table, action, reason, surgeCharge);
  };

  const handleSaveSurgeCharge = async () => {
    if (!business?.id) return;
    const value = parseFloat(surgeChargeInput);
    if (isNaN(value) || value < 0 || value > 100) {
      setSurgeChargeError('Enter a valid number between 0 and 100');
      return;
    }
    setSurgeChargeSaving(true);
    setSurgeChargeError(null);
    setSurgeChargeSaved(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-surge-charge`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId, recordId: business.id, surgeCharge: value }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      surgeChargeRef.current = value;
      setSurgeChargeSaved(true);
      setTimeout(() => setSurgeChargeSaved(false), 2500);
    } catch (err) {
      setSurgeChargeError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSurgeChargeSaving(false);
    }
  };

  const handleAccountAction = async (action: string) => {
    if ((action === 'disable' || action === 'restrict') && !showReasonInput) {
      setShowReasonInput(action);
      return;
    }

    if (!onAccountAction) return;

    setAccountActionLoading(action);
    setAccountActionError(null);
    try {
      await onAccountAction(user.id, action, actionReason || undefined);
      setShowReasonInput(null);
      setActionReason('');
    } catch (err) {
      setAccountActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setAccountActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')}
            </h2>
            <p className="text-sm text-slate-500">{user.email} &middot; {user.mobile_number}</p>
            <div className="flex gap-2 mt-1.5">
              {user.is_disabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-md">
                  <ShieldOff className="w-3 h-3" /> Disabled
                </span>
              )}
              {user.is_restricted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-md">
                  <Lock className="w-3 h-3" /> Restricted
                </span>
              )}
              {!user.is_disabled && !user.is_restricted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-md">
                  <Shield className="w-3 h-3" /> Active
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {pan && (
            <SectionReview
              title="PAN Verification (Required)"
              recordId={pan.id}
              table="kyc_pan_verification"
              status={pan.status}
              rejectionReason={pan.rejection_reason}
              onReview={handleReview}
              canEdit={canEdit}
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">PAN Number</p>
                  <p className="font-mono font-semibold text-slate-800">{pan.pan_number || '—'}</p>
                </div>
              </div>
              <DocImage url={pan.pan_photo_url} label="PAN Card" />
              <AuditInfo
                uploadedAt={pan.uploaded_at}
                uploadIp={pan.upload_ip}
                approvalAt={pan.approval_at}
                approvalIp={pan.approval_ip}
                digilockerVerified={pan.digilocker_verified}
                digilockerProvider={pan.digilocker_provider}
              />
            </SectionReview>
          )}

          {address && (
            <SectionReview
              title="Address Proof (Required)"
              recordId={address.id}
              table="kyc_address_proof"
              status={address.status}
              rejectionReason={address.rejection_reason}
              onReview={handleReview}
              canEdit={canEdit}
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Proof Type</p>
                  <p className="text-slate-800 capitalize">{address.proof_type?.replace('_', ' ') || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">
                    {address.proof_type === 'aadhar' ? 'Aadhaar Number' :
                     address.proof_type === 'passport' ? 'Passport Number' :
                     address.proof_type === 'voter_id' ? 'Voter ID Number' :
                     address.proof_type === 'driving_license' ? 'Licence Number' :
                     'ID Number'}
                  </p>
                  <p className="font-mono font-semibold text-slate-800">{address.id_number || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Address</p>
                  <p className="text-slate-800">{address.address || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">City</p>
                  <p className="text-slate-800">{address.city || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">State</p>
                  <p className="text-slate-800">{address.state || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Pincode</p>
                  <p className="text-slate-800">{address.pincode || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DocImage url={address.front_photo_url} label="Front" />
                <DocImage url={address.back_photo_url} label="Back" />
              </div>
              <AuditInfo
                uploadedAt={address.uploaded_at}
                uploadIp={address.upload_ip}
                approvalAt={address.approval_at}
                approvalIp={address.approval_ip}
                digilockerVerified={address.digilocker_verified}
                digilockerProvider={address.digilocker_provider}
              />
            </SectionReview>
          )}

          {business && hasBusinessDocs && (
            <SectionReview
              title="Business Information (Optional)"
              recordId={business.id}
              table="kyc_business_info"
              status={business.status}
              rejectionReason={business.rejection_reason}
              onReview={handleReview}
              hasDocuments={true}
              isBusinessSection={true}
              surgeChargeRef={surgeChargeRef}
              canEdit={canEdit}
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Company Type</p>
                  <p className="text-slate-800">{business.company_type || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Business Name</p>
                  <p className="text-slate-800">{business.business_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Incorporation Number</p>
                  <p className="font-mono text-slate-800">{business.incorporation_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Business PAN</p>
                  <p className="font-mono font-semibold text-slate-800">{business.business_pan || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">GST Number</p>
                  <p className="font-mono text-slate-800">{business.gst_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Business Phone</p>
                  <p className="font-mono text-slate-800">{business.business_phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Business Email</p>
                  <p className="text-slate-800 break-all">{business.business_email || '—'}</p>
                </div>
                {business.business_address && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Business Address</p>
                    <p className="text-slate-800 whitespace-pre-line">{business.business_address}</p>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="grid grid-cols-2 gap-3">
                {business.incorporation_certificate_url && (
                  <DocImage url={business.incorporation_certificate_url} label="Incorporation Certificate" />
                )}
                {business.company_pan_photo_url && (
                  <DocImage url={business.company_pan_photo_url} label="Company PAN Photo" />
                )}
                {business.gst_certificate_url && (
                  <DocImage url={business.gst_certificate_url} label="GST Certificate" />
                )}
                {business.loa_url && (
                  <DocImage url={business.loa_url} label="Letter of Authorization (LoA)" />
                )}
                {business.moa_url && (
                  <DocImage url={business.moa_url} label="Memorandum of Association (MoA)" />
                )}
                {business.aoa_url && (
                  <DocImage url={business.aoa_url} label="Articles of Association (AoA)" />
                )}
              </div>

              {/* Business Category Surge Charge */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-amber-600" />
                  <label className="text-sm font-medium text-amber-900">
                    Business Category Surge Charge (%) <span className="text-red-600">*</span>
                  </label>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={surgeChargeInput}
                      onChange={(e) => {
                        setSurgeChargeInput(e.target.value);
                        surgeChargeRef.current = parseFloat(e.target.value) || 0;
                        setSurgeChargeSaved(false);
                        setSurgeChargeError(null);
                      }}
                      step="0.01"
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 pr-8 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 text-sm font-semibold pointer-events-none">%</span>
                  </div>
                  <button
                    onClick={handleSaveSurgeCharge}
                    disabled={surgeChargeSaving}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {surgeChargeSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : surgeChargeSaved ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {surgeChargeSaving ? 'Saving…' : surgeChargeSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
                {surgeChargeError && (
                  <p className="text-xs text-red-600 mt-1.5">{surgeChargeError}</p>
                )}
                {surgeChargeSaved && (
                  <p className="text-xs text-green-700 mt-1.5 font-medium">Surge charge saved successfully.</p>
                )}
                <p className="text-xs text-amber-700 mt-1.5">
                  Additional percentage charged on top of standard fees for this business. Saved value is used as-is for charge calculations (e.g. enter <strong>1.5</strong> for 1.5%).
                </p>
              </div>
            </SectionReview>
          )}

          {/* Account Actions */}
          {onAccountAction && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <span className="font-semibold text-slate-700 text-sm">Account Actions</span>
              </div>
              <div className="p-4 space-y-3">
                {accountActionError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    {accountActionError}
                  </div>
                )}

                {showReasonInput && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Reason for {showReasonInput === 'disable' ? 'disabling' : 'restricting'} account
                    </label>
                    <textarea
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                      rows={2}
                      placeholder={`Enter reason for ${showReasonInput === 'disable' ? 'disabling' : 'restricting'} this account...`}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleAccountAction(showReasonInput)}
                        disabled={!!accountActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {accountActionLoading === showReasonInput ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : showReasonInput === 'disable' ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        Confirm {showReasonInput === 'disable' ? 'Disable' : 'Restrict'}
                      </button>
                      <button
                        onClick={() => { setShowReasonInput(null); setActionReason(''); }}
                        className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!showReasonInput && (
                  <div className="flex flex-wrap gap-2">
                    {user.is_disabled ? (
                      <button
                        onClick={() => handleAccountAction('enable')}
                        disabled={!!accountActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {accountActionLoading === 'enable' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Enable Account
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAccountAction('disable')}
                        disabled={!!accountActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {accountActionLoading === 'disable' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                        Disable Account
                      </button>
                    )}

                    {user.is_restricted ? (
                      <button
                        onClick={() => handleAccountAction('unrestrict')}
                        disabled={!!accountActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {accountActionLoading === 'unrestrict' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        Remove Restriction
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAccountAction('restrict')}
                        disabled={!!accountActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {accountActionLoading === 'restrict' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Restrict Account
                      </button>
                    )}
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-2">
                  Disabled accounts cannot login. Restricted accounts cannot add beneficiaries, bank accounts, or make payments.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
