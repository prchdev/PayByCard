import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Plus, Save, X, AlertCircle, CheckCircle, Loader2,
  Send, Calendar, Clock, Users, Trash2, Ban, ArrowLeft, ChevronLeft, ChevronRight, FileText,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface BulkSMSCampaign {
  id: string;
  campaign_name: string;
  message: string;
  recipient_filter: string;
  filter_days: number;
  hourly_rate: number;
  status: string;
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  dlt_template_id: string;
}

interface CampaignForm {
  campaign_name: string;
  message: string;
  recipient_filter: string;
  filter_days: number;
  hourly_rate: number;
  scheduled_at: string;
  send_now: boolean;
  dlt_template_id: string;
}

interface RecipientRecord {
  id: string;
  email_or_phone: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

const RECIPIENT_FILTERS = [
  { value: 'all_users', label: 'All Users' },
  { value: 'kyced_users', label: 'KYCed Users' },
  { value: 'kyced_no_payment', label: 'KYCed but not done payment' },
  { value: 'non_kyced_users', label: 'Non-KYCed Users' },
  { value: 'kyced_no_payment_x_days', label: 'KYCed but not done payment for X days' },
];

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-300',
  sending: 'bg-amber-50 text-amber-700 border-amber-300',
  completed: 'bg-green-50 text-green-700 border-green-300',
  failed: 'bg-red-50 text-red-700 border-red-300',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
};

const RECIPIENT_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

const PARAMETER_FIELDS = ['{first_name}', '{middle_name}', '{last_name}'];

const emptyForm: CampaignForm = {
  campaign_name: '',
  message: '',
  recipient_filter: 'all_users',
  filter_days: 7,
  hourly_rate: 100,
  scheduled_at: '',
  send_now: false,
  dlt_template_id: '',
};

const PER_PAGE = 50;

