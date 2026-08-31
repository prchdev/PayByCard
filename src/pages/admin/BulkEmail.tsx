import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Plus, Save, X, AlertCircle, CheckCircle, Loader2,
  Send, Calendar, Clock, Users, Eye, Trash2, Ban, Bold, Italic,
  Underline, Link2, Image as ImageIcon, List, ListOrdered, Type,
  ArrowLeft, ChevronLeft, ChevronRight, FileText,
  AlignLeft, AlignCenter, AlignRight, Link2Off, ZoomIn,
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

interface RecipientRecord {
  id: string;
  email_or_phone: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

const RECIPIENT_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

const PER_PAGE = 50;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [linkModal, setLinkModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' });
  const [imageModal, setImageModal] = useState<{ open: boolean; src: string; align: string; width: string }>({ open: false, src: '', align: 'none', width: '' });

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor || !savedRangeRef.current) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  // Report view state
  const [reportCampaign, setReportCampaign] = useState<BulkEmailCampaign | null>(null);
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

  const fetchRecipients = useCallback(async (campaignId: string, page: number) => {
    setRecipientLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bulk-email`,
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

  const openReport = (c: BulkEmailCampaign) => {
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
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, value);
    } else {
      document.execCommand(command, false, value);
    }
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImageLoading(true);
    const editor = editorRef.current;
    if (!editor) { setImageLoading(false); return; }
    editor.focus();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readFileAsDataURL(file);
      const img = `<img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;" />`;
      document.execCommand('insertHTML', false, img);
    }
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
    setImageLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLinkClick = () => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') {
      setMessage({ type: 'error', text: 'Select some text in the editor first, then click the link button' });
      return;
    }
    setLinkModal({ open: true, url: '' });
  };

  const applyLink = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const url = linkModal.url.trim();
    if (!url) { setLinkModal({ open: false, url: '' }); return; }
    const fullUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
    document.execCommand('createLink', false, fullUrl);
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
    setLinkModal({ open: false, url: '' });
  };

  const removeLink = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('unlink', false);
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
  };

  const setAlignment = (align: 'left' | 'center' | 'right') => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (align === 'left') document.execCommand('justifyLeft', false);
    else if (align === 'center') document.execCommand('justifyCenter', false);
    else if (align === 'right') document.execCommand('justifyRight', false);
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
  };

  const setFontSize = (size: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('fontSize', false, size);
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
  };

  const openImageModal = (img: HTMLImageElement) => {
    setImageModal({
      open: true,
      src: img.src,
      align: img.style.display === 'block' && img.style.marginLeft === 'auto' && img.style.marginRight === 'auto' ? 'center' : img.style.float === 'left' ? 'left' : img.style.float === 'right' ? 'right' : 'none',
      width: img.style.width || (img.style.maxWidth ? img.style.maxWidth : ''),
    });
  };

  const applyImageProperties = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const imgs = editor.querySelectorAll('img');
    for (const img of imgs) {
      if (img.src === imageModal.src) {
        img.style.float = '';
        img.style.display = '';
        img.style.marginLeft = '';
        img.style.marginRight = '';
        if (imageModal.align === 'center') {
          img.style.display = 'block';
          img.style.marginLeft = 'auto';
          img.style.marginRight = 'auto';
        } else if (imageModal.align === 'left') {
          img.style.float = 'left';
          img.style.marginRight = '12px';
        } else if (imageModal.align === 'right') {
          img.style.float = 'right';
          img.style.marginLeft = '12px';
        }
        if (imageModal.width) {
          img.style.width = imageModal.width;
          img.style.maxWidth = imageModal.width;
          img.style.height = 'auto';
        }
        break;
      }
    }
    setFormData((prev) => ({ ...prev, body_html: editor.innerHTML }));
    setImageModal({ open: false, src: '', align: 'none', width: '' });
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      openImageModal(target as HTMLImageElement);
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

  const filteredRecipients = statusFilter === 'all'
    ? recipients
    : recipients.filter((r) => r.status === statusFilter);

  const totalPages = Math.ceil(recipientTotal / PER_PAGE);

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
            <p className="text-sm text-gray-600 mb-1 font-medium">{reportCampaign.subject}</p>
            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: reportCampaign.body_html || '<p class="text-gray-400">No content</p>' }} />

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
                        <th className="pb-2 pr-4">Email</th>
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
              <div className="flex flex-wrap items-center gap-1 mb-2 p-2 bg-gray-50 border-2 border-gray-200 rounded-xl">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Bold"><Bold className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Italic"><Italic className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Underline"><Underline className="w-4 h-4" /></button>
                <div className="w-px bg-gray-300 mx-1" />
                <select
                  onMouseDown={saveSelection}
                  onChange={(e) => { restoreSelection(); setFontSize(e.target.value); e.target.selectedIndex = 0; }}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-700 outline-none focus:border-[#8c76f0]"
                  title="Font Size"
                  defaultValue=""
                >
                  <option value="" disabled>Size</option>
                  <option value="1">Small</option>
                  <option value="3">Normal</option>
                  <option value="5">Large</option>
                  <option value="7">X-Large</option>
                </select>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCommand('formatBlock', '<h2>'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Heading"><Type className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Bullet List"><List className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCommand('insertOrderedList'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
                <div className="w-px bg-gray-300 mx-1" />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setAlignment('left'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Align Left"><AlignLeft className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setAlignment('center'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Align Center"><AlignCenter className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setAlignment('right'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Align Right"><AlignRight className="w-4 h-4" /></button>
                <div className="w-px bg-gray-300 mx-1" />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleLinkClick(); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Convert selected text to link"><Link2 className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); removeLink(); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Remove Link"><Link2Off className="w-4 h-4" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleImageUploadClick(); }} disabled={imageLoading} className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50" title="Upload Image(s)">
                  {imageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                <div className="w-px bg-gray-300 mx-1" />
                {PARAMETER_FIELDS.map((p) => (
                  <button key={p} type="button" onMouseDown={(ev) => { ev.preventDefault(); insertParameter(p); }} className="px-3 py-2 text-xs font-medium bg-purple-50 text-[#8c76f0] border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-1">Tip: Click on an image in the editor to adjust its alignment and size.</p>
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onClick={handleEditorClick}
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
                    {canEdit && (c.status === 'completed' || c.status === 'failed' || c.status === 'cancelled') && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => openReport(c)} className="p-2 text-gray-500 hover:text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors" title="View Report">
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {canEdit && (c.status === 'draft' || c.status === 'scheduled' || c.status === 'sending') && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => openReport(c)} className="p-2 text-gray-500 hover:text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors" title="View Report">
                          <FileText className="w-4 h-4" />
                        </button>
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

        {/* Hyperlink modal */}
        {linkModal.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Insert Hyperlink</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">Enter the URL to convert the selected text into a clickable link.</p>
              <input
                type="text"
                value={linkModal.url}
                autoFocus
                onChange={(e) => setLinkModal({ ...linkModal, url: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setLinkModal({ open: false, url: '' }); }}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all mb-4"
                placeholder="https://example.com"
              />
              <div className="flex gap-3">
                <button onClick={applyLink} className="flex-1 px-4 py-2.5 bg-[#8c76f0] text-white rounded-xl font-medium hover:bg-purple-700 transition-colors">Apply Link</button>
                <button onClick={() => setLinkModal({ open: false, url: '' })} className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Image properties modal */}
        {imageModal.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Image Properties</h3>
              </div>
              <div className="mb-4">
                <img src={imageModal.src} alt="preview" className="max-h-32 rounded-xl border border-gray-200 mb-4" />
                <label className="block text-sm font-medium text-gray-700 mb-2">Alignment</label>
                <div className="flex gap-2 mb-4">
                  <button type="button" onClick={() => setImageModal({ ...imageModal, align: 'none' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${imageModal.align === 'none' ? 'border-[#8c76f0] bg-purple-50 text-[#8c76f0]' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>Inline</button>
                  <button type="button" onClick={() => setImageModal({ ...imageModal, align: 'left' })} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${imageModal.align === 'left' ? 'border-[#8c76f0] bg-purple-50 text-[#8c76f0]' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}><AlignLeft className="w-3.5 h-3.5" /> Left</button>
                  <button type="button" onClick={() => setImageModal({ ...imageModal, align: 'center' })} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${imageModal.align === 'center' ? 'border-[#8c76f0] bg-purple-50 text-[#8c76f0]' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}><AlignCenter className="w-3.5 h-3.5" /> Center</button>
                  <button type="button" onClick={() => setImageModal({ ...imageModal, align: 'right' })} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${imageModal.align === 'right' ? 'border-[#8c76f0] bg-purple-50 text-[#8c76f0]' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}><AlignRight className="w-3.5 h-3.5" /> Right</button>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Width (e.g. 300px, 50%, 100%)</label>
                <input
                  type="text"
                  value={imageModal.width}
                  onChange={(e) => setImageModal({ ...imageModal, width: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                  placeholder="e.g. 300px or 50%"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={applyImageProperties} className="flex-1 px-4 py-2.5 bg-[#8c76f0] text-white rounded-xl font-medium hover:bg-purple-700 transition-colors">Apply</button>
                <button onClick={() => setImageModal({ open: false, src: '', align: 'none', width: '' })} className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all">Cancel</button>
              </div>
            </div>
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
