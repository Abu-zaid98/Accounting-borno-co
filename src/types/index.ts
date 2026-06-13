export interface UserDocument {
  // المعرف الفريد للمستخدم (من Database)
  uid: string;
  fullName: string;
  username: string; // تم استبدال البريد الإلكتروني باسم المستخدم
  passwordHash?: string; // كلمة المرور المشفرة
  sessionToken?: string; // رمز الجلسة الحالي
  email?: string;
  phone?: string;
  avatarUrl?: string;
  
  // دور المستخدم
  role: 'super_admin' | 'manager' | 'accountant' | 'employee';
  
  // معرّف القسم (إن وجد)
  departmentId?: string;
  
  // حالة الحساب
  status: 'active' | 'inactive' | 'suspended' | 'pending_approval';
  
  // الصلاحيات (يتم جلبها من قاعدة البيانات)
  permissions: string[];
  
  // بيانات التدقيق
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  
  // ملاحظات إضافية
  notes?: string;
}

// دور المستخدم وصلاحياته
export interface RoleDocument {
  id: string;
  name: string;                   // مثل "super_admin"
  label: string;                  // مثل "مسؤول عام"
  description?: string;
  permissions: string[];          // قائمة الصلاحيات
  isSystem: boolean;              // هل هو دور نظام محجوز؟
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

// الصلاحيات المتاحة
export interface PermissionDocument {
  id: string;
  key: string;                    // مثل "users.view"
  label: string;                  // مثل "عرض المستخدمين"
  category: 'users' | 'employees' | 'attendance' | 'salary' | 'reports' | 'settings';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// جلسة المستخدم
export interface SessionData {
  uid: string;
  fullName: string;
  username: string;
  role: string;
  permissions: string[];
  status: UserDocument['status'];
  sessionToken: string;           // Custom Token
  expiresAt: number;              // Timestamp عند انتهاء الـ Token
}

export interface EmployeeDocument {
  id: string;
  employeeNo: string;
  fullName: string;
  phone: string;
  address: string;
  jobTitle: string;
  department: string;
  basicSalary: number;
  shiftType?: ShiftType;
  shiftStartTime?: string;
  shiftEndTime?: string;
  gracePeriodMinutes?: number;
  lateRule?: AttendanceRule;
  absenceRule?: AttendanceRule;
  hireDate: string;
  status: 'active' | 'suspended' | 'archived';
  avatarUrl?: string;
  // رقم هوية الموظف (اختياري)
  idNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceDocument {
  id: string; // employeeId_YYYYMMDD
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  checkIn: string; // ISO string
  checkOut?: string; // ISO string
  workingHours: number;
  status: AttendanceStatus;
  shiftType?: ShiftType;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  isManualOverride?: boolean;
  overrideReason?: string;
  auditTrail?: AttendanceAuditLog[];
  createdAt: string;
  updatedAt?: string;
}

export type ShiftType = 'morning' | 'evening';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'outside_shift';

export interface AttendanceRule {
  afterMinutes: number;
}

export interface AttendanceShiftSettings {
  shiftType: ShiftType;
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  lateRule: AttendanceRule;
  absenceRule: AttendanceRule;
}

export interface AttendanceAuditLog {
  id: string;
  action: 'manual_override' | 'check_in' | 'check_out' | 'mark_absent';
  changedBy: string;
  changedAt: string;
  reason?: string;
  before?: Partial<AttendanceDocument>;
  after?: Partial<AttendanceDocument>;
}

export interface OvertimeDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  hours: number;
  reason: string;
  hourlyRate: number;
  totalAmount: number;
  salaryCycleId?: string;
  createdAt: string;
}

export interface SalaryCycleDocument {
  id: string; // YYYY-MM
  month: number;
  year: number;
  status: 'draft' | 'approved' | 'paid' | 'closed';
  processedBy: string;
  processedAt: string;
}

export interface SalaryRecordDocument {
  id: string; // cycleId_employeeId
  cycleId: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  jobTitle: string;
  basicSalary: number;
  overtimeHours: number;
  overtimeAmount: number;
  bonuses: number;
  deductions: number;
  advances: number;
  netSalary: number;
  status: 'unpaid' | 'paid';
  paidAt?: string;
}

export interface GeneralSettingsDocument {
  shopName: string;
  logoUrl?: string;
  dailyWorkingHours: number;
  overtimeRateType: 'auto' | 'fixed';
  fixedOvertimeRate: number;
  globalCurrency: string;
  currency?: string;
  workStartTime: string;
  workEndTime: string;
  shiftType: ShiftType;
  gracePeriodMinutes: number;
  lateRule: AttendanceRule;
  absenceRule: AttendanceRule;
  shifts: Record<ShiftType, AttendanceShiftSettings>;
  updatedAt: string;
}

export interface DepartmentDocument {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}
