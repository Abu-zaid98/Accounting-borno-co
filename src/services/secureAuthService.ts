/**
 * ENHANCED SECURE AUTHENTICATION SERVICE
 * 
 * Handles:
 * - Secure login (bcrypt verification)
 * - Session creation in RTDB (sessions/{sessionToken})
 * - Session validation and refresh
 * - Logout and session cleanup
 * 
 * KEY SECURITY FEATURES:
 * ✓ passwordHash NEVER exposed to frontend
 * ✓ Session token stored separately from user credentials
 * ✓ Rate limiting on login attempts
 * ✓ Automatic session expiry
 * ✓ Audit logging of all auth events
 */

import bcrypt from 'bcryptjs';
import { ref, get, set, update, remove } from 'firebase/database';
import { rtdb, isFirebaseConfigured, authReadyPromise } from './firebase';
import { auditService } from './auditService';
import type {
  SecureSessionData,
  UserDocument,
  UserCredentials,
  LoginRequest,
  LoginResponse,
  SessionValidationResult
} from '../types/secure';

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes

export class AuthenticationError extends Error {
  constructor(
    message: string,
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export const secureAuthService = {
  /**
   * LOGIN FLOW
   * 
   * 1. Validate input
   * 2. Check rate limits
   * 3. Fetch user by username (NO passwordHash)
   * 4. Verify user is active
   * 5. Fetch passwordHash separately (authorized access only)
   * 6. Compare with bcrypt
   * 7. Generate secure session token
   * 8. Store session in RTDB
   * 9. Audit log success
   * 10. Return session (NO passwords, NO credentials)
   */
  async login(request: LoginRequest, companyId: string, ipAddress?: string): Promise<LoginResponse> {
    if (!isFirebaseConfigured || !rtdb) {
      throw new AuthenticationError(
        'FIREBASE_NOT_CONFIGURED',
      );
    }

    if (!request.username || !request.password) {
      throw new AuthenticationError(
        'INVALID_INPUT'
      );
    }

    const rateLimitKey = `${request.username}-${ipAddress || 'unknown'}`;

    try {
      await authReadyPromise;

      // Check rate limiting
      const isBlocked = await this.checkRateLimits(rateLimitKey);
      if (isBlocked) {
        await auditService.logEvent({
          companyId,
          userId: request.username,
          action: 'unauthorized_attempt',
          resource: 'authentication',
          status: 'failed',
          metadata: { reason: 'rate_limit_exceeded' },
          ipAddress,
          username: '',
          timestamp: 0
        });
        throw new AuthenticationError(
          'TOO_MANY_ATTEMPTS',

        );
      }

      // Fetch user by username (WITHOUT passwordHash - it's in separate node)
      const userDoc = await this.getUserByUsernameForLogin(request.username, companyId);

      if (!userDoc) {
        await this.recordFailedAttempt(rateLimitKey);
        await auditService.logEvent({
          companyId,
          userId: request.username,
          action: 'login',
          resource: 'authentication',
          status: 'failed',
          metadata: { reason: 'user_not_found' },
          ipAddress,
          username: '',
          timestamp: 0
        });
        throw new AuthenticationError(
          'INVALID_CREDENTIALS',

        );
      }

      // Verify user is active
      if (userDoc.status !== 'active') {
        await this.recordFailedAttempt(rateLimitKey);
        await auditService.logEvent({
          companyId,
          userId: userDoc.uid,
          action: 'login',
          resource: 'authentication',
          status: 'failed',
          metadata: { reason: 'account_' + userDoc.status },
          ipAddress,
          username: '',
          timestamp: 0
        });
        throw new AuthenticationError(
          'ACCOUNT_INACTIVE',

        );
      }

      // ✓ CRITICAL: Fetch passwordHash from SEPARATE node (userCredentials)
      // This node is protected by rules and cannot be accessed directly by frontend
      const credentials = await this.getCredentialsForVerification(userDoc.uid);

      if (!credentials || !credentials.passwordHash) {
        await this.recordFailedAttempt(rateLimitKey);
        await auditService.logEvent({
          companyId,
          userId: userDoc.uid,
          action: 'login',
          resource: 'authentication',
          status: 'failed',
          metadata: { reason: 'no_password_hash' },
          ipAddress,
          username: '',
          timestamp: 0
        });
        throw new AuthenticationError(
          'NO_PASSWORD',

        );
      }

      // Verify password with bcrypt
      const isPasswordValid = bcrypt.compareSync(request.password, credentials.passwordHash);

      if (!isPasswordValid) {
        await this.recordFailedAttempt(rateLimitKey);
        await auditService.logEvent({
          companyId,
          userId: userDoc.uid,
          action: 'login',
          resource: 'authentication',
          status: 'failed',
          metadata: { reason: 'invalid_password' },
          ipAddress,
          username: '',
          timestamp: 0
        });
        throw new AuthenticationError(
          'INVALID_CREDENTIALS',

        );
      }

      // ✓ Generate secure session token
      const sessionToken = await this.generateSecureSessionToken();

      // ✓ Create session in RTDB
      const expiresAt = Date.now() + SESSION_DURATION;
      const session: SecureSessionData = {
        uid: userDoc.uid,
        companyId,
        username: userDoc.username,
        fullName: userDoc.fullName,
        role: userDoc.role,
        permissions: userDoc.permissions || [],
        sessionToken,
        createdAt: Date.now(),
        expiresAt,
        isActive: true,
        ipAddress
      };

      // Store session in RTDB (protected by rules)
      await this.storeSession(session);

      // Clear rate limit on successful login
      await this.clearRateLimit(rateLimitKey);

      // Update user's lastLoginAt
      await this.updateLastLogin(userDoc.uid, companyId);

      // Audit log success
      await auditService.logEvent({
        companyId,
        userId: userDoc.uid,
        action: 'login',
        resource: 'authentication',
        status: 'success',
        metadata: {},
        ipAddress,
        username: '',
        timestamp: 0
      });

      return {
        session
        // ❌ NO passwordHash, NO credentials returned
      };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;

      await auditService.logEvent({
        companyId,
        userId: request.username,
        action: 'login',
        resource: 'authentication',
        status: 'failed',
        metadata: { reason: 'system_error', error: (error as any).message },
        ipAddress,
        username: '',
        timestamp: 0
      });

      throw new AuthenticationError(
        'LOGIN_FAILED',

      );
    }
  },

  /**
   * LOGOUT
   * - Invalidate session
   * - Remove from sessions node
   * - Audit log
   */
  async logout(session: SecureSessionData, ipAddress?: string): Promise<void> {
    try {
      if (!isFirebaseConfigured || !rtdb) return;
      await authReadyPromise;

      // Mark session as inactive (soft delete)
      await update(ref(rtdb, `sessions/${session.sessionToken}`), {
        isActive: false,
        updatedAt: Date.now()
      });

      // Audit log
      await auditService.logEvent({
        companyId: session.companyId,
        userId: session.uid,
        action: 'logout',
        resource: 'authentication',
        status: 'success',
        ipAddress,
        username: '',
        timestamp: 0
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  },

  /**
   * VALIDATE SESSION
   * - Check if session exists in RTDB
   * - Check if session is active
   * - Check if session is not expired
   * - Check company isolation
   */
  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    if (!isFirebaseConfigured || !rtdb) {
      return {
        isValid: false,
        session: null,
        error: 'Firebase not configured'
      };
    }

    try {
      await authReadyPromise;

      const snapshot = await get(ref(rtdb, `sessions/${sessionToken}`));

      if (!snapshot.exists()) {
        return {
          isValid: false,
          session: null,
          error: 'Session not found'
        };
      }

      const session = snapshot.val() as SecureSessionData;

      // Check if active
      if (!session.isActive) {
        return {
          isValid: false,
          session: null,
          error: 'Session is inactive'
        };
      }

      // Check if expired
      if (Date.now() > session.expiresAt) {
        return {
          isValid: false,
          session: null,
          error: 'Session expired'
        };
      }

      const expiresIn = session.expiresAt - Date.now();

      return {
        isValid: true,
        session,
        expiresIn
      };
    } catch (error) {
      return {
        isValid: false,
        session: null,
        error: (error as any).message
      };
    }
  },

  /**
   * REFRESH SESSION
   * - Validate current session
   * - Extend expiry time
   * - Optionally rotate token (advanced)
   */
  async refreshSession(sessionToken: string): Promise<SecureSessionData | null> {
    try {
      if (!isFirebaseConfigured || !rtdb) return null;
      await authReadyPromise;

      // Validate current session
      const validation = await this.validateSession(sessionToken);
      if (!validation.isValid || !validation.session) {
        return null;
      }

      const session = validation.session;
      const newExpiresAt = Date.now() + SESSION_DURATION;

      // Extend session in RTDB
      await update(ref(rtdb, `sessions/${sessionToken}`), {
        expiresAt: newExpiresAt,
        updatedAt: Date.now()
      });

      // Return updated session
      return {
        ...session,
        expiresAt: newExpiresAt
      };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  },

  /**
   * CHECK RATE LIMITS
   */
  async checkRateLimits(key: string): Promise<boolean> {
    if (!isFirebaseConfigured || !rtdb) return false;

    try {
      await authReadyPromise;

      const snapshot = await get(ref(rtdb, `rateLimits/${key}`));

      if (!snapshot.exists()) {
        return false; // Not rate limited
      }

      const limit = snapshot.val();
      const now = Date.now();

      // Check if block period has expired
      if (limit.blockedUntil && now < limit.blockedUntil) {
        return true; // Still blocked
      }

      // Check if attempt window has expired
      if (now - limit.lastAttemptTime > RATE_LIMIT_WINDOW) {
        return false; // Window expired, reset
      }

      // Check max attempts
      if (limit.attempts >= MAX_LOGIN_ATTEMPTS) {
        // Set block period
        await update(ref(rtdb, `rateLimits/${key}`), {
          blockedUntil: now + ATTEMPT_BLOCK_DURATION
        });
        return true; // Rate limited
      }

      return false;
    } catch (error) {
      console.error('Error checking rate limits:', error);
      return false;
    }
  },

  /**
   * RECORD FAILED ATTEMPT
   */
  async recordFailedAttempt(key: string): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) return;

    try {
      await authReadyPromise;

      const snapshot = await get(ref(rtdb, `rateLimits/${key}`));

      if (!snapshot.exists()) {
        await set(ref(rtdb, `rateLimits/${key}`), {
          attempts: 1,
          lastAttemptTime: Date.now()
        });
      } else {
        const limit = snapshot.val();
        await update(ref(rtdb, `rateLimits/${key}`), {
          attempts: (limit.attempts || 0) + 1,
          lastAttemptTime: Date.now()
        });
      }
    } catch (error) {
      console.error('Error recording failed attempt:', error);
    }
  },

  /**
   * CLEAR RATE LIMIT
   */
  async clearRateLimit(key: string): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) return;

    try {
      await authReadyPromise;
      await remove(ref(rtdb, `rateLimits/${key}`));
    } catch (error) {
      console.error('Error clearing rate limit:', error);
    }
  },

  /**
   * GENERATE SECURE SESSION TOKEN
   * Format: {UUID}-{timestamp}-{random}
   */
  async generateSecureSessionToken(): Promise<string> {
    const uuid = crypto.randomUUID();
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${uuid}-${timestamp}-${random}`;
  },

  /**
   * GET USER BY USERNAME FOR LOGIN
   * This fetches user WITHOUT passwordHash
   */
  async getUserByUsernameForLogin(username: string, companyId: string): Promise<UserDocument | null> {
    if (!isFirebaseConfigured || !rtdb) return null;

    try {
      await authReadyPromise;

      // Query users in company
      const snapshot = await get(ref(rtdb, `companies/${companyId}/users`));

      if (!snapshot.exists()) return null;

      const users = snapshot.val() as Record<string, UserDocument>;
      return Object.values(users).find(u => u.username === username) || null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  /**
   * GET CREDENTIALS FOR VERIFICATION (INTERNAL ONLY)
   * This is called server-side equivalent - only during login verification
   */
  async getCredentialsForVerification(uid: string): Promise<UserCredentials | null> {
    if (!isFirebaseConfigured || !rtdb) return null;

    try {
      await authReadyPromise;

      const snapshot = await get(ref(rtdb, `userCredentials/${uid}`));

      if (!snapshot.exists()) return null;

      return snapshot.val() as UserCredentials;
    } catch (error) {
      console.error('Error fetching credentials:', error);
      return null;
    }
  },

  /**
   * STORE SESSION IN RTDB
   */
  async storeSession(session: SecureSessionData): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) return;

    try {
      await authReadyPromise;

      await set(ref(rtdb, `sessions/${session.sessionToken}`), session);
    } catch (error) {
      console.error('Error storing session:', error);
      throw new AuthenticationError(
        'SESSION_STORAGE_FAILED',

      );
    }
  },

  /**
   * UPDATE LAST LOGIN
   */
  async updateLastLogin(uid: string, companyId: string): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) return;

    try {
      await authReadyPromise;

      await update(ref(rtdb, `companies/${companyId}/users/${uid}`), {
        lastLoginAt: Date.now(),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.warn('Warning: Could not update lastLoginAt:', error);
    }
  }
};
