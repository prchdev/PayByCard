import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Save, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface SMSSettings {
  id: string;
  send_otp_sms: boolean;
  send_transactional_sms: boolean;
  sender_id: string;
  dlt_entity_id: string;
  tpl_otp: string;
  tpl_merchant_onboarding: string;
  tpl_kyc_approved: string;
  tpl_kyc_rejected: string;
  tpl_payment_settled: string;
  tpl_payment_refund: string;
  tpl_payment_initiated: string;
}

interface SMSProvider {
  id: string;
  provider_name: string;
  is_enabled: boolean;
  is_default: boolean;
  api_key: string;
  otp_template_id: string;
  transactional_template_id: string;
  dlt_kyc_approved: string;
  dlt_kyc_rejected: string;
  dlt_payment_initiated: string;
  dlt_payment_settled: string;
  dlt_payment_refund: string;
}

const CRITICAL_TEMPLATES = [
  { field: 'tpl_otp' as keyof SMSSettings, label: 'OTP Template', placeholder: 'Your OTP is {#otp#}. Valid for 10 minutes. Do not share.' },
  { field: 'tpl_merchant_onboarding' as keyof SMSSettings, label: 'Merchant Onboarding', placeholder: 'Complete your merchant onboarding at {#link#}. Valid for {#hours#} hours.' },
];

const OPTIONAL_TEMPLATES = [
  { field: 'tpl_kyc_approved' as keyof SMSSettings, label: 'KYC Approved', placeholder: 'Your KYC has been approved. You can now make payments on PayByCard.' },
  { field: 'tpl_kyc_rejected' as keyof SMSSettings, label: 'KYC Rejected', placeholder: 'Your KYC has been rejected. Please login and resubmit your documents.' },
  { field: 'tpl_payment_initiated' as keyof SMSSettings, label: 'Payment Initiated', placeholder: 'Payment of Rs.{#amount#} initiated to {#name#}. Ref: {#ref#}.' },
  { field: 'tpl_payment_settled' as keyof SMSSettings, label: 'Payment Settled', placeholder: 'Payment of Rs.{#amount#} to {#name#} has been settled. Ref: {#ref#}.' },
  { field: 'tpl_payment_refund' as keyof SMSSettings, label: 'Payment Refund', placeholder: 'Refund of Rs.{#amount#} for Ref: {#ref#} has been processed.' },
];

const PROVIDER_DLT_FIELDS = [
  { field: 'otp_template_id' as keyof SMSProvider, label: 'DLT Content Template ID (OTP)' },
  { field: 'transactional_template_id' as keyof SMSProvider, label: 'DLT Content Template ID (Merchant Onboarding)' },
  { field: 'dlt_kyc_approved' as keyof SMSProvider, label: 'DLT Content Template ID (KYC Approved)' },
  { field: 'dlt_kyc_rejected' as keyof SMSProvider, label: 'DLT Content Template ID (KYC Rejected)' },
  { field: 'dlt_payment_initiated' as keyof SMSProvider, label: 'DLT Content Template ID (Payment Initiated)' },
  { field: 'dlt_payment_settled' as keyof SMSProvider, label: 'DLT Content Template ID (Payment Settled)' },
  { field: 'dlt_payment_refund' as keyof SMSProvider, label: 'DLT Content Template ID (Payment Refund)' },
];

function TemplateField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-none text-sm font-mono"
        placeholder={placeholder}
      />
    </div>
  );
}

