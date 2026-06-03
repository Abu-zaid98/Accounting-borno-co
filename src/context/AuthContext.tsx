import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService, AuthenticationError } from '../services/authService';
import { userService } from '../services/userService';
import { sessionService } from '../services/sessionService';
import type { SessionData, UserDocument } from '../types';

interface AuthContextType {
  session: SessionData | null;
  user: UserDocument | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;

  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [user, setUser] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const savedSession = sessionService.getSession();
        
        if (!savedSession || !savedSession.uid || !savedSession.sessionToken) {
          setSession(null);
          setUser(null);
          sessionService.clearSession();
          setIsLoading(false);
          return;
        }

        const refreshedSession = await authService.refreshSessionData(savedSession.uid, savedSession.sessionToken);

        if (!refreshedSession) {
          await authService.logout(savedSession.uid);
          setSession(null);
          setUser(null);
          sessionService.clearSession();
          setError('انتهت الجلسة أو تم تسجيل الدخول من جهاز آخر');
          setIsLoading(false);
          return;
        }

        setSession(refreshedSession);
        sessionService.saveSession(refreshedSession);

        const userDoc = await userService.getUserByUid(refreshedSession.uid);
        if (userDoc) {
          setUser(userDoc);
        }
        setError(null);
      } catch (err) {
        console.error('Error in auth initialization:', err);
        setSession(null);
        setUser(null);
        sessionService.clearSession();
        setError('حدث خطأ في نظام المصادقة');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const newSession = await authService.login(username, password);
      
      setSession(newSession);
      sessionService.saveSession(newSession);

      const userDoc = await userService.getUserByUid(newSession.uid);
      if (userDoc) {
        setUser(userDoc);
      }
    } catch (err) {
      const errorMessage = err instanceof AuthenticationError ? err.message : 'فشل تسجيل الدخول';
      setError(errorMessage);
      setSession(null);
      setUser(null);
      sessionService.clearSession();
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (session?.uid) {
        await authService.logout(session.uid);
      }
      
      setSession(null);
      setUser(null);
      sessionService.clearSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'فشل تسجيل الخروج';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    if (!session) return;
    try {
      const updatedUser = await userService.getUserByUid(session.uid);
      if (updatedUser) {
        setUser(updatedUser);
        setSession(prev => prev ? {
          ...prev,
          permissions: updatedUser.permissions,
          role: updatedUser.role,
        } : null);
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  }, [session]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!session) return false;
    return userService.hasPermission(session.permissions, permission);
  }, [session]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!session) return false;
    return userService.hasAnyPermission(session.permissions, permissions);
  }, [session]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (!session) return false;
    return userService.hasAllPermissions(session.permissions, permissions);
  }, [session]);

  const value: AuthContextType = {
    session,
    user,
    isAuthenticated: !!session && sessionService.isSessionValid(session),
    isLoading,
    error,
    login,
    logout,
    clearError,
    refreshUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
