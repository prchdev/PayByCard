import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, Save, AlertCircle, CheckCircle, Loader2, KeyRound, Eye, EyeOff, Info } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface KycProvider {
  id: string;
  provider_name: string;
  environment: 'testing' | 'production';
  is_enabled: boolean;
  is_default: boolean;
  test_api_key: string;
  test_api_secret: string;
  test_redirect_uri: string;
  test_public_key: string;
  test_public_key_password: string;
  production_api_key: string;
  production_api_secret: string;
  production_redirect_uri: string;
  production_public_key: string;
  production_public_key_password: string;
}

const DEFAULT_PROVIDERS: Omit<KycProvider, 'id'>[] = [
  {
    provider_name: 'DigiLocker',
    environment: 'testing',
    is_enabled: false,
    is_default: false,
    test_api_key: '',
    test_api_secret: '',
    test_redirect_uri: '',
    test_public_key: '',
    test_public_key_password: '',
    production_api_key: '',
    production_api_secret: '',
    production_redirect_uri: '',
    production_public_key: '',
    production_public_key_password: '',
  },
  {
    provider_name: 'CashFree DigiLocker',
    environment: 'testing',
    is_enabled: false,
    is_default: false,
    test_api_key: '',
    test_api_secret: '',
    test_redirect_uri: '',
    test_public_key: '',
    test_public_key_password: '',
    production_api_key: '',
    production_api_secret: '',
    production_redirect_uri: '',
    production_public_key: '',
    production_public_key_password: '',
  },
];

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 pr-10 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function KycMethodSettings() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('kyc-method');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  const [providers, setProviders] = useState<KycProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-kyc-method-settings`,
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
      if (response.ok && data.settings && data.settings.length > 0) {
        setProviders(
          data.settings.map((s: any) => ({
            id: s.id,
            provider_name: s.provider_name,
            environment: s.environment || 'testing',
            is_enabled: s.is_enabled ?? false,
            is_default: s.is_default ?? false,
            test_api_key: s.test_api_key || '',
            test_api_secret: s.test_api_secret || '',
            test_redirect_uri: s.test_redirect_uri || '',
            test_public_key: s.test_public_key || '',
            test_public_key_password: s.test_public_key_password || '',
            production_api_key: s.production_api_key || '',
            production_api_secret: s.production_api_secret || '',
            production_redirect_uri: s.production_redirect_uri || '',
            production_public_key: s.production_public_key || '',
            production_public_key_password: s.production_public_key_password || '',
          }))
        );
      } else {
        setProviders(DEFAULT_PROVIDERS.map((p, i) => ({ ...p, id: String(i) })));
      }
    } catch {
      setProviders(DEFAULT_PROVIDERS.map((p, i) => ({ ...p, id: String(i) })));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-kyc-method-settings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId, providers }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'KYC method settings saved successfully' });
        fetchSettings();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save KYC method settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving KYC method settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateProvider = (index: number, field: keyof KycProvider, value: any) => {
    const updated = [...providers];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'is_default' && value === true) {
      updated.forEach((_, i) => {
        if (i !== index) updated[i] = { ...updated[i], is_default: false };
      });
    }
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
          <h1 className="text-3xl font-bold text-gray-900">KYC Method Settings</h1>
          <p className="text-gray-600 mt-1">Configure DigiLocker and CashFree DigiLocker KYC API credentials and environment</p>
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

        <div className="space-y-6">
          {providers.map((provider, index) => {
            const isCashFree = provider.provider_name === 'CashFree DigiLocker';
            return (
              <div
                key={provider.provider_name}
                className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl"
              >
                {/* Header */}
                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                    <ScanFace className="w-5 h-5 text-[#8c76f0]" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{provider.provider_name}</h2>
                  <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Recommended</span>
                  <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Instant</span>
                </div>

                <div className="space-y-6">
                  {/* Provider-specific info panel */}
                  {!isCashFree ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-blue-900">APISetu / DigiLocker Direct — Required Parameters</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-800">
                            <div>
                              <p className="font-semibold">client_id</p>
                              <p className="text-blue-700">App ID assigned by DigiLocker/APISetu Partner Portal on app registration</p>
                            </div>
                            <div>
                              <p className="font-semibold">client_secret</p>
                              <p className="text-blue-700">App secret key; also used as HMAC-SHA256 key to verify downloaded file integrity</p>
                            </div>
                            <div>
                              <p className="font-semibold">redirect_uri</p>
                              <p className="text-blue-700">Pre-registered callback URL; must match exactly in all OAuth authorize &amp; token calls</p>
                            </div>
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
                            OAuth flow: <code className="bg-blue-100 px-1 rounded">/oauth2/1/authorize</code> → user consent → <code className="bg-blue-100 px-1 rounded">/oauth2/2/token</code> → <code className="bg-blue-100 px-1 rounded">access_token</code> → fetch Aadhaar XML / PAN document
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-sky-900">CashFree DigiLocker — Required Parameters</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-sky-800">
                            <div>
                              <p className="font-semibold">Client ID (x-client-id)</p>
                              <p className="text-sky-700">App ID from your CashFree dashboard under Developers → API Keys</p>
                            </div>
                            <div>
                              <p className="font-semibold">Client Secret (x-client-secret)</p>
                              <p className="text-sky-700">Secret key from CashFree dashboard; keep confidential</p>
                            </div>
                          </div>
                          <p className="text-xs text-sky-700 mt-1">
                            The redirect URI is automatically derived from your app's domain — no need to configure it here. CashFree appends <code className="bg-sky-100 px-1 rounded">?cf_verification_id=...</code> when redirecting back.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Environment, Enabled, Default */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label htmlFor={`environment-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Environment
                      </label>
                      <select
                        id={`environment-${index}`}
                        value={provider.environment}
                        onChange={(e) => updateProvider(index, 'environment', e.target.value as 'testing' | 'production')}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      >
                        <option value="testing">Testing</option>
                        <option value="production">Production</option>
                      </select>
                    </div>

                    <div className="flex items-end pb-2 gap-6">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`enabled-${index}`}
                          checked={provider.is_enabled}
                          onChange={(e) => updateProvider(index, 'is_enabled', e.target.checked)}
                          className="w-5 h-5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] checked:hover:bg-[#7a66d9] checked:hover:border-[#7a66d9] transition-colors cursor-pointer"
                        />
                        <label htmlFor={`enabled-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                          Enabled
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id={`default-${index}`}
                          name="default-provider"
                          checked={provider.is_default}
                          onChange={() => updateProvider(index, 'is_default', true)}
                          className="w-5 h-5 text-[#8c76f0] border-2 border-gray-300 focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 cursor-pointer"
                        />
                        <label htmlFor={`default-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                          Default
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Test Credentials */}
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">Test Environment Credentials</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                      OAuth 2.0 credentials from the{' '}
                      <span className="font-medium text-gray-700">DigiLocker / APISetu Partner Portal</span>
                      {' '}(Sandbox / Test app)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor={`test-api-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                          Client ID <span className="text-gray-400 font-normal">(app_id)</span>
                        </label>
                        <input
                          type="text"
                          id={`test-api-key-${index}`}
                          value={provider.test_api_key}
                          onChange={(e) => updateProvider(index, 'test_api_key', e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                          placeholder="e.g. ABCDEFGH"
                        />
                        <p className="text-xs text-gray-500 mt-1">Issued by DigiLocker Partner Portal during app registration</p>
                      </div>
                      <div>
                        <label htmlFor={`test-api-secret-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                          Client Secret <span className="text-gray-400 font-normal">(app_secret)</span>
                        </label>
                        <PasswordInput
                          id={`test-api-secret-${index}`}
                          value={provider.test_api_secret}
                          onChange={(v) => updateProvider(index, 'test_api_secret', v)}
                          placeholder="Enter Client Secret"
                        />
                        <p className="text-xs text-gray-500 mt-1">Also used as the HMAC-SHA256 key for file integrity verification</p>
                      </div>
                      {!isCashFree && (
                        <div className="md:col-span-2">
                          <label htmlFor={`test-redirect-uri-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                            Redirect URI <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="url"
                            id={`test-redirect-uri-${index}`}
                            value={provider.test_redirect_uri}
                            onChange={(e) => updateProvider(index, 'test_redirect_uri', e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            placeholder="https://yourdomain.com/kyc-verification"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Must match exactly the callback URL registered in your DigiLocker/APISetu Partner Portal app settings.
                            Used in <code className="bg-gray-100 px-1 rounded">/oauth2/1/authorize</code> and <code className="bg-gray-100 px-1 rounded">/oauth2/2/token</code> calls.
                          </p>
                        </div>
                      )}
                    </div>

                    {isCashFree && (
                      <div className="mt-6 border-t border-dashed border-gray-200 pt-5">
                        <div className="flex items-center gap-2 mb-4">
                          <KeyRound className="w-4 h-4 text-[#8c76f0]" />
                          <h3 className="text-sm font-semibold text-gray-900">Test 2FA Public Key</h3>
                          <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="md:col-span-2">
                            <label htmlFor={`test-public-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Public Key Certificate (.pem)
                            </label>
                            <textarea
                              id={`test-public-key-${index}`}
                              value={provider.test_public_key}
                              onChange={(e) => updateProvider(index, 'test_public_key', e.target.value)}
                              rows={4}
                              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono text-xs resize-y"
                              placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                              spellCheck={false}
                            />
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 flex-shrink-0" />
                              Generate in CashFree dashboard: Developers &rarr; Two-Factor Authentication &rarr; Generate Public Key
                            </p>
                          </div>
                          <div>
                            <label htmlFor={`test-public-key-password-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Key Password / Passphrase <span className="text-gray-400 font-normal">(if applicable)</span>
                            </label>
                            <PasswordInput
                              id={`test-public-key-password-${index}`}
                              value={provider.test_public_key_password}
                              onChange={(v) => updateProvider(index, 'test_public_key_password', v)}
                              placeholder="Enter key password if certificate is password-protected"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Production Credentials */}
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">Production Environment Credentials</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                      OAuth 2.0 credentials from the{' '}
                      <span className="font-medium text-gray-700">DigiLocker / APISetu Partner Portal</span>
                      {' '}(Live / Production app)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor={`production-api-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                          Client ID <span className="text-gray-400 font-normal">(app_id)</span>
                        </label>
                        <input
                          type="text"
                          id={`production-api-key-${index}`}
                          value={provider.production_api_key}
                          onChange={(e) => updateProvider(index, 'production_api_key', e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                          placeholder="e.g. ABCDEFGH"
                        />
                        <p className="text-xs text-gray-500 mt-1">Issued by DigiLocker Partner Portal during app registration</p>
                      </div>
                      <div>
                        <label htmlFor={`production-api-secret-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                          Client Secret <span className="text-gray-400 font-normal">(app_secret)</span>
                        </label>
                        <PasswordInput
                          id={`production-api-secret-${index}`}
                          value={provider.production_api_secret}
                          onChange={(v) => updateProvider(index, 'production_api_secret', v)}
                          placeholder="Enter Client Secret"
                        />
                        <p className="text-xs text-gray-500 mt-1">Also used as the HMAC-SHA256 key for file integrity verification</p>
                      </div>
                      {!isCashFree && (
                        <div className="md:col-span-2">
                          <label htmlFor={`production-redirect-uri-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                            Redirect URI <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="url"
                            id={`production-redirect-uri-${index}`}
                            value={provider.production_redirect_uri}
                            onChange={(e) => updateProvider(index, 'production_redirect_uri', e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            placeholder="https://yourdomain.com/kyc-verification"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Must match exactly the callback URL registered in your DigiLocker/APISetu Partner Portal app settings.
                            Used in <code className="bg-gray-100 px-1 rounded">/oauth2/1/authorize</code> and <code className="bg-gray-100 px-1 rounded">/oauth2/2/token</code> calls.
                          </p>
                        </div>
                      )}
                    </div>

                    {isCashFree && (
                      <div className="mt-6 border-t border-dashed border-gray-200 pt-5">
                        <div className="flex items-center gap-2 mb-4">
                          <KeyRound className="w-4 h-4 text-[#8c76f0]" />
                          <h3 className="text-sm font-semibold text-gray-900">Production 2FA Public Key</h3>
                          <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="md:col-span-2">
                            <label htmlFor={`production-public-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Public Key Certificate (.pem)
                            </label>
                            <textarea
                              id={`production-public-key-${index}`}
                              value={provider.production_public_key}
                              onChange={(e) => updateProvider(index, 'production_public_key', e.target.value)}
                              rows={4}
                              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono text-xs resize-y"
                              placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                              spellCheck={false}
                            />
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 flex-shrink-0" />
                              Generate in CashFree dashboard: Developers &rarr; Two-Factor Authentication &rarr; Generate Public Key
                            </p>
                          </div>
                          <div>
                            <label htmlFor={`production-public-key-password-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Key Password / Passphrase <span className="text-gray-400 font-normal">(if applicable)</span>
                            </label>
                            <PasswordInput
                              id={`production-public-key-password-${index}`}
                              value={provider.production_public_key_password}
                              onChange={(v) => updateProvider(index, 'production_public_key_password', v)}
                              placeholder="Enter key password if certificate is password-protected"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
