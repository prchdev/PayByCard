import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  Plus,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Pencil,
  Clock,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  FileText,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface PaymentCategory {
  id: string;
  category_name: string;
  is_enabled: boolean;
  display_order: number;
  receiver_kyc_required: boolean;
  new_card_payment_delay_hours: number;
  refund_after_hours: number;
  settlement_time: string;
  invoice_required: boolean;
  invoice_frequency_months: number;
  invoice_min_amount: number;
  max_payment_per_beneficiary: number;
  available_to_retail: boolean;
  available_to_business: boolean;
  created_at: string;
  updated_at: string;
}

interface CategoryFormData {
  id?: string;
  category_name: string;
  receiver_kyc_required: boolean;
  new_card_payment_delay_hours: number;
  refund_after_hours: number;
  settlement_time: string;
  is_enabled: boolean;
  display_order: number;
  invoice_required: boolean;
  invoice_frequency_months: number;
  invoice_min_amount: number;
  max_payment_per_beneficiary: number;
  available_to_retail: boolean;
  available_to_business: boolean;
}

const SETTLEMENT_TIME_OPTIONS = [
  { value: 'instant', label: 'Instant' },
  { value: 'same_day', label: 'Same Day' },
  { value: 't1', label: 'T+1' },
  { value: 't2', label: 'T+2' },
];

const EMPTY_FORM: CategoryFormData = {
  category_name: '',
  receiver_kyc_required: false,
  new_card_payment_delay_hours: 0,
  refund_after_hours: 0,
  settlement_time: 'instant',
  is_enabled: true,
  display_order: 0,
  invoice_required: false,
  invoice_frequency_months: 0,
  invoice_min_amount: 0,
  max_payment_per_beneficiary: 0,
  available_to_retail: true,
  available_to_business: true,
};

