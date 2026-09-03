import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Percent,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Tag,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface PaymentCategory {
  id: string;
  category_name: string;
  is_enabled: boolean;
  terms_and_conditions: string;
  charges_percentage: number;
  show_discount: boolean;
  discounted_charges_percentage: number;
  gst_percentage: number;
  settlement_time: string;
}

const SETTLEMENT_TIME_OPTIONS = [
  { value: 'instant', label: 'Instant Settlement' },
  { value: 'T+0', label: 'Transaction + 0 Day' },
  { value: 'T+1', label: 'Transaction + 1 Day' },
  { value: 'T+2', label: 'Transaction + 2 Days' },
];

function settlementLabel(value: string) {
  return SETTLEMENT_TIME_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export default function PaymentCharges() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('payment-charges');

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const id = sessionStorage.getItem('adminId');
      if (!id) throw new Error('Admin not authenticated');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-categories`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: id }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load payment options' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load payment options' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async (catId: string) => {
    setSavingId(catId);
    setMessage(null);
    try {
      const id = sessionStorage.getItem('adminId');
      if (!id) throw new Error('Admin not authenticated');
      const cat = categories.find((c) => c.id === catId);
      if (!cat) throw new Error('Category not found');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-payment-categories`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: id, categories: [cat] }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `"${cat.category_name}" saved successfully` });
        setExpandedId(null);
        fetchCategories();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const id = sessionStorage.getItem('adminId');
      if (!id) throw new Error('Admin not authenticated');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-payment-categories`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: id, categories }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Payment options saved successfully' });
        fetchCategories();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save payment options' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (id: string, field: keyof PaymentCategory, value: any) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const filtered = categories.filter((c) =>
    c.category_name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-3xl font-bold text-gray-900">Payment Option</h1>
            <p className="text-gray-600 mt-1">
              Configure charges, GST, settlement time and terms for each payment category
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save All Changes
                </>
              )}
            </button>
          )}
        </div>

        {/* Alert */}
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

        {/* Search */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search payment options..."
            className="w-full sm:w-80 pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
          />
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-gray-200">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</span>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Charges %</span>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">GST %</span>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Settlement</span>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Status</span>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Details</span>
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No payment options found</p>
                {searchTerm && <p className="text-gray-400 text-sm mt-1">Try a different search term</p>}
              </div>
            ) : (
              filtered.map((cat) => {
                const isExpanded = expandedId === cat.id;
                return (
                  <div key={cat.id} className="transition-colors hover:bg-gray-50">
                    {/* Summary row */}
                    <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-4 h-4 text-[#8c76f0]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{cat.category_name}</p>
                          {cat.show_discount && cat.discounted_charges_percentage > 0 && (
                            <p className="text-xs text-green-600 mt-0.5">Discount: {cat.discounted_charges_percentage}%</p>
                          )}
                        </div>
                      </div>

                      <div className="hidden md:flex justify-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                          <Percent className="w-3 h-3" />
                          {cat.charges_percentage}%
                        </span>
                      </div>

                      <div className="hidden md:flex justify-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-700 text-xs font-medium rounded-full border border-gray-200">
                          <Percent className="w-3 h-3" />
                          {cat.gst_percentage}%
                        </span>
                      </div>

                      <div className="hidden md:flex justify-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                          <Clock className="w-3 h-3" />
                          {settlementLabel(cat.settlement_time || 'instant')}
                        </span>
                      </div>

                      <div className="hidden md:flex justify-center">
                        {cat.is_enabled ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-200">
                            Disabled
                          </span>
                        )}
                      </div>

                      {canEdit && (
                        <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                <span className="hidden sm:inline">Collapse</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                <span className="hidden sm:inline">Edit</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded edit form */}
                    {isExpanded && canEdit && (
                      <div className="px-6 pb-6 border-t border-gray-100 bg-gray-50">
                        <div className="pt-5 space-y-6">
                          {/* Category Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                              <Tag className="w-4 h-4" /> Category Name
                            </label>
                            <input
                              type="text"
                              value={cat.category_name}
                              onChange={(e) => updateCategory(cat.id, 'category_name', e.target.value)}
                              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                              placeholder="Category name"
                            />
                          </div>

                          {/* Enable toggle */}
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`enabled-${cat.id}`}
                              checked={cat.is_enabled}
                              onChange={(e) => updateCategory(cat.id, 'is_enabled', e.target.checked)}
                              className="w-5 h-5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer"
                            />
                            <label htmlFor={`enabled-${cat.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                              Enable this payment category
                            </label>
                          </div>

                          {/* Charges + GST + Settlement */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                                <Percent className="w-4 h-4" /> Charges (%)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={cat.charges_percentage || 0}
                                onChange={(e) => updateCategory(cat.id, 'charges_percentage', parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                                <Percent className="w-4 h-4" /> GST (%)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={cat.gst_percentage || 0}
                                onChange={(e) => updateCategory(cat.id, 'gst_percentage', parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                                <Clock className="w-4 h-4" /> Settlement Time
                              </label>
                              <div className="relative">
                                <select
                                  value={cat.settlement_time || 'instant'}
                                  onChange={(e) => updateCategory(cat.id, 'settlement_time', e.target.value)}
                                  className="w-full px-4 py-2.5 pr-10 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white appearance-none"
                                >
                                  {SETTLEMENT_TIME_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Discount */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`discount-${cat.id}`}
                                checked={cat.show_discount}
                                onChange={(e) => updateCategory(cat.id, 'show_discount', e.target.checked)}
                                className="w-5 h-5 text-white bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] focus:ring-offset-0 checked:bg-[#8c76f0] checked:border-[#8c76f0] transition-colors cursor-pointer"
                              />
                              <label htmlFor={`discount-${cat.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                                Show discount to users
                              </label>
                            </div>
                            {cat.show_discount && (
                              <div className="max-w-xs ml-8">
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                                  <Percent className="w-4 h-4" /> Discounted Charges (%)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={cat.discounted_charges_percentage || 0}
                                  onChange={(e) => updateCategory(cat.id, 'discounted_charges_percentage', parseFloat(e.target.value) || 0)}
                                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                                />
                              </div>
                            )}
                          </div>

                          {/* Terms */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Terms and Conditions
                            </label>
                            <textarea
                              rows={3}
                              value={cat.terms_and_conditions}
                              onChange={(e) => updateCategory(cat.id, 'terms_and_conditions', e.target.value)}
                              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-none bg-white"
                              placeholder="Enter terms and conditions..."
                            />
                          </div>

                          {/* Per-row save */}
                          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => handleSaveCategory(cat.id)}
                              disabled={savingId === cat.id}
                              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingId === cat.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Save Changes
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary bar */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {filtered.length} of {categories.length} payment options
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