export default function BulkSMS() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('bulk-sms');

  const [campaigns, setCampaigns] = useState<BulkSMSCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CampaignForm>(emptyForm);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Report view state
  const [reportCampaign, setReportCampaign] = useState<BulkSMSCampaign | null>(null);
  const [recipients, setRecipients] = useState<RecipientRecord[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId, action: 'list' }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setCampaigns(data.campaigns || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load campaigns' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load campaigns' });
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const previewRecipients = async () => {
    setPreviewLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_id: adminId,
            action: 'preview_recipients',
            recipient_filter: formData.recipient_filter,
            filter_days: formData.filter_days,
          }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setPreviewCount(data.count);
      }
    } catch {
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (formData.recipient_filter) {
      previewRecipients();
    }
  }, [formData.recipient_filter, formData.filter_days]);

  const fetchRecipients = useCallback(async (campaignId: string, page: number) => {
    setRecipientLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId, action: 'get_recipients', campaign_id: campaignId, page, per_page: PER_PAGE }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setRecipients(data.recipients || []);
        setRecipientTotal(data.total || 0);
      }
    } catch {
      setRecipients([]);
    } finally {
      setRecipientLoading(false);
    }
  }, [adminId]);

  const openReport = (c: BulkSMSCampaign) => {
    setReportCampaign(c);
    setRecipientPage(1);
    setStatusFilter('all');
    fetchRecipients(c.id, 1);
  };

  useEffect(() => {
    if (reportCampaign) {
      fetchRecipients(reportCampaign.id, recipientPage);
    }
  }, [recipientPage, reportCampaign, fetchRecipients]);

  const insertParameter = (param: string) => {
    setFormData((prev) => ({ ...prev, message: prev.message + param }));
  };

  const handleSave = async (newStatus: string) => {
    if (!formData.campaign_name || !formData.message) {
      setMessage({ type: 'error', text: 'Campaign name and message are required' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_id: adminId,
            action: 'create',
            campaign_name: formData.campaign_name,
            message: formData.message,
            recipient_filter: formData.recipient_filter,
            filter_days: formData.filter_days,
            hourly_rate: formData.hourly_rate,
            scheduled_at: formData.send_now ? null : (formData.scheduled_at || null),
            status: newStatus,
            dlt_template_id: formData.dlt_template_id,
          }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Campaign ${newStatus === 'scheduled' ? 'scheduled' : 'saved'} successfully` });
        setShowForm(false);
        setFormData(emptyForm);
        setPreviewCount(null);
        fetchCampaigns();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save campaign' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save campaign' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (campaignId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId, action: 'cancel', campaign_id: campaignId }),
        }
      );
      if (response.ok) {
        setMessage({ type: 'success', text: 'Campaign cancelled' });
        fetchCampaigns();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to cancel campaign' });
    }
  };

  const handleDelete = async (campaignId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId, action: 'delete', campaign_id: campaignId }),
        }
      );
      if (response.ok) {
        setMessage({ type: 'success', text: 'Campaign deleted' });
        fetchCampaigns();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete campaign' });
    }
    setConfirmDelete(null);
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredRecipients = statusFilter === 'all'
    ? recipients
    : recipients.filter((r) => r.status === statusFilter);

  const totalPages = Math.ceil(recipientTotal / PER_PAGE);

  if (permLoading) return null;

  // ── Report View ──
  if (reportCampaign) {
    const sentPct = reportCampaign.total_recipients > 0
      ? Math.round((reportCampaign.sent_count / reportCampaign.total_recipients) * 100)
      : 0;
    return (
      <AdminLayout>
        <div className="max-w-6xl">
          <button onClick={() => setReportCampaign(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Campaigns
          </button>

          <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">{reportCampaign.campaign_name}</h2>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${STATUS_STYLES[reportCampaign.status] || STATUS_STYLES.draft}`}>
                {reportCampaign.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">{reportCampaign.message}</p>
            {reportCampaign.dlt_template_id && (
              <p className="text-xs text-gray-500 mb-4">DLT Template ID: <span className="font-mono font-medium text-gray-700">{reportCampaign.dlt_template_id}</span></p>
            )}

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-700">Delivery Progress</span>
                <span className="text-gray-500">{reportCampaign.sent_count} / {reportCampaign.total_recipients} ({sentPct}%)</span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full transition-all" style={{ width: `${sentPct}%` }} />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Total Recipients</p>
                <p className="text-lg font-bold text-gray-900">{reportCampaign.total_recipients}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                <p className="text-xs text-green-600 mb-1">Sent</p>
                <p className="text-lg font-bold text-green-700">{reportCampaign.sent_count}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-600 mb-1">Failed</p>
                <p className="text-lg font-bold text-red-700">{reportCampaign.failed_count}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Pending</p>
                <p className="text-lg font-bold text-gray-700">{Math.max(0, reportCampaign.total_recipients - reportCampaign.sent_count - reportCampaign.failed_count)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
              <span>Created: {fmtDate(reportCampaign.created_at)}</span>
              {reportCampaign.scheduled_at && <span>Scheduled: {fmtDate(reportCampaign.scheduled_at)}</span>}
              {reportCampaign.started_at && <span>Started: {fmtDate(reportCampaign.started_at)}</span>}
              {reportCampaign.completed_at && <span>Completed: {fmtDate(reportCampaign.completed_at)}</span>}
            </div>
          </div>

          {/* Recipient table */}
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8c76f0]" /> Recipient Delivery Status
              </h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8c76f0] outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {recipientLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#8c76f0] animate-spin" />
              </div>
            ) : filteredRecipients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recipients found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                        <th className="pb-2 pr-4">Phone Number</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Sent At</th>
                        <th className="pb-2">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRecipients.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="py-2.5 pr-4 font-mono text-gray-700">{r.email_or_phone || '-'}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${RECIPIENT_STATUS_STYLES[r.status] || RECIPIENT_STATUS_STYLES.pending}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-gray-500">{fmtDate(r.sent_at)}</td>
                          <td className="py-2.5 text-red-500 text-xs">{r.error_message || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Page {recipientPage} of {totalPages} ({recipientTotal} total)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRecipientPage((p) => Math.max(1, p - 1))}
                        disabled={recipientPage === 1}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRecipientPage((p) => Math.min(totalPages, p + 1))}
                        disabled={recipientPage === totalPages}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ── Main View ──
  return (
    <AdminLayout>
      <div className="max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk SMS</h1>
            <p className="text-gray-600 mt-1">Compose and send parameterized bulk SMS to users</p>
          </div>
          {!showForm && canEdit && (
            <button
              onClick={() => { setShowForm(true); setFormData(emptyForm); setPreviewCount(null); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" /> New Campaign
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
            <p className={`text-sm font-medium flex-1 ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>{message.text}</p>
            <button onClick={() => setMessage(null)}><X className="w-4 h-4 text-gray-500" /></button>
          </div>
        )}

        {showForm ? (
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New SMS Campaign</h2>
              <button onClick={() => { setShowForm(false); setFormData(emptyForm); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
              <input
                type="text"
                value={formData.campaign_name}
                onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="e.g. Payment Reminder"
              />
            </div>

            {/* DLT Content Template ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">DLT Content Template ID</label>
              <input
                type="text"
                value={formData.dlt_template_id}
                onChange={(e) => setFormData({ ...formData, dlt_template_id: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all font-mono"
                placeholder="e.g. 100716xxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500 mt-1">Required by Indian SMS gateways for transactional/bulk SMS delivery</p>
            </div>

            {/* Message with parameters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SMS Message</label>
              <div className="flex gap-2 mb-2">
                {PARAMETER_FIELDS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => insertParameter(p)}
                    className="px-3 py-1 text-xs font-medium bg-purple-50 text-[#8c76f0] border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={5}
                maxLength={500}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-y"
                placeholder="Compose your SMS here (use {first_name} for personalization)..."
              />
              <p className="text-xs text-gray-500 mt-1">{formData.message.length} / 500 characters</p>
            </div>

            {/* Recipient Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#8c76f0]" /> Recipient Filter
              </label>
              <select
                value={formData.recipient_filter}
                onChange={(e) => setFormData({ ...formData, recipient_filter: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
              >
                {RECIPIENT_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {formData.recipient_filter === 'kyced_no_payment_x_days' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Days (X)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.filter_days}
                    onChange={(e) => setFormData({ ...formData, filter_days: parseInt(e.target.value) || 7 })}
                    className="w-32 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  />
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-sm">
                {previewLoading ? (
                  <><Loader2 className="w-4 h-4 text-[#8c76f0] animate-spin" /> <span className="text-gray-500">Counting recipients...</span></>
                ) : previewCount !== null ? (
                  <span className="text-gray-700"><strong className="text-[#8c76f0]">{previewCount}</strong> recipients will receive this SMS</span>
                ) : null}
              </div>
            </div>

            {/* Hourly Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#8c76f0]" /> Hourly Send Rate
              </label>
              <input
                type="number"
                min="1"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseInt(e.target.value) || 100 })}
                className="w-32 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum SMS per hour (based on your SMS gateway capacity)</p>
            </div>

            {/* Schedule */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="sms-send-now"
                  checked={formData.send_now}
                  onChange={(e) => setFormData({ ...formData, send_now: e.target.checked })}
                  className="w-5 h-5 text-[#8c76f0] bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] checked:bg-[#8c76f0] checked:border-[#8c76f0] cursor-pointer"
                />
                <label htmlFor="sms-send-now" className="text-sm font-medium text-gray-700 cursor-pointer">Send immediately</label>
              </div>
              {!formData.send_now && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#8c76f0]" /> Schedule Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="w-full md:w-64 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleSave(formData.send_now ? 'sending' : 'scheduled')}
                disabled={saving || !canEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {formData.send_now ? 'Send Now' : 'Schedule Campaign'}
              </button>
              <button
                onClick={() => handleSave('draft')}
                disabled={saving || !canEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-[#8c76f0] transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5" /> Save as Draft
              </button>
              <button
                onClick={() => { setShowForm(false); setFormData(emptyForm); }}
                className="px-5 py-2.5 text-gray-500 rounded-xl font-medium hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-gray-300 p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No SMS campaigns yet. Click "New Campaign" to create one.</p>
              </div>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-5 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{c.campaign_name}</h3>
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${STATUS_STYLES[c.status] || STATUS_STYLES.draft}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 truncate">{c.message}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.total_recipients} recipients</span>
                        <span className="flex items-center gap-1"><Send className="w-3.5 h-3.5" /> {c.sent_count} sent</span>
                        {c.failed_count > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3.5 h-3.5" /> {c.failed_count} failed</span>}
                        <span>Created: {fmtDate(c.created_at)}</span>
                        {c.scheduled_at && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(c.scheduled_at)}</span>}
                        {c.completed_at && <span>Completed: {fmtDate(c.completed_at)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openReport(c)} className="p-2 text-gray-500 hover:text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors" title="View Report">
                        <FileText className="w-4 h-4" />
                      </button>
                      {canEdit && (c.status === 'draft' || c.status === 'scheduled' || c.status === 'sending') && (
                        <>
                          <button onClick={() => handleCancel(c.id)} className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Cancel">
                            <Ban className="w-4 h-4" />
                          </button>
                          {c.status === 'draft' && (
                            <button onClick={() => setConfirmDelete(c.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Campaign?</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">This action cannot be undone. The campaign and all its recipient records will be permanently deleted.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors">Delete</button>
                <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
