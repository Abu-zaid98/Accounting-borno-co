export interface UserDocument {
  uid: string;
  fullName: string;
  email: string;
  role: 'super_admin' | 'manager' | 'accountant' | string;
  permissions: string[];
  status: 'active' | 'disabled';
  passwordHash?: string; // للوضع المحلي فقط
  createdAt: string;
  updatedAt: string;
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

export interface PermissionDocument {
  id: string;
  key: string;        // e.g. "employees.view"
  label: string;      // e.g. "عرض الموظفين"
  departmentId?: string; // ربط بقسم
  createdAt: string;
  updatedAt: string;
}
