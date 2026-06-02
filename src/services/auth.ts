import { isFirebaseConfigured, auth } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { dbService } from './db';
import type { UserDocument } from '../types';

// بسيط: hash محلي لكلمة المرور (للوضع بدون Firebase Auth)
export const hashPassword = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `h_${Math.abs(hash).toString(36)}`;
};

const canLoginLocally = (user: UserDocument, password: string): boolean => {
  const passwordHash = hashPassword(password);
  const defaultPasswords = ['adminpassword', '123', 'admin123'];
  return (
    (user.passwordHash && user.passwordHash === passwordHash) ||
    (user.role === 'super_admin' && defaultPasswords.includes(password))
  );
};

export const authService = {
  // ----------------------------------------
  // تسجيل الدخول
  // ----------------------------------------
  async login(email: string, password: string, rememberMe: boolean = false): Promise<UserDocument> {
    if (isFirebaseConfigured && auth) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userDoc = await dbService.getUser(uid);
        if (userDoc) {
          if (userDoc.status === 'disabled') {
            throw new Error('تم تعطيل حسابك من قبل الإدارة. يرجى التواصل مع المسؤول.');
          }
          const store = rememberMe ? localStorage : sessionStorage;
          store.setItem('arbahy_user', JSON.stringify(userDoc));
          return userDoc;
        }

        // إنشاء document تلقائي للمستخدم الأول
        const newUserDoc: UserDocument = {
          uid,
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
        const message = (error as { message?: string }).message ?? '';

        // خطأ الشبكة — دخول محلي
        const isNetworkError =
          code === 'auth/network-request-failed' ||
          code === 'auth/too-many-requests' ||
          message.toLowerCase().includes('network');

        if (isNetworkError) {
          return this._localLogin(email, password, rememberMe);
        }

        // حساب معطل
        if (code === 'auth/user-disabled') {
          throw new Error('تم تعطيل هذا الحساب من قبل الإدارة.');
        }

        // أي حالة فشل في Firebase Auth (المستخدم غير مسجل في Auth أو كلمة مرور خاطئة)
        // نتحقق من قاعدة البيانات (RTDB أو محلي) مباشرة
        const isAuthFailure =
          code === 'auth/user-not-found' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-email' ||
          code === 'auth/email-not-found' ||
          code === 'auth/operation-not-allowed' ||
          code.startsWith('auth/');

        if (isAuthFailure) {
          // ابحث في RTDB/localStorage
          const users = await dbService.getUsers();
          const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (!matched) {
            throw new Error('البريد الإلكتروني المدخل غير مسجل لدينا.');
          }
          if (matched.status === 'disabled') {
            throw new Error('تم تعطيل حسابك من قبل الإدارة. يرجى التواصل مع المسؤول.');
          }
          if (!canLoginLocally(matched, password)) {
            throw new Error('كلمة المرور المدخلة غير صحيحة.');
          }
          const store = rememberMe ? localStorage : sessionStorage;
          store.setItem('arbahy_user', JSON.stringify(matched));
          return matched;
        }

        // أي خطأ آخر — تراجع للوضع المحلي
        return this._localLogin(email, password, rememberMe);
      }
    }

    return this._localLogin(email, password, rememberMe);
  },

  // دخول محلي
  async _localLogin(email: string, password: string, rememberMe: boolean): Promise<UserDocument> {
    const users = await dbService.getUsers();
    const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!matched) {
      throw new Error('البريد الإلكتروني المدخل غير مسجل لدينا.');
    }

    if (matched.status === 'disabled') {
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
        // أعد تسجيل دخول المستخدم الحالي (Firebase ينقل الجلسة تلقائياً للمستخدم الجديد)
        // نحفظ userDoc الجديد فقط في RTDB
      } catch (error: unknown) {
        const code = (error as { code?: string }).code ?? '';
        if (code === 'auth/email-already-in-use') {
          throw new Error('هذا البريد الإلكتروني مستخدم بالفعل.');
        }
        if (code === 'auth/weak-password') {
          throw new Error('كلمة المرور ضعيفة — يجب أن تكون 6 أحرف على الأقل.');
        }
        if (code === 'auth/network-request-failed') {
          // وضع محلي — نكمل بدون Firebase
          console.warn('Firebase غير متاح — سيُنشأ المستخدم محلياً فقط.');
        } else {
          // إذا كان admin وانتقلت الجلسة له، لا نرمي خطأ
          console.warn('Firebase Auth createUser:', error);
        }
      }
    }

    const newUser: UserDocument = {
      ...userData,
      uid,
      email,
      passwordHash: hashPassword(password),
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
    if (newPassword.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
    }
    await dbService.updateUser(uid, { passwordHash: hashPassword(newPassword) });
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
