import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

const PAGE_MAP: Record<string, DashboardSidebarPropsPage> = {
  '/dashboard': 'dashboard',
  '/kyc-verification': 'kyc',
  '/my-beneficiaries': 'beneficiaries',
  '/my-bank-accounts': 'bank-accounts',
  '/my-cards': 'my-cards',
  '/make-payment': 'make-payment',
  '/my-transactions': 'my-transactions',
  '/change-password': 'change-password',
  '/help-support': 'help',
};

type DashboardSidebarPropsPage = 'dashboard' | 'kyc' | 'beneficiaries' | 'bank-accounts' | 'change-password' | 'settings' | 'help' | 'make-payment' | 'my-transactions' | 'my-cards';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId: ctxUserId, userEmail: ctxUserEmail, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const state = (location.state || {}) as { userId?: string; userEmail?: string };
  const userId = state.userId || ctxUserId || undefined;
  const userEmail = state.userEmail || ctxUserEmail || undefined;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Require a session token to access any dashboard page.
  // Without it, the user is not truly authenticated even if userId is in sessionStorage.
  const sessionToken = sessionStorage.getItem('pbc_session');
  if (!userId || !sessionToken) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavigation
        userEmail={userEmail}
        userId={userId}
        onLogout={handleLogout}
        onMenuToggle={() => setIsMobileMenuOpen((v) => !v)}
      />
      <div className="flex max-w-7xl mx-auto">
        <DashboardSidebar
          userId={userId}
          userEmail={userEmail}
          currentPage={PAGE_MAP[location.pathname] || 'dashboard'}
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />
        <Outlet context={{ userId, userEmail }} />
      </div>
      <Footer />
    </div>
  );
}
