import bcrypt from 'bcryptjs';
import { isFirebaseConfigured } from './firebase';
import { userService } from './userService';
import type { SessionData } from '../types';

export class AuthenticationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthenticationError';
  }
}

export const authService = {
  async login(username: string, password: string): Promise<SessionData> {
    if (!isFirebaseConfigured) {
      throw new AuthenticationError('FIREBASE_NOT_CONFIGURED', 'تم تعطيل نظام المصادقة.');
    }

    if (!username || !password) {
      throw new AuthenticationError('INVALID_INPUT', 'يرجى إدخال اسم المستخدم وكلمة المرور');
    }

    try {
      const userDoc = await userService.getUserByUsername(username);
      
      if (!userDoc) {
        throw new AuthenticationError('USER_NOT_FOUND', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      if (!userDoc.passwordHash) {
        throw new AuthenticationError('NO_PASSWORD', 'لم يتم إعداد كلمة مرور لهذا الحساب. يرجى التواصل مع الإدارة.');
      }

      const isValidPassword = bcrypt.compareSync(password, userDoc.passwordHash);
      if (!isValidPassword) {
        throw new AuthenticationError('WRONG_PASSWORD', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      if (userDoc.status !== 'active') {
        const statusMessages: Record<string, string> = {
          inactive: 'الحساب غير مفعل',
          suspended: 'الحساب موقوف مؤقتاً',
          pending_approval: 'الحساب قيد الانتظار للموافقة',
        };
        throw new AuthenticationError('ACCOUNT_INACTIVE', statusMessages[userDoc.status] || 'الحساب غير متاح حالياً');
      }

      // Generate a new session token
      const sessionToken = crypto.randomUUID() + '-' + Date.now().toString(36);

      // Save token in RTDB
      await userService.updateUser(userDoc.uid, { sessionToken });

      const session: SessionData = {
        uid: userDoc.uid,
        fullName: userDoc.fullName,
        username: userDoc.username,
        role: userDoc.role,
        permissions: userDoc.permissions || [],
        status: userDoc.status,
        sessionToken,
        expiresAt: Date.now() + 24 * 3600000, // 24 hours
      };

      await userService.updateLastLoginAt(userDoc.uid);
      return session;
    } catch (error: any) {
      console.error("Login actual error:", error);
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError('LOGIN_FAILED', 'فشل تسجيل الدخول: خطأ غير معروف - ' + (error.message || ''));
    }
  },

  async logout(uid: string): Promise<void> {
    try {
      if (uid) {
        await userService.updateUser(uid, { sessionToken: '' }); // invalidate token
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  isTokenValid(session: SessionData | null): boolean {
    if (!session) return false;
    return Date.now() < session.expiresAt;
  },

  async refreshSessionData(uid: string, currentToken: string): Promise<SessionData | null> {
    try {
      const userDoc = await userService.getUserByUid(uid);
      
      if (!userDoc || userDoc.status !== 'active') {
        return null;
      }

      // Verify token matches what's in DB (single session policy / simple validation)
      if (userDoc.sessionToken !== currentToken) {
        return null; // Session expired or logged in from somewhere else
      }

      const session: SessionData = {
        uid: userDoc.uid,
        fullName: userDoc.fullName,
        username: userDoc.username,
        role: userDoc.role,
        permissions: userDoc.permissions || [],
        status: userDoc.status,
        sessionToken: currentToken, // keep the same token
        expiresAt: Date.now() + 24 * 3600000, // extend for another 24h
      };

      return session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  },
};
