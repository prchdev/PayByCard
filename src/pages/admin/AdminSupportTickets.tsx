import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, ChevronLeft, ChevronRight, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Eye, Send, Upload, FileText, X, Loader2, User, Download } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { createClient } from '@supabase/supabase-js';
import { useAdminPermission } from './useAdminPermission';

interface SupportTicket {
  ticket_id: string;
  ticket_number: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_mobile: string;
  category: string;
  sub_category: string;
  description: string;
  status: 'Open' | 'In Progress' | 'On Hold' | 'Waiting For More Details' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  created_at: string;
  updated_at: string;
  last_reply_at: string | null;
  reply_count: number;
}

interface TicketReply {
  reply_id: string;
  ticket_id: string;
  user_id: string;
  user_type: 'user' | 'admin';
  message: string;
  attachment_url: string | null;
  attachment_filename: string | null;
  created_at: string;
  admin_name?: string;
  user_name?: string;
  attachments?: TicketAttachment[];
}

interface TicketAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All Tickets', icon: MessageSquare },
  { value: 'Open', label: 'Open', icon: AlertCircle },
  { value: 'In Progress', label: 'In Progress', icon: Clock },
  { value: 'On Hold', label: 'On Hold', icon: AlertCircle },
  { value: 'Waiting For More Details', label: 'Waiting For More Details', icon: MessageSquare },
  { value: 'Resolved', label: 'Resolved', icon: CheckCircle },
  { value: 'Closed', label: 'Closed', icon: XCircle },
];

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Categories' },
  { value: 'Account Related', label: 'Account Related' },
  { value: 'KYC Related', label: 'KYC Related' },
  { value: 'Transaction Related', label: 'Transaction Related' },
  { value: 'Report Fraud', label: 'Report Fraud' },
];

