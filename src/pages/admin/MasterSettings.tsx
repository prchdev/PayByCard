import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Globe,
  Phone,
  Mail,
  FileText,
  Upload,
  CreditCard,
  Search,
  Landmark,
  Smartphone,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface MasterSettingsData {
  id?: string;
  company_name: string;
  address: string;
  cin: string;
  gst_number: string;
  pan: string;
  tan: string;
  company_logo_url: string;
  website_url: string;
  support_email: string;
  phone_number: string;
  bank_beneficiary_name: string;
  bank_ifsc_code: string;
  bank_account_number: string;
  bank_branch_name: string;
  bank_name: string;
  bank_account_type: string;
  mobile_app_enabled: boolean;
}

const EMPTY_SETTINGS: MasterSettingsData = {
  company_name: '',
  address: '',
  cin: '',
  gst_number: '',
  pan: '',
  tan: '',
  company_logo_url: '',
  website_url: '',
  support_email: '',
  phone_number: '',
  bank_beneficiary_name: '',
  bank_ifsc_code: '',
  bank_account_number: '',
  bank_branch_name: '',
  bank_name: '',
  bank_account_type: 'current',
  mobile_app_enabled: true,
};

export default function MasterSettings() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('master-settings');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  const [settings, setSettings] = useState<MasterSettingsData>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [ifscLookupLoading, setIfscLookupLoading] = useState(false);
  const [ifscError, setIfscError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-master-settings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId }),
        }
      );
      const data = await response.json();
      if (response.ok && data.settings) {
        setSettings(data.settings);
        if (data.settings.company_logo_url) {
          setLogoPreview(data.settings.company_logo_url);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Logo file must be less than 2MB' });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string> => {
    if (!logoFile) return settings.company_logo_url;

    const formData = new FormData();
    formData.append('file', logoFile);
    formData.append('userId', 'master-settings');
    formData.append('fileKey', 'company_logo');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-kyc-file`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to upload logo');
    return data.url;
  };

  const handleIfscLookup = async () => {
    const ifsc = settings.bank_ifsc_code.trim().toUpperCase();
    if (!ifsc) return;
    setIfscLookupLoading(true);
    setIfscError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-ifsc`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ifsc }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'IFSC not found');
      setSettings(prev => ({
        ...prev,
        bank_ifsc_code: data.ifsc || ifsc,
        bank_branch_name: data.branch || '',
        bank_name: data.bank || '',
      }));
    } catch (e) {
      setIfscError(e instanceof Error ? e.message : 'IFSC lookup failed');
    } finally {
      setIfscLookupLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      let logoUrl = settings.company_logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-master-settings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId,
            ...settings,
            company_logo_url: logoUrl,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save settings');

      setSettings(data.settings);
      setLogoFile(null);
      setMessage({ type: 'success', text: 'Master settings saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (permLoading) return null;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Master Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage company information used for billing and invoices
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
              {message.text}
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Company Information */}
          <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter company name"
                  required
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Address <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="address"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-none"
                  placeholder="Complete registered address"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="cin" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Identification Number (CIN)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="cin"
                      value={settings.cin}
                      onChange={(e) => setSettings({ ...settings, cin: e.target.value.toUpperCase() })}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono"
                      placeholder="U12345MH2020PTC123456"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="gst_number" className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="gst_number"
                      value={settings.gst_number}
                      onChange={(e) => setSettings({ ...settings, gst_number: e.target.value.toUpperCase() })}
                      maxLength={15}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono tracking-wider"
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="pan" className="block text-sm font-medium text-gray-700 mb-2">
                    PAN
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="pan"
                      value={settings.pan}
                      onChange={(e) => setSettings({ ...settings, pan: e.target.value.toUpperCase() })}
                      maxLength={10}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono tracking-wider"
                      placeholder="AAAAA0000A"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="tan" className="block text-sm font-medium text-gray-700 mb-2">
                    TAN
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="tan"
                      value={settings.tan}
                      onChange={(e) => setSettings({ ...settings, tan: e.target.value.toUpperCase() })}
                      maxLength={10}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono tracking-wider"
                      placeholder="AAAA00000A"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Logo */}
          <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Contact & Branding</h2>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Globe className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      id="website_url"
                      value={settings.website_url}
                      onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      placeholder="https://www.example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="support_email" className="block text-sm font-medium text-gray-700 mb-2">
                    Support Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="support_email"
                      value={settings.support_email}
                      onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      placeholder="support@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone_number"
                      value={settings.phone_number}
                      onChange={(e) => setSettings({ ...settings, phone_number: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Company Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Logo
                </label>
                <div className="flex items-start gap-6">
                  {logoPreview && (
                    <div className="w-24 h-24 border-2 border-gray-200 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
                      <img
                        src={logoPreview}
                        alt="Company logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="flex items-center gap-3 px-5 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#8c76f0] hover:bg-purple-50 transition-all">
                      <Upload className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {logoFile ? logoFile.name : 'Upload company logo'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">PNG, JPG up to 2MB</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Application */}
          <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Mobile Application</h2>
                <p className="text-xs text-gray-500 mt-0.5">Enable or disable access from the mobile app</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Enable Mobile App Access</p>
                <p className="text-xs text-gray-500 mt-1">
                  When enabled, users can log in and transact from the mobile application. When disabled, mobile app access is blocked.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.mobile_app_enabled}
                onClick={() => setSettings({ ...settings, mobile_app_enabled: !settings.mobile_app_enabled })}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${
                  settings.mobile_app_enabled ? 'bg-[#8c76f0]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    settings.mobile_app_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Company Bank Account */}
          <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <Landmark className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Company Bank Account</h2>
                <p className="text-xs text-gray-500 mt-0.5">Used for settlement and payout references</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Beneficiary Name */}
              <div>
                <label htmlFor="bank_beneficiary_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Beneficiary Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="bank_beneficiary_name"
                    value={settings.bank_beneficiary_name}
                    onChange={(e) => setSettings({ ...settings, bank_beneficiary_name: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="Account holder / beneficiary name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* IFSC Code */}
                <div>
                  <label htmlFor="bank_ifsc_code" className="block text-sm font-medium text-gray-700 mb-2">
                    IFSC Code
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="bank_ifsc_code"
                        value={settings.bank_ifsc_code}
                        onChange={(e) => {
                          setSettings({ ...settings, bank_ifsc_code: e.target.value.toUpperCase(), bank_branch_name: '', bank_name: '' });
                          setIfscError('');
                        }}
                        maxLength={11}
                        className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono tracking-wider"
                        placeholder="SBIN0001234"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleIfscLookup(); } }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleIfscLookup}
                      disabled={ifscLookupLoading || !settings.bank_ifsc_code.trim()}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {ifscLookupLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Search className="w-4 h-4" />}
                      Fetch
                    </button>
                  </div>
                  {ifscError && (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {ifscError}
                    </p>
                  )}
                </div>

                {/* Account Number */}
                <div>
                  <label htmlFor="bank_account_number" className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="bank_account_number"
                      value={settings.bank_account_number}
                      onChange={(e) => setSettings({ ...settings, bank_account_number: e.target.value.replace(/\D/g, '') })}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono tracking-wider"
                      placeholder="Enter account number"
                    />
                  </div>
                </div>

                {/* Bank Name (auto-filled) */}
                <div>
                  <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name
                    {settings.bank_name && <span className="ml-2 text-xs text-green-600 font-normal">(auto-filled)</span>}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Landmark className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="bank_name"
                      value={settings.bank_name}
                      onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-gray-50"
                      placeholder="Fetched automatically via IFSC"
                      readOnly={!!settings.bank_name}
                    />
                  </div>
                </div>

                {/* Branch (auto-filled) */}
                <div>
                  <label htmlFor="bank_branch_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Branch
                    {settings.bank_branch_name && <span className="ml-2 text-xs text-green-600 font-normal">(auto-filled)</span>}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Landmark className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="bank_branch_name"
                      value={settings.bank_branch_name}
                      onChange={(e) => setSettings({ ...settings, bank_branch_name: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-gray-50"
                      placeholder="Fetched automatically via IFSC"
                      readOnly={!!settings.bank_branch_name}
                    />
                  </div>
                </div>

                {/* Account Type */}
                <div>
                  <label htmlFor="bank_account_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type
                  </label>
                  <select
                    id="bank_account_type"
                    value={settings.bank_account_type}
                    onChange={(e) => setSettings({ ...settings, bank_account_type: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                  >
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="overdraft">Overdraft Account</option>
                    <option value="cash_credit">Cash Credit Account</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || !canEdit}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Master Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
