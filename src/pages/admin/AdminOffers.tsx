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
  Calendar,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';
import { useTableSort, SortableTh } from './TableSort';
import RichTextEditor from '../../components/RichTextEditor';

interface Offer {
  id: string;
  offer_name: string;
  slug: string;
  start_date: string;
  end_date: string;
  offer_details: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OfferFormData {
  id?: string;
  offer_name: string;
  start_date: string;
  end_date: string;
  offer_details: string;
  is_active: boolean;
}

const EMPTY_FORM: OfferFormData = {
  offer_name: '',
  start_date: '',
  end_date: '',
  offer_details: '',
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

function getStatusBadge(offer: Offer): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(offer.start_date);
  const end = new Date(offer.end_date);

  if (!offer.is_active) {
    return {
      label: 'Disabled',
      className: 'bg-red-50 text-red-600 border-red-200',
    };
  }
  if (today < start) {
    return {
      label: 'Scheduled',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  if (today > end) {
    return {
      label: 'Expired',
      className: 'bg-gray-50 text-gray-500 border-gray-200',
    };
  }
  return {
    label: 'Active',
    className: 'bg-green-50 text-green-700 border-green-200',
  };
}

export default function AdminOffers() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('offers');

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<OfferFormData>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-offers`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to fetch offers');
      setOffers(data.offers || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load offers',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!formData.offer_name.trim()) {
      setMessage({ type: 'error', text: 'Offer name is required' });
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

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-offer`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to save offer');

      setMessage({
        type: 'success',
        text: formData.id ? 'Offer updated successfully' : 'Offer created successfully',
      });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setPreviewMode(false);
      fetchOffers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save offer',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (offer: Offer) => {
    setFormData({
      id: offer.id,
      offer_name: offer.offer_name,
      start_date: offer.start_date,
      end_date: offer.end_date,
      offer_details: offer.offer_details || '',
      is_active: offer.is_active,
    });
    setShowForm(true);
    setPreviewMode(false);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreate = () => {
    setFormData(EMPTY_FORM);
    setShowForm(true);
    setPreviewMode(false);
    setMessage(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
    setPreviewMode(false);
  };

  const handleToggleActive = async (offer: Offer) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-offer`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId,
            id: offer.id,
            offer_name: offer.offer_name,
            start_date: offer.start_date,
            end_date: offer.end_date,
            offer_details: offer.offer_details,
            is_active: !offer.is_active,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update');
      setMessage({
        type: 'success',
        text: `Offer ${!offer.is_active ? 'enabled' : 'disabled'} successfully`,
      });
      fetchOffers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to toggle offer',
      });
    }
  };

  const filteredOffers = offers.filter((o) =>
    o.offer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sortedData: sortedOffers, sortConfig, handleSort } = useTableSort(
    filteredOffers,
    (offer: Offer, key: string) => {
      switch (key) {
        case 'name': return offer.offer_name;
        case 'start': return offer.start_date;
        case 'end': return offer.end_date;
        case 'status': return getStatusBadge(offer).label;
        case 'created': return offer.created_at;
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
      <div className="max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Offers</h1>
            <p className="text-gray-600 mt-1">
              Create and manage promotional offers published on the public website
            </p>
          </div>
          {!showForm && canEdit && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              New Offer
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
                  <Tag className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formData.id ? 'Edit Offer' : 'Create New Offer'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {formData.offer_details && (
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {previewMode ? 'Edit' : 'Preview'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="offer_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Offer Name <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Tag className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="offer_name"
                    value={formData.offer_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, offer_name: e.target.value }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    placeholder="e.g. Festive Season Cashback Offer"
                    required
                  />
                </div>
              </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Offer Details <span className="text-gray-400 text-xs">(Rich text with formatting, links, and images)</span>
              </label>
              {previewMode ? (
                <div
                  className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 border-2 border-gray-300 rounded-xl prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: formData.offer_details || '<p class="text-gray-400">No content to preview</p>' }}
                />
              ) : (
                <RichTextEditor
                  value={formData.offer_details}
                  onChange={(html) =>
                    setFormData((prev) => ({ ...prev, offer_details: html }))
                  }
                  placeholder="Write your offer details here..."
                />
              )}
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
                    Active offers are visible on the public Offers page (within date range)
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
                    {formData.id ? 'Update Offer' : 'Create Offer'}
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
            placeholder="Search offers..."
            className="w-full sm:w-80 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
          />
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-gray-200">
                  <SortableTh label="Offer Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" />
                  <SortableTh label="Start Date" sortKey="start" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <SortableTh label="End Date" sortKey="end" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <SortableTh label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <SortableTh label="Created" sortKey="created" sortConfig={sortConfig} onSort={handleSort} className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider" align="center" />
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOffers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Tag className="w-10 h-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No offers found</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {searchTerm ? 'Try a different search term' : 'Create your first offer to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedOffers.map((offer) => {
                    const status = getStatusBadge(offer);
                    return (
                      <tr key={offer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{offer.offer_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">/{offer.slug}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600">{formatDate(offer.start_date)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600">{formatDate(offer.end_date)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-500">
                            {new Date(offer.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => handleEdit(offer)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleToggleActive(offer)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                  offer.is_active
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {offer.is_active ? (
                                  <>
                                    <EyeOff className="w-4 h-4" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4" />
                                    Enable
                                  </>
                                )}
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
              Showing {filteredOffers.length} of {offers.length} offers
            </p>
            <p className="text-xs text-gray-500">
              {offers.filter((o) => o.is_active).length} active
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
