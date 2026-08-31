import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Plus, Save, X, AlertCircle, CheckCircle, Loader2,
  Send, Calendar, Clock, Users, Eye, Trash2, Ban, Bold, Italic,
  Underline, Link2, Image as ImageIcon, List, ListOrdered, Type,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface BulkEmailCampaign {
  id: string;
  campaign_name: string;
  subject: string;
  body_html: string;
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
}

interface CampaignForm {
  campaign_name: string;
  subject: string;
  body_html: string;
  recipient_filter: string;
  filter_days: number;
  hourly_rate: number;
  scheduled_at: string;
  send_now: boolean;
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

const PARAMETER_FIELDS = ['{first_name}', '{middle_name}', '{last_name}'];

const emptyForm: CampaignForm = {
  campaign_name: '',
  subject: '',
  body_html: '',
  recipient_filter: 'all_users',
  filter_days: 7,
  hourly_rate: 100,
  scheduled_at: '',
  send_now: false,
};

export default function BulkEmail() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('bulk-email');

  const [campaigns, setCampaigns] = useState<BulkEmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CampaignForm>(emptyForm);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-email`,
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-email`,
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

  const insertParameter = (param: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('insertText', false, param);
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
  };

  const insertParameterToSubject = (param: string) => {
    setFormData((prev) => ({ ...prev, subject: prev.subject + param }));
  };

  const execCommand = (command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (command === 'createLink') {
      const url = window.prompt('Enter URL:', 'https://');
      if (url) document.execCommand('createLink', false, url);
    } else if (command === 'insertImage') {
      const url = window.prompt('Enter image URL:', 'https://');
      if (url) document.execCommand('insertImage', false, url);
    } else if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, value);
    } else {
      document.execCommand(command, false, value);
    }
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
  };

  const handleEditorInput = () => {
    const editor = editorRef.current;
    if (editor) {
      setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
    }
  };

  const handleSave = async (newStatus: string) => {
    if (!formData.campaign_name || !formData.subject) {
      setMessage({ type: 'error', text: 'Campaign name and subject are required' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-email`,
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
            subject: formData.subject,
            body_html: formData.body_html,
            recipient_filter: formData.recipient_filter,
            filter_days: formData.filter_days,
            hourly_rate: formData.hourly_rate,
            scheduled_at: formData.send_now ? null : (formData.scheduled_at || null),
            status: newStatus,
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-email`,
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-email`,
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

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div className="max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk Email</h1>
            <p className="text-gray-600 mt-1">Compose and send parameterized bulk emails to users</p>
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
              <h2 className="text-lg font-semibold text-gray-900">New Email Campaign</h2>
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
                placeholder="e.g. Diwali Offer 2026"
              />
            </div>

            {/* Subject with parameters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <div className="flex gap-2 mb-2">
                {PARAMETER_FIELDS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => insertParameterToSubject(p)}
                    className="px-3 py-1 text-xs font-medium bg-purple-50 text-[#8c76f0] border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="Email subject (use {first_name} for personalization)"
              />
            </div>

            {/* Rich Text Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Body</label>
              <div className="flex flex-wrap gap-1 mb-2 p-2 bg-gray-50 border-2 border-gray-200 rounded-xl">
                <button type="button" onClick={() => execCommand('bold')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Bold"><Bold className="w-4 h-4" /></button>
                <button type="button" onClick={() => execCommand('italic')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Italic"><Italic className="w-4 h-4" /></button>
                <button type="button" onClick={() => execCommand('underline')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Underline"><Underline className="w-4 h-4" /></button>
                <div className="w-px bg-gray-300 mx-1" />
                <button type="button" onClick={() => execCommand('formatBlock', '<h2>')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Heading"><Type className="w-4 h-4" /></button>
                <button type="button" onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Bullet List"><List className="w-4 h-4" /></button>
                <button type="button" onClick={() => execCommand('insertOrderedList')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
                <div className="w-px bg-gray-300 mx-1" />
                <button type="button" onClick={() => execCommand('createLink')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Insert Link"><Link2 className="w-4 h-4" /></button>
                <button type="button" onClick={() => execCommand('insertImage')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Insert Image"><ImageIcon className="w-4 h-4" /></button>
                <div className="w-px bg-gray-300 mx-1" />
                {PARAMETER_FIELDS.map((p) => (
                  <button key={p} type="button" onClick={() => insertParameter(p)} className="px-3 py-2 text-xs font-medium bg-purple-50 text-[#8c76f0] border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                    {p}
                  </button>
                ))}
              </div>
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="min-h-[200px] max-h-[400px] overflow-y-auto px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all prose prose-sm max-w-none"
                style={{ lineHeight: '1.6' }}
                data-placeholder="Compose your email here..."
                suppressContentEditableWarning
              />
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
                  <span className="text-gray-700"><strong className="text-[#8c76f0]">{previewCount}</strong> recipients will receive this email</span>
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
              <p className="text-xs text-gray-500 mt-1">Maximum emails per hour (based on your email server capacity)</p>
            </div>

            {/* Schedule */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="send-now"
                  checked={formData.send_now}
                  onChange={(e) => setFormData({ ...formData, send_now: e.target.checked })}
                  className="w-5 h-5 text-[#8c76f0] bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#8c76f0] checked:bg-[#8c76f0] checked:border-[#8c76f0] cursor-pointer"
                />
                <label htmlFor="send-now" className="text-sm font-medium text-gray-700 cursor-pointer">Send immediately</label>
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
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No email campaigns yet. Click "New Campaign" to create one.</p>
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
                      <p className="text-sm text-gray-600 mb-3 truncate">{c.subject}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.total_recipients} recipients</span>
                        <span className="flex items-center gap-1"><Send className="w-3.5 h-3.5" /> {c.sent_count} sent</span>
                        {c.failed_count > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3.5 h-3.5" /> {c.failed_count} failed</span>}
                        <span>Created: {fmtDate(c.created_at)}</span>
                        {c.scheduled_at && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(c.scheduled_at)}</span>}
                        {c.completed_at && <span>Completed: {fmtDate(c.completed_at)}</span>}
                      </div>
                    </div>
                    {canEdit && (c.status === 'draft' || c.status === 'scheduled' || c.status === 'sending') && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleCancel(c.id)} className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Cancel">
                          <Ban className="w-4 h-4" />
                        </button>
                        {c.status === 'draft' && (
                          <button onClick={() => setConfirmDelete(c.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
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
