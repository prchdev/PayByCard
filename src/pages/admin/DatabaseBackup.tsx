import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  HardDrive,
  FileText,
  Clock,
  Server,
  Code2,
  Calendar,
  Lock,
  Users,
  Settings,
  Shield,
  Archive,
  X,
  FileArchive,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface BackupHistoryItem {
  id: string;
  backup_type: string;
  backup_label: string;
  status: string;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number;
  file_count: number;
  created_by_admin_name: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  is_deleted: boolean;
}

const BACKUP_OPTIONS = [
  { key: 'schema_data', label: 'Database Schema & Data', desc: 'Full database dump with schema and data (supabase db dump)', icon: Database },
  { key: 'data_only', label: 'Data Only', desc: 'Export only table data without schema (supabase db dump --data-only)', icon: HardDrive },
  { key: 'schema_only', label: 'Schema Only', desc: 'Export only schema/DDL without data (supabase db dump --schema-only)', icon: FileText },
  { key: 'roles', label: 'Roles', desc: 'Export database roles and application permissions (supabase db dump --role-only)', icon: Shield },
  { key: 'linked', label: 'Linked Supabase Project', desc: 'Project metadata, extensions, schemas, and storage buckets (supabase db dump --linked)', icon: Server },
  { key: 'pg_dump', label: 'Full PostgreSQL Control', desc: 'Complete pg_dump including triggers, functions, and views', icon: Archive },
  { key: 'storage', label: 'Storage — Files/Images/PDFs', desc: 'Backup manifest of all files in storage buckets', icon: HardDrive },
  { key: 'storage_bucket_files', label: 'Storage Bucket Files (KYC + Tickets)', desc: 'Download all KYC documents and support ticket attachments as a ZIP file', icon: FileArchive },
  { key: 'edge_functions', label: 'Edge Functions', desc: 'Backup manifest of all deployed edge functions', icon: Code2 },
  { key: 'cron_jobs', label: 'Cron Jobs', desc: 'Backup all scheduled cron jobs and their run history', icon: Clock },
  { key: 'auth_users', label: 'Auth Users', desc: 'Backup all authenticated users from auth.users', icon: Users },
  { key: 'project_config', label: 'Project Configuration & Secrets', desc: 'Project settings, extensions, and bucket configurations', icon: Settings },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DatabaseBackup() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('database-backup');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  const [backups, setBackups] = useState<BackupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [fullBackup, setFullBackup] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-backup-history`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
          },
          body: JSON.stringify({ adminId }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch backup history');
      setBackups(data.backups || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load backup history',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleType = (key: string) => {
    if (fullBackup) return;
    setSelectedTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleCreateBackup = async () => {
    if (fullBackup) {
      await createBackup('full');
    } else if (selectedTypes.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one backup type or choose Full Backup' });
      return;
    } else {
      for (const type of selectedTypes) {
        await createBackup(type);
      }
    }
  };

  const createBackup = async (type: string) => {
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-backup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
          },
          body: JSON.stringify({ adminId, backupType: type }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create backup');

      if (data.allSuccess) {
        setMessage({ type: 'success', text: data.message || 'Backup completed successfully' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Backup failed' });
      }

      // Refresh history to show the new backup entry
      await fetchBackups();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create backup',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backup: BackupHistoryItem) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-download-backup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
          },
          body: JSON.stringify({ adminId, backupId: backup.id }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate download link');

      setDownloadUrl(data.downloadUrl);
      setDownloadFileName(data.fileName);
      setShowDownloadModal(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to download backup',
      });
    }
  };

  const handleDelete = async (backup: BackupHistoryItem) => {
    if (!confirm(`Are you sure you want to delete "${backup.backup_label}"? This will remove the backup file permanently. The download button will be disabled after deletion.`)) {
      return;
    }

    setDeleting(backup.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-backup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session') || '',
          },
          body: JSON.stringify({ adminId, backupId: backup.id }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete backup');

      setMessage({ type: 'success', text: 'Backup deleted successfully' });
      await fetchBackups();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete backup',
      });
    } finally {
      setDeleting(null);
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === 'full') return Archive;
    const option = BACKUP_OPTIONS.find((o) => o.key === type);
    return option?.icon || FileArchive;
  };

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div className="max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-[#8c76f0]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Database Backup</h1>
              <p className="text-gray-600 mt-1">
                Create, download, and manage database backups safely
              </p>
            </div>
          </div>
        </div>

        {/* Alert message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p
              className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        {/* Safety notice */}
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Safe Backup Guarantee</p>
            <p className="text-xs text-blue-700 mt-1">
              Backups are read-only operations. No files, database data, or tables will be deleted,
              modified, or locked during the backup process. The database remains fully operational.
            </p>
          </div>
        </div>

        {/* Full Backup option */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-violet-100 rounded-xl flex items-center justify-center">
                <Archive className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Full Backup</h2>
                <p className="text-sm text-gray-500">Backup everything in a single operation</p>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={fullBackup}
                onChange={(e) => {
                  setFullBackup(e.target.checked);
                  if (e.target.checked) setSelectedTypes([]);
                }}
                disabled={!canEdit}
                className="w-6 h-6 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0]"
              />
              <span className="text-sm font-medium text-gray-700">Select Full Backup</span>
            </label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, all backup types will be combined into a single backup file. This creates a comprehensive
            backup containing schema, data, roles, storage manifests, edge functions, cron jobs, auth users, and project configuration.
            It will appear as a single entry in the backup history.
          </p>
        </div>

        {/* Individual backup options */}
        {!fullBackup && (
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select What to Backup</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BACKUP_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedTypes.includes(option.key);
                return (
                  <label
                    key={option.key}
                    className={`flex items-start gap-3 p-4 border-2 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#8c76f0] bg-purple-50'
                        : 'border-gray-200 hover:border-[#8c76f0]'
                    } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleType(option.key)}
                      disabled={!canEdit}
                      className="w-5 h-5 text-[#8c76f0] border-gray-300 rounded focus:ring-[#8c76f0] mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-[#8c76f0] flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-900">{option.label}</p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{option.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Create backup button */}
        <div className="mb-8">
          <button
            onClick={handleCreateBackup}
            disabled={creating || !canEdit || (!fullBackup && selectedTypes.length === 0)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Backup...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                {fullBackup ? 'Start Full Backup' : `Start Backup (${selectedTypes.length} selected)`}
              </>
            )}
          </button>
        </div>

        {/* Backup History */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Backup History</h2>
            </div>
            <span className="text-xs text-gray-500">
              {backups.filter((b) => b.status === 'completed' && !b.is_deleted).length} available
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
            </div>
          ) : backups.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Database className="w-10 h-10 text-gray-300 mb-3 mx-auto" />
              <p className="text-gray-500 font-medium">No backups yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Create your first backup using the options above
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Backup Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {backups.map((backup) => {
                    const Icon = getTypeIcon(backup.backup_type);
                    const canDownload = backup.status === 'completed' && !backup.is_deleted && backup.file_path;
                    return (
                      <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {backup.backup_label}
                              </p>
                              {backup.file_name && (
                                <p className="text-xs text-gray-400 mt-0.5">{backup.file_name}</p>
                              )}
                            </div>
                          </div>
                          {backup.error_message && (
                            <p className="text-xs text-red-500 mt-2 ml-11">
                              {backup.error_message}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {backup.is_deleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full border border-gray-200">
                              <Trash2 className="w-3 h-3" />
                              Deleted
                            </span>
                          ) : backup.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </span>
                          ) : backup.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-200">
                              <AlertCircle className="w-3 h-3" />
                              Failed
                            </span>
                          ) : backup.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 bg-gray-50 text-gray-500 text-xs font-medium rounded-full border border-gray-200">
                              {backup.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {backup.file_size_bytes > 0 ? (
                            <span className="text-sm text-gray-600">
                              {formatBytes(backup.file_size_bytes)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {formatDate(backup.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {backup.created_by_admin_name || 'Admin'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleDownload(backup)}
                              disabled={!canDownload}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                canDownload
                                  ? 'text-[#8c76f0] hover:bg-purple-50'
                                  : 'text-gray-300 cursor-not-allowed'
                              }`}
                              title={canDownload ? 'Download backup' : 'Download not available'}
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                            {canEdit && !backup.is_deleted && (
                              <button
                                onClick={() => handleDelete(backup)}
                                disabled={deleting === backup.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete backup"
                              >
                                {deleting === backup.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && backups.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
              <p className="text-xs text-gray-500">
                Total: {backups.length} backup records | {backups.filter((b) => b.is_deleted).length} deleted
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Download Modal */}
      {showDownloadModal && downloadUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowDownloadModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Backup Ready</h3>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Your backup file is ready for download. The download link is valid for 1 hour.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileArchive className="w-4 h-4 text-[#8c76f0]" />
                <p className="text-sm font-medium text-gray-900 truncate">{downloadFileName}</p>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={downloadFileName || 'backup.sql'}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Download className="w-5 h-5" />
              Download File
            </a>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
