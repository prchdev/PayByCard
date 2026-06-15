import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Plus, FileText, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import Footer from '../components/Footer';
import CreateTicketModal from './support/CreateTicketModal';
import TicketDetailsModal from './support/TicketDetailsModal';
import { useAuth } from '../contexts/AuthContext';

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

export default function HelpSupport() {
  const navigate = useNavigate();
  const userId = sessionStorage.getItem('userId');
  const userEmail = sessionStorage.getItem('userEmail') || '';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate('/login');
    }
  }, [userId, navigate]);

  if (!userId) return null;

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
    navigate('/login');
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
    <div className="min-h-screen bg-gray-50">
      <DashboardNavigation
        userEmail={userEmail}
        userId={userId}
        onLogout={handleLogout}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex max-w-7xl mx-auto">
        <DashboardSidebar
          userId={userId}
          userEmail={userEmail}
          currentPage="help"
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-6xl">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
                  </div>
                  <p className="text-gray-500 text-sm mt-1 ml-[52px]">
                    Raise and manage your support tickets
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Create Ticket
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="md:hidden w-full flex items-center justify-center gap-2 mb-6 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Create New Ticket
            </button>

            <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-6 mb-6 transition-all">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
                {['All', 'Open', 'In Progress', 'On Hold', 'Waiting For More Details', 'Resolved', 'Closed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === status
                        ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border-2 border-gray-300 p-12 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-[#8c76f0] animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 text-sm">Loading tickets...</p>
                </div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] p-12 text-center transition-all hover:shadow-xl">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-50 to-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-[#8c76f0]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tickets Found</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  {statusFilter !== 'All'
                    ? `You don't have any tickets with status "${statusFilter}"`
                    : "You haven't created any support tickets yet"}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Ticket
                </button>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] overflow-hidden transition-all">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-gray-300">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Ticket #</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Sub-Category</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Priority</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Created</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {tickets.map((ticket) => (
                          <tr
                            key={ticket.id}
                            className="hover:bg-purple-50 cursor-pointer transition-colors"
                            onClick={() => handleTicketClick(ticket)}
                          >
                            <td className="px-6 py-4 text-sm font-medium text-[#8c76f0]">
                              {ticket.ticket_number}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{ticket.category}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{ticket.sub_category}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                                {ticket.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTicketClick(ticket);
                                }}
                                className="flex items-center gap-1 text-sm text-[#8c76f0] hover:text-purple-700 font-medium"
                              >
                                <FileText className="w-4 h-4" />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-4 py-2 bg-white border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-4 py-2 bg-white border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-8 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-2xl px-6 py-4 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">About Support Tickets</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Need help? Create a support ticket and our team will assist you. You can track the status of your tickets and receive updates on your queries.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Footer />

      {showCreateModal && (
        <CreateTicketModal
          userId={userId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleTicketCreated}
        />
      )}

      {showDetailsModal && selectedTicket && (
        <TicketDetailsModal
          ticketId={selectedTicket.id}
          userId={userId}
          onClose={handleDetailsClose}
        />
      )}
    </div>
  );
}
