/**
 * SESSION VALIDATION SERVICE
 * 
 * Handles:
 * - Session token validation against RTDB
 * - Permission checking
 * - Company isolation verification
 * - Session state management in localStorage (with RTDB validation)
 * 
 * KEY SECURITY FEATURES:
 * ✓ All sessions validated against RTDB (not just localStorage)
 * ✓ Company isolation enforced
 * ✓ Permissions verified before operations
 * ✓ Automatic session refresh
 */

import { ref, get, onValue } from 'firebase/database';
import { rtdb, isFirebaseConfigured, authReadyPromise } from './firebase';
import type { SecureSessionData, SessionValidationResult } from '../types/secure';

const SESSION_STORAGE_KEY = 'secure_session';
const REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh if less than 5 minutes left

export const sessionValidationService = {
  /**
   * SAVE SESSION TO LOCALSTORAGE
   * Note: This is just client-side cache. Real validation is always against RTDB.
   */
  saveSession(session: SecureSessionData): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  },

  /**
   * GET SESSION FROM LOCALSTORAGE
   * Returns cached session but MUST be validated against RTDB before use
   */
  getSession(): SecureSessionData | null {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored) as SecureSessionData;
      
      // Basic client-side validation
      if (!session.sessionToken || !session.uid || !session.companyId) {
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error retrieving session:', error);
      return null;
    }
  },

  /**
   * CLEAR SESSION FROM LOCALSTORAGE
   */
  clearSession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  },

  /**
   * VALIDATE SESSION AGAINST RTDB
   * This is the REAL validation - checks RTDB, not just localStorage
   */
  async validateSessionAgainstRTDB(
    sessionToken: string,
    expectedCompanyId: string,
    expectedUid: string
  ): Promise<SessionValidationResult> {
    if (!isFirebaseConfigured || !rtdb) {
      return {
        isValid: false,
        session: null,
        error: 'Firebase not configured'
      };
    }

    try {
      await authReadyPromise;

      // Fetch session from RTDB
      const snapshot = await get(ref(rtdb, `sessions/${sessionToken}`));

      if (!snapshot.exists()) {
        return {
          isValid: false,
          session: null,
          error: 'Session not found in database'
        };
      }

      const session = snapshot.val() as SecureSessionData;

      // ✓ CRITICAL: Verify company isolation
      if (session.companyId !== expectedCompanyId) {
        return {
          isValid: false,
          session: null,
          error: 'Company mismatch - potential security breach'
        };
      }

      // ✓ CRITICAL: Verify user ID matches
      if (session.uid !== expectedUid) {
        return {
          isValid: false,
          session: null,
          error: 'User ID mismatch'
        };
      }

      // Verify session is active
      if (!session.isActive) {
        return {
          isValid: false,
          session: null,
          error: 'Session is inactive'
        };
      }

      // Verify session is not expired
      if (Date.now() > session.expiresAt) {
        return {
          isValid: false,
          session: null,
          error: 'Session has expired'
        };
      }

      const expiresIn = session.expiresAt - Date.now();

      return {
        isValid: true,
        session,
        expiresIn
      };
    } catch (error) {
      console.error('Error validating session against RTDB:', error);
      return {
        isValid: false,
        session: null,
        error: 'Failed to validate session'
      };
    }
  },

  /**
   * CHECK IF SESSION NEEDS REFRESH
   * Sessions refresh if less than REFRESH_THRESHOLD time remains
   */
  needsRefresh(session: SecureSessionData): boolean {
    const expiresIn = session.expiresAt - Date.now();
    return expiresIn < REFRESH_THRESHOLD;
  },

  /**
   * CHECK PERMISSION
   * Verify user has specific permission
   */
  hasPermission(session: SecureSessionData, permission: string): boolean {
    if (!session || !session.permissions || !Array.isArray(session.permissions)) {
      return false;
    }

    // Wildcard permission
    if (session.permissions.includes('*')) {
      return true;
    }

    return session.permissions.includes(permission);
  },

  /**
   * CHECK ANY PERMISSION
   * Verify user has at least one of the permissions
   */
  hasAnyPermission(session: SecureSessionData, permissions: string[]): boolean {
    if (!session || !permissions || !Array.isArray(permissions)) {
      return false;
    }

    return permissions.some(p => this.hasPermission(session, p));
  },

  /**
   * CHECK ALL PERMISSIONS
   * Verify user has all of the permissions
   */
  hasAllPermissions(session: SecureSessionData, permissions: string[]): boolean {
    if (!session || !permissions || !Array.isArray(permissions)) {
      return false;
    }

    return permissions.every(p => this.hasPermission(session, p));
  },

  /**
   * CHECK ROLE
   */
  hasRole(session: SecureSessionData, role: string): boolean {
    return session?.role === role;
  },

  /**
   * CHECK IF USER IS ADMIN
   */
  isAdmin(session: SecureSessionData): boolean {
    return session?.role === 'super_admin' || session?.role === 'manager';
  },

  /**
   * GET COMPANY ID
   */
  getCompanyId(session: SecureSessionData): string {
    return session?.companyId || '';
  },

  /**
   * GET USER ID
   */
  getUserId(session: SecureSessionData): string {
    return session?.uid || '';
  },

  /**
   * SETUP REAL-TIME SESSION MONITORING
   * Listen for session changes in RTDB
   * This detects if session is invalidated from another device
   */
  setupRealtimeSessionMonitoring(
    sessionToken: string,
    onSessionChanged: (isValid: boolean, session: SecureSessionData | null) => void,
    onError: (error: string) => void
  ): () => void {
    if (!isFirebaseConfigured || !rtdb) {
      onError('Firebase not configured');
      return () => {};
    }

    try {
      const unsubscribe = onValue(
        ref(rtdb, `sessions/${sessionToken}`),
        (snapshot) => {
          if (!snapshot.exists()) {
            onSessionChanged(false, null);
            return;
          }

          const session = snapshot.val() as SecureSessionData;

          // Check if active and not expired
          const isValid = session.isActive && Date.now() < session.expiresAt;

          onSessionChanged(isValid, session);
        },
        (error) => {
          console.error('Error monitoring session:', error);
          onError('Failed to monitor session');
        }
      );

      return unsubscribe;
    } catch (error) {
      onError((error as any).message);
      return () => {};
    }
  },

  /**
   * VERIFY SESSION VALIDITY
   * Complete validation including RTDB check
   */
  async verifySessionValidity(session: SecureSessionData | null): Promise<boolean> {
    if (!session) return false;

    try {
      const result = await this.validateSessionAgainstRTDB(
        session.sessionToken,
        session.companyId,
        session.uid
      );

      return result.isValid;
    } catch (error) {
      console.error('Error verifying session validity:', error);
      return false;
    }
  },

  /**
   * FORMAT SESSION TIME REMAINING
   * For UI display (e.g., "Session expires in 2 hours")
   */
  formatTimeRemaining(expiresAt: number): string {
    const msRemaining = expiresAt - Date.now();

    if (msRemaining < 0) return 'Expired';

    const minutes = Math.floor(msRemaining / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;

    return 'Less than a minute';
  },

  /**
   * IS SESSION EXPIRING SOON
   */
  isExpiringsoon(expiresAt: number, warningThreshold: number = 10 * 60 * 1000): boolean {
    const msRemaining = expiresAt - Date.now();
    return msRemaining > 0 && msRemaining < warningThreshold;
  }
};
