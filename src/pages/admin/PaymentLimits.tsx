import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Save, AlertCircle, CheckCircle, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface PaymentLimitsData {
  id?: string;
  minimum_amount: number;
  maximum_amount: number;
  updated_by?: string;
  updated_ip?: string;
  updated_at?: string;
}

export default function PaymentLimits() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('payment-limits');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<PaymentLimitsData>({
    minimum_amount: 1,
    maximum_amount: 100000,
  });

  useEffect(() => {
    fetchPaymentLimits();
  }, []);

  const fetchPaymentLimits = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-limits`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch payment limits');
      }

      setFormData({
        minimum_amount: result.minimum_amount || 1,
        maximum_amount: result.maximum_amount || 100000,
        updated_by: result.updated_by,
        updated_ip: result.updated_ip,
        updated_at: result.updated_at,
      });
    } catch (error) {
      console.error('Error fetching payment limits:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load payment limits',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (formData.minimum_amount <= 0) {
      setMessage({
        type: 'error',
        text: 'Minimum amount must be greater than 0',
      });
      setSaving(false);
      return;
    }

    if (formData.maximum_amount <= formData.minimum_amount) {
      setMessage({
        type: 'error',
        text: 'Maximum amount must be greater than minimum amount',
      });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-payment-limits`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            minimum_amount: formData.minimum_amount,
            maximum_amount: formData.maximum_amount,
            adminId: adminId,
            ip: 'system',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save payment limits');
      }

      setMessage({
        type: 'success',
        text: 'Payment limits saved successfully',
      });

      fetchPaymentLimits();
    } catch (error) {
      console.error('Error saving payment limits:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save payment limits',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
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
          <h1 className="text-3xl font-bold text-gray-900">Payment Limits</h1>
          <p className="text-gray-600 mt-1">Configure minimum and maximum payment amounts</p>
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

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Payment Amount Limits</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="minimum_amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Amount <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <TrendingDown className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="minimum_amount"
                    name="minimum_amount"
                    value={formData.minimum_amount}
                    onChange={handleChange}
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="1.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum payment amount allowed</p>
              </div>

              <div>
                <label htmlFor="maximum_amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Amount <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="maximum_amount"
                    name="maximum_amount"
                    value={formData.maximum_amount}
                    onChange={handleChange}
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="100000.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Maximum payment amount allowed</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Important Information</p>
                  <ul className="text-sm text-gray-700 mt-2 space-y-1 list-disc list-inside">
                    <li>Minimum amount must be greater than 0</li>
                    <li>Maximum amount must be greater than minimum amount</li>
                    <li>These limits will apply to all payment transactions</li>
                    <li>Changes take effect immediately after saving</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Current Range</p>
                  <p className="text-sm text-blue-800 mt-1">
                    Payments between <strong>₹{formData.minimum_amount.toLocaleString()}</strong> and{' '}
                    <strong>₹{formData.maximum_amount.toLocaleString()}</strong> will be accepted
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <button
              type="submit"
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
                  Save Payment Limits
                </>
              )}
            </button>
          </div>

          {formData.updated_at && (
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Last Updated Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-600 mb-1">Updated By</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formData.updated_by || 'System'}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-600 mb-1">IP Address</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formData.updated_ip || 'N/A'}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-600 mb-1">Updated At</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formData.updated_at ? new Date(formData.updated_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </AdminLayout>
  );
}
