import { useState, useEffect, useRef } from 'react';
import { X, Send, Upload, FileText, Loader2, AlertCircle, User, Clock, Tag, MessageCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface TicketDetailsModalProps {
  ticketId: string;
  userId: string;
  onClose: () => void;
}

interface Ticket {
  id: string;
  ticket_number: string;
  category: string;
  sub_category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  reply_id: string;
  ticket_id: string;
  user_type: 'user' | 'admin';
  message: string;
  created_at: string;
  user_name: string;
  admin_name: string;
  attachment_url: string | null;
  attachment_filename: string | null;
  attachments: Attachment[];
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
}

export default function TicketDetailsModal({ ticketId, userId, onClose }: TicketDetailsModalProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    fetchTicketDetails();
  }, [ticketId]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const fetchTicketDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-ticket-details?ticketId=${ticketId}&userId=${userId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch ticket details');
      }

      setTicket(result.ticket);
      setReplies(result.replies || []);
      setAttachments(result.attachments || []);
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (replyFiles.length + selectedFiles.length > 3) {
      setError('Maximum 3 files allowed');
      return;
    }

    const invalidFiles = selectedFiles.filter(file => {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      const maxSize = 1048576;
      return !validTypes.includes(file.type) || file.size > maxSize;
    });

    if (invalidFiles.length > 0) {
      setError('Files must be PNG, JPG, JPEG, or PDF and less than 1MB each');
      return;
    }

    setReplyFiles([...replyFiles, ...selectedFiles]);
    setError('');
  };

  const removeFile = (index: number) => {
    setReplyFiles(replyFiles.filter((_, i) => i !== index));
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setSending(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-ticket-reply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketId,
            userId,
            message: replyMessage,
            ip: 'user',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reply');
      }

      const replyId = result.reply.id;

      for (const file of replyFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ticketId', ticketId);
        formData.append('replyId', replyId);
        formData.append('userId', userId);
        formData.append('ip', 'user');

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
          console.error('Failed to upload file:', file.name);
        }
      }

      setReplyMessage('');
      setReplyFiles([]);
      fetchTicketDetails();
    } catch (err) {
      console.error('Error sending reply:', err);
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-ticket-attachment?filePath=${encodeURIComponent(attachment.file_path)}&userId=${userId}&isAdmin=false`,
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

  const canReply = ticket && !['Resolved', 'Closed'].includes(ticket.status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'On Hold':
        return 'bg-orange-100 text-orange-800';
      case 'Waiting For More Details':
        return 'bg-purple-100 text-purple-800';
      case 'Resolved':
        return 'bg-green-100 text-green-800';
      case 'Closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-center text-gray-900 font-medium">Failed to load ticket details</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-6 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b-2 border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Ticket #{ticket.ticket_number}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-purple-200 rounded-xl p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">Category:</span>
                <span className="text-sm font-medium text-gray-900">{ticket.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">Created:</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(ticket.created_at).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">Sub-Category:</p>
              <p className="text-sm font-medium text-gray-900">{ticket.sub_category}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Description:</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
            </div>
            {attachments.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Attachments:</p>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() => downloadAttachment(attachment)}
                      className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
                    >
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-900">{attachment.file_name}</span>
                      <span className="text-xs text-gray-500">
                        ({(attachment.file_size / 1024).toFixed(1)} KB)
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {replies.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Conversation</h3>
              </div>
              {replies.map((reply) => (
                <div
                  key={reply.reply_id}
                  className={`rounded-xl p-4 ${
                    reply.user_type === 'admin'
                      ? 'bg-green-50 border-2 border-green-200'
                      : 'bg-purple-50 border-2 border-purple-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      reply.user_type === 'admin' ? 'bg-green-200' : 'bg-purple-200'
                    }`}>
                      <User className={`w-4 h-4 ${
                        reply.user_type === 'admin' ? 'text-green-700' : 'text-purple-700'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {reply.user_type === 'admin' ? reply.admin_name : reply.user_name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          reply.user_type === 'admin'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-purple-200 text-purple-800'
                        }`}>
                          {reply.user_type === 'admin' ? 'Admin' : 'You'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{reply.message}</p>
                      {reply.attachments && reply.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {reply.attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              onClick={() => downloadAttachment(attachment)}
                              className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span className="text-sm text-gray-900">{attachment.file_name}</span>
                              <span className="text-xs text-gray-500">
                                ({(attachment.file_size / 1024).toFixed(1)} KB)
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={repliesEndRef} />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-900">{error}</p>
            </div>
          )}
        </div>

        {canReply ? (
          <form onSubmit={handleSendReply} className="border-t-2 border-gray-200 p-6 flex-shrink-0">
            <div className="space-y-4">
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all resize-none"
              />

              {replyFiles.length > 0 && (
                <div className="space-y-2">
                  {replyFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-900">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={replyFiles.length >= 3}
                  className="px-4 py-2 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Attach</span>
                </button>
                <button
                  type="submit"
                  disabled={sending || !replyMessage.trim()}
                  className="flex-1 px-6 py-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Reply
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="border-t-2 border-gray-200 p-6 bg-gray-50">
            <p className="text-center text-gray-600 font-medium">
              This ticket is {ticket.status.toLowerCase()} and cannot accept new replies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
