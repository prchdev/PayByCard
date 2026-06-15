import React, { useState, useEffect } from 'react';
import { Building2, Save, Trash2 } from 'lucide-react';
import { BusinessData, COMPANY_TYPES, COMPANY_TYPES_REQUIRING_INC_CERT } from './types';
import StatusBadge from './StatusBadge';
import FileUploadField from './FileUploadField';
import AuditInfo from './AuditInfo';
import { uploadKycFile, saveKycSection } from './useKycData';
import { getClientIp } from '../../utils/getClientIp';

interface BusinessSectionProps {
  userId: string;
  data: BusinessData | null;
  onSaved: () => void;
}

export default function BusinessSection({ userId, data, onSaved }: BusinessSectionProps) {
  const isLocked = data?.status === 'verified' || data?.status === 'verification_pending';
  const isRejected = data?.status === 'rejected';

  const [companyType, setCompanyType] = useState(data?.company_type ?? '');
  const [businessName, setBusinessName] = useState(data?.business_name ?? '');
  const [incorporationNumber, setIncorporationNumber] = useState(data?.incorporation_number ?? '');
  const [businessPan, setBusinessPan] = useState(data?.business_pan ?? '');
  const [gstNumber, setGstNumber] = useState(data?.gst_number ?? '');
  const [businessAddress, setBusinessAddress] = useState(data?.business_address ?? '');
  const [businessEmail, setBusinessEmail] = useState(data?.business_email ?? '');
  const [businessPhone, setBusinessPhone] = useState(data?.business_phone ?? '');
  const [incCertFile, setIncCertFile] = useState<File | null>(null);
  const [companyPanFile, setCompanyPanFile] = useState<File | null>(null);
  const [gstCertFile, setGstCertFile] = useState<File | null>(null);
  const [loaFile, setLoaFile] = useState<File | null>(null);
  const [moaFile, setMoaFile] = useState<File | null>(null);
  const [aoaFile, setAoaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    setCompanyType(data?.company_type ?? '');
    setBusinessName(data?.business_name ?? '');
    setIncorporationNumber(data?.incorporation_number ?? '');
    setBusinessPan(data?.business_pan ?? '');
    setGstNumber(data?.gst_number ?? '');
    setBusinessAddress(data?.business_address ?? '');
    setBusinessEmail(data?.business_email ?? '');
    setBusinessPhone(data?.business_phone ?? '');
  }, [data]);

  const requiresIncCert = COMPANY_TYPES_REQUIRING_INC_CERT.includes(companyType);
  const requiresGstCert = gstNumber.trim().length > 0;
  const requiresMoaAoa = companyType === 'Private Limited Company' || companyType === 'One Person Company (OPC)';

  const validateFileSize = (file: File | null, maxMB: number): boolean => {
    if (!file) return true;
    return file.size <= maxMB * 1024 * 1024;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!companyType) {
      setError('Please select a Company Type.');
      return;
    }

    if (!businessName.trim()) {
      setError('Business / Company Registration Name is required.');
      return;
    }
    if (!/^[A-Za-z0-9&.\- ]+$/.test(businessName)) {
      setError('Company Name may only contain letters, numbers, &, ., -, and spaces.');
      return;
    }
    if (businessName.length > 150) {
      setError('Company Name must not exceed 150 characters.');
      return;
    }

    if (!incorporationNumber.trim()) {
      setError('Business / Company Incorporation Number is required.');
      return;
    }
    if (!/^[A-Za-z0-9]+$/.test(incorporationNumber)) {
      setError('Incorporation Number (CIN) may only contain letters and numbers.');
      return;
    }
    if (incorporationNumber.length > 21) {
      setError('Incorporation Number (CIN) must not exceed 21 characters.');
      return;
    }

    if (!businessPan.trim()) {
      setError('Business PAN is required.');
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(businessPan)) {
      setError('Business PAN must be in the format AAAAA9999A (10 characters).');
      return;
    }

    if (gstNumber.trim()) {
      if (!/^[A-Za-z0-9]+$/.test(gstNumber)) {
        setError('GST Number may only contain letters and numbers.');
        return;
      }
      if (gstNumber.length !== 15) {
        setError('GST Number must be exactly 15 characters.');
        return;
      }
    }

    if (!businessAddress.trim()) {
      setError('Business Address is required.');
      return;
    }
    if (businessAddress.trim().length < 10) {
      setError('Business Address must be at least 10 characters.');
      return;
    }
    if (businessAddress.length > 500) {
      setError('Business Address must not exceed 500 characters.');
      return;
    }

    if (!businessEmail.trim()) {
      setError('Business Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
      setError('Please enter a valid Business Email address.');
      return;
    }

    if (!businessPhone.trim()) {
      setError('Business Phone Number is required.');
      return;
    }
    if (!/^[0-9]{10}$/.test(businessPhone)) {
      setError('Business Phone Number must be exactly 10 digits.');
      return;
    }

    if (requiresIncCert && !incCertFile && !data?.incorporation_certificate_url) {
      setError('Business / Company Incorporation Certificate is required for ' + companyType + '.');
      return;
    }

    if (!companyPanFile && !data?.company_pan_photo_url) {
      setError('Company PAN Photo is required.');
      return;
    }

    if (requiresGstCert && !gstCertFile && !data?.gst_certificate_url) {
      setError('GST Certificate is required when a GST Number is provided.');
      return;
    }

    if (!loaFile && !data?.loa_url) {
      setError('Letter of Authorization (LoA) is mandatory for business info submission.');
      return;
    }

    if (requiresMoaAoa) {
      if (!moaFile && !data?.moa_url) {
        setError('Memorandum of Association (MoA) is required for ' + companyType + '.');
        return;
      }
      if (!aoaFile && !data?.aoa_url) {
        setError('Articles of Association (AoA) is required for ' + companyType + '.');
        return;
      }
    }

    if (!validateFileSize(incCertFile, 1)) {
      setError('Incorporation Certificate file must be less than 1 MB.');
      return;
    }
    if (!validateFileSize(companyPanFile, 1)) {
      setError('Company PAN Photo file must be less than 1 MB.');
      return;
    }
    if (!validateFileSize(gstCertFile, 1)) {
      setError('GST Certificate file must be less than 1 MB.');
      return;
    }
    if (!validateFileSize(loaFile, 1)) {
      setError('LoA file must be less than 1 MB.');
      return;
    }
    if (!validateFileSize(moaFile, 1)) {
      setError('MoA file must be less than 1 MB.');
      return;
    }
    if (!validateFileSize(aoaFile, 1)) {
      setError('AoA file must be less than 1 MB.');
      return;
    }

    setSaving(true);
    try {
      const ipAddress = await getClientIp();
      let incCertUrl = data?.incorporation_certificate_url ?? null;
      let companyPanUrl = data?.company_pan_photo_url ?? null;
      let gstCertUrl = data?.gst_certificate_url ?? null;
      let loaUrl = data?.loa_url ?? null;
      let moaUrl = data?.moa_url ?? null;
      let aoaUrl = data?.aoa_url ?? null;

      if (incCertFile) incCertUrl = await uploadKycFile(incCertFile, userId, 'inc_certificate');
      if (companyPanFile) companyPanUrl = await uploadKycFile(companyPanFile, userId, 'company_pan_photo');
      if (gstCertFile) gstCertUrl = await uploadKycFile(gstCertFile, userId, 'gst_certificate');
      if (loaFile) loaUrl = await uploadKycFile(loaFile, userId, 'loa');
      if (moaFile) moaUrl = await uploadKycFile(moaFile, userId, 'moa');
      if (aoaFile) aoaUrl = await uploadKycFile(aoaFile, userId, 'aoa');

      await saveKycSection(userId, 'business', {
        company_type: companyType,
        business_name: businessName,
        incorporation_number: incorporationNumber,
        business_pan: businessPan,
        gst_number: gstNumber,
        business_address: businessAddress,
        business_email: businessEmail,
        business_phone: businessPhone,
        incorporation_certificate_url: incCertUrl,
        company_pan_photo_url: companyPanUrl,
        gst_certificate_url: gstCertUrl,
        loa_url: loaUrl,
        moa_url: requiresMoaAoa ? moaUrl : null,
        aoa_url: requiresMoaAoa ? aoaUrl : null,
      }, ipAddress);
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save business details.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setSaved(false);
    setRemoving(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-business-info`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove business information');
      }

      const result = await response.json();
      setSaved(true);
      setShowRemoveConfirm(false);

      if (result.kycVerified) {
        setTimeout(() => {
          onSaved();
        }, 1500);
      } else {
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove business information.');
    } finally {
      setRemoving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border-2 border-gray-300 text-sm focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none transition-colors';
  const lockedClass = `${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`;

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] shadow-sm overflow-hidden transition-all">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Business Information</h3>
            <p className="text-sm text-gray-500">Optional — for registered businesses</p>
          </div>
        </div>
        <StatusBadge status={data?.status ?? 'pending'} />
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Business information is optional. Admin review is required when you upload business documents. Letter of Authorization (LoA) is mandatory for submission.
          </p>
        </div>

        {!isLocked && (loaFile || incCertFile || gstCertFile || companyPanFile || data?.loa_url || data?.incorporation_certificate_url || data?.gst_certificate_url || data?.company_pan_photo_url) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-700">
              <strong>Important:</strong> If your KYC was previously verified, adding or updating business documents will reset your verification status to pending until an admin reviews the new information.
            </p>
          </div>
        )}

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
                ? 'Business information is verified. No changes allowed.'
                : 'Business information is under review. You cannot make changes until the review is complete.'}
            </p>
          </div>
        )}

        {/* Company Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Company Type <span className="text-red-600">*</span>
          </label>
          <select
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value)}
            disabled={isLocked && !isRejected}
            className={`${inputClass} ${isLocked && !isRejected ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
          >
            <option value="">Select Company Type</option>
            {COMPANY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Business Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business / Company Registration Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value.replace(/[^A-Za-z0-9&.\- ]/g, ''))}
            disabled={isLocked && !isRejected}
            maxLength={150}
            placeholder="As per registration certificate"
            className={isLocked && !isRejected ? lockedClass : inputClass}
          />
        </div>

        {/* Incorporation Number + Business PAN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Business / Company Incorporation Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={incorporationNumber}
              onChange={(e) => setIncorporationNumber(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
              disabled={isLocked && !isRejected}
              maxLength={21}
              placeholder="CIN / LLP / Firm Number"
              className={`${isLocked && !isRejected ? lockedClass : inputClass} font-mono`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Business PAN <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={businessPan}
              onChange={(e) => setBusinessPan(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
              disabled={isLocked && !isRejected}
              maxLength={10}
              placeholder="AAAAA9999A"
              className={`${isLocked && !isRejected ? lockedClass : inputClass} font-mono tracking-widest`}
            />
          </div>
        </div>

        {/* GST Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              GST Number
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
              disabled={isLocked && !isRejected}
              placeholder="15-character GSTIN"
              maxLength={15}
              className={`${isLocked && !isRejected ? lockedClass : inputClass} font-mono tracking-wider`}
            />
          </div>
        </div>

        {/* Business Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business Address <span className="text-red-600">*</span>
          </label>
          <textarea
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            disabled={isLocked && !isRejected}
            rows={3}
            maxLength={500}
            placeholder="Full registered business address"
            className={`${isLocked && !isRejected ? lockedClass : inputClass} resize-none`}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{businessAddress.length}/500</p>
        </div>

        {/* Business Email + Business Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Business Email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              disabled={isLocked && !isRejected}
              placeholder="contact@yourbusiness.com"
              className={isLocked && !isRejected ? lockedClass : inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Business Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              disabled={isLocked && !isRejected}
              maxLength={10}
              placeholder="10-digit number"
              className={`${isLocked && !isRejected ? lockedClass : inputClass} font-mono tracking-wider`}
            />
          </div>
        </div>

        {/* Inc Certificate + Company PAN Photo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Business / Company Incorporation Certificate"
            accept=".pdf"
            existingUrl={data?.incorporation_certificate_url ?? null}
            file={incCertFile}
            onChange={setIncCertFile}
            disabled={isLocked && !isRejected}
            required={requiresIncCert}
          />
          <div>
            <FileUploadField
              label="Company PAN Photo"
              accept=".pdf,.jpg,.jpeg,.png"
              existingUrl={data?.company_pan_photo_url ?? null}
              file={companyPanFile}
              onChange={setCompanyPanFile}
              disabled={isLocked && !isRejected}
              required
            />
            <p className="text-xs text-gray-500 mt-1">PDF or image. Max 1 MB.</p>
          </div>
        </div>

        {/* GST Certificate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="GST Certificate"
            accept=".pdf"
            existingUrl={data?.gst_certificate_url ?? null}
            file={gstCertFile}
            onChange={setGstCertFile}
            disabled={isLocked && !isRejected}
            required={requiresGstCert}
          />
        </div>

        {/* LoA - Mandatory */}
        <div>
          <FileUploadField
            label="Letter of Authorization (LoA) *"
            accept=".pdf,.jpg,.jpeg,.png"
            existingUrl={data?.loa_url ?? null}
            file={loaFile}
            onChange={setLoaFile}
            disabled={isLocked && !isRejected}
          />
          <p className="text-xs text-gray-500 mt-1">Accepts PDF or image files. Max 1 MB.</p>
        </div>

        {/* MoA and AoA - conditional */}
        {requiresMoaAoa && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FileUploadField
                label="Memorandum of Association (MoA) *"
                accept=".pdf"
                existingUrl={data?.moa_url ?? null}
                file={moaFile}
                onChange={setMoaFile}
                disabled={isLocked && !isRejected}
              />
              <p className="text-xs text-gray-500 mt-1">PDF only. Max 1 MB.</p>
            </div>
            <div>
              <FileUploadField
                label="Articles of Association (AoA) *"
                accept=".pdf"
                existingUrl={data?.aoa_url ?? null}
                file={aoaFile}
                onChange={setAoaFile}
                disabled={isLocked && !isRejected}
              />
              <p className="text-xs text-gray-500 mt-1">PDF only. Max 1 MB.</p>
            </div>
          </div>
        )}

        <AuditInfo
          uploadedAt={data?.uploaded_at}
          uploadIp={data?.upload_ip}
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
        )}

        {saved && (
          <p className="text-sm text-green-700 bg-green-50 px-4 py-2.5 rounded-xl">Business information saved successfully.</p>
        )}

        {(!isLocked || isRejected) && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || removing}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isRejected ? 'Resubmit Business Info' : 'Save Business Info'}
            </button>

            {isRejected && (
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={saving || removing}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remove Business Information
              </button>
            )}
          </div>
        )}
      </form>

      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Business Information?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete your business information from the database. If your PAN and Address verifications are both approved, your KYC will be automatically verified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                disabled={removing}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {removing ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
