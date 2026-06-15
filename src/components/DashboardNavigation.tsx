import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DashboardNavigationProps {
  userEmail?: string;
  userId?: string;
  onLogout?: () => void;
  onMenuToggle?: () => void;
  kycRefreshKey?: number;
}

export default function DashboardNavigation({ userEmail, userId, onLogout, onMenuToggle, kycRefreshKey = 0 }: DashboardNavigationProps) {
  const navigate = useNavigate();
  const [kycStatus, setKycStatus] = useState<string>('loading');

  useEffect(() => {
    if (userId) {
      fetchKYCStatus();
    }
  }, [userId, kycRefreshKey]);

  const fetchKYCStatus = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-kyc-status`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();
      if (response.ok) {
        if (result.isVerified) {
          setKycStatus('verified');
        } else {
          setKycStatus(result.status);
        }
      } else {
        setKycStatus('not_started');
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      setKycStatus('not_started');
    }
  };

  const getStatusDisplay = () => {
    switch (kycStatus) {
      case 'verified':
        return (
          <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span className="text-green-700 font-bold">KYC Verified</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-amber-700 font-bold">KYC Under Review</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-red-700 font-bold">KYC Rejected</span>
          </div>
        );
      case 'incomplete':
      case 'not_submitted':
        return (
          <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-600 font-bold">KYC Pending</span>
          </div>
        );
      case 'loading':
        return (
          <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
            <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-[#8c76f0] rounded-full animate-spin"></div>
            <span className="text-gray-600 font-bold">Loading...</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
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
            </div>
          </div>

          {/* Right section: User info + Logout + Menu */}
          <div className="flex items-center gap-4">
            {/* User Email & Info */}
            {userEmail && (
              <div className="text-right hidden sm:block">
                <p className="text-gray-900 text-sm font-medium">{userEmail}</p>
                <div className="text-xs">{getStatusDisplay()}</div>
              </div>
            )}

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            {onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="lg:hidden p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
