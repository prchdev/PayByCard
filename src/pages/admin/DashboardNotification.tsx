import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Power,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface DashboardNotificationItem {
  id: string;
  title: string;
  message: string;
  notification_type: 'information' | 'warning' | 'error';
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const TYPE_CONFIG = {
  information: { label: 'Information', icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  warning: { label: 'Warning', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
};

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-notifications`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export default function DashboardNotification() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const { loading: permLoading, canEdit } = useAdminPermission('dashboard-notification');

  const [notifications, setNotifications] = useState<DashboardNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    message: '',
    notification_type: 'information' as 'information' | 'warning' | 'error',
    display_order: 0,
  });

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    fetchNotifications();
  }, [adminId, navigate]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}?action=list`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load notifications');
      setNotifications(data.notifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', message: '', notification_type: 'information', display_order: 0 });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (n: DashboardNotificationItem) => {
    setEditingId(n.id);
    setForm({
      title: n.title,
      message: n.message,
      notification_type: n.notification_type,
      display_order: n.display_order,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setFormError('Title and message are required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const res = await fetch(`${BASE}`, {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify({ adminId, id: editingId, ...form }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');
      } else {
        const res = await fetch(`${BASE}`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ adminId, ...form }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Create failed');
      }
      setShowModal(false);
      await fetchNotifications();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (n: DashboardNotificationItem) => {
    try {
      const res = await fetch(`${BASE}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ adminId, id: n.id, is_active: !n.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Toggle failed');
      await fetchNotifications();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    try {
      const res = await fetch(`${BASE}`, {
        method: 'DELETE',
        headers: HEADERS,
        body: JSON.stringify({ adminId, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await fetchNotifications();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Notifications</h1>
            <p className="text-gray-600 mt-1">Create and manage notifications displayed on the user dashboard</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {canEdit && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add Notification
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border-2 border-red-300 bg-red-50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin mb-3" />
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium text-lg">No notifications yet</p>
            <p className="text-sm text-gray-500 mt-1">Create a notification to display it on the user dashboard</p>
            {canEdit && (
              <button
                onClick={openCreate}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create First Notification
              </button>
            )}
          </div>
        ) : (
          /* Notification list */
          <div className="space-y-4">
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.notification_type] || TYPE_CONFIG.information;
              const TypeIcon = cfg.icon;
              return (
                <div
                  key={n.id}
                  className={`bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-md ${
                    n.is_active ? 'border-gray-200 hover:border-[#8c76f0]' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Type icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      <TypeIcon className={`w-5 h-5 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-semibold text-gray-900">{n.title}</h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {!n.is_active && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Order: {n.display_order} &middot; Created {new Date(n.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleToggle(n)}
                          className={`p-2 rounded-lg transition-colors ${
                            n.is_active
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={n.is_active ? 'Disable' : 'Enable'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(n)}
                          className="p-2 text-gray-600 hover:text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Notification' : 'Create Notification'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-xl border-2 border-red-300 bg-red-50 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-900">{formError}</p>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="e.g. Scheduled Maintenance Notice"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Message <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-y"
                  placeholder="Write the notification message that users will see on their dashboard..."
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notification Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const selected = form.notification_type === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setForm({ ...form, notification_type: key as 'information' | 'warning' | 'error' })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          selected
                            ? `${cfg.border} ${cfg.bg} ring-2 ring-purple-100`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                        <span className={`text-xs font-medium ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Lower numbers appear first on the user dashboard</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
