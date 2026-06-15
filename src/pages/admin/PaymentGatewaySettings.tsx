import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Save, AlertCircle, CheckCircle, Loader2, Percent, Building2, Key } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface PaymentGateway {
  id: string;
  gateway_name: string;
  environment: string;
  is_enabled: boolean;
  app_id: string;
  secret_key: string;
  test_api_key: string;
  test_api_secret: string;
  production_api_key: string;
  production_api_secret: string;
  supported_cards: string[];
  instant_settlement_cards: string[];
  default_payment_cards: string[];
  instant_settlement_charges: Record<string, number>;
  gst_percentage: number;
  visa_charges: number;
  mastercard_charges: number;
  rupay_charges: number;
  amex_charges: number;
  diners_charges: number;
  payout_charges_inr: number;
  registered_name: string;
  gst_number: string;
  payout_mode: string;
  test_payout_client_id: string;
  test_payout_client_secret: string;
  production_payout_client_id: string;
  production_payout_client_secret: string;
  test_payout_account_number: string;
  production_payout_account_number: string;
  test_cashfree_2fa_public_key: string;
  production_cashfree_2fa_public_key: string;
}

const ALLOWED_GATEWAYS = ['RazorPay', 'CashFree', 'PayU'];
const PAYOUT_GATEWAYS = ['RazorPay', 'CashFree', 'PayU'];