export default function AdminSupportTickets() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const adminName = sessionStorage.getItem('adminName') ?? 'Admin';
  const { loading: permLoading, canEdit } = useAdminPermission('support-tickets');

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReplies, setTicketReplies] = useState<TicketReply[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    fetchTickets();
  }, [adminId, statusFilter, categoryFilter]);

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-support-tickets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            adminId,
            statusFilter: statusFilter === 'all' ? undefined : statusFilter,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setTickets(data.tickets || []);
      } else {
        setError(data.error || 'Failed to fetch support tickets');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError('Failed to fetch support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setShowDetailsModal(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-ticket-details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ ticketId: ticket.ticket_id }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setTicketReplies(data.replies || []);
        setTicketAttachments(data.attachments || []);
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    }
  };

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  const downloadAttachment = async (attachment: TicketAttachment) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-ticket-attachment?filePath=${encodeURIComponent(attachment.file_path)}&userId=${adminId}&isAdmin=true`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to download file');
      }

      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = attachment.file_name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Only PDF, JPG, JPEG, and PNG files are allowed');
      return;
    }

    if (file.size > 1024 * 1024) {
      setError('File size must be less than 1MB');
      return;
    }

    setReplyFile(file);
    setError('');
  };

  const handleSubmitReply = async () => {
    if (!selectedTicket) return;
    if (!replyMessage.trim() && !replyFile) {
      setError('Please enter a message or attach a file');
      return;
    }

    setError('');
    setSuccessMessage('');

    setSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-ticket-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            ticketId: selectedTicket.ticket_id,
            userId: adminId,
            userType: 'admin',
            message: replyMessage,
            ip: 'admin',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit reply');
      }

      const replyId = data.reply.id;

      if (replyFile) {
        const formData = new FormData();
        formData.append('file', replyFile);
        formData.append('ticketId', selectedTicket.ticket_id);
        formData.append('replyId', replyId);
        formData.append('userId', adminId);
        formData.append('ip', 'admin');
        formData.append('isAdmin', 'true');

        const uploadResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-ticket-attachment`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          console.error('Failed to upload attachment');
        }
      }

      setReplyMessage('');
      setReplyFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessMessage('Reply sent successfully');
      handleViewTicket(selectedTicket);
    } catch (error) {
      console.error('Error submitting reply:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedTicket || newStatus === selectedTicket.status) return;

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-ticket-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            adminId,
            ticketId: selectedTicket.ticket_id,
            status: newStatus,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Ticket status updated successfully');
        setTimeout(() => {
          setShowDetailsModal(false);
          fetchTickets();
        }, 1500);
      } else {
        setError(data.error || 'Failed to update ticket status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update ticket status');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch =
      ticket.user_email.toLowerCase().includes(search.toLowerCase()) ||
      ticket.user_name.toLowerCase().includes(search.toLowerCase()) ||
      ticket.user_mobile.toLowerCase().includes(search.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      ticket.category.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredTickets.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + recordsPerPage);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'On Hold': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Waiting For More Details': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-gray-600 mt-1">Manage and respond to user support requests</p>
          </div>
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.value}
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                    statusFilter === filter.value
                      ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ticket number, name, email, mobile, or category..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
            >
              {CATEGORY_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            <select
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          {error && !showDetailsModal && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-900">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8c76f0]"></div>
            </div>
          ) : paginatedTickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No tickets found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ticket #</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User Details</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Replies</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTickets.map((ticket) => (
                      <tr key={ticket.ticket_id} className="border-b border-gray-100 hover:bg-purple-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono text-gray-900">{ticket.ticket_number}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">{ticket.user_name}</p>
                            <p className="text-gray-600 text-xs">{ticket.user_mobile}</p>
                            <p className="text-gray-600 text-xs">{ticket.user_email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">{ticket.category}</p>
                            <p className="text-gray-600 text-xs">{ticket.sub_category}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(ticket.status)}`}>
                            {ticket.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatDate(ticket.created_at)}</td>
                        <td className="py-3 px-4 text-sm text-center font-semibold text-gray-900">{ticket.reply_count}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleViewTicket(ticket)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#8c76f0] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(startIndex + recordsPerPage, filteredTickets.length)} of {filteredTickets.length} tickets
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border-2 border-gray-300 hover:border-[#8c76f0] hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border-2 border-gray-300 hover:border-[#8c76f0] hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showDetailsModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Ticket Details</h2>
                  <p className="text-sm text-white/80 mt-0.5">#{selectedTicket.ticket_number}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="bg-gray-50 p-5 rounded-xl space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Ticket Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">User Details</p>
                    <p className="font-semibold text-gray-900">{selectedTicket.user_name}</p>
                    <p className="text-sm text-gray-700">{selectedTicket.user_mobile}</p>
                    <p className="text-sm text-gray-700">{selectedTicket.user_email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Category</p>
                    <p className="font-semibold text-gray-900">{selectedTicket.category}</p>
                    <p className="text-sm text-gray-700">{selectedTicket.sub_category}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Ticket Number</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">{selectedTicket.ticket_number}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(selectedTicket.status)}`}>
                      {selectedTicket.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Created</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(selectedTicket.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Description
                </h3>
                <div className="bg-white border-2 border-gray-300 rounded-xl p-4">
                  <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
                {ticketAttachments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Initial Attachments:</p>
                    <div className="space-y-2">
                      {ticketAttachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          onClick={() => downloadAttachment(attachment)}
                          className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
                        >
                          <FileText className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-900 flex-1">{attachment.file_name}</span>
                          <span className="text-xs text-gray-500">
                            ({(attachment.file_size / 1024).toFixed(1)} KB)
                          </span>
                          <Download className="w-4 h-4 text-[#8c76f0]" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Conversation
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {ticketReplies.map((reply) => (
                    <div
                      key={reply.reply_id}
                      className={`p-4 rounded-xl border-2 ${
                        reply.user_type === 'admin'
                          ? 'bg-purple-50 border-[#8c76f0] ml-8'
                          : 'bg-white border-gray-300 mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          {reply.user_type === 'admin' ? reply.admin_name : reply.user_name}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded font-medium ${
                            reply.user_type === 'admin'
                              ? 'bg-[#8c76f0] text-white'
                              : 'bg-gray-300 text-gray-700'
                          }`}>
                            {reply.user_type.toUpperCase()}
                          </span>
                        </span>
                        <span className="text-xs text-gray-600">{formatDate(reply.created_at)}</span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{reply.message}</p>
                      {reply.attachments && reply.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {reply.attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              onClick={() => downloadAttachment(attachment)}
                              className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full"
                            >
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span className="text-sm text-gray-900 flex-1">{attachment.file_name}</span>
                              <span className="text-xs text-gray-500">
                                ({(attachment.file_size / 1024).toFixed(1)} KB)
                              </span>
                              <Download className="w-4 h-4 text-[#8c76f0]" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-900">{successMessage}</p>
                </div>
              )}

              <div className="bg-gray-50 p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Add Reply
                </h3>
                <div className="space-y-3">
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply here..."
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all resize-none bg-white"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-xl hover:border-[#8c76f0] hover:bg-purple-50 transition-all text-gray-700 font-medium"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">Attach File</span>
                    </button>
                    {replyFile && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-[#8c76f0] rounded-xl">
                        <FileText className="w-4 h-4 text-[#8c76f0]" />
                        <span className="text-sm text-gray-900">{replyFile.name}</span>
                        <button
                          onClick={() => {
                            setReplyFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSubmitReply}
                    disabled={submitting || (!replyMessage.trim() && !replyFile) || !canEdit}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {submitting ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Update Status
                </h3>
                <div className="space-y-3">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Waiting For More Details">Waiting For More Details</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={submitting || newStatus === selectedTicket.status || !canEdit}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Status'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
