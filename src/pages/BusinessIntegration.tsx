import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Save,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  CreditCard,
  Send,
  Code,
  FileText,
  Upload,
  X,
  FileText as FileIcon,
  ExternalLink,
} from 'lucide-react';
import { useDashboardContext } from '../hooks/useDashboardContext';
import { uploadKycFile } from './kyc/useKycData';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const COMPANY_TYPES = [
  'Sole Proprietorship',
  'Limited Liability Partnership (LLP)',
  'Private Limited Company',
  'One Person Company (OPC)',
  'Public Limited Company',
];

const COMPANY_TYPES_REQUIRING_INC_CERT = [
  'Limited Liability Partnership (LLP)',
  'Private Limited Company',
  'One Person Company (OPC)',
  'Public Limited Company',
];

interface BusinessIntegrationApplication {
  id: string;
  company_type: string;
  business_name: string;
  incorporation_number: string;
  business_pan: string;
  gst_number: string;
  business_address: string;
  business_email: string;
  business_phone: string;
  incorporation_certificate_url: string | null;
  company_pan_photo_url: string | null;
  gst_certificate_url: string | null;
  loa_url: string | null;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

const BENEFITS = [
  {
    icon: CreditCard,
    title: 'Accept Payments Without Restrictions',
    description: 'Without availing on a payment gateway, you can use PayByCard to accept payments from your customers seamlessly.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Send,
    title: 'Make Payments',
    description: 'Use PayByCard Business for payouts using Bulk upload or API — send money to multiple beneficiaries in a few clicks.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Code,
    title: 'API Integration',
    description: 'You can use our API for Payment Gateway and Payout Services by integrating directly into your application.',
    color: 'from-orange-500 to-amber-500',
  },
  {
    icon: FileText,
    title: 'Billing & Invoicing',
    description: 'Every transaction created comes with a GST-compliant invoice for platform usage, ensuring complete tax compliance.',
    color: 'from-purple-500 to-pink-500',
  },
];

export default function BusinessIntegration() {
  const navigate = useNavigate();
  const { userId } = useDashboardContext();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [application, setApplication] = useState<BusinessIntegrationApplication | null>(null);

  // Form fields
  const [companyType, setCompanyType] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [incorporationNumber, setIncorporationNumber] = useState('');
  const [businessPan, setBusinessPan] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // File fields
  const [incCertFile, setIncCertFile] = useState<File | null>(null);
  const [companyPanFile, setCompanyPanFile] = useState<File | null>(null);
  const [gstCertFile, setGstCertFile] = useState<File | null>(null);
  const [loaFile, setLoaFile] = useState<File | null>(null);

  const sessionHeader = sessionStorage.getItem('pbc_session') || localStorage.getItem('pbc_session') || '';

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }
    fetchApplication();
  }, [userId, navigate]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-business-integration`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-session': sessionHeader,
        },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch application');

      if (data.application) {
        const app = data.application as BusinessIntegrationApplication;
        setApplication(app);
        // Pre-fill form fields
        setCompanyType(app.company_type);
        setBusinessName(app.business_name);
        setIncorporationNumber(app.incorporation_number);
        setBusinessPan(app.business_pan);
        setGstNumber(app.gst_number);
        setBusinessAddress(app.business_address);
        setBusinessEmail(app.business_email);
        setBusinessPhone(app.business_phone);
        // If approved, go straight to step 2 (read-only)
        // If rejected, go to step 2 with editable form
        // If pending/in_review, go to step 2 (read-only)
        if (app.status === 'approved' || app.status === 'pending' || app.status === 'in_review') {
          setStep(2);
        } else if (app.status === 'rejected') {
          setStep(2);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const requiresIncCert = COMPANY_TYPES_REQUIRING_INC_CERT.includes(companyType);
  const requiresGstCert = gstNumber.trim().length > 0;

  const isLocked = application != null && (application.status === 'pending' || application.status === 'in_review' || application.status === 'approved');
  const isRejected = application?.status === 'rejected';
  const isApproved = application?.status === 'approved';

  const validateFileSize = (file: File | null, maxMB: number): boolean => {
    if (!file) return true;
    return file.size <= maxMB * 1024 * 1024;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!companyType) { setError('Please select a Company Type.'); return; }
    if (!businessName.trim()) { setError('Business / Company Registration Name is required.'); return; }
    if (!/^[A-Za-z0-9&.\- ]+$/.test(businessName)) { setError('Company Name may only contain letters, numbers, &, ., -, and spaces.'); return; }
    if (businessName.length > 150) { setError('Company Name must not exceed 150 characters.'); return; }
    if (!incorporationNumber.trim()) { setError('Business / Company Incorporation Number is required.'); return; }
    if (!/^[A-Za-z0-9]+$/.test(incorporationNumber)) { setError('Incorporation Number may only contain letters and numbers.'); return; }
    if (incorporationNumber.length > 21) { setError('Incorporation Number must not exceed 21 characters.'); return; }
    if (!businessPan.trim()) { setError('Business PAN is required.'); return; }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(businessPan.toUpperCase())) { setError('Business PAN must be in the format AAAAA9999A (10 characters).'); return; }
    if (gstNumber.trim()) {
      if (!/^[A-Za-z0-9]+$/.test(gstNumber)) { setError('GST Number may only contain letters and numbers.'); return; }
      if (gstNumber.length !== 15) { setError('GST Number must be exactly 15 characters.'); return; }
    }
    if (!businessAddress.trim()) { setError('Business Address is required.'); return; }
    if (businessAddress.trim().length < 10) { setError('Business Address must be at least 10 characters.'); return; }
    if (businessAddress.length > 500) { setError('Business Address must not exceed 500 characters.'); return; }
    if (!businessEmail.trim()) { setError('Business Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) { setError('Please enter a valid Business Email address.'); return; }
    if (!businessPhone.trim()) { setError('Business Phone Number is required.'); return; }
    if (!/^[0-9]{10}$/.test(businessPhone)) { setError('Business Phone Number must be exactly 10 digits.'); return; }

    if (requiresIncCert && !incCertFile && !application?.incorporation_certificate_url) {
      setError('Business / Company Incorporation Certificate is required for ' + companyType + '.'); return;
    }
    if (!companyPanFile && !application?.company_pan_photo_url) {
      setError('Company PAN Photo is required.'); return;
    }
    if (requiresGstCert && !gstCertFile && !application?.gst_certificate_url) {
      setError('GST Certificate is required when a GST Number is provided.'); return;
    }
    if (!loaFile && !application?.loa_url) {
      setError('Letter of Authorization (LoA) is required.'); return;
    }

    if (!validateFileSize(incCertFile, 1)) { setError('Incorporation Certificate file must be less than 1 MB.'); return; }
    if (!validateFileSize(companyPanFile, 1)) { setError('Company PAN Photo file must be less than 1 MB.'); return; }
    if (!validateFileSize(gstCertFile, 1)) { setError('GST Certificate file must be less than 1 MB.'); return; }
    if (!validateFileSize(loaFile, 1)) { setError('LoA file must be less than 1 MB.'); return; }

    setSaving(true);
    try {
      let incCertUrl = application?.incorporation_certificate_url ?? null;
      let companyPanUrl = application?.company_pan_photo_url ?? null;
      let gstCertUrl = application?.gst_certificate_url ?? null;
      let loaUrl = application?.loa_url ?? null;

      if (incCertFile) incCertUrl = await uploadKycFile(incCertFile, userId!, 'biz_inc_certificate');
      if (companyPanFile) companyPanUrl = await uploadKycFile(companyPanFile, userId!, 'biz_company_pan');
      if (gstCertFile) gstCertUrl = await uploadKycFile(gstCertFile, userId!, 'biz_gst_certificate');
      if (loaFile) loaUrl = await uploadKycFile(loaFile, userId!, 'biz_loa');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-business-integration`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-session': sessionHeader,
        },
        body: JSON.stringify({
          userId,
          companyType,
          businessName: businessName.trim(),
          incorporationNumber: incorporationNumber.trim(),
          businessPan: businessPan.toUpperCase(),
          gstNumber: gstNumber.trim(),
          businessAddress: businessAddress.trim(),
          businessEmail: businessEmail.trim(),
          businessPhone: businessPhone.trim(),
          incorporationCertificateUrl: incCertUrl,
          companyPanPhotoUrl: companyPanUrl,
          gstCertificateUrl: gstCertUrl,
          loaUrl: loaUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit application');

      setSaved(true);
      await fetchApplication();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit application.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border-2 border-gray-300 text-sm focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 outline-none transition-colors';
  const lockedClass = `${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`;

  if (loading) {
    return (
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#8c76f0]" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 bg-gradient-to-br from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Apply For Business Integration</h1>
            <p className="text-sm text-gray-500">Unlock PayByCard's full business capabilities</p>
          </div>
        </div>
      </div>

      {/* Status Banner — when application exists */}
      {application && (
        <StatusBanner application={application} />
      )}

      {/* Wizard Steps Indicator */}
      {!(isApproved) && (
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#8c76f0]' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= 1 ? 'bg-[#8c76f0] text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <span className="text-sm font-medium hidden sm:inline">Benefits</span>
          </div>
          <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-[#8c76f0]' : 'bg-gray-200'} transition-colors`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#8c76f0]' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= 2 ? 'bg-[#8c76f0] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <span className="text-sm font-medium hidden sm:inline">Business Details</span>
          </div>
        </div>
      )}

      {/* Step 1 — Benefits (hidden if approved) */}
      {step === 1 && !isApproved && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Why PayByCard for Business?</h2>
            <p className="text-sm text-gray-500 mb-6">Discover the benefits of integrating PayByCard into your business operations.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BENEFITS.map((benefit, i) => (
                <div key={i} className="group rounded-xl border-2 border-gray-200 hover:border-[#8c76f0] p-5 transition-all hover:shadow-md">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${benefit.color} flex items-center justify-center mb-3`}>
                    <benefit.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1.5">{benefit.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Business Form */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Back button — only if not approved and not pending/in_review */}
          {!isLocked && (
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#8c76f0] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Benefits
            </button>
          )}

          <div className="bg-white rounded-2xl border-2 border-gray-200 hover:border-[#8c76f0] shadow-sm overflow-hidden transition-all">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Business Information</h3>
                  <p className="text-sm text-gray-500">Submit your business details for review</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {isLocked && !isRejected && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-amber-700">
                    {isApproved
                      ? 'Your application has been approved. Fields are read-only.'
                      : 'Your application is under review. You cannot make changes until the review is complete.'}
                  </p>
                </div>
              )}

              {isRejected && application?.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-red-700">Application Rejected</p>
                  <p className="text-sm text-red-600 mt-1">{application.rejection_reason}</p>
                  <p className="text-sm text-red-700 mt-2 font-medium">Please update your details and resubmit.</p>
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

              {/* File Uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BizFileUpload
                  label="Business / Company Incorporation Certificate"
                  accept=".pdf"
                  existingUrl={application?.incorporation_certificate_url ?? null}
                  file={incCertFile}
                  onChange={setIncCertFile}
                  disabled={isLocked && !isRejected}
                  required={requiresIncCert}
                />
                <BizFileUpload
                  label="Company PAN Photo"
                  accept=".pdf,.jpg,.jpeg,.png"
                  existingUrl={application?.company_pan_photo_url ?? null}
                  file={companyPanFile}
                  onChange={setCompanyPanFile}
                  disabled={isLocked && !isRejected}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BizFileUpload
                  label="GST Certificate"
                  accept=".pdf"
                  existingUrl={application?.gst_certificate_url ?? null}
                  file={gstCertFile}
                  onChange={setGstCertFile}
                  disabled={isLocked && !isRejected}
                  required={requiresGstCert}
                />
                <BizFileUpload
                  label="Letter of Authorization (LoA)"
                  accept=".pdf,.jpg,.jpeg,.png"
                  existingUrl={application?.loa_url ?? null}
                  file={loaFile}
                  onChange={setLoaFile}
                  disabled={isLocked && !isRejected}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
              )}

              {saved && (
                <p className="text-sm text-green-700 bg-green-50 px-4 py-2.5 rounded-xl">
                  Application submitted successfully. It is now pending review.
                </p>
              )}

              {/* Submit button — hidden when locked (approved/pending/in_review) */}
              {(!isLocked || isRejected) && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Submitting...' : isRejected ? 'Resubmit Application' : 'Submit Application'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Status Banner ─────────────────────────────────────────────────────────────

function StatusBanner({ application }: { application: BusinessIntegrationApplication }) {
  const config = {
    pending: { icon: Clock, label: 'Application In Review', classes: 'bg-blue-50 border-blue-200 text-blue-700', desc: 'Your application has been submitted and is being reviewed by our team.' },
    in_review: { icon: Clock, label: 'Application In Review', classes: 'bg-blue-50 border-blue-200 text-blue-700', desc: 'Your application is being reviewed by our team.' },
    approved: { icon: CheckCircle, label: 'Application Approved', classes: 'bg-green-50 border-green-200 text-green-700', desc: 'Congratulations! Your business integration has been approved.' },
    rejected: { icon: XCircle, label: 'Application Rejected', classes: 'bg-red-50 border-red-200 text-red-700', desc: 'Your application was rejected. Please review the reason below and resubmit.' },
  }[application.status];

  const Icon = config.icon;

  return (
    <div className={`rounded-xl border-2 px-4 py-3 mb-6 flex items-start gap-3 ${config.classes}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-sm">{config.label}</p>
        <p className="text-sm mt-0.5">{config.desc}</p>
        {application.reviewed_at && (
          <p className="text-xs mt-1 opacity-70">
            Reviewed on {new Date(application.reviewed_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </p>
        )}
      </div>
    </div>
  );
}

// ── File Upload Component (self-contained for this page) ─────────────────────

interface BizFileUploadProps {
  label: string;
  accept: string;
  existingUrl: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
  required?: boolean;
}

function BizFileUpload({ label, accept, existingUrl, file, onChange, disabled, required }: BizFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [removedExisting, setRemovedExisting] = useState(false);

  const localPreview = file ? URL.createObjectURL(file) : null;
  const displayUrl = localPreview ?? (removedExisting ? null : existingUrl);
  const isExistingFile = !localPreview && !!existingUrl && !removedExisting;

  const isImage = (() => {
    if (file) return file.type.startsWith('image/');
    if (displayUrl) {
      const ext = displayUrl.split('?')[0].split('.').pop()?.toLowerCase();
      return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp';
    }
    return accept.includes('image') || accept.includes('png') || accept.includes('jpg');
  })();

  const isPdf = (() => {
    if (file) return file.type === 'application/pdf';
    if (displayUrl) {
      const ext = displayUrl.split('?')[0].split('.').pop()?.toLowerCase();
      return ext === 'pdf';
    }
    return accept.includes('pdf');
  })();

  useEffect(() => { if (file) setRemovedExisting(false); }, [file]);
  useEffect(() => { setRemovedExisting(false); }, [existingUrl]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
      </label>

      {displayUrl ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          {isImage ? (
            <div className="relative group">
              <img src={displayUrl} alt={label} className="w-full max-h-44 object-contain p-3 cursor-zoom-in" onClick={() => setLightbox(true)} />
              {!disabled && (
                <button type="button" onClick={() => { onChange(null); setRemovedExisting(true); if (inputRef.current) inputRef.current.value = ''; }}
                  className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors z-10">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : isPdf ? (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileIcon className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">{file ? file.name : 'Uploaded PDF'}</p>
              </div>
              <div className="flex items-center gap-2">
                {isExistingFile && (
                  <a href={existingUrl!} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center text-blue-500 hover:text-blue-700 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {!disabled && (
                  <button type="button" onClick={() => { onChange(null); setRemovedExisting(true); if (inputRef.current) inputRef.current.value = ''; }}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-xl px-4 py-5 flex flex-col items-center gap-2 transition-colors ${
            disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' : 'border-gray-300 hover:border-[#8c76f0] hover:bg-purple-50 cursor-pointer'
          }`}
        >
          <Upload className={`w-5 h-5 ${disabled ? 'text-gray-400' : 'text-[#8c76f0]'}`} />
          <span className="text-sm text-gray-500">{disabled ? 'Upload disabled' : 'Click to upload'}</span>
          <span className="text-xs text-gray-400">{accept.replace(/\./g, '').replace(/,/g, ' / ').toUpperCase()} &bull; Max 1 MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null;
          if (selected && selected.size > 1024 * 1024) {
            setSizeError(`File is ${(selected.size / (1024 * 1024)).toFixed(2)} MB — must be less than 1 MB.`);
            e.target.value = '';
            return;
          }
          setSizeError(null);
          onChange(selected);
        }}
      />

      {sizeError && <p className="mt-1.5 text-xs text-red-600">{sizeError}</p>}

      {lightbox && displayUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={displayUrl} alt={label} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button type="button" onClick={() => setLightbox(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
