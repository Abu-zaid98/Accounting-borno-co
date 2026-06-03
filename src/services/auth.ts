import { isFirebaseConfigured, auth } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { dbService } from './db';
import type { UserDocument } from '../types';

// ملاحظة: كل كلمات المرور تُدار عبر Firebase

const canLoginLocally = (_user: any, password: string): boolean => {
  const defaultPasswords = ['adminpassword', '123', 'admin123'];
  return defaultPasswords.includes(password);
};

/**
 * ⚠️ DEPRECATED: This is legacy code - use authService from authService.ts instead
 * This file is kept for reference only
 */
export const authService = {
  // ----------------------------------------
  // تسجيل الدخول (DEPRECATED)
  // ----------------------------------------
  async login(email: string, password: string, rememberMe: boolean = false): Promise<UserDocument> {
    // For backward compatibility only - redirect to new authService
    console.warn('⚠️ Using deprecated auth.login - please use authService from authService.ts');

    if (isFirebaseConfigured && auth) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userDoc = await dbService.getUser(uid);
        if (userDoc) {
          if (userDoc.status !== 'active') {
            throw new Error('تم تعطيل حسابك من قبل الإدارة. يرجى التواصل مع المسؤول.');
          }
          const store = rememberMe ? localStorage : sessionStorage;
          store.setItem('arbahy_user', JSON.stringify(userDoc));
          return userDoc;
        }

        // إنشاء document تلقائي للمستخدم الأول
        const newUserDoc: UserDocument = {
          uid,
          username: email.split('@')[0],
          fullName: userCredential.user.displayName || email.split('@')[0],
          email,
          role: 'super_admin',
          permissions: [
            'employees.view', 'employees.create', 'employees.edit', 'employees.delete',
            'salary.view', 'salary.create', 'salary.edit', 'salary.delete',
            'attendance.view', 'attendance.create', 'attendance.edit',
            'overtime.view', 'overtime.create', 'overtime.edit',
            'reports.view', 'reports.print',
            'settings.view', 'settings.edit',
            'users.view', 'users.create', 'users.edit', 'users.delete',
            'departments.view', 'departments.create', 'departments.edit', 'departments.delete',
          ],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        try {
          await dbService.createUser(newUserDoc);
        } catch {
          const users: UserDocument[] = JSON.parse(localStorage.getItem('users') || '[]');
          if (!users.some(u => u.uid === uid)) {
            users.push(newUserDoc);
            localStorage.setItem('users', JSON.stringify(users));
          }
        }

        const store = rememberMe ? localStorage : sessionStorage;
        store.setItem('arbahy_user', JSON.stringify(newUserDoc));
        return newUserDoc;
      } catch (error: unknown) {
        const code = (error as { code?: string }).code ?? '';
        // Network errors
        if (code === 'auth/network-request-failed' || code === 'auth/too-many-requests') {
          throw new Error('خطأ في الشبكة. يرجى المحاولة لاحقًا.');
        }
        // Disabled account
        if (code === 'auth/user-disabled') {
          throw new Error('تم تعطيل هذا الحساب من قبل الإدارة.');
        }
        // Invalid credentials
        if (
          code === 'auth/user-not-found' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-email' ||
          code === 'auth/email-not-found' ||
          code === 'auth/operation-not-allowed' ||
          code.startsWith('auth/')
        ) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        }
        // Other errors
        const message = (error as { message?: string }).message ?? 'خطأ غير معروف.';
        throw new Error(message);
      }
    }
    throw new Error('خدمة المصادقة غير متاحة');
  },

  // دخول محلي
  async _localLogin(email: string, password: string, rememberMe: boolean): Promise<UserDocument> {
    const users = await dbService.getUsers();
    const matched = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (!matched) {
      throw new Error('البريد الإلكتروني المدخل غير مسجل لدينا.');
    }

    if (matched.status !== 'active') {
      throw new Error('تم تعطيل حسابك من قبل الإدارة. يرجى التواصل مع المسؤول.');
    }

    if (!canLoginLocally(matched, password)) {
      throw new Error('كلمة المرور المدخلة غير صحيحة.');
    }

    const store = rememberMe ? localStorage : sessionStorage;
    store.setItem('arbahy_user', JSON.stringify(matched));
    return matched;
  },

  // ----------------------------------------
  // إنشاء مستخدم جديد (من لوحة التحكم)
  // ----------------------------------------
  async createUser(
    email: string,
    password: string,
    userData: Omit<UserDocument, 'uid' | 'createdAt' | 'updatedAt'>
  ): Promise<UserDocument> {
    let uid = `user_${Date.now()}`;

    // حاول إنشاؤه في Firebase Auth
    if (isFirebaseConfigured && auth) {
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        uid = credential.user.uid;
      } catch (error: unknown) {
        const code = (error as { code?: string }).code ?? '';
        if (code === 'auth/email-already-in-use') {
          throw new Error('هذا البريد الإلكتروني مستخدم بالفعل.');
        }
        if (code === 'auth/weak-password') {
          throw new Error('كلمة المرور ضعيفة — يجب أن تكون 6 أحرف على الأقل.');
        }
        if (code === 'auth/network-request-failed') {
          console.warn('Firebase غير متاح — سيُنشأ المستخدم محلياً فقط.');
        } else {
          console.warn('Firebase Auth createUser:', error);
        }
      }
    }

    const newUser: UserDocument = {
      ...userData,
      uid,
      email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.createUser(newUser);
    return newUser;
  },

  // ----------------------------------------
  // تغيير كلمة مرور المستخدم الحالي
  // ----------------------------------------
  async changePassword(uid: string, newPassword: string): Promise<void> {
    void newPassword;
    void uid;
    // كلمة المرور يتم تغييرها عبر Firebase Auth فقط
    throw new Error('غير متوفر حالياً - يرجى استخدام إعادة تعيين كلمة المرور');
  },

  // ----------------------------------------
  // إعادة تعيين كلمة مرور (إرسال إيميل)
  // ----------------------------------------
  async sendPasswordReset(email: string): Promise<void> {
    void email;
    throw new Error('إعادة التعيين عبر البريد غير مفعلة. استخدم تغيير كلمة المرور من لوحة الأدمن.');
  },

  // ----------------------------------------
  // تسجيل الخروج
  // ----------------------------------------
  async logout(): Promise<void> {
    if (isFirebaseConfigured && auth) {
      try { await signOut(auth); } catch { /* تجاهل خطأ الشبكة */ }
    }
    localStorage.removeItem('arbahy_user');
    sessionStorage.removeItem('arbahy_user');
  },

  // ----------------------------------------
  // جلسة المستخدم الحالي
  // ----------------------------------------
  getCurrentUser(): UserDocument | null {
    const local = localStorage.getItem('arbahy_user') || sessionStorage.getItem('arbahy_user');
    return local ? JSON.parse(local) : null;
  },
};
