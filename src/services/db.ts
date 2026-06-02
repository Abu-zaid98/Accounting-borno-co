import { isFirebaseConfigured, rtdb } from './firebase';
import {
  ref, get, set, update, remove
} from 'firebase/database';
import type {
  UserDocument, EmployeeDocument, AttendanceDocument, OvertimeDocument,
  SalaryCycleDocument, SalaryRecordDocument, GeneralSettingsDocument,
  DepartmentDocument, PermissionDocument
} from '../types';
import { DEFAULT_ATTENDANCE_SETTINGS } from './attendance';

// ==========================================
// البيانات الافتراضية للوضع المحلي
// ==========================================

const DEFAULT_USERS: UserDocument[] = [
  {
    uid: 'mock-admin',
    fullName: 'أبو محمد - المدير العام',
    email: 'admin@arbahy.com',
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
    passwordHash: 'h_' + Math.abs('adminpassword'.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)).toString(36),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    uid: 'mock-accountant',
    fullName: 'أحمد مراد - المحاسب المالي',
    email: 'accountant@arbahy.com',
    role: 'accountant',
    permissions: [
      'employees.view',
      'salary.view', 'salary.edit',
      'attendance.view', 'attendance.create',
      'overtime.view', 'overtime.create',
      'reports.view', 'reports.print',
      'settings.view',
      'departments.view',
    ],
    status: 'active',
    passwordHash: 'h_' + Math.abs('123'.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)).toString(36),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_EMPLOYEES: EmployeeDocument[] = [
  {
    id: 'emp-1',
    employeeNo: 'EMP-001',
    fullName: 'محمد عبد الله الحسين',
    phone: '0501234567',
    address: 'الرياض - حي الياسمين',
    jobTitle: 'أخصائي تغليف وتصميم هدايا',
    department: 'قسم التغليف الفاخر',
    basicSalary: 6000,
    hireDate: '2024-01-15',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-2',
    employeeNo: 'EMP-002',
    fullName: 'سارة أحمد الشمري',
    phone: '0559876543',
    address: 'الرياض - حي الملقا',
    jobTitle: 'مسؤولة مبيعات وكاشير',
    department: 'المبيعات والصالة',
    basicSalary: 4800,
    hireDate: '2024-03-01',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-3',
    employeeNo: 'EMP-003',
    fullName: 'خالد عمر باوزير',
    phone: '0543210987',
    address: 'الرياض - حي العقيق',
    jobTitle: 'منسق زهور طبيعية وتصميم كوش',
    department: 'قسم التنسيق والزهور',
    basicSalary: 5500,
    hireDate: '2024-06-10',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-4',
    employeeNo: 'EMP-004',
    fullName: 'ريم علي السبيعي',
    phone: '0561122334',
    address: 'الرياض - حي الصحافة',
    jobTitle: 'أخصائية تغليف وتطريز أشرطة',
    department: 'قسم التغليف الفاخر',
    basicSalary: 6200,
    hireDate: '2025-02-20',
    status: 'suspended',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_SETTINGS: GeneralSettingsDocument = {
  shopName: 'البورنو لخدمات تغليف الهدايا الراقية',
  dailyWorkingHours: 8,
  overtimeRateType: 'auto',
  fixedOvertimeRate: 25,
  globalCurrency: 'ر.س',
  currency: 'ر.س',
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
  { id: 'perm-1',  key: 'employees.view',      label: 'عرض الموظفين',                  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-2',  key: 'employees.create',    label: 'إضافة موظف',                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-3',  key: 'employees.edit',      label: 'تعديل موظف',                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-4',  key: 'employees.delete',    label: 'حذف موظف',                      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-5',  key: 'salary.view',         label: 'عرض الرواتب',                   createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-6',  key: 'salary.create',       label: 'توليد مسير رواتب',              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-7',  key: 'salary.edit',         label: 'تعديل الرواتب يدوياً',          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-8',  key: 'salary.delete',       label: 'حذف مسيرات الرواتب',            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-9',  key: 'attendance.view',     label: 'عرض سجل التحضير',              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-10', key: 'attendance.create',   label: 'تسجيل الحضور والانصراف',       createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-11', key: 'attendance.edit',     label: 'تعديل سجل الدوام',             createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-12', key: 'overtime.view',       label: 'عرض الساعات الإضافية',         createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-13', key: 'overtime.create',     label: 'إضافة ساعات إضافية',           createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-14', key: 'overtime.edit',       label: 'تعديل وحذف الإضافي',           createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-15', key: 'reports.view',        label: 'عرض مركز التقارير',            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-16', key: 'reports.print',       label: 'طباعة وتصدير التقارير',        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-17', key: 'settings.view',       label: 'عرض الإعدادات العامة',         createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-18', key: 'settings.edit',       label: 'تعديل الإعدادات والمعادلات',   createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-19', key: 'users.view',          label: 'عرض مستخدمي النظام',           createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-20', key: 'users.create',        label: 'إضافة مستخدم جديد',            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-21', key: 'users.edit',          label: 'تعديل صلاحيات المستخدمين',    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-22', key: 'users.delete',        label: 'حذف المستخدمين',               createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-23', key: 'departments.view',    label: 'عرض الأقسام',                  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-24', key: 'departments.create',  label: 'إضافة قسم جديد',               createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-25', key: 'departments.edit',    label: 'تعديل الأقسام',                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-26', key: 'departments.delete',  label: 'حذف الأقسام',                  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-27', key: 'dashboard.view',      label: 'عرض لوحة القيادة (الرئيسية)',    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-28', key: 'salary.approve',      label: 'اعتماد وقفل مسيرات الرواتب',     createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-29', key: 'salary.pay',          label: 'تأكيد صرف مسيرات الرواتب',      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'perm-30', key: 'attendance.delete',   label: 'حذف سجلات الحضور والانصراف',   createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// ==========================================
// تهيئة التخزين المحلي
// ==========================================
const initLocalStorage = () => {
  if (!localStorage.getItem('users'))         localStorage.setItem('users',         JSON.stringify(DEFAULT_USERS));
  if (!localStorage.getItem('employees'))     localStorage.setItem('employees',     JSON.stringify(DEFAULT_EMPLOYEES));
  if (!localStorage.getItem('settings'))      localStorage.setItem('settings',      JSON.stringify(DEFAULT_SETTINGS));
  if (!localStorage.getItem('attendance'))    localStorage.setItem('attendance',    JSON.stringify([]));
  if (!localStorage.getItem('overtime'))      localStorage.setItem('overtime',      JSON.stringify([]));
  if (!localStorage.getItem('salary_cycles')) localStorage.setItem('salary_cycles', JSON.stringify([]));
  if (!localStorage.getItem('salary_records'))localStorage.setItem('salary_records',JSON.stringify([]));
  if (!localStorage.getItem('departments'))   localStorage.setItem('departments',   JSON.stringify(DEFAULT_DEPARTMENTS));
  if (!localStorage.getItem('permissions'))   localStorage.setItem('permissions',   JSON.stringify(DEFAULT_PERMISSIONS));
};

initLocalStorage();

// ==========================================
// رفع البيانات الافتراضية إلى Firebase (عند أول تشغيل)
// ==========================================
const seedFirebase = async () => {
  if (!isFirebaseConfigured || !rtdb) return;
  try {
    // تحقق من وجود مستخدمين في Firebase
    const usersSnap = await get(ref(rtdb, 'users'));
    if (!usersSnap.exists() || Object.keys(usersSnap.val() || {}).length === 0) {
      console.log('🌱 Firebase فارغ — رفع البيانات الافتراضية...');
      // رفع المستخدمين الافتراضيين
      const usersMap: Record<string, UserDocument> = {};
      DEFAULT_USERS.forEach(u => { usersMap[u.uid] = u; });
      await set(ref(rtdb, 'users'), usersMap);
      console.log('✅ تم رفع المستخدمين الافتراضيين إلى Firebase.');
    }

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

    // تحقق من وجود صلاحيات
    const permsSnap = await get(ref(rtdb, 'permissions'));
    if (!permsSnap.exists() || Object.keys(permsSnap.val() || {}).length === 0) {
      const permsMap: Record<string, PermissionDocument> = {};
      DEFAULT_PERMISSIONS.forEach(p => { permsMap[p.id] = p; });
      await set(ref(rtdb, 'permissions'), permsMap);
      console.log('✅ تم رفع الصلاحيات الافتراضية إلى Firebase.');
    }

    // تحقق من وجود موظفين
    const empsSnap = await get(ref(rtdb, 'employees'));
    if (!empsSnap.exists() || Object.keys(empsSnap.val() || {}).length === 0) {
      const empsMap: Record<string, EmployeeDocument> = {};
      DEFAULT_EMPLOYEES.forEach(e => { empsMap[e.id] = e; });
      await set(ref(rtdb, 'employees'), empsMap);
      console.log('✅ تم رفع الموظفين الافتراضيين إلى Firebase.');
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
  if (!isFirebaseConfigured || !rtdb) return localFn();
  try {
    return await firebaseFn();
  } catch (error) {
    if (isFirebaseOfflineError(error)) {
      console.warn('⚠️ Realtime DB غير متاح، تراجع للبيانات المحلية...', error);
      return localFn();
    }
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

const legacyHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36);
};

const normalizeUsers = (users: UserDocument[]): UserDocument[] => users.map(user => {
  if (user.passwordHash) return user;
  if (user.email === 'admin@arbahy.com') return { ...user, passwordHash: legacyHash('adminpassword') };
  if (user.email === 'accountant@arbahy.com') return { ...user, passwordHash: legacyHash('123') };
  return user;
});

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
};
