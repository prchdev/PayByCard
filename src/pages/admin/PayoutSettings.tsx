import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Key,
  Building2,
  Banknote,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface PayoutSettings {
  id: string;
  environment: string;
  payout_mode: string;

  cashfree_test_client_id: string;
  cashfree_test_client_secret: string;
  cashfree_production_client_id: string;
  cashfree_production_client_secret: string;
  cashfree_test_2fa_public_key: string;
  cashfree_production_2fa_public_key: string;

  razorpay_test_key_id: string;
  razorpay_test_key_secret: string;
  razorpay_production_key_id: string;
  razorpay_production_key_secret: string;
  razorpay_test_account_number: string;
  razorpay_production_account_number: string;

  axis_test_client_id: string;
  axis_test_client_secret: string;
  axis_production_client_id: string;
  axis_production_client_secret: string;
  axis_test_base_url: string;
  axis_production_base_url: string;
  axis_corporate_id: string;
  axis_channel_id: string;
  axis_test_virtual_account: string;
  axis_production_virtual_account: string;
}

const EMPTY_SETTINGS: PayoutSettings = {
  id: '',
  environment: 'test',
  payout_mode: 'manual',

  cashfree_test_client_id: '',
  cashfree_test_client_secret: '',
  cashfree_production_client_id: '',
  cashfree_production_client_secret: '',
  cashfree_test_2fa_public_key: '',
  cashfree_production_2fa_public_key: '',

  razorpay_test_key_id: '',
  razorpay_test_key_secret: '',
  razorpay_production_key_id: '',
  razorpay_production_key_secret: '',
  razorpay_test_account_number: '',
  razorpay_production_account_number: '',

  axis_test_client_id: '',
  axis_test_client_secret: '',
  axis_production_client_id: '',
  axis_production_client_secret: '',
  axis_test_base_url: 'https://uatapis.axisbank.co.uk',
  axis_production_base_url: 'https://apis.axisbank.co.uk',
  axis_corporate_id: '',
  axis_channel_id: 'TXB',
  axis_test_virtual_account: '',
  axis_production_virtual_account: '',
};

const PAYOUT_MODE_OPTIONS = [
  { value: 'manual', label: 'Manual Payout' },
  { value: 'cashfree_payout', label: 'CashFree Auto Payout' },
  { value: 'cashfree_payment_split', label: 'CashFree Payment Split' },
  { value: 'razorpay_payout', label: 'Razorpay Auto Payout' },
  { value: 'razorpay_payment_split', label: 'Razorpay Payment Split' },
  { value: 'axis_payout', label: 'Axis Bank Auto Payout' },
];