export default function PaymentGatewaySettings() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('payment-gateway');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const adminId = sessionStorage.getItem('adminId');
      if (!adminId) {
        throw new Error('Admin not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-gateways`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_id: adminId }),
      });

      const data = await response.json();

      if (response.ok) {
        const gatewaysData = (data.gateways || [])
          .filter((gw: any) => ALLOWED_GATEWAYS.includes(gw.gateway_name))
          .map((gw: any) => ({
            ...gw,
            test_api_key: gw.test_api_key || '',
            test_api_secret: gw.test_api_secret || '',
            production_api_key: gw.production_api_key || '',
            production_api_secret: gw.production_api_secret || '',
            instant_settlement_charges: gw.instant_settlement_charges || {},
            gst_percentage: gw.gst_percentage || 18,
            visa_charges: gw.visa_charges || 0,
            mastercard_charges: gw.mastercard_charges || 0,
            rupay_charges: gw.rupay_charges || 0,
            amex_charges: gw.amex_charges || 0,
            diners_charges: gw.diners_charges || 0,
            payout_charges_inr: gw.payout_charges_inr || 0,
            registered_name: gw.registered_name || '',
            gst_number: gw.gst_number || '',
            payout_mode: gw.payout_mode || 'payment_split',
            test_payout_client_id: gw.test_payout_client_id || '',
            test_payout_client_secret: gw.test_payout_client_secret || '',
            production_payout_client_id: gw.production_payout_client_id || '',
            production_payout_client_secret: gw.production_payout_client_secret || '',
            test_payout_account_number: gw.test_payout_account_number || '',
            production_payout_account_number: gw.production_payout_account_number || '',
            test_cashfree_2fa_public_key: gw.test_cashfree_2fa_public_key || '',
            production_cashfree_2fa_public_key: gw.production_cashfree_2fa_public_key || '',
          }));
        setGateways(gatewaysData);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load payment gateways' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'An error occurred while loading payment gateways' });
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
      const adminId = sessionStorage.getItem('adminId');
      if (!adminId) {
        throw new Error('Admin not authenticated');
      }

      const ip_address = await getClientIp();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-payment-gateways`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: adminId,
          gateways,
          ip_address
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Payment gateway settings updated successfully' });
        fetchGateways();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save payment gateway settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving payment gateway settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateGateway = (index: number, field: keyof PaymentGateway, value: any) => {
    const updated = [...gateways];
    if (field === 'is_enabled' && value === true) {
      updated.forEach((gw, i) => { if (i !== index) updated[i] = { ...updated[i], is_enabled: false }; });
    }
    updated[index] = { ...updated[index], [field]: value };
    setGateways(updated);
  };

  const updateCharge = (index: number, chargeType: 'instant_settlement_charges', card: string, value: string) => {
    const updated = [...gateways];
    const numValue = parseFloat(value) || 0;
    updated[index][chargeType] = {
      ...updated[index][chargeType],
      [card]: numValue
    };
    setGateways(updated);
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
          <h1 className="text-3xl font-bold text-gray-900">Payment Gateway Settings</h1>
          <p className="text-gray-600 mt-1">Configure payment gateways, credentials, and transaction charges</p>
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
          {gateways.map((gateway, index) => (
            <div key={gateway.id} className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 transition-all hover:shadow-xl">
              <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{gateway.gateway_name}</h2>
              </div>

              <div className="space-y-6">
                {/* Environment and Enabled */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label htmlFor={`environment-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                      Environment
                    </label>
                    <select
                      id={`environment-${index}`}
                      value={gateway.environment}
                      onChange={(e) => updateGateway(index, 'environment', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    >
                      <option value="test">Testing</option>
                      <option value="production">Production</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor={`payout-mode-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                      Payout Mode
                    </label>
                    <select
                      id={`payout-mode-${index}`}
                      value={gateway.payout_mode}
                      onChange={(e) => updateGateway(index, 'payout_mode', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    >
                      <option value="payment_split">Payment Split</option>
                      <option value="manual">Manual Payout</option>
                      <option value="payout">Auto Payout</option>
                    </select>
                  </div>

                  <div className="flex items-end pb-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`enabled-${index}`}
                        checked={gateway.is_enabled}
                        onChange={(e) => updateGateway(index, 'is_enabled', e.target.checked)}
                        className="w-5 h-5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] checked:hover:bg-[#7a66d9] checked:hover:border-[#7a66d9] transition-colors cursor-pointer"
                      />
                      <label htmlFor={`enabled-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                        Enabled
                      </label>
                    </div>
                  </div>
                </div>

                {/* Business Details */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-[#8c76f0]" />
                    <h3 className="text-sm font-semibold text-gray-900">Business Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor={`registered-name-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Registered Name
                      </label>
                      <input
                        type="text"
                        id={`registered-name-${index}`}
                        value={gateway.registered_name}
                        onChange={(e) => updateGateway(index, 'registered_name', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                        placeholder="Company registered name on gateway"
                      />
                    </div>
                    <div>
                      <label htmlFor={`gst-number-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        GST Number
                      </label>
                      <input
                        type="text"
                        id={`gst-number-${index}`}
                        value={gateway.gst_number}
                        onChange={(e) => updateGateway(index, 'gst_number', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                        placeholder="GST number registered on gateway"
                      />
                    </div>
                  </div>
                </div>

                {/* Test Credentials */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Test Environment Credentials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor={`test-api-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Test API Key
                      </label>
                      <input
                        type="text"
                        id={`test-api-key-${index}`}
                        value={gateway.test_api_key}
                        onChange={(e) => updateGateway(index, 'test_api_key', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                        placeholder="Enter Test API Key"
                      />
                    </div>
                    <div>
                      <label htmlFor={`test-api-secret-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Test API Secret
                      </label>
                      <input
                        type="password"
                        id={`test-api-secret-${index}`}
                        value={gateway.test_api_secret}
                        onChange={(e) => updateGateway(index, 'test_api_secret', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                        placeholder="Enter Test API Secret"
                      />
                    </div>
                  </div>
                </div>

                {/* Production Credentials */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Production Environment Credentials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor={`production-api-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Production API Key
                      </label>
                      <input
                        type="text"
                        id={`production-api-key-${index}`}
                        value={gateway.production_api_key}
                        onChange={(e) => updateGateway(index, 'production_api_key', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                        placeholder="Enter Production API Key"
                      />
                    </div>
                    <div>
                      <label htmlFor={`production-api-secret-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Production API Secret
                      </label>
                      <input
                        type="password"
                        id={`production-api-secret-${index}`}
                        value={gateway.production_api_secret}
                        onChange={(e) => updateGateway(index, 'production_api_secret', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                        placeholder="Enter Production API Secret"
                      />
                    </div>
                  </div>
                </div>

                {/* Payout API Credentials — CashFree, RazorPay, PayU */}
                {PAYOUT_GATEWAYS.includes(gateway.gateway_name) && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="w-4 h-4 text-[#8c76f0]" />
                      <h3 className="text-sm font-semibold text-gray-900">Payout API Credentials</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-5">
                      {gateway.gateway_name === 'CashFree'
                        ? 'Cashfree Payout API uses separate credentials from the Payment Gateway API.'
                        : gateway.gateway_name === 'RazorPay'
                        ? 'RazorPay X Payout API credentials and source account number for fund transfers.'
                        : 'Payout API credentials for fund transfer operations.'}
                    </p>

                    {/* Test Payout Credentials */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">Test</span>
                        <span className="text-xs text-gray-500">Used when Environment is set to Testing</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`test-payout-client-id-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                            {gateway.gateway_name === 'RazorPay' ? 'Test Payout Key ID' : 'Test Payout Client ID'}
                          </label>
                          <input
                            type="text"
                            id={`test-payout-client-id-${index}`}
                            value={gateway.test_payout_client_id}
                            onChange={(e) => updateGateway(index, 'test_payout_client_id', e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                            placeholder={gateway.gateway_name === 'RazorPay' ? 'rzp_test_...' : 'Enter Test Payout Client ID'}
                          />
                        </div>
                        <div>
                          <label htmlFor={`test-payout-client-secret-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                            {gateway.gateway_name === 'RazorPay' ? 'Test Payout Key Secret' : 'Test Payout Client Secret'}
                          </label>
                          <input
                            type="password"
                            id={`test-payout-client-secret-${index}`}
                            value={gateway.test_payout_client_secret}
                            onChange={(e) => updateGateway(index, 'test_payout_client_secret', e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                            placeholder="Enter Test Payout Client Secret"
                          />
                        </div>
                        {gateway.gateway_name === 'RazorPay' && (
                          <div className="md:col-span-2">
                            <label htmlFor={`test-payout-account-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Test Payout Account Number
                            </label>
                            <input
                              type="text"
                              id={`test-payout-account-${index}`}
                              value={gateway.test_payout_account_number}
                              onChange={(e) => updateGateway(index, 'test_payout_account_number', e.target.value)}
                              className="w-full md:w-1/2 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                              placeholder="RazorPay X test account number"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Production Payout Credentials */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Production</span>
                        <span className="text-xs text-gray-500">Used when Environment is set to Production</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`prod-payout-client-id-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                            {gateway.gateway_name === 'RazorPay' ? 'Production Payout Key ID' : 'Production Payout Client ID'}
                          </label>
                          <input
                            type="text"
                            id={`prod-payout-client-id-${index}`}
                            value={gateway.production_payout_client_id}
                            onChange={(e) => updateGateway(index, 'production_payout_client_id', e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                            placeholder={gateway.gateway_name === 'RazorPay' ? 'rzp_live_...' : 'Enter Production Payout Client ID'}
                          />
                        </div>
                        <div>
                          <label htmlFor={`prod-payout-client-secret-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                            {gateway.gateway_name === 'RazorPay' ? 'Production Payout Key Secret' : 'Production Payout Client Secret'}
                          </label>
                          <input
                            type="password"
                            id={`prod-payout-client-secret-${index}`}
                            value={gateway.production_payout_client_secret}
                            onChange={(e) => updateGateway(index, 'production_payout_client_secret', e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                            placeholder="Enter Production Payout Client Secret"
                          />
                        </div>
                        {gateway.gateway_name === 'RazorPay' && (
                          <div className="md:col-span-2">
                            <label htmlFor={`prod-payout-account-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Production Payout Account Number
                            </label>
                            <input
                              type="text"
                              id={`prod-payout-account-${index}`}
                              value={gateway.production_payout_account_number}
                              onChange={(e) => updateGateway(index, 'production_payout_account_number', e.target.value)}
                              className="w-full md:w-1/2 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                              placeholder="RazorPay X production account number"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cashfree 2FA Public Key */}
                    {gateway.gateway_name === 'CashFree' && (
                      <div className="mt-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">2FA</span>
                          <span className="text-xs text-gray-500">RSA public key for Cashfree Payout OTP verification (optional)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor={`test-2fa-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Test 2FA Public Key
                            </label>
                            <textarea
                              id={`test-2fa-key-${index}`}
                              value={gateway.test_cashfree_2fa_public_key}
                              onChange={(e) => updateGateway(index, 'test_cashfree_2fa_public_key', e.target.value)}
                              rows={5}
                              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono text-xs resize-y"
                              placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                            />
                          </div>
                          <div>
                            <label htmlFor={`prod-2fa-key-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                              Production 2FA Public Key
                            </label>
                            <textarea
                              id={`prod-2fa-key-${index}`}
                              value={gateway.production_cashfree_2fa_public_key}
                              onChange={(e) => updateGateway(index, 'production_cashfree_2fa_public_key', e.target.value)}
                              rows={5}
                              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono text-xs resize-y"
                              placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Card Charges */}
                <div className="border-t-2 border-gray-200 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Percent className="w-5 h-5 text-[#8c76f0]" />
                    <h3 className="text-base font-semibold text-gray-900">Card Charges Configuration</h3>
                  </div>

                  <div className="mb-4">
                    <label htmlFor={`gst-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                      GST Percentage (%)
                    </label>
                    <input
                      type="number"
                      id={`gst-${index}`}
                      value={gateway.gst_percentage}
                      onChange={(e) => updateGateway(index, 'gst_percentage', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      max="100"
                      className="w-full md:w-48 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      placeholder="18.00"
                    />
                  </div>

                  {/* Group 1: Visa / MasterCard / RuPay */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-800 mb-4 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                      Visa / MasterCard / RuPay
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <CardChargeGroup
                        label="Visa"
                        index={index}
                        normalValue={gateway.visa_charges}
                        instantValue={gateway.instant_settlement_charges['Visa'] || 0}
                        onNormalChange={(val) => updateGateway(index, 'visa_charges', val)}
                        onInstantChange={(val) => updateCharge(index, 'instant_settlement_charges', 'Visa', String(val))}
                      />
                      <CardChargeGroup
                        label="MasterCard"
                        index={index}
                        normalValue={gateway.mastercard_charges}
                        instantValue={gateway.instant_settlement_charges['MasterCard'] || 0}
                        onNormalChange={(val) => updateGateway(index, 'mastercard_charges', val)}
                        onInstantChange={(val) => updateCharge(index, 'instant_settlement_charges', 'MasterCard', String(val))}
                      />
                      <CardChargeGroup
                        label="RuPay"
                        index={index}
                        normalValue={gateway.rupay_charges}
                        instantValue={gateway.instant_settlement_charges['Rupay'] || 0}
                        onNormalChange={(val) => updateGateway(index, 'rupay_charges', val)}
                        onInstantChange={(val) => updateCharge(index, 'instant_settlement_charges', 'Rupay', String(val))}
                      />
                    </div>
                  </div>

                  {/* Group 2: AmEx / Diners */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-800 mb-4 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                      American Express / Diners Club
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <CardChargeGroup
                        label="American Express"
                        index={index}
                        normalValue={gateway.amex_charges}
                        instantValue={gateway.instant_settlement_charges['American Express'] || 0}
                        onNormalChange={(val) => updateGateway(index, 'amex_charges', val)}
                        onInstantChange={(val) => updateCharge(index, 'instant_settlement_charges', 'American Express', String(val))}
                      />
                      <CardChargeGroup
                        label="Diners Club"
                        index={index}
                        normalValue={gateway.diners_charges}
                        instantValue={gateway.instant_settlement_charges['Dinner Club'] || 0}
                        onNormalChange={(val) => updateGateway(index, 'diners_charges', val)}
                        onInstantChange={(val) => updateCharge(index, 'instant_settlement_charges', 'Dinner Club', String(val))}
                      />
                    </div>
                  </div>

                  {/* Payout Charges */}
                  <div>
                    <label htmlFor={`payout-${index}`} className="block text-sm font-semibold text-gray-900 mb-2">
                      PayOut Charges Per Transaction (INR)
                    </label>
                    <input
                      type="number"
                      id={`payout-${index}`}
                      value={gateway.payout_charges_inr}
                      onChange={(e) => updateGateway(index, 'payout_charges_inr', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      className="w-full md:w-64 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Flat fee charged per payout transaction</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
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

function CardChargeGroup({
  label,
  index,
  normalValue,
  instantValue,
  onNormalChange,
  onInstantChange,
}: {
  label: string;
  index: number;
  normalValue: number;
  instantValue: number;
  onNormalChange: (val: number) => void;
  onInstantChange: (val: number) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <label className="block text-sm font-medium text-gray-800 mb-3">{label}</label>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Normal Settlement (%)</label>
          <input
            type="number"
            value={normalValue}
            onChange={(e) => onNormalChange(parseFloat(e.target.value) || 0)}
            step="0.01"
            min="0"
            max="100"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-50 outline-none transition-all bg-white"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Instant Settlement (%)</label>
          <input
            type="number"
            value={instantValue}
            onChange={(e) => onInstantChange(parseFloat(e.target.value) || 0)}
            step="0.01"
            min="0"
            max="100"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-50 outline-none transition-all bg-white"
            placeholder="0.00"
          />
        </div>
      </div>
    </div>
  );
}
