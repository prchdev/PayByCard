import React, { useState, useEffect } from 'react';
import { User, Save, ShieldCheck } from 'lucide-react';
import { PanData } from './types';
import StatusBadge from './StatusBadge';
import FileUploadField from './FileUploadField';
import AuditInfo from './AuditInfo';
import { uploadKycFile, saveKycSection } from './useKycData';
import { getClientIp } from '../../utils/getClientIp';

interface PanSectionProps {
  userId: string;
  data: PanData | null;
  onSaved: () => void;
}

export default function PanSection({ userId, data, onSaved }: PanSectionProps) {
  const isLocked = data?.status === 'verified' || data?.status === 'verification_pending';
  const isRejected = data?.status === 'rejected';
  const isDigiLocker = !!(data?.digilocker_verified);

  const [panNumber, setPanNumber] = useState(data?.pan_number ?? '');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPanNumber(data?.pan_number ?? '');
  }, [data]);

  const panChanged = panNumber !== (data?.pan_number ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!panNumber.trim()) { setError('PAN number is required.'); return; }

    const panClean = panNumber.toUpperCase();
    if (!/^[A-Z0-9]+$/.test(panClean)) {
      setError('PAN number must contain only letters (A-Z) and numbers.'); return;
    }
    if (panClean.length !== 10) {
      setError('PAN number must be exactly 10 characters.'); return;
    }
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panClean)) {
      setError('Please enter a valid PAN number (e.g., ABCDE1234F).'); return;
    }

    if (panChanged && !panFile && !data?.pan_photo_url) {
      setError('PAN card photo is required when updating PAN number.'); return;
    }
    if (panChanged && !panFile) {
      setError('Please upload a new PAN card photo when changing the PAN number.'); return;
    }

    setSaving(true);
    try {
      const ipAddress = await getClientIp();
      let photoUrl = data?.pan_photo_url ?? null;
      if (panFile) {
        photoUrl = await uploadKycFile(panFile, userId, 'pan_photo');
      }
      await saveKycSection(userId, 'pan', {
        pan_number: panNumber.toUpperCase(),
        pan_photo_url: photoUrl,
      }, ipAddress);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save PAN details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] shadow-sm overflow-hidden transition-all">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">PAN Verification</h3>
            <p className="text-sm text-gray-500">Permanent Account Number card details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDigiLocker && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" />
              e-KYC via DigiLocker
            </span>
          )}
          <StatusBadge status={data?.status ?? 'pending'} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
        {data?.status === 'rejected' && data.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-red-700">Rejection Reason</p>
            <p className="text-sm text-red-600 mt-1">{data.rejection_reason}</p>
            <p className="text-sm text-red-700 mt-2 font-medium">Please update your details and resubmit.</p>
          </div>
        )}

        {isLocked && !isRejected && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-700">
              {data?.status === 'verified'
                ? 'PAN verification is complete. No changes allowed.'
                : 'PAN is under review. You cannot make changes until the review is complete.'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            PAN Card Number <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
            disabled={isLocked && !isRejected}
            maxLength={10}
            placeholder="ABCDE1234F"
            className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm font-mono tracking-widest uppercase transition-colors ${
              isLocked && !isRejected
                ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                : 'border-gray-300 focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none'
            }`}
          />
        </div>

        {isDigiLocker ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700">
              PAN verified electronically via DigiLocker
              {data?.digilocker_provider ? ` (${data.digilocker_provider})` : ''}.
              Document photo is not required.
            </p>
          </div>
        ) : (
          <FileUploadField
            label="PAN Card Photo"
            accept=".png,.jpg,.jpeg"
            existingUrl={data?.pan_photo_url ?? null}
            file={panFile}
            onChange={setPanFile}
            disabled={isLocked && !isRejected}
            required={panChanged}
          />
        )}

        <AuditInfo
          uploadedAt={data?.uploaded_at}
          uploadIp={data?.upload_ip}
          approvedByAdminId={data?.approved_by_admin_id}
          approvalAt={data?.approval_at}
          approvalIp={data?.approval_ip}
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
        )}

        {(!isLocked || isRejected) && (
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isRejected ? 'Resubmit' : 'Save & Submit'}
          </button>
        )}
      </form>
    </div>
  );
}
