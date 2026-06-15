import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Search, RefreshCw, CreditCard as Edit, Power, Shield, User, Crown, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { validatePassword, PASSWORD_REQUIREMENTS } from '../../utils/passwordValidation';
import { useAdminPermission } from './useAdminPermission';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'moderator';
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminUserManagement() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? '';
  const { loading: permLoading, canEdit } = useAdminPermission('users');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
      return;
    }
    fetchAdminUsers();
  }, [adminId]);

  const fetchAdminUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ adminId }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setAdminUsers(data.adminUsers || []);
      } else {
        setError(data.error || 'Failed to fetch admin users');
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
      setError('Failed to fetch admin users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to ${user.is_active ? 'disable' : 'enable'} ${user.full_name}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-toggle-user-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            adminId,
            targetUserId: user.id,
            isActive: !user.is_active,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        setTimeout(() => setSuccess(''), 5000);
        fetchAdminUsers();
      } else {
        setError(data.error || 'Failed to update admin status');
      }
    } catch (error) {
      console.error('Error updating admin status:', error);
      setError('Failed to update admin status');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = adminUsers.filter((user) => {
    const q = search.toLowerCase();
    return (
      !q ||
      user.email.toLowerCase().includes(q) ||
      user.full_name.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q)
    );
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'moderator':
        return <User className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const config = {
      super_admin: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Super Admin' },
      admin: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Admin' },
      moderator: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Moderator' },
    };

    const style = config[role as keyof typeof config] || config.moderator;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {getRoleIcon(role)}
        {style.label}
      </span>
    );
  };

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              </div>
              <p className="text-gray-500 text-sm mt-1 ml-[52px]">
                Manage admin users and their permissions
              </p>
            </div>
            {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
            >
              <UserPlus className="w-5 h-5" />
              Add Admin User
            </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-xl px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-800 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-xl px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-900">Success</p>
                <p className="text-sm text-green-800 mt-0.5">{success}</p>
              </div>
            </div>
          </div>
        )}

        {canEdit && (
        <button
          onClick={() => setShowAddModal(true)}
          className="md:hidden w-full flex items-center justify-center gap-2 mb-6 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
        >
          <UserPlus className="w-5 h-5" />
          Add New Admin User
        </button>
        )}

        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
          <div className="p-6 border-b border-gray-200 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                />
              </div>
              <button
                onClick={fetchAdminUsers}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 border-2 border-gray-300 rounded-xl hover:border-[#8c76f0] hover:bg-purple-50 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{filtered.length} {filtered.length === 1 ? 'admin user' : 'admin users'}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-[#8c76f0] animate-spin mx-auto mb-4" />
              <p className="text-gray-600 text-sm">Loading admin users...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-50 to-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#8c76f0]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No admin users found</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {search ? 'Try adjusting your search criteria' : 'Add your first admin user to get started'}
              </p>
              {!search && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <UserPlus className="w-5 h-5" />
                  Add Admin User
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Admin User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          )}
                          {canEdit && (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={actionLoading || user.id === adminId}
                            className={`p-2 rounded-lg transition-colors ${
                              user.id === adminId
                                ? 'text-gray-400 cursor-not-allowed'
                                : user.is_active
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={user.id === adminId ? 'Cannot disable yourself' : user.is_active ? 'Disable' : 'Enable'}
                          >
                            <Power className="w-5 h-5" />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddAdminModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchAdminUsers();
          }}
          adminId={adminId}
        />
      )}

      {showEditModal && selectedUser && (
        <EditAdminModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            fetchAdminUsers();
          }}
          adminId={adminId}
        />
      )}
    </AdminLayout>
  );
}

interface AddAdminModalProps {
  onClose: () => void;
  onSuccess: () => void;
  adminId: string;
}

function AddAdminModal({ onClose, onSuccess, adminId }: AddAdminModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'admin' as 'super_admin' | 'admin' | 'moderator',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error!);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-add-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ adminId, ...formData }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        setTimeout(() => onSuccess(), 1500);
      } else {
        setError(data.error || 'Failed to add admin user');
      }
    } catch (error) {
      console.error('Error adding admin user:', error);
      setError('Failed to add admin user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Add New Admin User</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-green-700 text-sm font-medium">{success}</p>
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-5 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Admin Details
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-600">*</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                maxLength={20}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                placeholder="Enter password"
              />
              <div className="mt-2 bg-gray-50 border border-gray-300 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-2 font-medium">Password must contain:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req, idx) => (
                    <li key={idx}>• {req}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
              >
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-[#8c76f0] hover:bg-purple-50 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Admin'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditAdminModalProps {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
  adminId: string;
}

function EditAdminModal({ user, onClose, onSuccess, adminId }: EditAdminModalProps) {
  const [formData, setFormData] = useState({
    email: user.email,
    password: '',
    fullName: user.full_name,
    role: user.role,
    isActive: user.is_active,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (formData.password) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        setError(passwordValidation.error!);
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            adminId,
            targetUserId: user.id,
            ...formData,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        setTimeout(() => onSuccess(), 1500);
      } else {
        setError(data.error || 'Failed to update admin user');
      }
    } catch (error) {
      console.error('Error updating admin user:', error);
      setError('Failed to update admin user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Edit className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Edit Admin User</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-green-700 text-sm font-medium">{success}</p>
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-5 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Admin Details
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password (leave empty to keep current)
              </label>
              <input
                type="password"
                minLength={8}
                maxLength={20}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                placeholder="Enter new password or leave empty"
              />
              {formData.password && (
                <div className="mt-2 bg-gray-50 border border-gray-300 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-2 font-medium">Password must contain:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {PASSWORD_REQUIREMENTS.map((req, idx) => (
                      <li key={idx}>• {req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
              >
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-[#8c76f0] hover:bg-purple-50 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Admin'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
