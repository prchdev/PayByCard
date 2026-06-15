import React, { useState, useEffect } from 'react';
import { MapPin, Save, CreditCard, ShieldCheck } from 'lucide-react';
import { AddressData, INDIAN_STATES, PROOF_TYPES } from './types';
import StatusBadge from './StatusBadge';
import FileUploadField from './FileUploadField';
import AuditInfo from './AuditInfo';
import { uploadKycFile, saveKycSection } from './useKycData';
import { getClientIp } from '../../utils/getClientIp';

interface AddressSectionProps {
  userId: string;
  data: AddressData | null;
  onSaved: () => void;
}

export default function AddressSection({ userId, data, onSaved }: AddressSectionProps) {
  const isLocked = data?.status === 'verified' || data?.status === 'verification_pending';
  const isRejected = data?.status === 'rejected';
  const isDigiLocker = !!(data?.digilocker_verified);

  const [idNumber, setIdNumber] = useState(data?.id_number ?? '');
  const [address, setAddress] = useState(data?.address ?? '');
  const [city, setCity] = useState(data?.city ?? '');
  const [state, setState] = useState(data?.state ?? '');
  const [pincode, setPincode] = useState(data?.pincode ?? '');
  const [proofType, setProofType] = useState<AddressData['proof_type']>(data?.proof_type ?? '');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIdNumber(data?.id_number ?? '');
    setAddress(data?.address ?? '');
    setCity(data?.city ?? '');
    setState(data?.state ?? '');
    setPincode(data?.pincode ?? '');
    setProofType(data?.proof_type ?? '');
  }, [data]);

  const idNumberLabel = proofType
    ? (PROOF_TYPES.find(p => p.value === proofType)?.label ?? 'Document') + ' Number'
    : 'ID Number';

  const idNumberPlaceholder: Record<string, string> = {
    aadhar: 'Enter 12-digit Aadhaar number',
    passport: 'Enter passport number (e.g. A1234567)',
    voter_id: 'Enter Voter ID number',
    driving_license: 'Enter driving licence number',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!idNumber.trim()) { setError(`${idNumberLabel} is required.`); return; }
    if (proofType === 'aadhar' && !/^\d{12}$/.test(idNumber.replace(/\s/g, ''))) {
      setError('Enter a valid 12-digit Aadhaar number.'); return;
    }

    if (!address.trim()) { setError('Address is required.'); return; }
    if (!/^[A-Za-z0-9 \-.,()]+$/.test(address)) {
      setError('Address may only contain letters, numbers, spaces, and - . , ( )'); return;
    }
    if (address.length > 500) { setError('Address must not exceed 500 characters.'); return; }

    if (!city.trim()) { setError('City is required.'); return; }
    if (!/^[A-Za-z ]+$/.test(city)) { setError('City must contain only letters and spaces.'); return; }
    if (city.length > 20) { setError('City must not exceed 20 characters.'); return; }

    if (!state) { setError('State is required.'); return; }
    if (!pincode.trim() || !/^\d{6}$/.test(pincode)) { setError('Enter a valid 6-digit pincode.'); return; }
    if (!proofType) { setError('Please select a proof document type.'); return; }

    const existingFront = data?.front_photo_url ?? null;
    const existingBack = data?.back_photo_url ?? null;
    if (!isDigiLocker) {
      if (!frontFile && !existingFront) { setError('Front photo of proof document is required.'); return; }
      if (!backFile && !existingBack) { setError('Back photo of proof document is required.'); return; }
    }

    setSaving(true);
    try {
      const ipAddress = await getClientIp();
      let frontUrl = existingFront;
      let backUrl = existingBack;
      if (frontFile) frontUrl = await uploadKycFile(frontFile, userId, 'address_front');
      if (backFile) backUrl = await uploadKycFile(backFile, userId, 'address_back');

      await saveKycSection(userId, 'address', {
        id_number: idNumber.trim(),
        address,
        city,
        state,
        pincode,
        proof_type: proofType,
        front_photo_url: frontUrl,
        back_photo_url: backUrl,
      }, ipAddress);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save address details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] shadow-sm overflow-hidden transition-all">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Address Proof</h3>
            <p className="text-sm text-gray-500">Government-issued address verification document</p>
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
                ? 'Address verification is complete. No changes allowed.'
                : 'Address proof is under review. You cannot make changes until the review is complete.'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-gray-500" />
              {idNumberLabel} <span className="text-red-600">*</span>
            </span>
          </label>
          <input
            type="text"
            value={idNumber}
            onChange={(e) => {
              const v = e.target.value;
              if (proofType === 'aadhar') {
                setIdNumber(v.replace(/\D/g, '').slice(0, 12));
              } else {
                setIdNumber(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20));
              }
            }}
            disabled={isLocked && !isRejected}
            placeholder={idNumberPlaceholder[proofType] ?? 'Enter document ID number'}
            maxLength={proofType === 'aadhar' ? 12 : 20}
            className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm font-mono transition-colors ${
              isLocked && !isRejected
                ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                : 'border-gray-300 focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none'
            }`}
          />
          {proofType === 'aadhar' && idNumber.length > 0 && idNumber.length < 12 && (
            <p className="text-xs text-amber-600 mt-1">{12 - idNumber.length} more digits required</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Full Address <span className="text-red-600">*</span>
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value.replace(/[^A-Za-z0-9 \-.,()]/g, ''))}
            disabled={isLocked && !isRejected}
            rows={3}
            maxLength={500}
            placeholder="House/Flat No., Street, Locality, Landmark"
            className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm resize-none transition-colors ${
              isLocked && !isRejected
                ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                : 'border-gray-300 focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none'
            }`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              City <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value.replace(/[^A-Za-z ]/g, ''))}
              disabled={isLocked && !isRejected}
              maxLength={20}
              placeholder="e.g. Mumbai"
              className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${
                isLocked && !isRejected
                  ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              State <span className="text-red-600">*</span>
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={isLocked && !isRejected}
              className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${
                isLocked && !isRejected
                  ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none'
              }`}
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Pincode <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isLocked && !isRejected}
              placeholder="6-digit pincode"
              maxLength={6}
              className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm font-mono transition-colors ${
                isLocked && !isRejected
                  ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Proof Document Type <span className="text-red-600">*</span>
            </label>
            <select
              value={proofType}
              onChange={(e) => setProofType(e.target.value as AddressData['proof_type'])}
              disabled={isLocked && !isRejected}
              className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${
                isLocked && !isRejected
                  ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none'
              }`}
            >
              <option value="">Select Document</option>
              {PROOF_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {proofType && (
          isDigiLocker ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700">
                Address proof verified electronically via DigiLocker
                {data?.digilocker_provider ? ` (${data.digilocker_provider})` : ''}.
                Document photos are not required.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FileUploadField
                label={`${PROOF_TYPES.find(p => p.value === proofType)?.label ?? 'Document'} - Front`}
                accept=".png,.jpg,.jpeg"
                existingUrl={data?.front_photo_url ?? null}
                file={frontFile}
                onChange={setFrontFile}
                disabled={isLocked && !isRejected}
                required
              />
              <FileUploadField
                label={`${PROOF_TYPES.find(p => p.value === proofType)?.label ?? 'Document'} - Back`}
                accept=".png,.jpg,.jpeg"
                existingUrl={data?.back_photo_url ?? null}
                file={backFile}
                onChange={setBackFile}
                disabled={isLocked && !isRejected}
                required
              />
            </div>
          )
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
