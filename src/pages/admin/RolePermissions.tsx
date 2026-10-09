import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Save, RefreshCw, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useTableSort, SortableTh } from './TableSort';

interface AdminPage {
  id: string;
  page_key: string;
  page_name: string;
  page_path: string;
  description: string;
  icon: string;
  display_order: number;
  is_active: boolean;
}

interface Permission {
  permission_id: string;
  can_view: boolean;
  can_edit: boolean;
}

interface RolePermissions {
  super_admin: (AdminPage & Permission)[];
  admin: (AdminPage & Permission)[];
  moderator: (AdminPage & Permission)[];
}

export default function RolePermissions() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<AdminPage[]>([]);
  const [permissions, setPermissions] = useState<RolePermissions>({
    super_admin: [],
    admin: [],
    moderator: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const adminId = localStorage.getItem('adminId');
  const adminRole = localStorage.getItem('adminRole');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login', { replace: true });
      return;
    }

    if (adminRole !== 'super_admin') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    fetchPermissions();
  }, [adminId, adminRole, navigate]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-role-permissions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch permissions');
      }

      setPages(data.pages);
      setPermissions(data.permissions);
    } catch (err: any) {
      setError(err.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (role: keyof RolePermissions, pageId: string, field: 'can_view' | 'can_edit', value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [role]: prev[role].map(page =>
        page.id === pageId
          ? {
              ...page,
              [field]: value,
              can_edit: field === 'can_view' && !value ? false : (field === 'can_edit' ? value : page.can_edit),
            }
          : page
      ),
    }));
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const updates = [];
      for (const role of Object.keys(permissions) as (keyof RolePermissions)[]) {
        for (const page of permissions[role]) {
          updates.push({
            role,
            pageId: page.id,
            canView: page.can_view,
            canEdit: page.can_edit,
          });
        }
      }

      for (const update of updates) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-role-permissions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ adminId, ...update }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update permissions');
        }
      }

      setSuccess('All permissions updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'moderator':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      default:
        return role;
    }
  };

  const { sortedData: sortedPages, sortConfig, handleSort } = useTableSort(pages, (page: AdminPage, key: string) => {
    switch (key) {
      case 'page': return page.page_name;
      default: return '';
    }
  });

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Role Permissions</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1 ml-[52px]">
            Configure which pages each role can access
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-xl px-6 py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-xl px-6 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-12 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-[#8c76f0] animate-spin mx-auto mb-4" />
              <p className="text-gray-600 text-sm">Loading permissions...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-300">
                  <tr>
                    <SortableTh label="Page" sortKey="page" sortConfig={sortConfig} onSort={handleSort} className="px-6 py-4 text-left text-sm font-semibold text-gray-900" />
                    {(['super_admin', 'admin', 'moderator'] as const).map((role) => (
                      <th key={role} className="px-6 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold border ${getRoleBadgeColor(role)}`}>
                          {getRoleDisplayName(role)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedPages.map((page) => (
                    <tr key={page.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{page.page_name}</p>
                          <p className="text-sm text-gray-500">{page.description}</p>
                        </div>
                      </td>
                      {(['super_admin', 'admin', 'moderator'] as const).map((role) => {
                        const pagePermission = permissions[role].find((p) => p.id === page.id);
                        if (!pagePermission) return <td key={role}></td>;

                        return (
                          <td key={role} className="px-6 py-4">
                            <div className="flex flex-col gap-2 items-center">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pagePermission.can_view}
                                  onChange={(e) => handlePermissionChange(role, page.id, 'can_view', e.target.checked)}
                                  disabled={role === 'super_admin'}
                                  className="w-4 h-4 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0] disabled:opacity-50"
                                />
                                <span className="text-sm text-gray-700">View</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pagePermission.can_edit}
                                  onChange={(e) => handlePermissionChange(role, page.id, 'can_edit', e.target.checked)}
                                  disabled={role === 'super_admin' || !pagePermission.can_view}
                                  className="w-4 h-4 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0] disabled:opacity-50"
                                />
                                <span className="text-sm text-gray-700">Edit</span>
                              </label>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">About Role Permissions</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Super Admin:</strong> Has full access to all pages by default and cannot be modified</li>
            <li><strong>Admin:</strong> Can be granted access to most pages except sensitive ones</li>
            <li><strong>Moderator:</strong> Limited access, typically for content review and basic tasks</li>
            <li><strong>View:</strong> Allows the role to see and access the page</li>
            <li><strong>Edit:</strong> Allows the role to make changes on the page (requires View permission)</li>
          </ul>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={fetchPermissions}
            disabled={loading || saving}
            className="flex-1 md:flex-none md:px-8 flex items-center justify-center gap-2 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-[#8c76f0] hover:bg-purple-50 font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleSaveAll}
            disabled={loading || saving}
            className="flex-1 md:flex-none md:px-8 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="hidden md:inline">Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span className="hidden md:inline">Save All Changes</span>
                <span className="md:hidden">Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