export default function PayoutSettingsPage() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('payout-settings');

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const [settings, setSettings] = useState<PayoutSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payout-settings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId }),
        }
      );
      const data = await response.json();
      if (response.ok && data.settings) {
        setSettings({ ...EMPTY_SETTINGS, ...data.settings });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load payout settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while loading payout settings' });
    } finally {
      setLoading(false);
    }
  };

  const getClientIp = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'Unknown';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const ip_address = await getClientIp();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-payout-settings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId, settings, ip_address }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Payout settings saved successfully' });
        fetchSettings();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save payout settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving payout settings' });
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof PayoutSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payout Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure global payout mode and provider API credentials for fund transfers
          </p>
        </div>

        {/* Alert */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${
              message.type === 'success' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
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

        {/* Global Settings */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl mb-6">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Global Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
              <select
                value={settings.environment}
                onChange={(e) => update('environment', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
              >
                <option value="test">Testing</option>
                <option value="production">Production</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
 Determines which set of provider credentials are used for payouts
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payout Mode</label>
              <select
                value={settings.payout_mode}
                onChange={(e) => update('payout_mode', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
              >
                {PAYOUT_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select how payouts are processed to beneficiaries
              </p>
            </div>
          </div>
        </div>

        {/* CashFree Payout Credentials */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl mb-6">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">CashFree Payout Credentials</h2>
              <p className="text-xs text-gray-500">Cashfree Payout API uses separate credentials from the Payment Gateway API</p>
            </div>
          </div>

          {/* Test Credentials */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">Test</span>
              <span className="text-xs text-gray-500">Used when Environment is set to Testing</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Client ID</label>
                <input
                  type="text"
                  value={settings.cashfree_test_client_id}
                  onChange={(e) => update('cashfree_test_client_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Test Payout Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Client Secret</label>
                <input
                  type="password"
                  value={settings.cashfree_test_client_secret}
                  onChange={(e) => update('cashfree_test_client_secret', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Test Payout Client Secret"
                />
              </div>
            </div>
          </div>

          {/* Production Credentials */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Production</span>
              <span className="text-xs text-gray-500">Used when Environment is set to Production</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Client ID</label>
                <input
                  type="text"
                  value={settings.cashfree_production_client_id}
                  onChange={(e) => update('cashfree_production_client_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Production Payout Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Client Secret</label>
                <input
                  type="password"
                  value={settings.cashfree_production_client_secret}
                  onChange={(e) => update('cashfree_production_client_secret', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Production Payout Client Secret"
                />
              </div>
            </div>
          </div>

          {/* 2FA Public Key */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">2FA</span>
              <span className="text-xs text-gray-500">RSA public key for Cashfree Payout OTP verification (optional)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test 2FA Public Key</label>
                <textarea
                  value={settings.cashfree_test_2fa_public_key}
                  onChange={(e) => update('cashfree_test_2fa_public_key', e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono text-xs resize-y"
                  placeholder={'-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production 2FA Public Key</label>
                <textarea
                  value={settings.cashfree_production_2fa_public_key}
                  onChange={(e) => update('cashfree_production_2fa_public_key', e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono text-xs resize-y"
                  placeholder={'-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Razorpay Payout Credentials */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl mb-6">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Razorpay Payout Credentials</h2>
              <p className="text-xs text-gray-500">RazorPay X Payout API credentials and source account number for fund transfers</p>
            </div>
          </div>

          {/* Test Credentials */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">Test</span>
              <span className="text-xs text-gray-500">Used when Environment is set to Testing</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Payout Key ID</label>
                <input
                  type="text"
                  value={settings.razorpay_test_key_id}
                  onChange={(e) => update('razorpay_test_key_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="rzp_test_..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Payout Key Secret</label>
                <input
                  type="password"
                  value={settings.razorpay_test_key_secret}
                  onChange={(e) => update('razorpay_test_key_secret', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Test Payout Key Secret"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Payout Account Number</label>
                <input
                  type="text"
                  value={settings.razorpay_test_account_number}
                  onChange={(e) => update('razorpay_test_account_number', e.target.value)}
                  className="w-full md:w-1/2 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="RazorPay X test account number"
                />
              </div>
            </div>
          </div>

          {/* Production Credentials */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Production</span>
              <span className="text-xs text-gray-500">Used when Environment is set to Production</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Payout Key ID</label>
                <input
                  type="text"
                  value={settings.razorpay_production_key_id}
                  onChange={(e) => update('razorpay_production_key_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="rzp_live_..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Payout Key Secret</label>
                <input
                  type="password"
                  value={settings.razorpay_production_key_secret}
                  onChange={(e) => update('razorpay_production_key_secret', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Production Payout Key Secret"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Payout Account Number</label>
                <input
                  type="text"
                  value={settings.razorpay_production_account_number}
                  onChange={(e) => update('razorpay_production_account_number', e.target.value)}
                  className="w-full md:w-1/2 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="RazorPay X production account number"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Axis Bank Neo Corporate API */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl mb-6">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Axis Bank Neo Corporate API</h2>
              <p className="text-xs text-gray-500">Axis Bank Corporate Neo API banking credentials for transferring money to beneficiaries</p>
            </div>
          </div>

          {/* Corporate ID */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-[#8c76f0] bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">Corporate</span>
              <span className="text-xs text-gray-500">Shared corporate identifier used across environments</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Corporate ID</label>
                <input
                  type="text"
                  value={settings.axis_corporate_id}
                  onChange={(e) => update('axis_corporate_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Axis Bank Corporate ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel ID</label>
                <input
                  type="text"
                  value={settings.axis_channel_id}
                  onChange={(e) => update('axis_channel_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="TXB"
                />
                <p className="text-xs text-gray-500 mt-1">Channel identifier from Axis Bank (e.g. TXB)</p>
              </div>
            </div>
          </div>

          {/* Test Credentials */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">Test</span>
              <span className="text-xs text-gray-500">Used when Environment is set to Testing</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Client ID</label>
                <input
                  type="text"
                  value={settings.axis_test_client_id}
                  onChange={(e) => update('axis_test_client_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Test Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Client Secret</label>
                <input
                  type="password"
                  value={settings.axis_test_client_secret}
                  onChange={(e) => update('axis_test_client_secret', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Test Client Secret"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Base URL</label>
                <input
                  type="text"
                  value={settings.axis_test_base_url}
                  onChange={(e) => update('axis_test_base_url', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="https://uatapis.axisbank.co.uk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Virtual Account Number</label>
                <input
                  type="text"
                  value={settings.axis_test_virtual_account}
                  onChange={(e) => update('axis_test_virtual_account', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Test Virtual Account Number"
                />
              </div>
            </div>
          </div>

          {/* Production Credentials */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Production</span>
              <span className="text-xs text-gray-500">Used when Environment is set to Production</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Client ID</label>
                <input
                  type="text"
                  value={settings.axis_production_client_id}
                  onChange={(e) => update('axis_production_client_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Production Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Client Secret</label>
                <input
                  type="password"
                  value={settings.axis_production_client_secret}
                  onChange={(e) => update('axis_production_client_secret', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Production Client Secret"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Base URL</label>
                <input
                  type="text"
                  value={settings.axis_production_base_url}
                  onChange={(e) => update('axis_production_base_url', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="https://apis.axisbank.co.uk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Production Virtual Account Number</label>
                <input
                  type="text"
                  value={settings.axis_production_virtual_account}
                  onChange={(e) => update('axis_production_virtual_account', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Enter Production Virtual Account Number"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 pt-6 border-t-2 border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving || !canEdit}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
