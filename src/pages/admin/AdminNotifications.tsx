import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import {
  Bell, Plus, Save, X, AlertCircle, CheckCircle, Loader2,
  Pencil, Calendar, Clock, Repeat, Image as ImageIcon, SquarePen,
  Ban, Send,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface NotificationCampaign {
  id: string;
  campaign_name: string;
  title: string;
  message: string;
  image_url: string | null;
  start_date: string;
  end_date: string;
  push_time_from: string;
  push_time_to: string;
  frequency: 'once' | 'daily';
  status: 'active' | 'ended' | 'expired';
  ended_at: string | null;
  ended_by_admin_id: string | null;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
  push_count?: number;
}

interface CampaignFormData {
  id?: string;
  campaign_name: string;
  title: string;
  message: string;
  image_url: string;
  start_date: string;
  end_date: string;
  push_time_from: string;
  push_time_to: string;
  frequency: 'once' | 'daily';
}

const EMPTY_FORM: CampaignFormData = {
  campaign_name: '',
  title: '',
  message: '',
  image_url: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
  push_time_from: '09:00',
  push_time_to: '18:00',
  frequency: 'once',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  ended: 'bg-gray-50 text-gray-600 border-gray-200',
  expired: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  ended: 'Ended',
  expired: 'Expired',
};

function fmtDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtTime(timeStr: string) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${period}`;
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? localStorage.getItem('adminId') ?? '';
  const { loading: permLoading, canEdit } = useAdminPermission('mobile-notifications');

  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CampaignFormData>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [endingId, setEndingId] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<NotificationCampaign | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  useEffect(() => {
    if (!permLoading) fetchCampaigns();
  }, [permLoading]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-notifications`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to fetch campaigns');
      setCampaigns(data.campaigns || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load campaigns',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData(EMPTY_FORM);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (campaign: NotificationCampaign) => {
    setFormData({
      id: campaign.id,
      campaign_name: campaign.campaign_name,
      title: campaign.title,
      message: campaign.message,
      image_url: campaign.image_url || '',
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      push_time_from: campaign.push_time_from,
      push_time_to: campaign.push_time_to,
      frequency: campaign.frequency,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be under 5MB' });
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `campaign-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('notification-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from('notification-images')
        .getPublicUrl(fileName);

      setFormData((prev) => ({ ...prev, image_url: urlData.publicUrl }));
      setMessage({ type: 'success', text: 'Image uploaded successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to upload image',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-notification`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to save campaign');

      setShowForm(false);
      setFormData(EMPTY_FORM);
      setMessage({
        type: 'success',
        text: formData.id ? 'Campaign updated successfully' : 'Campaign created successfully',
      });
      fetchCampaigns();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save campaign',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEndCampaign = async () => {
    if (!confirmEnd) return;
    setEndingId(confirmEnd.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-end-notification`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId, campaignId: confirmEnd.id }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to end campaign');

      setMessage({ type: 'success', text: 'Campaign ended successfully' });
      setConfirmEnd(null);
      fetchCampaigns();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to end campaign',
      });
    } finally {
      setEndingId(null);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.campaign_name.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      c.message.toLowerCase().includes(term)
    );
  });

  if (permLoading || loading) {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mobile Notifications</h1>
            <p className="text-gray-600 mt-1">
              Create and manage push notification campaigns for the mobile application
            </p>
          </div>
          {!showForm && canEdit && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              New Campaign
            </button>
          )}
        </div>

        {/* Alert banner */}
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
            <button
              onClick={() => setMessage(null)}
              className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        {/* Form panel */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-6 mb-8"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formData.id ? 'Edit Campaign' : 'Create New Campaign'}
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

            {/* Campaign Name */}
            <div>
              <label
                htmlFor="campaign_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Campaign Name <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Bell className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="campaign_name"
                  value={formData.campaign_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, campaign_name: e.target.value }))
                  }
                  className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="e.g. Summer Sale 2026"
                  required
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Notification Title <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <SquarePen className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="e.g. Special Offer Just for You!"
                  required
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-red-600">*</span>
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-none"
                placeholder="Notification body text shown to users..."
                required
              />
            </div>

            {/* Image upload (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Image <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              {formData.image_url ? (
                <div className="relative inline-block">
                  <img
                    src={formData.image_url}
                    alt="Notification preview"
                    className="w-48 h-32 object-cover rounded-xl border-2 border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-[#8c76f0] hover:bg-purple-50/30 transition-all"
                >
                  <div className="flex flex-col items-center gap-2">
                    {uploadingImage ? (
                      <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    )}
                    <p className="text-sm text-gray-500 font-medium">
                      {uploadingImage ? 'Uploading...' : 'Click to upload image (max 5MB)'}
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="start_date"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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
                <label
                  htmlFor="end_date"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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
                    onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Push time range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="push_time_from"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Push Time From <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="time"
                    id="push_time_from"
                    value={formData.push_time_from}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, push_time_from: e.target.value }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Earliest time to push notification</p>
              </div>
              <div>
                <label
                  htmlFor="push_time_to"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Push Time To <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="time"
                    id="push_time_to"
                    value={formData.push_time_to}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, push_time_to: e.target.value }))
                    }
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Latest time to push notification</p>
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['once', 'daily'] as const).map((freq) => (
                  <label
                    key={freq}
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                      formData.frequency === freq
                        ? 'border-[#8c76f0] bg-purple-50'
                        : 'border-gray-200 hover:border-[#8c76f0]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={freq}
                      checked={formData.frequency === freq}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          frequency: e.target.value as 'once' | 'daily',
                        }))
                      }
                      className="w-5 h-5 text-[#8c76f0] border-gray-300 focus:ring-[#8c76f0]"
                    />
                    <div className="flex items-center gap-2">
                      <Repeat className="w-5 h-5 text-[#8c76f0]" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {freq === 'once' ? 'Once' : 'Daily Once'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {freq === 'once'
                            ? 'Send notification one time'
                            : 'Send notification every day'}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit / Cancel */}
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
                    {formData.id ? 'Update Campaign' : 'Create Campaign'}
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
        {!showForm && (
          <div className="mb-6">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full sm:w-80 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
            />
          </div>
        )}

        {/* Campaign list table */}
        {!showForm && (
          <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-gray-200">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Push Time
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Pushes
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <Bell className="w-10 h-10 text-gray-300 mb-3" />
                          <p className="text-gray-500 font-medium">No campaigns found</p>
                          <p className="text-gray-400 text-sm mt-1">
                            Create a new campaign to send push notifications
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            {c.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c.campaign_name}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                <Bell className="w-5 h-5 text-[#8c76f0]" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {c.campaign_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{c.title}</p>
                              <p className="text-xs text-gray-400 truncate mt-0.5 max-w-xs">
                                {c.message}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs text-gray-700 font-medium">
                            {fmtDate(c.start_date)} — {fmtDate(c.end_date)}
                          </p>
                          {c.status === 'ended' && c.ended_at && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Ended: {fmtDateTime(c.ended_at)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs text-gray-700">
                            {fmtTime(c.push_time_from)} — {fmtTime(c.push_time_to)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${
                              c.frequency === 'daily'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            <Repeat className="w-3.5 h-3.5" />
                            {c.frequency === 'daily' ? 'Daily' : 'Once'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${
                              STATUS_STYLES[c.status] || 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                          >
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1 text-sm text-gray-700 font-medium">
                            <Send className="w-3.5 h-3.5 text-gray-400" />
                            {c.push_count || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEdit(c)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </button>
                                {c.status === 'active' && (
                                  <button
                                    onClick={() => setConfirmEnd(c)}
                                    disabled={endingId === c.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {endingId === c.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Ban className="w-4 h-4" />
                                    )}
                                    End
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Summary footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Showing {filteredCampaigns.length} of {campaigns.length} campaigns
              </p>
              <p className="text-xs text-gray-500">
                {campaigns.filter((c) => c.status === 'active').length} active
              </p>
            </div>
          </div>
        )}

        {/* End campaign confirmation modal */}
        {confirmEnd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setConfirmEnd(null)}
            />
            <div className="relative bg-white rounded-2xl border-2 border-gray-300 max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">End Campaign Early?</h3>
              </div>
              <div className="py-4">
                <p className="text-sm text-gray-600">
                  Are you sure you want to end the campaign{' '}
                  <span className="font-semibold text-gray-900">"{confirmEnd.campaign_name}"</span>{' '}
                  before its scheduled end date?
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  This action cannot be undone. No further notifications will be pushed for this
                  campaign.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setConfirmEnd(null)}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndCampaign}
                  disabled={endingId === confirmEnd.id}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {endingId === confirmEnd.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  End Campaign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
