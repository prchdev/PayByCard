import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ticket,
  Plus,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Pencil,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Trash2,
  Percent,
  IndianRupee,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';
import { useTableSort, SortableTh } from './TableSort';

interface Coupon {
  id: string;
  coupon_code: string;
  minimum_total: number;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  per_account_limit: number;
  applicable_to: 'first_transaction' | 'non_first_transaction' | 'all';
  total_usage_limit: number | null;
  total_usage_count: number;
  actual_usage_count: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CouponFormData {
  id?: string;
  coupon_code: string;
  minimum_total: string;
  discount_type: 'flat' | 'percentage';
  discount_value: string;
  per_account_limit: string;
  applicable_to: 'first_transaction' | 'non_first_transaction' | 'all';
  total_usage_limit: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const EMPTY_FORM: CouponFormData = {
  coupon_code: '',
  minimum_total: '',
  discount_type: 'flat',
  discount_value: '',
  per_account_limit: '1',
  applicable_to: 'all',
  total_usage_limit: '',
  start_date: '',
  end_date: '',
  is_active: true,
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusBadge(coupon: Coupon): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(coupon.start_date);
  const end = new Date(coupon.end_date);

  if (!coupon.is_active) {
    return { label: 'Disabled', className: 'bg-red-50 text-red-600 border-red-200' };
  }
  if (today < start) {
    return { label: 'Scheduled', className: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (today > end) {
    return { label: 'Expired', className: 'bg-gray-100 text-gray-500 border-gray-300' };
  }
  return { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' };
}

function applicableLabel(value: string): string {
  switch (value) {
    case 'first_transaction': return 'First Transaction';
    case 'non_first_transaction': return 'Non First Transaction';
    default: return 'All Transactions';
  }
}

export default function AdminCoupons() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('coupons');

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CouponFormData>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-coupons`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to fetch coupons');
      setCoupons(data.coupons || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load coupons',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!formData.coupon_code.trim()) {
      setMessage({ type: 'error', text: 'Coupon code is required' });
      setSaving(false);
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      setMessage({ type: 'error', text: 'Start date and end date are required' });
      setSaving(false);
      return;
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setMessage({ type: 'error', text: 'End date cannot be before start date' });
      setSaving(false);
      return;
    }
    if (!formData.discount_value || Number(formData.discount_value) <= 0) {
      setMessage({ type: 'error', text: 'Discount value must be a positive number' });
      setSaving(false);
      return;
    }
    if (formData.discount_type === 'percentage' && Number(formData.discount_value) > 100) {
      setMessage({ type: 'error', text: 'Percentage discount cannot exceed 100' });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-coupon`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId,
            id: formData.id,
            coupon_code: formData.coupon_code,
            minimum_total: Number(formData.minimum_total) || 0,
            discount_type: formData.discount_type,
            discount_value: Number(formData.discount_value),
            per_account_limit: Number(formData.per_account_limit) || 1,
            applicable_to: formData.applicable_to,
            total_usage_limit: formData.total_usage_limit ? Number(formData.total_usage_limit) : null,
            start_date: formData.start_date,
            end_date: formData.end_date,
            is_active: formData.is_active,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save coupon');

      setMessage({
        type: 'success',
        text: formData.id ? 'Coupon updated successfully' : 'Coupon created successfully',
      });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      fetchCoupons();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save coupon',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setFormData({
      id: coupon.id,
      coupon_code: coupon.coupon_code,
      minimum_total: String(coupon.minimum_total ?? ''),
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      per_account_limit: String(coupon.per_account_limit),
      applicable_to: coupon.applicable_to,
      total_usage_limit: coupon.total_usage_limit != null ? String(coupon.total_usage_limit) : '',
      start_date: coupon.start_date ? coupon.start_date.split('T')[0] : '',
      end_date: coupon.end_date ? coupon.end_date.split('T')[0] : '',
      is_active: coupon.is_active,
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

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-coupon`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId, id: coupon.id, action: 'toggle' }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update');
      setMessage({
        type: 'success',
        text: `Coupon ${!coupon.is_active ? 'enabled' : 'disabled'} successfully`,
      });
      fetchCoupons();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to toggle coupon',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-coupon`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId, id: deleteTarget.id, action: 'delete' }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete coupon');
      setMessage({ type: 'success', text: 'Coupon deleted successfully' });
      setDeleteTarget(null);
      fetchCoupons();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete coupon',
      });
    }
  };

  const filteredCoupons = coupons.filter((c) =>
    c.coupon_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sortedData: sortedCoupons, sortConfig, handleSort } = useTableSort(
    filteredCoupons,
    (coupon: Coupon, key: string) => {
      switch (key) {
        case 'code': return coupon.coupon_code;
        case 'type': return coupon.discount_type;
        case 'start': return coupon.start_date;
        case 'end': return coupon.end_date;
        case 'usage': return coupon.actual_usage_count;
        case 'status': return getStatusBadge(coupon).label;
        case 'created': return coupon.created_at;
        default: return '';
      }
    }
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
      <div className="max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
            <p className="text-gray-600 mt-1">
              Create and manage discount coupons for transactions
            </p>
          </div>
          {!showForm && canEdit && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              New Coupon
            </button>
          )}
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
            <p
              className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-6 mb-8"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formData.id ? 'Edit Coupon' : 'Create New Coupon'}
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
              <div className="md:col-span-2">
                <label htmlFor="coupon_code" className="block text-sm font-medium text-gray-700 mb-2">
                  Coupon Code <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Ticket className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="coupon_code"
                    value={formData.coupon_code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, coupon_code: e.target.value.toUpperCase() }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all uppercase tracking-wider font-mono"
                    placeholder="e.g. SAVE100"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="minimum_total" className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Total Value
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <IndianRupee className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="minimum_total"
                    value={formData.minimum_total}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, minimum_total: e.target.value }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="discount_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Type <span className="text-red-600">*</span>
                </label>
                <select
                  id="discount_type"
                  value={formData.discount_type}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, discount_type: e.target.value as 'flat' | 'percentage' }))
                  }
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                >
                  <option value="flat">Flat Discount</option>
                  <option value="percentage">Percentage Discount</option>
                </select>
              </div>

              <div>
                <label htmlFor="discount_value" className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Value <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {formData.discount_type === 'percentage' ? (
                      <Percent className="w-5 h-5 text-gray-400" />
                    ) : (
                      <IndianRupee className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <input
                    type="number"
                    id="discount_value"
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, discount_value: e.target.value }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder={formData.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 100'}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="per_account_limit" className="block text-sm font-medium text-gray-700 mb-2">
                  Per Account Limit <span className="text-gray-400 text-xs">(no. of times)</span>
                </label>
                <input
                  type="number"
                  id="per_account_limit"
                  value={formData.per_account_limit}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, per_account_limit: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="1"
                  min="1"
                  required
                />
              </div>

              <div>
                <label htmlFor="applicable_to" className="block text-sm font-medium text-gray-700 mb-2">
                  Applicable To <span className="text-red-600">*</span>
                </label>
                <select
                  id="applicable_to"
                  value={formData.applicable_to}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, applicable_to: e.target.value as CouponFormData['applicable_to'] }))
                  }
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all bg-white"
                >
                  <option value="all">All Transactions</option>
                  <option value="first_transaction">First Transaction Only</option>
                  <option value="non_first_transaction">Non First Transaction Only</option>
                </select>
              </div>

              <div>
                <label htmlFor="total_usage_limit" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Usage Limit <span className="text-gray-400 text-xs">(across all accounts)</span>
                </label>
                <input
                  type="number"
                  id="total_usage_limit"
                  value={formData.total_usage_limit}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, total_usage_limit: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="Unlimited"
                  min="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="start_date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                      }
                      className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="end_date"
                      value={formData.end_date}
                      min={formData.start_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                      className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8c76f0] transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                }
                className="w-5 h-5 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
              />
              <div className="flex items-center gap-2">
                {formData.is_active ? (
                  <ToggleRight className="w-5 h-5 text-green-600" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">Active</p>
                  <p className="text-xs text-gray-500">
                    Active coupons can be applied by users within the date range
                  </p>
                </div>
              </div>
            </label>

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
                    {formData.id ? 'Update Coupon' : 'Create Coupon'}
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

        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search coupons..."
            className="w-full sm:w-80 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
          />
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-gray-200">
                  <SortableTh label="Code" sortKey="code" sortConfig={sortConfig} onSort={handleSort} className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" />
                  <SortableTh label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Min Total</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Applicable To</th>
                  <SortableTh label="Usage" sortKey="usage" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <SortableTh label="Start Date" sortKey="start" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <SortableTh label="End Date" sortKey="end" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <SortableTh label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Ticket className="w-10 h-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No coupons found</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {searchTerm ? 'Try a different search term' : 'Create your first coupon to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedCoupons.map((coupon) => {
                    const status = getStatusBadge(coupon);
                    const usageLimit = coupon.total_usage_limit != null
                      ? `${coupon.actual_usage_count} / ${coupon.total_usage_limit}`
                      : `${coupon.actual_usage_count}`;
                    return (
                      <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-semibold text-gray-900 tracking-wider">
                            {coupon.coupon_code}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {coupon.discount_type === 'percentage'
                              ? `${coupon.discount_value}% off`
                              : `Rs. ${coupon.discount_value} off`}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${
                            coupon.discount_type === 'percentage'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {coupon.discount_type === 'percentage' ? (
                              <><Percent className="w-3 h-3" /> Percentage</>
                            ) : (
                              <><IndianRupee className="w-3 h-3" /> Flat</>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600">
                            {coupon.minimum_total > 0 ? `Rs. ${coupon.minimum_total}` : 'None'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-xs text-gray-600">{applicableLabel(coupon.applicable_to)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-medium text-gray-900">{usageLimit}</span>
                            <span className="text-xs text-gray-400">{coupon.per_account_limit}/account</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600">{formatDate(coupon.start_date)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600">{formatDate(coupon.end_date)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                              <button
                                onClick={() => handleEdit(coupon)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleToggleActive(coupon)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                  coupon.is_active
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {coupon.is_active ? (
                                  <><EyeOff className="w-4 h-4" />Disable</>
                                ) : (
                                  <><Eye className="w-4 h-4" />Enable</>
                                )}
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => setDeleteTarget(coupon)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {filteredCoupons.length} of {coupons.length} coupons
            </p>
            <p className="text-xs text-gray-500">
              {coupons.filter((c) => c.is_active).length} active
            </p>
          </div>
        </div>

        {deleteTarget && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Coupon</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete coupon <span className="font-mono font-semibold">{deleteTarget.coupon_code}</span>?
                It will no longer be usable by any user.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
