import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Lock, MessageCircle, Landmark, CreditCard, Clock, Users,
  LogOut, ChevronRight,
} from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';

export default function MobileMore() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const { logout } = useAuth();

  const handleLogout = () => { logout(); navigate('/mobile/login', { replace: true }); };

  const menuItems = [
    { icon: ShieldCheck, label: 'My KYC Details', path: '/mobile/kyc-verification', color: 'bg-green-50', iconColor: 'text-green-600' },
    { icon: Landmark, label: 'My Bank Accounts', path: '/mobile/my-bank-accounts', color: 'bg-blue-50', iconColor: 'text-blue-600' },
    { icon: Users, label: 'My Payee', path: '/mobile/my-beneficiaries', color: 'bg-purple-50', iconColor: 'text-[#8c76f0]' },
    { icon: Clock, label: 'Transaction History', path: '/mobile/my-transactions', color: 'bg-amber-50', iconColor: 'text-amber-600' },
    { icon: CreditCard, label: 'Make Payment', path: '/mobile/make-payment', color: 'bg-rose-50', iconColor: 'text-rose-600' },
    { icon: Lock, label: 'Change Password', path: '/mobile/change-password', color: 'bg-gray-100', iconColor: 'text-gray-600' },
    { icon: MessageCircle, label: 'Help & Support', path: '/mobile/help-support', color: 'bg-cyan-50', iconColor: 'text-cyan-600' },
  ];

  return (
    <MobileLayout userId={userId} userEmail={userEmail} onLogout={handleLogout}>
      <div className="px-4 py-3 space-y-4">
        {/* Account Section */}
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Account</h2>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path, { state: { userId, userEmail } })}
                className="w-full flex items-center gap-3 p-3 active:bg-gray-50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-gray-900">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-3 bg-white rounded-2xl border border-red-200 text-red-600 font-semibold text-sm active:scale-95 transition-transform shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>

        {/* App Version */}
        <div className="text-center pb-2">
          <p className="text-xs text-gray-400">PayByCard Mobile v1.0.0</p>
        </div>
      </div>
    </MobileLayout>
  );
}