export default function PaymentCategories() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('payment-categories');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-payment-categories`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to fetch categories');
      setCategories(data.categories || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load categories',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!formData.category_name.trim()) {
      setMessage({ type: 'error', text: 'Category name is required' });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-payment-category`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId, ...formData }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save category');

      setMessage({
        type: 'success',
        text: formData.id ? 'Category updated successfully' : 'Category created successfully',
      });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      fetchCategories();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save category',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: PaymentCategory) => {
    setFormData({
      id: cat.id,
      category_name: cat.category_name,
      receiver_kyc_required: cat.receiver_kyc_required,
      new_card_payment_delay_hours: cat.new_card_payment_delay_hours,
      refund_after_hours: cat.refund_after_hours,
      settlement_time: cat.settlement_time || 'instant',
      is_enabled: cat.is_enabled,
      display_order: cat.display_order,
      invoice_required: cat.invoice_required ?? false,
      invoice_frequency_months: cat.invoice_frequency_months ?? 0,
      invoice_min_amount: cat.invoice_min_amount ?? 0,
      max_payment_per_beneficiary: cat.max_payment_per_beneficiary ?? 0,
      available_to_retail: cat.available_to_retail ?? true,
      available_to_business: cat.available_to_business ?? true,
    });
    setShowForm(true);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreate = () => {
    setFormData(EMPTY_FORM);
    setShowForm(true);
    setMessage(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
  };

  const filteredCategories = categories.filter((cat) =>
    cat.category_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Categories</h1>
            <p className="text-gray-600 mt-1">
              Manage payment categories shown to users on the Make Payment page
            </p>
          </div>
          {!showForm && canEdit && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              New Category
            </button>
          )}
        </div>

        {/* Alert message */}
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
            <p
              className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-6 mb-8"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                  <Tag className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formData.id ? 'Edit Category' : 'Create New Category'}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Name */}
              <div className="md:col-span-2">
                <label
                  htmlFor="category_name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Category Name <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Tag className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="category_name"
                    value={formData.category_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, category_name: e.target.value }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="e.g. College Tuition Fees"
                    required
                  />
                </div>
              </div>

              {/* New Card Payment Delay */}
              <div>
                <label
                  htmlFor="delay_hours"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  New Card Payment Delay (hours)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="delay_hours"
                    min="0"
                    step="1"
                    value={formData.new_card_payment_delay_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        new_card_payment_delay_hours: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Hours to wait before processing payments from new cards. Set to 0 for no delay.
                </p>
              </div>

              {/* Display Order */}
              <div>
                <label
                  htmlFor="display_order"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Display Order
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-sm font-medium">#</span>
                  </div>
                  <input
                    type="number"
                    id="display_order"
                    min="0"
                    step="1"
                    value={formData.display_order}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        display_order: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers appear first in the user dropdown
                </p>
              </div>

              {/* Settlement Time */}
              <div>
                <label
                  htmlFor="settlement_time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Settlement Time
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <select
                    id="settlement_time"
                    value={formData.settlement_time}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        settlement_time: e.target.value,
                      }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all appearance-none bg-white"
                  >
                    {SETTLEMENT_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Time taken to settle the payment to the receiver
                </p>
              </div>

            </div>

            {/* Checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8c76f0] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.receiver_kyc_required}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      receiver_kyc_required: e.target.checked,
                      refund_after_hours: e.target.checked ? prev.refund_after_hours : 0,
                    }))
                  }
                  className="w-5 h-5 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
                />
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#8c76f0]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Receiver KYC Required</p>
                    <p className="text-xs text-gray-500">
                      Require receiver to complete KYC before payment
                    </p>
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8c76f0] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, is_enabled: e.target.checked }))
                  }
                  className="w-5 h-5 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
                />
                <div className="flex items-center gap-2">
                  {formData.is_enabled ? (
                    <ToggleRight className="w-5 h-5 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">Enabled</p>
                    <p className="text-xs text-gray-500">
                      Show this category on the Make Payment page
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Availability checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8c76f0] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.available_to_retail}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, available_to_retail: e.target.checked }))
                  }
                  className="w-5 h-5 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
                />
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#8c76f0]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Available to Retail</p>
                    <p className="text-xs text-gray-500">
                      Show this category to retail users (default account type)
                    </p>
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8c76f0] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.available_to_business}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, available_to_business: e.target.checked }))
                  }
                  className="w-5 h-5 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
                />
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#8c76f0]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Available to Business</p>
                    <p className="text-xs text-gray-500">
                      Show this category to users with verified business KYC
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Refund After Hours - conditional on KYC Required */}
            {formData.receiver_kyc_required && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
                <label
                  htmlFor="refund_after_hours"
                  className="block text-sm font-medium text-gray-900 mb-2"
                >
                  Refund After Hours (if KYC not completed)
                </label>
                <div className="relative max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <RotateCcw className="w-5 h-5 text-amber-500" />
                  </div>
                  <input
                    type="number"
                    id="refund_after_hours"
                    min="0"
                    step="1"
                    value={formData.refund_after_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        refund_after_hours: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-amber-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  If the receiver has not completed KYC within this many hours, the payment will be automatically refunded. Set to 0 for no automatic refund.
                </p>
              </div>
            )}

            {/* Invoice/Bill Required */}
            <div className="grid grid-cols-1 gap-4">
              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8c76f0] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.invoice_required}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      invoice_required: e.target.checked,
                      invoice_frequency_months: e.target.checked ? prev.invoice_frequency_months : 0,
                      invoice_min_amount: e.target.checked ? prev.invoice_min_amount : 0,
                    }))
                  }
                  className="w-5 h-5 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
                />
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#8c76f0]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Invoice/Bill Required</p>
                    <p className="text-xs text-gray-500">
                      Require users to upload an invoice or bill for this category
                    </p>
                  </div>
                </div>
              </label>

              {formData.invoice_required && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Frequency */}
                    <div>
                      <label
                        htmlFor="invoice_frequency_months"
                        className="block text-sm font-medium text-gray-900 mb-2"
                      >
                        Ask Every X Months
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Calendar className="w-5 h-5 text-blue-500" />
                        </div>
                        <input
                          type="number"
                          id="invoice_frequency_months"
                          min="0"
                          step="1"
                          value={formData.invoice_frequency_months}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              invoice_frequency_months: Math.max(0, parseInt(e.target.value) || 0),
                            }))
                          }
                          className="w-full pl-12 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-xs text-blue-700 mt-1.5">
                        Ask for invoice every X months. Set to 0 to ask for every payment.
                      </p>
                    </div>

                    {/* Min Amount */}
                    <div>
                      <label
                        htmlFor="invoice_min_amount"
                        className="block text-sm font-medium text-gray-900 mb-2"
                      >
                        Ask Only If Amount Greater Than
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <IndianRupee className="w-5 h-5 text-blue-500" />
                        </div>
                        <input
                          type="number"
                          id="invoice_min_amount"
                          min="0"
                          step="0.01"
                          value={formData.invoice_min_amount}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              invoice_min_amount: Math.max(0, parseFloat(e.target.value) || 0),
                            }))
                          }
                          className="w-full pl-12 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-blue-700 mt-1.5">
                        Only ask for invoice if payment amount exceeds this value. Set to 0 to always ask.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Max Payment Per Beneficiary */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label
                  htmlFor="max_payment_per_beneficiary"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Maximum Permitted Payment Per Beneficiary
                </label>
                <div className="relative max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <IndianRupee className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="max_payment_per_beneficiary"
                    min="0"
                    step="0.01"
                    value={formData.max_payment_per_beneficiary}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_payment_per_beneficiary: Math.max(0, parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum amount a single beneficiary can receive in this category. Set to 0 for no limit.
                </p>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-gray-200 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || !canEdit}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {formData.id ? 'Update Category' : 'Create Category'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search categories..."
            className="w-full sm:w-80 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
          />
        </div>

        {/* Categories table */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-gray-200">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Category Name
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    KYC Required
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Refund Hours
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Settlement
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Max/Beneficiary
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Card Delay
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Retail
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Tag className="w-10 h-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No categories found</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {searchTerm
                            ? 'Try a different search term'
                            : 'Create your first category to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr
                      key={cat.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {cat.category_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(cat.updated_at).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.receiver_kyc_required ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 bg-gray-50 text-gray-500 text-xs font-medium rounded-full border border-gray-200">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.receiver_kyc_required && cat.refund_after_hours > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                            <RotateCcw className="w-3.5 h-3.5" />
                            {cat.refund_after_hours}h
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                          <Clock className="w-3.5 h-3.5" />
                          {SETTLEMENT_TIME_OPTIONS.find((o) => o.value === cat.settlement_time)?.label || 'Instant'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.invoice_required ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                              <FileText className="w-3.5 h-3.5" />
                              Yes
                            </span>
                            <span className="text-xs text-gray-500">
                              {cat.invoice_frequency_months > 0
                                ? `Every ${cat.invoice_frequency_months}mo`
                                : 'Every payment'}
                              {cat.invoice_min_amount > 0
                                ? ` > ₹${cat.invoice_min_amount}`
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.max_payment_per_beneficiary > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full border border-teal-200">
                            <IndianRupee className="w-3.5 h-3.5" />
                            {cat.max_payment_per_beneficiary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No limit</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.new_card_payment_delay_hours > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                            <Clock className="w-3.5 h-3.5" />
                            {cat.new_card_payment_delay_hours}h
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-gray-600">{cat.display_order}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.available_to_retail ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.available_to_business ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {cat.is_enabled ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-200">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {canEdit && (
                        <button
                          onClick={() => handleEdit(cat)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary bar */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {filteredCategories.length} of {categories.length} categories
            </p>
            <p className="text-xs text-gray-500">
              {categories.filter((c) => c.is_enabled).length} enabled
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
