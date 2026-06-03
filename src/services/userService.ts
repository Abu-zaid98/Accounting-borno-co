import { ref, get, set, update } from 'firebase/database';
import { rtdb, isFirebaseConfigured, authReadyPromise } from './firebase';
import type { UserDocument } from '../types';
import bcrypt from 'bcryptjs';

/**
 * userService - خدمة إدارة المستخدمين
 * تعتمد كلياً على Firebase Realtime DB
 */

export const userService = {
  async getUserByUid(uid: string): Promise<UserDocument | null> {
    if (!isFirebaseConfigured || !rtdb) throw new Error('Firebase غير مُعَد');
    await authReadyPromise;
    try {
      const snapshot = await get(ref(rtdb, `users/${uid}`));
      if (!snapshot.exists()) return null;
      const data = snapshot.val() as UserDocument;
      if (data.uid !== uid) return null;
      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw new Error('فشل جلب بيانات المستخدم');
    }
  },

  async getAllUsers(): Promise<UserDocument[]> {
    if (!isFirebaseConfigured || !rtdb) throw new Error('Firebase غير مُعَد');
    await authReadyPromise;
    try {
      const snapshot = await get(ref(rtdb, 'users'));
      if (!snapshot.exists()) return [];
      const data = snapshot.val() as Record<string, UserDocument>;
      return Object.values(data).filter(u => u.uid);
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('فشل جلب قائمة المستخدمين');
    }
  },

  async getUserByUsername(username: string): Promise<UserDocument | null> {
    if (!isFirebaseConfigured || !rtdb) throw new Error('Firebase غير مُعَد');
    await authReadyPromise;
    try {
      const snapshot = await get(ref(rtdb, 'users'));
      if (!snapshot.exists()) return null;
      const data = snapshot.val() as Record<string, UserDocument>;
      const user = Object.values(data).find(u => u.username === username);
      return user || null;
    } catch (error: any) {
      console.error('Error searching user by username:', error);
      throw new Error(`فشل البحث عن المستخدم (${error.message || 'خطأ مجهول'})`);
    }
  },

  async createUser(userData: Omit<UserDocument, 'createdAt' | 'updatedAt' | 'uid'> & { password?: string }): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) throw new Error('Firebase غير مُعَد');
    await authReadyPromise;
    try {
      const users = await this.getAllUsers();
      if (users.some(u => u.username === userData.username)) {
        throw new Error('اسم المستخدم موجود بالفعل');
      }

      const uid = crypto.randomUUID();
      const now = new Date().toISOString();

      let passwordHash = undefined;
      if (userData.password) {
        passwordHash = bcrypt.hashSync(userData.password, 10);
      }

      const userDocument: UserDocument = {
        ...userData,
        uid,
        passwordHash,
        permissions: userData.permissions || [],
        createdAt: now,
        updatedAt: now,
      };

      // Remove plaintext password if passed
      delete (userDocument as any).password;

      await set(ref(rtdb, `users/${uid}`), userDocument);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async updateUser(uid: string, updates: Partial<UserDocument>): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) throw new Error('Firebase غير مُعَد');
    await authReadyPromise;
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await update(ref(rtdb, `users/${uid}`), updateData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('فشل تحديث بيانات المستخدم');
    }
  },

  async updateUserPassword(uid: string, newPassword: string): Promise<void> {
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await this.updateUser(uid, { passwordHash });
  },

  async updateUserStatus(uid: string, status: UserDocument['status']): Promise<void> {
    await this.updateUser(uid, { status });
  },

  async updateLastLoginAt(uid: string): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) return;
    await authReadyPromise;
    try {
      await update(ref(rtdb, `users/${uid}`), {
        lastLoginAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Warning: Could not update lastLoginAt:', error);
    }
  },

  hasPermission(permissions: string[], requiredPermission: string): boolean {
    if (!permissions || !Array.isArray(permissions)) return false;
    return permissions.includes(requiredPermission) || permissions.includes('*');
  },

  hasAnyPermission(permissions: string[], requiredPermissions: string[]): boolean {
    if (!permissions || !Array.isArray(permissions)) return false;
    return requiredPermissions.some(p => this.hasPermission(permissions, p));
  },

  hasAllPermissions(permissions: string[], requiredPermissions: string[]): boolean {
    if (!permissions || !Array.isArray(permissions)) return false;
    return requiredPermissions.every(p => this.hasPermission(permissions, p));
  },
};
