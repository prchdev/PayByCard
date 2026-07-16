import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileHeader from './MobileHeader';
import BottomNavigation from './BottomNavigation';
import SessionTimeoutModal from '../SessionTimeoutModal';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';

interface MobileLayoutProps {
  children: React.ReactNode;
  userId?: string;
  userEmail?: string;
  onLogout?: () => void;
  showBack?: boolean;
  title?: string;
  showBottomNav?: boolean;
}

export default function MobileLayout({
  children,
  userId,
  userEmail,
  onLogout,
  showBack,
  title,
  showBottomNav = true,
}: MobileLayoutProps) {
  const navigate = useNavigate();
  const { showWarning, secondsLeft, extendSession } = useSessionTimeout(() => {
    onLogout?.();
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MobileHeader
        userEmail={userEmail}
        userId={userId}
        onLogout={onLogout}
        showBack={showBack}
        title={title}
      />

      <main className={`flex-1 ${showBottomNav ? 'pb-16' : ''}`}>
        {children}
      </main>

      {showBottomNav && <BottomNavigation userId={userId} userEmail={userEmail} />}

      {showWarning && (
        <SessionTimeoutModal
          secondsLeft={secondsLeft}
          onStay={extendSession}
          onLogout={() => {
            onLogout?.();
            navigate('/mobile/login');
          }}
        />
      )}
    </div>
  );
}
