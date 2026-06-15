import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  login: (userId: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem('userId');
    const storedEmail = sessionStorage.getItem('userEmail');

    if (storedUserId && storedEmail) {
      setIsAuthenticated(true);
      setUserId(storedUserId);
      setUserEmail(storedEmail);
    }
  }, []);

  const login = (userId: string, email: string) => {
    sessionStorage.setItem('userId', userId);
    sessionStorage.setItem('userEmail', email);
    setIsAuthenticated(true);
    setUserId(userId);
    setUserEmail(email);
  };

  const logout = () => {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userEmail');
    setIsAuthenticated(false);
    setUserId(null);
    setUserEmail(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, userEmail, login, logout }}>
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
