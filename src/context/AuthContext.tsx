import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserDocument } from '../types';
import { authService } from '../services/auth';
import { dbService } from '../services/db';

interface AuthContextType {
  user: UserDocument | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<UserDocument>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check local or session storage for existing login session
    const initAuth = async () => {
      const cur = authService.getCurrentUser();
      if (cur) {
        setUser(cur);
        try {
          const dbUser = await dbService.getUser(cur.uid);
          if (dbUser) {
            if (dbUser.status === 'disabled') {
              await authService.logout();
              setUser(null);
            } else {
              setUser(dbUser);
              const store = localStorage.getItem('arbahy_user') ? localStorage : sessionStorage;
              store.setItem('arbahy_user', JSON.stringify(dbUser));
            }
          } else {
            await authService.logout();
            setUser(null);
          }
        } catch (error) {
          console.error('Error validating session against database:', error);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    setLoading(true);
    try {
      const loggedUser = await authService.login(email, password, rememberMe);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true; // Super Admin has all privileges
    return Array.isArray(user.permissions) ? user.permissions.includes(permission) : false;
  };

  const refreshUser = async () => {
    if (user) {
      try {
        const dbUser = await dbService.getUser(user.uid);
        if (dbUser) {
          if (dbUser.status === 'disabled') {
            await logout();
            return;
          }
          setUser(dbUser);
          const store = localStorage.getItem('arbahy_user') ? localStorage : sessionStorage;
          store.setItem('arbahy_user', JSON.stringify(dbUser));
        } else {
          await logout();
        }
      } catch (error) {
        console.error('Error refreshing user from database:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
