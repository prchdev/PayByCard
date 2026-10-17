import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Lock, Shield, Home, FileCheck, Users, Mail, MessageSquare, CreditCard, IndianRupee, LayoutDashboard, DollarSign, Tag, Settings, Wallet, AlertTriangle, Undo2, BarChart2, UserSearch, ScanFace, ShieldCheck, Bell, Send, Smartphone, Building2, ReceiptText, Database, Landmark, Ticket } from 'lucide-react';
import Footer from '../../components/Footer';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import SessionTimeoutModal from '../../components/SessionTimeoutModal';

interface AdminLayoutProps {
  children: ReactNode;
}

interface MenuItem {
  page_key: string;
  page_path: string;
  page_name: string;
  icon: string;
  can_view: boolean;
  can_edit: boolean;
}

const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  Home,
  FileCheck,
  Users,
  Mail,
  MessageSquare,
  CreditCard,
  IndianRupee,
  Shield,
  Lock,
  DollarSign,
  Tag,
  Settings,
  Wallet,
  AlertTriangle,
  Undo2,
  BarChart2,
  UserSearch,
  ScanFace,
  ShieldCheck,
  Bell,
  Send,
  Smartphone,
  Building2,
  ReceiptText,
  Database,
  Landmark,
  Ticket,
};

