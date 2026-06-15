import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Server, Lock, Save, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface EmailSettingsData {
  id?: string;
  from_email: string;
  from_display_name: string;
  smtp_username: string;
  smtp_password: string;
  smtp_server: string;
  smtp_port: number;
  use_tls: boolean;
  use_ssl: boolean;
  updated_by_admin_id?: string;
  updated_by_admin_name?: string;
  updated_by_ip_address?: string;
  updated_at?: string;
}

export default function EmailSettings() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('email');

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  if (!adminId) return null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<EmailSettingsData>({
    from_email: '',
    from_display_name: '',
    smtp_username: '',
    smtp_password: '',
    smtp_server: '',
    smtp_port: 587,
    use_tls: true,
    use_ssl: false,
  });

  useEffect(() => {
    fetchEmailSettings();
  }, []);

  const fetchEmailSettings = async () => {
    setLoading(true);
    try {
      const adminId = sessionStorage.getItem('adminId');
      if (!adminId) {
        throw new Error('Admin not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-email-settings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admin_id: adminId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch email settings');
      }

      if (result.settings) {
        setFormData(result.settings);
      }
    } catch (error) {
      console.error('Error fetching email settings:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load email settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const adminId = sessionStorage.getItem('adminId');
      if (!adminId) {
        throw new Error('Admin not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-email-settings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_id: adminId,
            settings: formData,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save email settings');
      }

      setMessage({
        type: 'success',
        text: 'Email settings saved successfully',
      });

      if (result.settings) {
        setFormData(result.settings);
      }
    } catch (error) {
      console.error('Error saving email settings:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save email settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value,
    }));
  };

  if (permLoading) return null;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
        <p className="text-gray-600 mt-1">Configure SMTP settings for email communications</p>
      </div>

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
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
            {message.text}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Sender Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="from_email" className="block text-sm font-medium text-gray-700 mb-2">
                From Email Address <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                id="from_email"
                name="from_email"
                value={formData.from_email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="noreply@example.com"
              />
            </div>

            <div>
              <label htmlFor="from_display_name" className="block text-sm font-medium text-gray-700 mb-2">
                From Display Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="from_display_name"
                name="from_display_name"
                value={formData.from_display_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="PayByCard"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Server className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">SMTP Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="smtp_server" className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Server <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="smtp_server"
                name="smtp_server"
                value={formData.smtp_server}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="smtp.gmail.com"
              />
            </div>

            <div>
              <label htmlFor="smtp_port" className="block text-sm font-medium text-gray-700 mb-2">
                Port <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                id="smtp_port"
                name="smtp_port"
                value={formData.smtp_port}
                onChange={handleChange}
                required
                min="1"
                max="65535"
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="587"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use_tls"
                name="use_tls"
                checked={formData.use_tls}
                onChange={handleChange}
                className="w-5 h-5 text-[#8c76f0] border-2 border-gray-300 rounded focus:ring-2 focus:ring-purple-50 focus:ring-offset-0"
              />
              <label htmlFor="use_tls" className="text-sm font-medium text-gray-700">
                Use TLS Encryption (STARTTLS for port 587)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use_ssl"
                name="use_ssl"
                checked={formData.use_ssl}
                onChange={handleChange}
                className="w-5 h-5 text-[#8c76f0] border-2 border-gray-300 rounded focus:ring-2 focus:ring-purple-50 focus:ring-offset-0"
              />
              <label htmlFor="use_ssl" className="text-sm font-medium text-gray-700">
                Use SSL/TLS (Direct SSL for port 465)
              </label>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Encryption Guide</p>
                  <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                    <li><strong>Port 587:</strong> Enable TLS only (STARTTLS)</li>
                    <li><strong>Port 465:</strong> Enable both TLS and SSL</li>
                    <li><strong>Port 25:</strong> No encryption (not recommended)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#8c76f0]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Authentication</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="smtp_username" className="block text-sm font-medium text-gray-700 mb-2">
                Username <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="smtp_username"
                name="smtp_username"
                value={formData.smtp_username}
                onChange={handleChange}
                required
                autoComplete="username"
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="username@example.com"
              />
            </div>

            <div>
              <label htmlFor="smtp_password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-600">*</span>
              </label>
              <input
                type="password"
                id="smtp_password"
                name="smtp_password"
                value={formData.smtp_password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Security Notice</p>
                <p className="text-sm text-gray-700 mt-1">
                  Your SMTP password is encrypted before storage. For Gmail, use an App Password instead of your regular password.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving || !canEdit}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Settings
              </>
            )}
          </button>
        </div>

        {formData.updated_at && (
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Last Updated Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-600 mb-1">Updated By</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formData.updated_by_admin_name || 'N/A'}
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-600 mb-1">IP Address</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formData.updated_by_ip_address || 'N/A'}
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-600 mb-1">Updated At</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formData.updated_at ? new Date(formData.updated_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
      </div>
    </AdminLayout>
  );
}
