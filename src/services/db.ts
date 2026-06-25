import { isFirebaseConfigured, rtdb, authReadyPromise } from './firebase';
import {
  ref, get, set, update, remove
} from 'firebase/database';
import type {
  UserDocument, EmployeeDocument, AttendanceDocument, OvertimeDocument,
  SalaryCycleDocument, SalaryRecordDocument, GeneralSettingsDocument,
  DepartmentDocument, PermissionDocument, FinancialTransactionType, EmployeeFinancialTransaction
} from '../types';
import { DEFAULT_ATTENDANCE_SETTINGS } from './attendance';

// ==========================================
// البيانات الافتراضية للوضع المحلي
// ==========================================

// تمت إزالة المستخدمين والموظفين الوهميين (Mock Data) بناءً على طلب المستخدم
const DEFAULT_SETTINGS: GeneralSettingsDocument = {
  shopName: 'البورنو لخدمات تغليف الهدايا الراقية',
  dailyWorkingHours: 8,
  overtimeRateType: 'auto',
  fixedOvertimeRate: 25,
  globalCurrency: '₪',
  currency: '₪',
  ...DEFAULT_ATTENDANCE_SETTINGS,
  updatedAt: new Date().toISOString()
};

const DEFAULT_DEPARTMENTS: DepartmentDocument[] = [
  { id: 'dept-1', name: 'قسم التغليف الفاخر', description: 'تغليف وتنسيق الهدايا الراقية', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dept-2', name: 'المبيعات والصالة', description: 'استقبال العملاء والمبيعات', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dept-3', name: 'قسم التنسيق والزهور', description: 'تنسيق الزهور الطبيعية والصناعية', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dept-4', name: 'المحاسبة والمالية', description: 'الشؤون المالية والمحاسبة', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dept-5', name: 'الموارد البشرية', description: 'إدارة شؤون الموظفين', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const DEFAULT_PERMISSIONS: PermissionDocument[] = [
  { id: 'perm-1', key: 'employees.view', label: 'عرض الموظفين', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-2', key: 'employees.create', label: 'إضافة موظف', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-3', key: 'employees.edit', label: 'تعديل موظف', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-4', key: 'employees.delete', label: 'حذف موظف', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-5', key: 'salary.view', label: 'عرض كشوفات الرواتب', category: 'salary', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-6', key: 'salary.create', label: 'توليد كشف رواتب', category: 'salary', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-7', key: 'salary.edit', label: 'تعديل كشف الرواتب', category: 'salary', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-8', key: 'salary.delete', label: 'حذف كشوفات الرواتب', category: 'salary', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-9', key: 'attendance.view', label: 'عرض سجل التحضير', category: 'attendance', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-10', key: 'attendance.create', label: 'تسجيل الحضور والانصراف', category: 'attendance', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-11', key: 'attendance.edit', label: 'تعديل سجل الدوام', category: 'attendance', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-12', key: 'overtime.view', label: 'عرض الساعات الإضافية', category: 'attendance', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-13', key: 'overtime.create', label: 'إضافة ساعات إضافية', category: 'attendance', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-14', key: 'overtime.edit', label: 'تعديل وحذف الإضافي', category: 'attendance', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-15', key: 'reports.view', label: 'عرض مركز التقارير', category: 'reports', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-16', key: 'reports.print', label: 'طباعة وتصدير التقارير', category: 'reports', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-17', key: 'settings.view', label: 'عرض الإعدادات العامة', category: 'settings', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-18', key: 'settings.edit', label: 'تعديل الإعدادات والمعادلات', category: 'settings', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-19', key: 'users.view', label: 'عرض مستخدمي النظام', category: 'users', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-20', key: 'users.create', label: 'إضافة مستخدم جديد', category: 'users', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-21', key: 'users.edit', label: 'تعديل صلاحيات المستخدمين', category: 'users', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-22', key: 'users.delete', label: 'حذف المستخدمين', category: 'users', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-23', key: 'departments.view', label: 'عرض الأقسام', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-24', key: 'departments.create', label: 'إضافة قسم جديد', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-25', key: 'departments.edit', label: 'تعديل الأقسام', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-26', key: 'departments.delete', label: 'حذف الأقسام', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-27', key: 'dashboard.view', label: 'عرض لوحة القيادة (الرئيسية)', category: 'settings', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-28', key: 'salary.approve', label: 'اعتماد وقفل مسيرات الرواتب', category: 'salary', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-29', key: 'salary.pay', label: 'تأكيد صرف مسيرات الرواتب', category: 'salary', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-30', key: 'attendance.delete', label: 'حذف سجلات الحضور والانصراف', category: 'attendance', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-31', key: 'employee-financial-transactions.view', label: 'عرض الحركات المالية', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-32', key: 'employee-financial-transactions.create', label: 'إضافة حركة مالية', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-33', key: 'employee-financial-transactions.edit', label: 'تعديل الحركات المالية', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-34', key: 'employee-financial-transactions.delete', label: 'حذف الحركات المالية', category: 'employees', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const DEFAULT_FINANCIAL_TRANSACTION_TYPES: FinancialTransactionType[] = [
  { id: 'type-1', name: 'مكافأة أداء', category: 'BONUS', isSystem: false, createdAt: new Date().toISOString() },
  { id: 'type-2', name: 'بدل مواصلات', category: 'BONUS', isSystem: false, createdAt: new Date().toISOString() },
  { id: 'type-3', name: 'سلفة مالية', category: 'DEDUCTION', isSystem: false, createdAt: new Date().toISOString() },
  { id: 'type-4', name: 'خصم إداري', category: 'DEDUCTION', isSystem: false, createdAt: new Date().toISOString() },
  { id: 'type-5', name: 'حسم غياب', category: 'DEDUCTION', isSystem: true, createdAt: new Date().toISOString() },
  { id: 'type-6', name: 'تسوية راتب', category: 'BONUS', isSystem: true, createdAt: new Date().toISOString() },
  { id: 'type-7', name: 'تسوية راتب (سالب)', category: 'DEDUCTION', isSystem: true, createdAt: new Date().toISOString() },
];

// ==========================================
// تهيئة التخزين المحلي (تمت الإزالة)
// ==========================================
const initLocalStorage = () => {
  // تم التخلص من حفظ البيانات في LocalStorage للتركيز على RTDB كلياً
};

initLocalStorage();

// ==========================================
// رفع البيانات الافتراضية إلى Firebase (عند أول تشغيل)
// ==========================================
const seedFirebase = async () => {
  if (!isFirebaseConfigured || !rtdb) return;
  await authReadyPromise;
  try {
    // تمت إزالة حقن المستخدمين الافتراضيين بناءً على طلب المستخدم

    // تحقق من وجود إعدادات
    const settingsSnap = await get(ref(rtdb, 'settings/general'));
    if (!settingsSnap.exists()) {
      await set(ref(rtdb, 'settings/general'), DEFAULT_SETTINGS);
      console.log('✅ تم رفع الإعدادات الافتراضية إلى Firebase.');
    }

    // تحقق من وجود أقسام
    const deptsSnap = await get(ref(rtdb, 'departments'));
    if (!deptsSnap.exists() || Object.keys(deptsSnap.val() || {}).length === 0) {
      const deptsMap: Record<string, DepartmentDocument> = {};
      DEFAULT_DEPARTMENTS.forEach(d => { deptsMap[d.id] = d; });
      await set(ref(rtdb, 'departments'), deptsMap);
      console.log('✅ تم رفع الأقسام الافتراضية إلى Firebase.');
    }

    // تحقق من وجود صلاحيات وأضف الناقص منها
    const permsSnap = await get(ref(rtdb, 'permissions'));
    const currentPerms = permsSnap.exists() ? permsSnap.val() : {};
    const permsToUpdate: Record<string, PermissionDocument> = {};
    let hasMissingPerms = false;
    
    DEFAULT_PERMISSIONS.forEach(p => {
      if (!currentPerms[p.id]) {
        permsToUpdate[p.id] = p;
        hasMissingPerms = true;
      }
    });
    
    if (hasMissingPerms) {
      await update(ref(rtdb, 'permissions'), permsToUpdate);
      console.log('✅ تم دمج الصلاحيات الجديدة الناقصة إلى Firebase.');
    }

    // تحقق من أنواع الحركات المالية
    const fTypesSnap = await get(ref(rtdb, 'financial_transaction_types'));
    if (!fTypesSnap.exists() || Object.keys(fTypesSnap.val() || {}).length === 0) {
      const typesMap: Record<string, FinancialTransactionType> = {};
      DEFAULT_FINANCIAL_TRANSACTION_TYPES.forEach(t => { typesMap[t.id] = t; });
      await set(ref(rtdb, 'financial_transaction_types'), typesMap);
      console.log('✅ تم رفع أنواع الحركات المالية الافتراضية إلى Firebase.');
    }

    // تمت إزالة حقن الموظفين الافتراضيين بناءً على طلب المستخدم

    // Migration: منح صلاحيات الحركات المالية للمدراء بشكل تلقائي لمرة واحدة
    const usersSnap = await get(ref(rtdb, 'users'));
    if (usersSnap.exists()) {
      const usersData = usersSnap.val() as Record<string, UserDocument>;
      const usersUpdates: Record<string, any> = {};
      const newPerms = [
        'employee-financial-transactions.view',
        'employee-financial-transactions.create',
        'employee-financial-transactions.edit',
        'employee-financial-transactions.delete'
      ];
      
      let needUserUpdate = false;
      Object.values(usersData).forEach(u => {
        if (u.role === 'super_admin' || u.role === 'manager') {
          const perms = u.permissions || [];
          let added = false;
          newPerms.forEach(np => {
            if (!perms.includes(np)) {
              perms.push(np);
              added = true;
            }
          });
          if (added) {
            usersUpdates[`${u.uid}/permissions`] = perms;
            needUserUpdate = true;
          }
        }
      });
      
      if (needUserUpdate) {
        await update(ref(rtdb, 'users'), usersUpdates);
        console.log('✅ تم دمج الصلاحيات الجديدة لمدراء النظام بنجاح.');
      }
    }
  } catch (err) {
    console.warn('⚠️ فشل رفع البيانات الافتراضية إلى Firebase:', err);
  }
};

// تشغيل عملية الـ seed عند بدء التطبيق
seedFirebase();

// ==========================================
// Helpers
// ==========================================
const snapToArray = <T>(snap: { val: () => Record<string, T> | null }): T[] => {
  const val = snap.val();
  if (!val) return [];
  return Object.values(val);
};

const isFirebaseOfflineError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code ?? '';
  const message = (error as { message?: string }).message ?? '';
  return (
    code === 'NETWORK_ERROR' || code === 'unavailable' ||
    code === 'disconnected' ||
    message.toLowerCase().includes('offline') ||
    message.toLowerCase().includes('network')
  );
};

const withRTDBFallback = async <T>(
  firebaseFn: () => Promise<T>,
  localFn: () => Promise<T>
): Promise<T> => {
  if (!isFirebaseConfigured || !rtdb) {
    // If Firebase is not configured, directly use the local fallback.
    return await localFn();
  }
  await authReadyPromise;
  try {
    // Try the Firebase version first.
    return await firebaseFn();
  } catch (error) {
    // If the error indicates an offline/network issue, fall back to local storage.
    if (isFirebaseOfflineError(error)) {
      console.warn('⚠️ Firebase غير متصل، الانتقال إلى النسخة المحلية.', error);
      return await localFn();
    }
    // Re‑throw other unexpected errors.
    throw error;
  }
};

const normalizeSettings = (settings: Partial<GeneralSettingsDocument>): GeneralSettingsDocument => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  globalCurrency: settings.globalCurrency ?? settings.currency ?? DEFAULT_SETTINGS.globalCurrency,
  currency: settings.globalCurrency ?? settings.currency ?? DEFAULT_SETTINGS.globalCurrency,
  shifts: {
    ...DEFAULT_SETTINGS.shifts,
    ...(settings.shifts ?? {}),
  },
  lateRule: settings.lateRule ?? DEFAULT_SETTINGS.lateRule,
  absenceRule: settings.absenceRule ?? DEFAULT_SETTINGS.absenceRule,
});

