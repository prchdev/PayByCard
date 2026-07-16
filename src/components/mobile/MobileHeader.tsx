import { LogOut, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

interface MobileHeaderProps {
  userEmail?: string;
  userId?: string;
  onLogout?: () => void;
  showBack?: boolean;
  title?: string;
}

export default function MobileHeader({ userEmail, userId, onLogout, showBack, title }: MobileHeaderProps) {
  const navigate = useNavigate();
  const [kycStatus, setKycStatus] = useState<string>('loading');

  useEffect(() => {
    if (userId) fetchKYCStatus();
  }, [userId]);

  const fetchKYCStatus = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-kyc-status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );
      const result = await res.json();
      if (res.ok) {
        setKycStatus(result.isVerified ? 'verified' : result.status);
      } else {
        setKycStatus('not_started');
      }
    } catch {
      setKycStatus('not_started');
    }
  };

  const kycBadge = () => {
    switch (kycStatus) {
      case 'verified':
        return (
          <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md">
            <CheckCircle className="w-3 h-3 text-green-600" />
            <span className="text-green-700 text-[10px] font-bold">Verified</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-amber-600" />
            <span className="text-amber-700 text-[10px] font-bold">Review</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md">
            <XCircle className="w-3 h-3 text-red-600" />
            <span className="text-red-700 text-[10px] font-bold">Rejected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md">
            <AlertCircle className="w-3 h-3 text-gray-500" />
            <span className="text-gray-600 text-[10px] font-bold">Pending</span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm">
      <div className="px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 -ml-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/mobile/dashboard')}>
              <img src="/PayByCard.png" alt="Logo" className="w-16 h-8 object-contain" />
            </div>
          )}
          {title && (
            <span className="text-base font-bold text-gray-900">{title}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {userEmail && kycBadge()}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
