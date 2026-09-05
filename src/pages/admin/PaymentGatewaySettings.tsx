import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Save, AlertCircle, CheckCircle, Loader2, Building2, Settings2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface PaymentOption {
  id: string;
  category_name: string;
}

interface RazorpayConfig {
  payment_option_id: string;
  checkout_config_id: string;
  is_active: boolean;
}

interface PhonePeConfig {
  payment_option_id: string;
  card_types: string[];
  networks: string[];
  variants: string[];
  geo_scopes: string[];
  is_active: boolean;
}

const PHONEPE_CARD_TYPES = ['CREDIT_CARD', 'DEBIT_CARD'];
const PHONEPE_NETWORKS = ['VISA', 'MASTER_CARD', 'RUPAY', 'AMEX', 'DINERS_CLUB'];
const PHONEPE_VARIANTS = ['CONSUMER', 'PREMIUM', 'SUPER_PREMIUM', 'CORPORATE'];
const PHONEPE_GEO_SCOPES = ['DOMESTIC', 'INTERNATIONAL'];

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
  gst_percentage: number;
  registered_name: string;
  gst_number: string;
}

const ALLOWED_GATEWAYS = ['RazorPay', 'CashFree', 'PayU', 'PhonePe'];

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
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [razorpayConfigs, setRazorpayConfigs] = useState<Record<string, RazorpayConfig>>({});
  const [phonepeConfigs, setPhonepeConfigs] = useState<Record<string, PhonePeConfig>>({});
  const [phonepeConfigsLoading, setPhonepeConfigsLoading] = useState(false);
  const [phonepeConfigsSaving, setPhonepeConfigsSaving] = useState(false);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configsSaving, setConfigsSaving] = useState(false);

  useEffect(() => {
    fetchGateways();
    fetchPaymentOptions();
  }, []);

  const fetchPaymentOptions = async () => {
    try {
      const adminId = sessionStorage.getItem('adminId');
      if (!adminId) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-categories`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_id: adminId }),
      });
      const data = await response.json();
      if (response.ok && data.categories) {
        setPaymentOptions(data.categories.map((c: any) => ({ id: c.id, category_name: c.category_name })));
      }
    } catch {
      // silent fail — configs are optional
    }
  };

  const fetchRazorpayConfigs = async (gatewayId: string) => {
    setConfigsLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-payment-configs?gateway_id=${gatewayId}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      const data = await response.json();
      if (response.ok && data.configs) {
        const map: Record<string, RazorpayConfig> = {};
        for (const c of data.configs) {
          map[c.payment_option_id] = {
            payment_option_id: c.payment_option_id,
            checkout_config_id: c.checkout_config_id || '',
            is_active: c.is_active !== false,
          };
        }
        setRazorpayConfigs(map);
      }
    } catch {
      // silent fail
    } finally {
      setConfigsLoading(false);
    }
  };

  const updateRazorpayConfig = (optionId: string, field: keyof RazorpayConfig, value: any) => {
    setRazorpayConfigs(prev => ({
      ...prev,
      [optionId]: {
        payment_option_id: optionId,
        checkout_config_id: prev[optionId]?.checkout_config_id || '',
        is_active: prev[optionId]?.is_active ?? true,
        [field]: value,
      },
    }));
  };

  const saveRazorpayConfigs = async (gatewayId: string) => {
    setConfigsSaving(true);
    setMessage(null);
    try {
      const configs = Object.values(razorpayConfigs);
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-payment-configs`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gateway_id: gatewayId, configs }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Razorpay payment configurations saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save Razorpay configurations' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving Razorpay configurations' });
    } finally {
      setConfigsSaving(false);
    }
  };

  const fetchPhonepeConfigs = async (gatewayId: string) => {
    setPhonepeConfigsLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phonepe-payment-configs?gateway_id=${gatewayId}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      const data = await response.json();
      if (response.ok && data.configs) {
        const map: Record<string, PhonePeConfig> = {};
        for (const c of data.configs) {
          map[c.payment_option_id] = {
            payment_option_id: c.payment_option_id,
            card_types: c.card_types || [],
            networks: c.networks || [],
            variants: c.variants || [],
            geo_scopes: c.geo_scopes || [],
            is_active: c.is_active !== false,
          };
        }
        setPhonepeConfigs(map);
      }
    } catch {
      // silent fail
    } finally {
      setPhonepeConfigsLoading(false);
    }
  };

  const updatePhonepeConfig = (optionId: string, field: keyof PhonePeConfig, value: any) => {
    setPhonepeConfigs(prev => ({
      ...prev,
      [optionId]: {
        payment_option_id: optionId,
        card_types: prev[optionId]?.card_types || [],
        networks: prev[optionId]?.networks || [],
        variants: prev[optionId]?.variants || [],
        geo_scopes: prev[optionId]?.geo_scopes || [],
        is_active: prev[optionId]?.is_active ?? true,
        [field]: value,
      },
    }));
  };

  const togglePhonepeMultiSelect = (optionId: string, field: 'card_types' | 'networks' | 'variants' | 'geo_scopes', value: string) => {
    setPhonepeConfigs(prev => {
      const current = prev[optionId] || {
        payment_option_id: optionId,
        card_types: [],
        networks: [],
        variants: [],
        geo_scopes: [],
        is_active: true,
      };
      const arr = current[field] as string[];
      const newArr = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return {
        ...prev,
        [optionId]: { ...current, [field]: newArr },
      };
    });
  };

  const savePhonepeConfigs = async (gatewayId: string) => {
    setPhonepeConfigsSaving(true);
    setMessage(null);
    try {
      const configs = Object.values(phonepeConfigs);
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phonepe-payment-configs`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gateway_id: gatewayId, configs }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'PhonePe payment configurations saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save PhonePe configurations' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving PhonePe configurations' });
    } finally {
      setPhonepeConfigsSaving(false);
    }
  };

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
            gst_percentage: gw.gst_percentage || 18,
            registered_name: gw.registered_name || '',
            gst_number: gw.gst_number || '',
          }));
        setGateways(gatewaysData);

        // Fetch Razorpay per-option configs if RazorPay gateway exists
        const razorpayGw = gatewaysData.find((gw: any) => gw.gateway_name === 'RazorPay');
        if (razorpayGw) {
          fetchRazorpayConfigs(razorpayGw.id);
        }

        // Fetch PhonePe per-option configs if PhonePe gateway exists
        const phonepeGw = gatewaysData.find((gw: any) => gw.gateway_name === 'PhonePe');
        if (phonepeGw) {
          fetchPhonepeConfigs(phonepeGw.id);
        }
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {/* Razorpay Per-Payment-Option Configuration */}
                {gateway.gateway_name === 'RazorPay' && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Settings2 className="w-4 h-4 text-[#8c76f0]" />
                      <h3 className="text-sm font-semibold text-gray-900">Payment Option Configurations</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                      Configure a Razorpay Checkout Config ID for each payment option. If a payment option is not configured below, the default Razorpay checkout configuration is used.
                    </p>

                    {configsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading configurations...
                      </div>
                    ) : paymentOptions.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No payment options available. Create payment options first in the Payment Categories page.</p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {paymentOptions.map((option) => {
                            const config = razorpayConfigs[option.id];
                            const isEnabled = config?.is_active ?? false;
                            return (
                              <div key={option.id} className={`rounded-xl border-2 p-4 transition-all ${isEnabled ? 'border-[#8c76f0] bg-purple-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={(e) => updateRazorpayConfig(option.id, 'is_active', e.target.checked)}
                                      className="w-4 h-4 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-gray-900">{option.category_name}</span>
                                  </div>
                                </div>
                                {isEnabled && (
                                  <div className="pl-7">
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Checkout Config ID</label>
                                    <input
                                      type="text"
                                      value={config?.checkout_config_id || ''}
                                      onChange={(e) => updateRazorpayConfig(option.id, 'checkout_config_id', e.target.value)}
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-50 outline-none transition-all text-sm"
                                      placeholder="e.g. config_1234567890"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                      The Razorpay Checkout Config ID to use for this payment option. Leave empty to use the default configuration.
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4">
                          <button
                            onClick={() => saveRazorpayConfigs(gateway.id)}
                            disabled={configsSaving || !canEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {configsSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Configurations
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* PhonePe Per-Payment-Option Configuration */}
                {gateway.gateway_name === 'PhonePe' && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Settings2 className="w-4 h-4 text-[#8c76f0]" />
                      <h3 className="text-sm font-semibold text-gray-900">Payment Option Configurations</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                      Configure PhonePe payment mode constraints for each payment option. If a payment option is not configured below, the default PhonePe checkout is used (no paymentModeConfig sent to PhonePe API).
                    </p>

                    {phonepeConfigsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading configurations...
                      </div>
                    ) : paymentOptions.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No payment options available. Create payment options first in the Payment Categories page.</p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {paymentOptions.map((option) => {
                            const config = phonepeConfigs[option.id];
                            const isEnabled = config?.is_active ?? false;
                            return (
                              <div key={option.id} className={`rounded-xl border-2 p-4 transition-all ${isEnabled ? 'border-[#8c76f0] bg-purple-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={(e) => updatePhonepeConfig(option.id, 'is_active', e.target.checked)}
                                      className="w-4 h-4 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-gray-900">{option.category_name}</span>
                                  </div>
                                </div>
                                {isEnabled && (
                                  <div className="pl-7 space-y-4">
                                    {/* Card Types */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Card Types</label>
                                      <div className="flex flex-wrap gap-2">
                                        {PHONEPE_CARD_TYPES.map((ct) => {
                                          const selected = (config?.card_types || []).includes(ct);
                                          return (
                                            <button
                                              key={ct}
                                              type="button"
                                              onClick={() => togglePhonepeMultiSelect(option.id, 'card_types', ct)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${selected ? 'border-[#8c76f0] bg-[#8c76f0] text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-[#8c76f0]/50'}`}
                                            >
                                              {ct.replace(/_/g, ' ')}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    {/* Networks */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Networks</label>
                                      <div className="flex flex-wrap gap-2">
                                        {PHONEPE_NETWORKS.map((n) => {
                                          const selected = (config?.networks || []).includes(n);
                                          return (
                                            <button
                                              key={n}
                                              type="button"
                                              onClick={() => togglePhonepeMultiSelect(option.id, 'networks', n)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${selected ? 'border-[#8c76f0] bg-[#8c76f0] text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-[#8c76f0]/50'}`}
                                            >
                                              {n.replace(/_/g, ' ')}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    {/* Variants */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Variants</label>
                                      <div className="flex flex-wrap gap-2">
                                        {PHONEPE_VARIANTS.map((v) => {
                                          const selected = (config?.variants || []).includes(v);
                                          return (
                                            <button
                                              key={v}
                                              type="button"
                                              onClick={() => togglePhonepeMultiSelect(option.id, 'variants', v)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${selected ? 'border-[#8c76f0] bg-[#8c76f0] text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-[#8c76f0]/50'}`}
                                            >
                                              {v.replace(/_/g, ' ')}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    {/* Geo Scopes */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Geo Scopes</label>
                                      <div className="flex flex-wrap gap-2">
                                        {PHONEPE_GEO_SCOPES.map((g) => {
                                          const selected = (config?.geo_scopes || []).includes(g);
                                          return (
                                            <button
                                              key={g}
                                              type="button"
                                              onClick={() => togglePhonepeMultiSelect(option.id, 'geo_scopes', g)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${selected ? 'border-[#8c76f0] bg-[#8c76f0] text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-[#8c76f0]/50'}`}
                                            >
                                              {g}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                      If all fields are left empty, no paymentModeConfig is sent to PhonePe and the default checkout is used.
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4">
                          <button
                            onClick={() => savePhonepeConfigs(gateway.id)}
                            disabled={phonepeConfigsSaving || !canEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {phonepeConfigsSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Configurations
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* GST Configuration */}
                <div className="border-t-2 border-gray-200 pt-6">
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