const normalizeUsers = (users: UserDocument[]): UserDocument[] => users;

// ==========================================
// dbService
// ==========================================
const removeUndefinedDeep = (obj: any): any => {
  const seen = new WeakSet();
  function clean(value: any): any {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return undefined;
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map(clean).filter(v => v !== undefined);
    }
    const res: any = {};
    for (const [k, v] of Object.entries(value)) {
      const cv = clean(v);
      if (cv !== undefined) res[k] = cv;
    }
    return res;
  }
  return clean(obj);
};

export const dbService = {

  // ----------------------------------------
  // الإعدادات
  // ----------------------------------------
  async getSettings(): Promise<GeneralSettingsDocument> {
    return withRTDBFallback(
      async () => {
        const snap = await get(ref(rtdb!, 'settings/general'));
        if (snap.exists()) return normalizeSettings(snap.val() as GeneralSettingsDocument);
        await set(ref(rtdb!, 'settings/general'), DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      },
      async () => {
        const local = localStorage.getItem('settings');
        const settings = local ? normalizeSettings(JSON.parse(local)) : DEFAULT_SETTINGS;
        localStorage.setItem('settings', JSON.stringify(settings));
        return settings;
      }
    );
  },

  async updateSettings(data: Partial<GeneralSettingsDocument>): Promise<void> {
    return withRTDBFallback(
      async () => { await update(ref(rtdb!, 'settings/general'), { ...data, updatedAt: new Date().toISOString() }); },
      async () => {
        const current = await this.getSettings();
        localStorage.setItem('settings', JSON.stringify(normalizeSettings({ ...current, ...data, updatedAt: new Date().toISOString() })));
      }
    );
  },

  // ----------------------------------------
  // المستخدمون
  // ----------------------------------------
  async getUsers(): Promise<UserDocument[]> {
    return withRTDBFallback(
      async () => { const snap = await get(ref(rtdb!, 'users')); return normalizeUsers(snapToArray<UserDocument>(snap)); },
      async () => {
        const users = normalizeUsers(JSON.parse(localStorage.getItem('users') || '[]'));
        localStorage.setItem('users', JSON.stringify(users));
        return users;
      }
    );
  },

  async getUser(uid: string): Promise<UserDocument | null> {
    return withRTDBFallback(
      async () => {
        const snap = await get(ref(rtdb!, `users/${uid}`));
        if (!snap.exists()) return null;
        return normalizeUsers([snap.val() as UserDocument])[0];
      },
      async () => { const users = await this.getUsers(); return users.find(u => u.uid === uid) || null; }
    );
  },

  async createUser(user: UserDocument): Promise<void> {
    return withRTDBFallback(
      async () => {
        await set(ref(rtdb!, `users/${user.uid}`), user);
        // Sync to local storage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (!users.some((u: UserDocument) => u.uid === user.uid)) {
          users.push(user);
          localStorage.setItem('users', JSON.stringify(users));
        }
      },
      async () => {
        const users = await this.getUsers();
        if (users.some(u => u.uid === user.uid)) return;
        users.push(user);
        localStorage.setItem('users', JSON.stringify(users));
      }
    );
  },

  async updateUser(uid: string, data: Partial<UserDocument>): Promise<void> {
    return withRTDBFallback(
      async () => {
        await update(ref(rtdb!, `users/${uid}`), { ...data, updatedAt: new Date().toISOString() });
        // Sync to local storage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const idx = users.findIndex((u: UserDocument) => u.uid === uid);
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
          localStorage.setItem('users', JSON.stringify(users));
        }
      },
      async () => {
        const users = await this.getUsers();
        const idx = users.findIndex(u => u.uid === uid);
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
          localStorage.setItem('users', JSON.stringify(users));
        }
      }
    );
  },

  async deleteUser(uid: string): Promise<void> {
    return withRTDBFallback(
      async () => {
        await remove(ref(rtdb!, `users/${uid}`));
        // Sync to local storage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const updatedUsers = users.filter((u: UserDocument) => u.uid !== uid);
        localStorage.setItem('users', JSON.stringify(updatedUsers));
      },
      async () => {
        const users = (await this.getUsers()).filter(u => u.uid !== uid);
        localStorage.setItem('users', JSON.stringify(users));
      }
    );
  },

  // ----------------------------------------
  // الموظفون
  // ----------------------------------------
  async getEmployees(): Promise<EmployeeDocument[]> {
    return withRTDBFallback(
      async () => { const snap = await get(ref(rtdb!, 'employees')); return snapToArray<EmployeeDocument>(snap); },
      async () => JSON.parse(localStorage.getItem('employees') || '[]')
    );
  },

  async getEmployee(id: string): Promise<EmployeeDocument | null> {
    return withRTDBFallback(
      async () => { const snap = await get(ref(rtdb!, `employees/${id}`)); return snap.exists() ? snap.val() as EmployeeDocument : null; },
      async () => { const emps = await this.getEmployees(); return emps.find(e => e.id === id) || null; }
    );
  },

  async createEmployee(employee: EmployeeDocument): Promise<void> {
    return withRTDBFallback(
      async () => { await set(ref(rtdb!, `employees/${employee.id}`), employee); },
      async () => {
        const employees = await this.getEmployees();
        employees.push(employee);
        localStorage.setItem('employees', JSON.stringify(employees));
      }
    );
  },

  async updateEmployee(id: string, data: Partial<EmployeeDocument>): Promise<void> {
    return withRTDBFallback(
      async () => { await update(ref(rtdb!, `employees/${id}`), { ...data, updatedAt: new Date().toISOString() }); },
      async () => {
        const employees = await this.getEmployees();
        const idx = employees.findIndex(e => e.id === id);
        if (idx !== -1) {
          employees[idx] = { ...employees[idx], ...data, updatedAt: new Date().toISOString() };
          localStorage.setItem('employees', JSON.stringify(employees));
        }
      }
    );
  },

  async deleteEmployee(id: string): Promise<void> {
    return withRTDBFallback(
      async () => { await remove(ref(rtdb!, `employees/${id}`)); },
      async () => {
        const employees = (await this.getEmployees()).filter(e => e.id !== id);
        localStorage.setItem('employees', JSON.stringify(employees));
      }
    );
  },

  // ----------------------------------------
  // الحضور
  // ----------------------------------------
  async getAttendance(date?: string): Promise<AttendanceDocument[]> {
    return withRTDBFallback(
      async () => {
        const snap = await get(ref(rtdb!, 'attendance'));
        const all = snapToArray<AttendanceDocument>(snap);
        return date ? all.filter(a => a.date === date) : all;
      },
      async () => {
        const all: AttendanceDocument[] = JSON.parse(localStorage.getItem('attendance') || '[]');
        return date ? all.filter(a => a.date === date) : all;
      }
    );
  },

  async recordAttendance(attendance: AttendanceDocument): Promise<void> {
    const sanitized = removeUndefinedDeep(attendance);
    return withRTDBFallback(
      async () => { await set(ref(rtdb!, `attendance/${attendance.id}`), sanitized); },
      async () => {
        const all = await this.getAttendance();
        const idx = all.findIndex(a => a.id === attendance.id);
        if (idx !== -1) { all[idx] = sanitized as AttendanceDocument; } else { all.push(sanitized as AttendanceDocument); }
        localStorage.setItem('attendance', JSON.stringify(all));
      }
    );
  },


  async deleteAttendance(id: string): Promise<void> {
    return withRTDBFallback(
      async () => { await remove(ref(rtdb!, `attendance/${id}`)); },
      async () => {
        const all = (await this.getAttendance()).filter(a => a.id !== id);
        localStorage.setItem('attendance', JSON.stringify(all));
      }
    );
  },

  // ----------------------------------------
  // الساعات الإضافية
  // ----------------------------------------
  async getOvertimeRecords(cycleId?: string): Promise<OvertimeDocument[]> {
    return withRTDBFallback(
      async () => {
        const snap = await get(ref(rtdb!, 'overtime'));
        const all = snapToArray<OvertimeDocument>(snap);
        return cycleId ? all.filter(o => o.salaryCycleId === cycleId) : all;
      },
      async () => {
        const all: OvertimeDocument[] = JSON.parse(localStorage.getItem('overtime') || '[]');
        return cycleId ? all.filter(o => o.salaryCycleId === cycleId) : all;
      }
    );
  },

  async addOvertime(record: OvertimeDocument): Promise<void> {
    return withRTDBFallback(
      async () => { await set(ref(rtdb!, `overtime/${record.id}`), record); },
      async () => {
        const all = await this.getOvertimeRecords();
        all.push(record);
        localStorage.setItem('overtime', JSON.stringify(all));
      }
    );
  },

  async deleteOvertime(id: string): Promise<void> {
    return withRTDBFallback(
      async () => { await remove(ref(rtdb!, `overtime/${id}`)); },
      async () => {
        const all = (await this.getOvertimeRecords()).filter(o => o.id !== id);
        localStorage.setItem('overtime', JSON.stringify(all));
      }
    );
  },

  // ----------------------------------------
  // دورات ومسيرات الرواتب
  // ----------------------------------------
  async getSalaryCycles(): Promise<SalaryCycleDocument[]> {
    return withRTDBFallback(
      async () => { const snap = await get(ref(rtdb!, 'salary_cycles')); return snapToArray<SalaryCycleDocument>(snap); },
      async () => JSON.parse(localStorage.getItem('salary_cycles') || '[]')
    );
  },

  async createSalaryCycle(cycle: SalaryCycleDocument, records: SalaryRecordDocument[]): Promise<void> {
    return withRTDBFallback(
      async () => {
        await set(ref(rtdb!, `salary_cycles/${cycle.id}`), cycle);
        const recordsMap: Record<string, SalaryRecordDocument> = {};
        records.forEach(r => { recordsMap[r.id] = r; });
        await update(ref(rtdb!, 'salary_records'), recordsMap);
      },
      async () => {
        const cycles = await this.getSalaryCycles();
        cycles.push(cycle);
        localStorage.setItem('salary_cycles', JSON.stringify(cycles));
        const allRecords = JSON.parse(localStorage.getItem('salary_records') || '[]');
        allRecords.push(...records);
        localStorage.setItem('salary_records', JSON.stringify(allRecords));
      }
    );
  },

  async deleteSalaryCycle(cycleId: string): Promise<void> {
    return withRTDBFallback(
      async () => {
        const snap = await get(ref(rtdb!, `salary_cycles/${cycleId}`));
        if (snap.exists()) {
          const cycle = snap.val() as SalaryCycleDocument;
          if (cycle.status === 'approved' || cycle.status === 'paid' || cycle.status === 'closed') {
            throw new Error('لا يمكن حذف كشف معتمد أو مقفل.');
          }
        }
        await remove(ref(rtdb!, `salary_cycles/${cycleId}`));
        const snapRecords = await get(ref(rtdb!, 'salary_records'));
        const recordsToDelete = snapToArray<SalaryRecordDocument>(snapRecords).filter(r => r.cycleId === cycleId);
        const updates: Record<string, unknown> = {};
        recordsToDelete.forEach(r => { updates[r.id] = null; });
        if (Object.keys(updates).length > 0) await update(ref(rtdb!, 'salary_records'), updates);
      },
      async () => {
        const cycles = await this.getSalaryCycles();
        const cycle = cycles.find(c => c.id === cycleId);
        if (cycle && (cycle.status === 'approved' || cycle.status === 'paid' || cycle.status === 'closed')) {
          throw new Error('لا يمكن حذف كشف معتمد أو مقفل.');
        }
        const updated = cycles.filter(c => c.id !== cycleId);
        localStorage.setItem('salary_cycles', JSON.stringify(updated));
        const allRecords: SalaryRecordDocument[] = JSON.parse(localStorage.getItem('salary_records') || '[]');
        const filtered = allRecords.filter(r => r.cycleId !== cycleId);
        localStorage.setItem('salary_records', JSON.stringify(filtered));
      }
    );
  },


  async updateSalaryCycleStatus(cycleId: string, status: 'draft' | 'approved' | 'paid' | 'closed'): Promise<void> {
    return withRTDBFallback(
      async () => {
        await update(ref(rtdb!, `salary_cycles/${cycleId}`), { status });
        if (status === 'paid') {
          const snap = await get(ref(rtdb!, 'salary_records'));
          const all = snapToArray<SalaryRecordDocument>(snap);
          const updates: Record<string, unknown> = {};
          all.filter(r => r.cycleId === cycleId).forEach(r => {
            updates[`salary_records/${r.id}/status`] = 'paid';
            updates[`salary_records/${r.id}/paidAt`] = new Date().toISOString();
          });
          if (Object.keys(updates).length > 0) await update(ref(rtdb!), updates);
        }
      },
      async () => {
        const cycles = await this.getSalaryCycles();
        const idx = cycles.findIndex(c => c.id === cycleId);
        if (idx !== -1) { cycles[idx].status = status; localStorage.setItem('salary_cycles', JSON.stringify(cycles)); }
        const allRecords: SalaryRecordDocument[] = JSON.parse(localStorage.getItem('salary_records') || '[]');
        const updated = allRecords.map(r =>
          r.cycleId === cycleId
            ? { ...r, status: status === 'paid' ? 'paid' as const : 'unpaid' as const, paidAt: status === 'paid' ? new Date().toISOString() : undefined }
            : r
        );
        localStorage.setItem('salary_records', JSON.stringify(updated));
      }
    );
  },

  async getSalaryRecords(cycleId: string): Promise<SalaryRecordDocument[]> {
    return withRTDBFallback(
      async () => {
        const snap = await get(ref(rtdb!, 'salary_records'));
        return snapToArray<SalaryRecordDocument>(snap).filter(r => r.cycleId === cycleId);
      },
      async () => {
        const all: SalaryRecordDocument[] = JSON.parse(localStorage.getItem('salary_records') || '[]');
        return all.filter(r => r.cycleId === cycleId);
      }
    );
  },

  async updateSalaryRecord(recordId: string, data: Partial<SalaryRecordDocument>): Promise<void> {
    return withRTDBFallback(
      async () => { await update(ref(rtdb!, `salary_records/${recordId}`), data); },
      async () => {
        const all: SalaryRecordDocument[] = JSON.parse(localStorage.getItem('salary_records') || '[]');
        const idx = all.findIndex(r => r.id === recordId);
        if (idx !== -1) { all[idx] = { ...all[idx], ...data }; localStorage.setItem('salary_records', JSON.stringify(all)); }
      }
    );
  },

  async deleteSalaryRecord(recordId: string): Promise<void> {
    return withRTDBFallback(
      async () => { await remove(ref(rtdb!, `salary_records/${recordId}`)); },
      async () => {
        const all: SalaryRecordDocument[] = JSON.parse(localStorage.getItem('salary_records') || '[]');
        const updated = all.filter(r => r.id !== recordId);
        localStorage.setItem('salary_records', JSON.stringify(updated));
      }
    );
  },

  // ----------------------------------------
  // الأقسام (Departments)
  // ----------------------------------------
  async getDepartments(): Promise<DepartmentDocument[]> {
    return withRTDBFallback(
      async () => { const snap = await get(ref(rtdb!, 'departments')); return snapToArray<DepartmentDocument>(snap); },
      async () => JSON.parse(localStorage.getItem('departments') || '[]')
    );
  },

  async createDepartment(dept: DepartmentDocument): Promise<void> {
    return withRTDBFallback(
      async () => { await set(ref(rtdb!, `departments/${dept.id}`), dept); },
      async () => {
        const all = await this.getDepartments();
        all.push(dept);
        localStorage.setItem('departments', JSON.stringify(all));
      }
    );
  },

  async updateDepartment(id: string, data: Partial<DepartmentDocument>): Promise<void> {
    return withRTDBFallback(
      async () => { await update(ref(rtdb!, `departments/${id}`), { ...data, updatedAt: new Date().toISOString() }); },
      async () => {
        const all = await this.getDepartments();
        const idx = all.findIndex(d => d.id === id);
        if (idx !== -1) { all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() }; localStorage.setItem('departments', JSON.stringify(all)); }
      }
    );
  },

  async deleteDepartment(id: string): Promise<void> {
    return withRTDBFallback(
      async () => { await remove(ref(rtdb!, `departments/${id}`)); },
      async () => {
        const all = (await this.getDepartments()).filter(d => d.id !== id);
        localStorage.setItem('departments', JSON.stringify(all));
      }
    );
  },

  // ----------------------------------------
  // الصلاحيات (Permissions)
  // ----------------------------------------
  async getPermissions(): Promise<PermissionDocument[]> {
    return withRTDBFallback(
      async () => { const snap = await get(ref(rtdb!, 'permissions')); return snapToArray<PermissionDocument>(snap); },
      async () => JSON.parse(localStorage.getItem('permissions') || '[]')
    );
  },

  async createPermission(perm: PermissionDocument): Promise<void> {
    return withRTDBFallback(
      async () => { await set(ref(rtdb!, `permissions/${perm.id}`), perm); },
      async () => {
        const all = await this.getPermissions();
        all.push(perm);
        localStorage.setItem('permissions', JSON.stringify(all));
      }
    );
  },

  async updatePermission(id: string, data: Partial<PermissionDocument>): Promise<void> {
    return withRTDBFallback(
      async () => { await update(ref(rtdb!, `permissions/${id}`), { ...data, updatedAt: new Date().toISOString() }); },
      async () => {
        const all = await this.getPermissions();
        const idx = all.findIndex(p => p.id === id);
        if (idx !== -1) { all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() }; localStorage.setItem('permissions', JSON.stringify(all)); }
      }
    );
  },

  async deletePermission(id: string): Promise<void> {
    return withRTDBFallback(
      async () => { await remove(ref(rtdb!, `permissions/${id}`)); },
      async () => {
        const all = (await this.getPermissions()).filter(p => p.id !== id);
        localStorage.setItem('permissions', JSON.stringify(all));
      }
    );
  },

  // ----------------------------------------
  // الحركات المالية للموظفين (Financial Transactions)
  // ----------------------------------------
  async getFinancialTransactionTypes(): Promise<FinancialTransactionType[]> {
    return withRTDBFallback(
      async () => { const snap = await get(ref(rtdb!, 'financial_transaction_types')); return snapToArray<FinancialTransactionType>(snap); },
      async () => JSON.parse(localStorage.getItem('financial_transaction_types') || '[]')
    );
  },

  async getFinancialTransactions(monthCycle?: string, employeeId?: string): Promise<EmployeeFinancialTransaction[]> {
    return withRTDBFallback(
      async () => {
        const snap = await get(ref(rtdb!, 'financial_transactions'));
        let all = snapToArray<EmployeeFinancialTransaction>(snap);
        if (monthCycle) all = all.filter(t => t.monthCycle === monthCycle);
        if (employeeId) all = all.filter(t => t.employeeId === employeeId);
        return all;
      },
      async () => {
        let all: EmployeeFinancialTransaction[] = JSON.parse(localStorage.getItem('financial_transactions') || '[]');
        if (monthCycle) all = all.filter(t => t.monthCycle === monthCycle);
        if (employeeId) all = all.filter(t => t.employeeId === employeeId);
        return all;
      }
    );
  },

  async addFinancialTransaction(transaction: EmployeeFinancialTransaction): Promise<void> {
    return withRTDBFallback(
      async () => { await set(ref(rtdb!, `financial_transactions/${transaction.id}`), transaction); },
      async () => {
        const all: EmployeeFinancialTransaction[] = JSON.parse(localStorage.getItem('financial_transactions') || '[]');
        all.push(transaction);
        localStorage.setItem('financial_transactions', JSON.stringify(all));
      }
    );
  },

  async updateFinancialTransaction(id: string, data: Partial<EmployeeFinancialTransaction>): Promise<void> {
    return withRTDBFallback(
      async () => { await update(ref(rtdb!, `financial_transactions/${id}`), { ...data, updatedAt: new Date().toISOString() }); },
      async () => {
        const all: EmployeeFinancialTransaction[] = JSON.parse(localStorage.getItem('financial_transactions') || '[]');
        const idx = all.findIndex(t => t.id === id);
        if (idx !== -1) {
          all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
          localStorage.setItem('financial_transactions', JSON.stringify(all));
        }
      }
    );
  },

  async deleteFinancialTransaction(id: string): Promise<void> {
    return withRTDBFallback(
      async () => { await remove(ref(rtdb!, `financial_transactions/${id}`)); },
      async () => {
        const all: EmployeeFinancialTransaction[] = JSON.parse(localStorage.getItem('financial_transactions') || '[]');
        const updated = all.filter(t => t.id !== id);
        localStorage.setItem('financial_transactions', JSON.stringify(updated));
      }
    );
  },
};
