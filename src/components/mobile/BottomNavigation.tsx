import { useNavigate, useLocation } from 'react-router-dom';
import { Home, CreditCard, Clock, Users, MoreHorizontal } from 'lucide-react';

interface BottomNavProps {
  userId?: string;
  userEmail?: string;
}

export default function BottomNavigation({ userId, userEmail }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: Home, label: 'Home', path: '/mobile/dashboard', page: 'dashboard' },
    { icon: CreditCard, label: 'Pay', path: '/mobile/make-payment', page: 'make-payment' },
    { icon: Clock, label: 'History', path: '/mobile/my-transactions', page: 'my-transactions' },
    { icon: Users, label: 'Payees', path: '/mobile/my-beneficiaries', page: 'beneficiaries' },
    { icon: MoreHorizontal, label: 'More', path: '/mobile/more', page: 'more' },
  ];

  const isActive = (path: string) => {
    if (path === '/mobile/dashboard') return location.pathname === '/mobile/dashboard';
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path, { state: { userId, userEmail } });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-center justify-around h-16 px-1">
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.page}
              onClick={() => handleNav(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active ? 'text-[#8c76f0]' : 'text-gray-500'
              }`}
            >
              <item.icon className={`w-5 h-5 ${active ? 'fill-[#f3f0fe]' : ''}`} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] font-medium ${active ? 'font-bold' : ''}`}>{item.label}</span>
              {active && <span className="absolute bottom-0 w-8 h-0.5 bg-[#8c76f0] rounded-t-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
