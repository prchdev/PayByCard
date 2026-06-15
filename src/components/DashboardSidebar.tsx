import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  HelpCircle,
  Lock,
  Users,
  Send,
  Landmark,
  History,
} from 'lucide-react';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import SessionTimeoutModal from './SessionTimeoutModal';

interface DashboardSidebarProps {
  userId: string;
  userEmail: string;
  currentPage: 'dashboard' | 'kyc' | 'beneficiaries' | 'bank-accounts' | 'change-password' | 'settings' | 'help' | 'make-payment' | 'my-transactions';
  isMobileMenuOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function DashboardSidebar({
  userId,
  userEmail,
  currentPage,
  isMobileMenuOpen,
  onClose,
  onLogout
}: DashboardSidebarProps) {
  const navigate = useNavigate();
  const { showWarning, secondsLeft, extendSession } = useSessionTimeout(onLogout);

  const handleNavigation = (path: string, page: string) => {
    if (currentPage !== page) {
      navigate(path, { state: { userId, userEmail } });
    }
    onClose();
  };

  const menuItems = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      page: 'dashboard',
      path: '/dashboard',
      onClick: () => handleNavigation('/dashboard', 'dashboard')
    },
    {
      icon: ShieldCheck,
      label: 'My KYC Details',
      page: 'kyc',
      path: '/kyc-verification',
      onClick: () => handleNavigation('/kyc-verification', 'kyc')
    },
    {
      icon: Users,
      label: 'My Beneficiaries',
      page: 'beneficiaries',
      path: '/my-beneficiaries',
      onClick: () => handleNavigation('/my-beneficiaries', 'beneficiaries')
    },
    {
      icon: Landmark,
      label: 'My Bank Accounts',
      page: 'bank-accounts',
      path: '/my-bank-accounts',
      onClick: () => handleNavigation('/my-bank-accounts', 'bank-accounts')
    },
    {
      icon: Send,
      label: 'Make Payment',
      page: 'make-payment',
      path: '/make-payment',
      onClick: () => handleNavigation('/make-payment', 'make-payment')
    },
    {
      icon: History,
      label: 'My Transactions',
      page: 'my-transactions',
      path: '/my-transactions',
      onClick: () => handleNavigation('/my-transactions', 'my-transactions')
    },
    {
      icon: Lock,
      label: 'Change Password',
      page: 'change-password',
      path: '/change-password',
      onClick: () => handleNavigation('/change-password', 'change-password')
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      page: 'help',
      path: '/help-support',
      onClick: () => handleNavigation('/help-support', 'help')
    },
  ];

  return (
    <>
      {showWarning && (
        <SessionTimeoutModal
          secondsLeft={secondsLeft}
          onStay={extendSession}
          onLogout={onLogout}
        />
      )}

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:sticky top-20 left-0 h-[calc(100vh-80px)]
        w-64 bg-white border-r border-gray-200 z-40
        transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <nav className="p-4 space-y-1">
          {menuItems.map((item, index) => {
            const active = currentPage === item.page;
            return (
              <button
                key={index}
                onClick={item.onClick}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                  ${active
                    ? 'bg-gradient-to-r from-purple-50 to-violet-50 text-[#8c76f0] border-2 border-[#8c76f0]'
                    : 'text-gray-700 hover:bg-gray-50 border-2 border-transparent'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}

          <button
            onClick={onLogout}
            className="w-full flex lg:hidden items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50 border-2 border-transparent"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </nav>

        {/* Help Section at Bottom of Sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#8c76f0] mb-1">Need Help?</p>
            <p className="text-xs text-gray-700 mb-3">
              Contact our support team for assistance
            </p>
            <button
              onClick={() => {
                navigate('/help-support', { state: { userId, userEmail } });
                onClose();
              }}
              className="w-full px-3 py-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Contact Support
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
