/**
 * SECURE AUTH CONTEXT
 * 
 * Replace the old AuthContext with this production-grade version
 * 
 * Features:
 * ✓ Session-based authentication
 * ✓ RTDB validation
 * ✓ Company isolation
 * ✓ Permission checking
 * ✓ Automatic session refresh
 * ✓ Audit logging
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { secureAuthService, AuthenticationError } from '../services/secureAuthService';
import { sessionValidationService } from '../services/sessionValidationService';
import type { SecureSessionData, LoginRequest } from '../types/secure';

interface SecureAuthContextType {
  session: SecureSessionData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (request: LoginRequest, companyId: string, ipAddress?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<SecureSessionData | null>;
  clearError: () => void;
  setError: (error: string | null) => void;

  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
}

const SecureAuthContext = createContext<SecureAuthContextType | undefined>(undefined);

export const SecureAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SecureSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to restore session from localStorage
        const savedSession = sessionValidationService.getSession();

        if (!savedSession) {
          setSession(null);
          setIsLoading(false);
          return;
        }

        // Validate saved session against RTDB
        const validation = await sessionValidationService.validateSessionAgainstRTDB(
          savedSession.sessionToken,
          savedSession.companyId,
          savedSession.uid
        );

        if (!validation.isValid) {
          // Session invalid - clear and logout
          sessionValidationService.clearSession();
          setSession(null);
          setError('Your session has expired. Please log in again.');
          setIsLoading(false);
          return;
        }

        // Session valid
        setSession(validation.session!);
        setError(null);
      } catch (err) {
        console.error('Error initializing auth:', err);
        setSession(null);
        setError('Failed to initialize authentication');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(
    async (request: LoginRequest, companyId: string, ipAddress?: string) => {
      try {
        setError(null);
        setIsLoading(true);

        const response = await secureAuthService.login(request, companyId, ipAddress);

        setSession(response.session);
        sessionValidationService.saveSession(response.session);
      } catch (err) {
        const errorMessage =
          err instanceof AuthenticationError
            ? (err as AuthenticationError).message
            : 'Login failed: Unknown error';

        setError(errorMessage);
        setSession(null);
        sessionValidationService.clearSession();

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (session) {
        await secureAuthService.logout(session);
      }

      setSession(null);
      sessionValidationService.clearSession();
    } catch (err) {
      console.error('Error during logout:', err);
      setError('Logout failed');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const refreshSession = useCallback(async (): Promise<SecureSessionData | null> => {
    if (!session) return null;

    try {
      const refreshed = await secureAuthService.refreshSession(session.sessionToken);

      if (refreshed) {
        setSession(refreshed);
        sessionValidationService.saveSession(refreshed);
        return refreshed;
      }

      // Refresh failed - logout
      await logout();
      return null;
    } catch (err) {
      console.error('Error refreshing session:', err);
      return null;
    }
  }, [session, logout]);

  const clearError = useCallback(() => setError(null), []);

  // Permission checking helpers
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return session ? sessionValidationService.hasPermission(session, permission) : false;
    },
    [session]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      return session ? sessionValidationService.hasAnyPermission(session, permissions) : false;
    },
    [session]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      return session ? sessionValidationService.hasAllPermissions(session, permissions) : false;
    },
    [session]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      return session ? sessionValidationService.hasRole(session, role) : false;
    },
    [session]
  );

  const isAdmin = useCallback((): boolean => {
    return session ? sessionValidationService.isAdmin(session) : false;
  }, [session]);

  const value: SecureAuthContextType = {
    session,
    isAuthenticated: !!session && Date.now() < session.expiresAt && session.isActive,
    isLoading,
    error,

    login,
    logout,
    refreshSession,
    clearError,
    setError,

    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isAdmin
  };

  return (
    <SecureAuthContext.Provider value={value}>{children}</SecureAuthContext.Provider>
  );
};

export const useSecureAuth = (): SecureAuthContextType => {
  const context = useContext(SecureAuthContext);
  if (!context) {
    throw new Error('useSecureAuth must be used within SecureAuthProvider');
  }
  return context;
};
