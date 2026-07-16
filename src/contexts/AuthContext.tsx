import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  isRemembered: boolean;
  rememberedEmail: string | null;
  login: (userId: string, email: string) => void;
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

  const login = (userId: string, email: string) => {
    sessionStorage.setItem('userId', userId);
    sessionStorage.setItem('userEmail', email);
    setIsAuthenticated(true);
    setUserId(userId);
    setUserEmail(email);

    // Persist remembered session for biometric unlock on next visit
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ userId, email }));
    setIsRemembered(true);
    setRememberedEmail(email);
  };

  const biometricUnlock = () => {
    try {
      const remembered = localStorage.getItem(REMEMBERED_KEY);
      if (!remembered) return;
      const parsed = JSON.parse(remembered);
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
