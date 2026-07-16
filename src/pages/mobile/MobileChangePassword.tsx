import { useState, useEffect, FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';
import { validatePassword, PASSWORD_REQUIREMENTS } from '../../utils/passwordValidation';

export default function MobileChangePassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const { logout } = useAuth();
  const [formData, setFormData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userId) navigate('/mobile/login', { replace: true });
  }, [userId, navigate]);

  if (!userId) return null;

  const handleLogout = () => { logout(); navigate('/mobile/login', { replace: true }); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(false);

    if (!formData.currentPassword) { setError('Current password is required.'); return; }
    const pv = validatePassword(formData.newPassword);
    if (!pv.isValid) { setError(pv.error!); return; }
    if (!formData.confirmPassword) { setError('Please confirm your new password.'); return; }
    if (formData.newPassword !== formData.confirmPassword) { setError('New passwords do not match.'); return; }
    if (formData.currentPassword === formData.newPassword) { setError('New password must be different from current.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ user_id: userId, current_password: formData.currentPassword, new_password: formData.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setSuccess(true);
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout userId={userId} userEmail={userEmail} onLogout={handleLogout} showBack title="Change Password">
      <div className="px-4 py-4 max-w-sm mx-auto">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div><p className="text-sm font-semibold text-red-900">Error</p><p className="text-xs text-red-800 mt-0.5">{error}</p></div>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-300 rounded-xl p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div><p className="text-sm font-semibold text-green-900">Success</p><p className="text-xs text-green-800 mt-0.5">Password changed successfully!</p></div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm pr-10"
                required minLength={8} maxLength={20} disabled={loading || success} placeholder="Enter current password" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm pr-10"
                required minLength={8} maxLength={20} disabled={loading || success} placeholder="Enter new password" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c76f0] text-sm pr-10"
                required minLength={8} maxLength={20} disabled={loading || success} placeholder="Re-enter new password" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-600 mb-2 font-medium">Password must contain:</p>
            <ul className="text-xs text-gray-500 space-y-0.5">
              {PASSWORD_REQUIREMENTS.map((req, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-[#8c76f0] rounded-full"></span>{req}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/mobile/dashboard', { state: { userId, userEmail } })}
              disabled={loading || success}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium active:scale-95 transition-transform disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || success}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : <><Lock className="w-4 h-4" />Change Password</>}
            </button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