interface MenuSection {
  label: string;
  items: { key: string; name: string; path: string; icon: string }[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    label: '',
    items: [
      { key: 'dashboard', name: 'Dashboard', path: '/admin/dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    label: 'Regular Usage',
    items: [
      { key: 'kyc', name: 'KYC Verification', path: '/admin/kyc-verification', icon: 'FileCheck' },
      { key: 'merchant-kyc', name: 'Merchant KYC', path: '/admin/merchant-kyc', icon: 'ScanFace' },
      { key: 'user-summary', name: 'User Summary', path: '/admin/user-summary', icon: 'UserSearch' },
      { key: 'manual-payout', name: 'Manual Payout', path: '/admin/manual-payout', icon: 'Wallet' },
      { key: 'reports', name: 'Reports', path: '/admin/reports', icon: 'BarChart2' },
    ],
  },
  {
    label: 'Help & Support',
    items: [
      { key: 'support-tickets', name: 'Support Ticket', path: '/admin/support-tickets', icon: 'MessageSquare' },
    ],
  },
  {
    label: 'Master Configuration',
    items: [
      { key: 'master-settings', name: 'Master Settings', path: '/admin/master-settings', icon: 'Settings' },
      { key: 'email', name: 'Email Settings', path: '/admin/email-settings', icon: 'Mail' },
      { key: 'sms', name: 'SMS Settings', path: '/admin/sms-settings', icon: 'Send' },
      { key: 'payment-limits', name: 'Payment Limit', path: '/admin/payment-limits', icon: 'IndianRupee' },
      { key: 'payment-gateway', name: 'Payment Gateway', path: '/admin/payment-gateway-settings', icon: 'CreditCard' },
      { key: 'payout-settings', name: 'Payout Settings', path: '/admin/payout-settings', icon: 'DollarSign' },
      { key: 'payment-option', name: 'Payment Option', path: '/admin/payment-option', icon: 'Tag' },
      { key: 'payment-categories', name: 'Payment Categories', path: '/admin/payment-categories', icon: 'Tag' },
      { key: 'kyc-method', name: 'KYC Method', path: '/admin/kyc-method', icon: 'ShieldCheck' },
      { key: 'dashboard-notification', name: 'Dashboard Notification', path: '/admin/dashboard-notification', icon: 'Bell' },
      { key: 'database-backup', name: 'Database Backup', path: '/admin/database-backup', icon: 'Database' },
      { key: 'gateway-settlement', name: 'Payment Gateway Settlement', path: '/admin/gateway-settlement', icon: 'Landmark' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { key: 'bulk-email', name: 'Bulk Email', path: '/admin/bulk-email', icon: 'Mail' },
      { key: 'bulk-sms', name: 'Bulk SMS', path: '/admin/bulk-sms', icon: 'MessageSquare' },
      { key: 'mobile-notifications', name: 'Mobile Notifications', path: '/admin/mobile-notifications', icon: 'Smartphone' },
      { key: 'offers', name: 'Offers', path: '/admin/offers', icon: 'Tag' },
      { key: 'coupons', name: 'Coupons', path: '/admin/coupons', icon: 'Ticket' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'vendor-management', name: 'Vendor Management', path: '/admin/vendor-management', icon: 'Building2' },
      { key: 'invoicing', name: 'Invoicing', path: '/admin/invoicing', icon: 'ReceiptText' },
    ],
  },
  {
    label: 'Admin User Management',
    items: [
      { key: 'users', name: 'Admin Management', path: '/admin/user-management', icon: 'Users' },
      { key: 'role-permissions', name: 'Roles Permission', path: '/admin/role-permissions', icon: 'Shield' },
      { key: 'change-password', name: 'Change Password', path: '/admin/change-password', icon: 'Lock' },
    ],
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const adminName = sessionStorage.getItem('adminName') ?? 'Admin';
  const adminEmail = sessionStorage.getItem('adminEmail') ?? '';
  const adminId = localStorage.getItem('adminId');

  useEffect(() => {
    const sessionToken = sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session');
    if (!adminId || !sessionToken) {
      sessionStorage.removeItem('adminId');
      sessionStorage.removeItem('adminEmail');
      sessionStorage.removeItem('adminName');
      sessionStorage.removeItem('pbc_admin_session');
      localStorage.removeItem('adminId');
      localStorage.removeItem('adminRole');
      localStorage.removeItem('pbc_admin_session');
      navigate('/admin/login');
      return;
    }
    fetchUserPermissions();
  }, [adminId, navigate]);

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-permissions`,
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

      if (response.ok) {
        const items = data.permissions.map((perm: any) => ({
          page_key: perm.page_key,
          page_path: perm.page_path,
          page_name: perm.page_name,
          icon: perm.icon,
          can_view: perm.can_view,
          can_edit: perm.can_edit,
        }));

        // Ensure dashboard is always first regardless of DB permissions
        if (!items.find((i: MenuItem) => i.page_key === 'dashboard')) {
          items.unshift({
            page_key: 'dashboard',
            page_path: '/admin/dashboard',
            page_name: 'Dashboard',
            icon: 'LayoutDashboard',
            can_view: true,
            can_edit: false,
          });
        }

        items.push({
          page_key: 'change-password',
          page_path: '/admin/change-password',
          page_name: 'Change Password',
          icon: 'Lock',
          can_view: true,
          can_edit: true,
        });

        setMenuItems(items);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminId');
    sessionStorage.removeItem('adminEmail');
    sessionStorage.removeItem('adminName');
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminRole');
    sessionStorage.removeItem('pbc_admin_session');
    localStorage.removeItem('pbc_admin_session');
    navigate('/admin/login');
  };

  const { showWarning, secondsLeft, extendSession } = useSessionTimeout(handleLogout);

  const handleNavigate = (page: string) => {
    const routes: Record<string, string> = {
      'about': '/about',
      'faq': '/faq',
      'terms': '/terms',
      'privacy': '/privacy',
      'refund': '/refund',
      'fraud': '/fraud-reporting',
    };
    navigate(routes[page] || '/');
  };

  const isActive = (path: string) => location.pathname === path;

  const visibleKeys = new Set(menuItems.map((i) => i.page_key));
  const canEdit = (key: string) => menuItems.find((i) => i.page_key === key)?.can_edit ?? false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white">
      {showWarning && (
        <SessionTimeoutModal
          secondsLeft={secondsLeft}
          onStay={extendSession}
          onLogout={handleLogout}
        />
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src="/PayByCard-Logo.png" alt="PayByCard Logo" className="w-20 h-10 object-contain" />
                <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-30"></div>
              </div>
              <div>
                <span className="text-gray-900 font-bold text-xl">PayByCard</span>
                <span className="text-[#8c76f0] text-sm ml-2 font-semibold">Admin</span>
              </div>
            </div>

            {/* Right section: Admin info + Logout + Menu */}
            <div className="flex items-center gap-4">
              {/* Admin Email & Info */}
              <div className="text-right hidden sm:block">
                <p className="text-gray-900 text-sm font-medium">{adminName}</p>
                <p className="text-gray-600 text-xs">{adminEmail}</p>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex max-w-[1600px] mx-auto">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-20 left-0 h-[calc(100vh-80px)]
          w-56 flex-shrink-0 bg-white border-r border-gray-200 z-40
          transform transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <nav className="p-3 overflow-y-auto h-full pb-6">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8c76f0]"></div>
              </div>
            ) : (
              MENU_SECTIONS.map((section, sIdx) => {
                const sectionItems = section.items.filter(
                  (item) => item.key === 'dashboard' || item.key === 'change-password' || visibleKeys.has(item.key)
                );

                if (sectionItems.length === 0) return null;

                return (
                  <div key={sIdx} className={sIdx > 0 ? 'mt-4' : ''}>
                    {section.label && (
                      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {section.label}
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {sectionItems.map((item) => {
                        const Icon = ICON_MAP[item.icon] || Home;
                        const active = isActive(item.page_path);
                        const editable = canEdit(item.key);
                        return (
                          <button
                            key={item.key}
                            onClick={() => {
                              navigate(item.path);
                              setMobileMenuOpen(false);
                            }}
                            className={`
                              w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                              ${active
                                ? 'bg-gradient-to-r from-purple-50 to-violet-50 text-[#8c76f0] border-2 border-[#8c76f0]'
                                : 'text-gray-700 hover:bg-gray-50 border-2 border-transparent'
                              }
                            `}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate text-xs">{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-8">
          {children}
        </main>
      </div>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
