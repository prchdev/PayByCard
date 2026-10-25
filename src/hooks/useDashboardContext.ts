import { useOutletContext, useLocation } from 'react-router-dom';

interface DashboardOutletContext {
  userId?: string;
  userEmail?: string;
}

export function useDashboardContext() {
  const ctx = useOutletContext<DashboardOutletContext | null>();
  const location = useLocation();
  const state = (location.state || {}) as DashboardOutletContext;
  return {
    userId: ctx?.userId || state.userId,
    userEmail: ctx?.userEmail || state.userEmail,
  };
}
