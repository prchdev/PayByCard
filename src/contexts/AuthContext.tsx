import React, { createContext, useContext, useState, useEffect } from 'react';
import { setUserSessionToken, getUserSessionToken, clearUserSessionToken } from '../utils/session';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  isRemembered: boolean;
  rememberedEmail: string | null;
  login: (userId: string, email: string, sessionToken?: string) => void;
  biometricUnlock: () => void;
  logout: () => void;
  clearRememberedSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REMEMBERED_KEY = 'pbc_remembered_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isRemembered, setIsRemembered] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem('userId');
    const storedEmail = sessionStorage.getItem('userEmail');

    if (storedUserId && storedEmail) {
      setIsAuthenticated(true);
      setUserId(storedUserId);
      setUserEmail(storedEmail);
    }

    try {
      const remembered = localStorage.getItem(REMEMBERED_KEY);
      if (remembered) {
        const parsed = JSON.parse(remembered);
        setIsRemembered(true);
        setRememberedEmail(parsed.email || null);
      }
    } catch {
      // corrupted entry — clear it
      localStorage.removeItem(REMEMBERED_KEY);
    }
  }, []);

  const login = (userId: string, email: string, sessionToken?: string) => {
    sessionStorage.setItem('userId', userId);
    sessionStorage.setItem('userEmail', email);
    if (sessionToken) setUserSessionToken(sessionToken);
    setIsAuthenticated(true);
    setUserId(userId);
    setUserEmail(email);

    // Persist remembered session for biometric unlock on next visit
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ userId, email }));
    setIsRemembered(true);
    setRememberedEmail(email);
  };

  const biometricUnlock = async () => {
    try {
      const remembered = localStorage.getItem(REMEMBERED_KEY);
      if (!remembered) return;
      const parsed = JSON.parse(remembered);
      const token = getUserSessionToken();
      if (!token) return;
      // F25: Verify the session token is still valid with the server before restoring.
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-stats`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-session': token,
        },
        body: JSON.stringify({ userId: parsed.userId }),
      });
      if (!res.ok) {
        clearUserSessionToken();
        localStorage.removeItem(REMEMBERED_KEY);
        setIsRemembered(false);
        setRememberedEmail(null);
        return;
      }
      sessionStorage.setItem('userId', parsed.userId);
      sessionStorage.setItem('userEmail', parsed.email);
      setIsAuthenticated(true);
      setUserId(parsed.userId);
      setUserEmail(parsed.email);
    } catch {
      localStorage.removeItem(REMEMBERED_KEY);
      setIsRemembered(false);
      setRememberedEmail(null);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('isRestricted');
    clearUserSessionToken();
    setIsAuthenticated(false);
    setUserId(null);
    setUserEmail(null);
  };

  const clearRememberedSession = () => {
    localStorage.removeItem(REMEMBERED_KEY);
    setIsRemembered(false);
    setRememberedEmail(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, userEmail, isRemembered, rememberedEmail, login, biometricUnlock, logout, clearRememberedSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
