/**
 * SESSION MANAGER COMPONENT
 * 
 * Handles:
 * - Session lifecycle management
 * - Automatic session refresh
 * - Session expiry warnings
 * - Automatic logout
 * - Real-time session monitoring
 * 
 * Should be mounted at app root level
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { sessionValidationService } from '../../services/sessionValidationService';

interface SessionManagerProps {
  refreshInterval?: number; // ms, default 5 minutes
  warningThreshold?: number; // ms before expiry to show warning, default 10 minutes
  onWarning?: (timeRemaining: string) => void;
  onLogout?: () => void;
}

/**
 * SESSION MANAGER
 * 
 * This component:
 * 1. Monitors session validity in real-time
 * 2. Auto-refreshes sessions before expiry
 * 3. Shows warning when session is expiring soon
 * 4. Auto-logouts on expiry
 * 5. Detects if session is invalidated from another device
 */
export const SessionManager: React.FC<SessionManagerProps> = ({
  refreshInterval = 5 * 60 * 1000, // 5 minutes
  warningThreshold = 10 * 60 * 1000, // 10 minutes
  onWarning,
  onLogout
}) => {
  const { session, logout, refreshSession, setError } = useSecureAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const refreshIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Calculate time remaining
  const calculateTimeRemaining = useCallback((expiresAt: number): string => {
    return sessionValidationService.formatTimeRemaining(expiresAt);
  }, []);

  // Handle refresh session
  const handleRefreshSession = useCallback(async () => {
    if (!session) return;

    try {
      const refreshed = await refreshSession();
      if (refreshed) {
        console.log('[SessionManager] Session refreshed successfully');
      } else {
        console.warn('[SessionManager] Session refresh failed - logging out');
        await logout();
        onLogout?.();
      }
    } catch (error) {
      console.error('[SessionManager] Error refreshing session:', error);
    }
  }, [session, refreshSession, logout, onLogout]);

  // Setup real-time session monitoring
  useEffect(() => {
    if (!session) {
      setShowWarning(false);
      return;
    }

    // Unsubscribe from previous listener if exists
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Setup real-time monitoring
    unsubscribeRef.current = sessionValidationService.setupRealtimeSessionMonitoring(
      session.sessionToken,
      (isValid) => {
        if (!isValid) {
          console.warn('[SessionManager] Session invalidated - logging out');
          setError('Your session has been invalidated (logged in from another device)');
          logout();
          onLogout?.();
        }
      },
      (error) => {
        console.error('[SessionManager] Real-time monitoring error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [session, logout, onLogout, setError]);

  // Setup auto-refresh interval
  useEffect(() => {
    if (!session) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      return;
    }

    // Refresh session periodically
    refreshIntervalRef.current = setInterval(() => {
      handleRefreshSession();
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [session, refreshInterval, handleRefreshSession]);

  // Setup expiry warning interval
  useEffect(() => {
    if (!session) {
      if (warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current);
      }
      setShowWarning(false);
      return;
    }

    warningIntervalRef.current = setInterval(() => {
      const msRemaining = session.expiresAt - Date.now();

      // Check if expired
      if (msRemaining < 0) {
        setShowWarning(false);
        logout();
        onLogout?.();
        return;
      }

      // Check if should show warning
      const shouldWarn = msRemaining > 0 && msRemaining < warningThreshold;

      if (shouldWarn) {
        setShowWarning(true);
        const timeStr = calculateTimeRemaining(session.expiresAt);
        setTimeRemaining(timeStr);
        onWarning?.(timeStr);
      } else if (showWarning) {
        setShowWarning(false);
      }
    }, 1000); // Update every second

    return () => {
      if (warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current);
      }
    };
  }, [session, warningThreshold, logout, onLogout, calculateTimeRemaining, showWarning, onWarning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  // Don't render if no session or no warning
  if (!session || !showWarning) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-yellow-50 border border-yellow-300 rounded-xl shadow-lg p-4">
        {/* Icon + Title */}
        <div className="flex items-start gap-3 mb-2">
          <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-900">Session Expiring Soon</h3>
            <p className="text-sm text-yellow-800 mt-1">
              Your session will expire in <strong>{timeRemaining}</strong>
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleRefreshSession}
            className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-1"
          >
            <Clock size={16} />
            Extend Session
          </button>
          <button
            onClick={() => setShowWarning(false)}
            className="px-3 py-2 bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded-lg font-medium transition-colors text-sm"
          >
            Dismiss
          </button>
        </div>

        {/* Info Text */}
        <p className="text-xs text-yellow-700 mt-3">
          Click "Extend Session" to stay logged in. You will be automatically logged out if no action is taken.
        </p>
      </div>
    </div>
  );
};

export default SessionManager;
