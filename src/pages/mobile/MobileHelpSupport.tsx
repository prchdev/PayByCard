import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Plus, FileText, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import CreateTicketModal from '../support/CreateTicketModal';
import TicketDetailsModal from '../support/TicketDetailsModal';
import { useAuth } from '../../contexts/AuthContext';

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

const STATUS_OPTIONS = [
  'All',
  'Open',
  'In Progress',
  'On Hold',
  'Waiting For More Details',
  'Resolved',
  'Closed',
];

export default function MobileHelpSupport() {
  const navigate = useNavigate();
  const userId = sessionStorage.getItem('userId') || '';
  const userEmail = sessionStorage.getItem('userEmail') || '';

  useEffect(() => {
    if (!userId) {
      navigate('/mobile/login');
    }
  }, [userId, navigate]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/mobile/login');
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, currentPage]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId: userId,
        page: currentPage.toString(),
        limit: '10',
      });

      if (statusFilter !== 'All') {
        params.append('status', statusFilter);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-support-tickets?${params}`,
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
        throw new Error(result.error || 'Failed to fetch tickets');
      }

      setTickets(result.tickets || []);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketCreated = () => {
    setShowCreateModal(false);
    setCurrentPage(1);
    fetchTickets();
  };

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowDetailsModal(true);
  };

  const handleDetailsClose = () => {
    setShowDetailsModal(false);
    setSelectedTicket(null);
    fetchTickets();
  };

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'text-red-600';
      case 'High':
        return 'text-orange-600';
      case 'Medium':
        return 'text-yellow-600';
      case 'Low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <MobileLayout
      userId={userId}
      userEmail={userEmail}
      onLogout={handleLogout}
      showBack={true}
    >
      <div className="px-4 py-3">
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>
              <p className="text-gray-500 text-xs">Raise and manage your support tickets</p>
            </div>
          </div>
        </div>

        {/* Create Ticket - Full Width Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-2 mb-3 px-6 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          Create New Ticket
        </button>

        {/* Status Filter - Horizontal Scrollable Pills */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1.5 px-1">Filter by Status</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Loading tickets...</p>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-50 to-violet-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="w-6 h-6 text-[#8c76f0]" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1.5">No Tickets Found</h3>
            <p className="text-gray-600 text-xs mb-3 max-w-xs mx-auto">
              {statusFilter !== 'All'
                ? `You don't have any tickets with status "${statusFilter}"`
                : "You haven't created any support tickets yet"}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              Create Your First Ticket
            </button>
          </div>
        ) : (
          /* Ticket Cards */
          <>
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => handleTicketClick(ticket)}
                  className="bg-white rounded-2xl border-2 border-gray-200 hover:border-[#8c76f0] p-3 transition-all cursor-pointer active:scale-[0.99]"
                >
                  {/* Top row: ticket number + status badge */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Ticket #</p>
                      <p className="text-sm font-bold text-[#8c76f0]">{ticket.ticket_number}</p>
                    </div>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="mb-1.5">
                    <p className="text-xs text-gray-500">Category</p>
                    <p className="text-sm font-medium text-gray-900">{ticket.category}</p>
                  </div>

                  {/* Sub-Category */}
                  <div className="mb-2">
                    <p className="text-xs text-gray-500">Sub-Category</p>
                    <p className="text-sm text-gray-700 truncate">{ticket.sub_category}</p>
                  </div>

                  {/* Bottom row: priority + created date + view button */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Priority:</span>
                        <span className={`text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Created:</span>
                        <span className="text-xs text-gray-600">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTicketClick(ticket);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-[#8c76f0] rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Info Banner */}
        <div className="mt-4 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-2xl px-3 py-2.5 shadow-lg">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#8c76f0] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">About Support Tickets</p>
              <p className="text-xs text-gray-700 mt-1">
                Need help? Create a support ticket and our team will assist you. You can track the status of your tickets and receive updates on your queries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <CreateTicketModal
          userId={userId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleTicketCreated}
        />
      )}

      {/* Ticket Details Modal */}
      {showDetailsModal && selectedTicket && (
        <TicketDetailsModal
          ticketId={selectedTicket.id}
          userId={userId}
          onClose={handleDetailsClose}
        />
      )}
    </MobileLayout>
  );
}