function ProviderCard({
  provider,
  index,
  onUpdate,
}: {
  provider: SMSProvider;
  index: number;
  onUpdate: (index: number, field: keyof SMSProvider, value: any) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:shadow-xl">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#8c76f0]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{provider.provider_name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {provider.is_enabled ? (provider.is_default ? 'Enabled · Default' : 'Enabled') : 'Disabled'}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-5">
          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={provider.is_enabled}
                onChange={(e) => onUpdate(index, 'is_enabled', e.target.checked)}
                className="w-5 h-5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">Enabled</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={provider.is_default}
                onChange={(e) => onUpdate(index, 'is_default', e.target.checked)}
                className="w-5 h-5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">Default</span>
            </label>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
            <input
              type="password"
              value={provider.api_key}
              onChange={(e) => onUpdate(index, 'api_key', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
              placeholder="Enter API Key"
            />
          </div>

          {/* DLT Template IDs */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">DLT Content Template IDs</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PROVIDER_DLT_FIELDS.map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={(provider[field] as string) || ''}
                    onChange={(e) => onUpdate(index, field, e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono text-sm"
                    placeholder="1234567890123456789"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SMSSettings() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('sms');

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const [settings, setSettings] = useState<SMSSettings | null>(null);
  const [providers, setProviders] = useState<SMSProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const id = sessionStorage.getItem('adminId');
      if (!id) throw new Error('Admin not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-sms-settings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: id }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setSettings(data.settings);
        setProviders(data.providers || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load SMS settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const getClientIp = async () => {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      return (await r.json()).ip;
    } catch { return 'Unknown'; }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const id = sessionStorage.getItem('adminId');
      if (!id) throw new Error('Admin not authenticated');

      const ip_address = await getClientIp();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-sms-settings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: id, settings, providers, ip_address }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'SMS settings updated successfully' });
        fetchSettings();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save SMS settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving SMS settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (field: keyof SMSSettings, value: any) => {
    if (settings) setSettings({ ...settings, [field]: value });
  };

  const updateProvider = (index: number, field: keyof SMSProvider, value: any) => {
    const updated = [...providers];
    if (field === 'is_default' && value === true) {
      updated.forEach((p, i) => { if (i !== index) p.is_default = false; });
    }
    updated[index] = { ...updated[index], [field]: value };
    setProviders(updated);
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
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SMS Settings</h1>
          <p className="text-gray-600 mt-1">Configure SMS providers, templates, and messaging preferences</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            {message.type === 'success'
              ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
            <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>{message.text}</p>
          </div>
        )}

        {settings && (
          <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl mb-6">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Common Controls</h2>
            </div>

            <div className="space-y-6">
              {/* Feature toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-[#8c76f0] hover:bg-purple-50/30 transition-all">
                  <input
                    type="checkbox"
                    checked={settings.send_otp_sms}
                    onChange={(e) => updateSettings('send_otp_sms', e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Critical Service Messages</p>
                    <p className="text-xs text-gray-500 mt-0.5">OTP, Merchant Onboarding</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-[#8c76f0] hover:bg-purple-50/30 transition-all">
                  <input
                    type="checkbox"
                    checked={settings.send_transactional_sms}
                    onChange={(e) => updateSettings('send_transactional_sms', e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Optional Service Messages</p>
                    <p className="text-xs text-gray-500 mt-0.5">KYC updates, Payment notifications</p>
                  </div>
                </label>
              </div>

              {/* Sender ID + DLT Entity ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender ID (Header)</label>
                  <input
                    type="text"
                    value={settings.sender_id}
                    onChange={(e) => updateSettings('sender_id', e.target.value)}
                    maxLength={6}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono tracking-wider"
                    placeholder="PAYBYC"
                  />
                  <p className="text-xs text-gray-500 mt-1">6-character DLT-approved sender ID</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">DLT Entity ID (PE ID)</label>
                  <input
                    type="text"
                    value={settings.dlt_entity_id}
                    onChange={(e) => updateSettings('dlt_entity_id', e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono"
                    placeholder="1234567890123456789"
                  />
                  <p className="text-xs text-gray-500 mt-1">Principal Entity ID registered on DLT platform (TRAI)</p>
                </div>
              </div>

              {/* Critical Service Message Templates */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">Critical Service Message Templates</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="space-y-4">
                  {CRITICAL_TEMPLATES.map(({ field, label, placeholder }) => (
                    <TemplateField
                      key={field}
                      label={label}
                      value={(settings[field] as string) || ''}
                      placeholder={placeholder}
                      onChange={(v) => updateSettings(field, v)}
                    />
                  ))}
                </div>
              </div>

              {/* Optional Service Message Templates */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">Optional Service Message Templates</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="space-y-4">
                  {OPTIONAL_TEMPLATES.map(({ field, label, placeholder }) => (
                    <TemplateField
                      key={field}
                      label={label}
                      value={(settings[field] as string) || ''}
                      placeholder={placeholder}
                      onChange={(v) => updateSettings(field, v)}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-sm text-blue-700">
                  <strong>DLT Compliance:</strong> All SMS messages are sent via DLT-approved routes. Ensure your Sender ID, Entity ID, and Content Template IDs are registered on the DLT portal (JioTrueConnect / Vodafone DLT / Airtel DLT). Use <code className="bg-blue-100 px-1 rounded">{'{#variable#}'}</code> syntax for dynamic values.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Provider Cards */}
        <div className="space-y-6">
          {providers.map((provider, index) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              index={index}
              onUpdate={updateProvider}
            />
          ))}
        </div>

        <div className="mt-8 pt-6 border-t-2 border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving || !canEdit}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Saving...</>
            ) : (
              <><Save className="w-5 h-5" />Save Changes</>
            )}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
