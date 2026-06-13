/**
 * SECURE TYPES - Session-Based Authentication System
 * 
 * This file defines all types for the new secure multi-tenant architecture.
 * All sensitive data (passwordHash, secrets) are excluded from frontend.
 */

// ==================== SESSION TYPES ====================

export interface SecureSessionData {
  uid: string;
  companyId: string;
  username: string;
  fullName: string;
  role: UserRole;
  permissions: string[];
  sessionToken: string;
  createdAt: number;
  expiresAt: number;
  isActive: boolean;
  ipAddress?: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  session: SecureSessionData | null;
  error?: string;
  expiresIn?: number;
}

// ==================== USER TYPES ====================

export type UserRole = 'super_admin' | 'manager' | 'accountant' | 'employee';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_approval';

export interface UserDocument {
  uid: string;
  companyId: string;
  fullName: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
  email?: string;
  phone?: string;
  avatarUrl?: string;
  departmentId?: string;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  notes?: string;
  // ❌ NO passwordHash here - it's in userCredentials node
}

/**
 * Credentials stored separately in userCredentials/{uid}
 * NEVER sent to frontend
 */
export interface UserCredentials {
  uid: string;
  passwordHash: string;
  status: UserStatus;
  lastPasswordChange: number;
  passwordHistory?: string[]; // optional: store last N password hashes
}

// ==================== COMPANY TYPES ====================

export interface CompanyMetadata {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: number;
  updatedAt: number;
  ownerId: string;
}

export interface CompanyData {
  metadata: CompanyMetadata;
  users: Record<string, UserDocument>;
  employees: Record<string, EmployeeDocument>;
  salaries: Record<string, SalaryRecordDocument>;
  attendance: Record<string, AttendanceDocument>;
  settings: GeneralSettingsDocument;
  logs: Record<string, AuditLogEntry>;
}

// ==================== AUDIT TYPES ====================

export type AuditAction =
  | 'login'
  | 'logout'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'salary.view'
  | 'salary.approve'
  | 'salary.pay'
  | 'attendance.mark'
  | 'attendance.delete'
  | 'employee.create'
  | 'employee.update'
  | 'settings.update'
  | 'permission.change'
  | 'role.change'
  | 'unauthorized_attempt';

export interface AuditLogEntry {
  id: string;
  companyId: string; // Multi‑tenant identifier
  userId: string;
  username: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  timestamp: number;
  status: 'success' | 'failed';
  metadata?: Record<string, any>;
  ipAddress?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
}

// ==================== RATE LIMITING ====================

export interface RateLimitEntry {
  attempts: number;
  lastAttemptTime: number;
  blockedUntil?: number;
}

// ==================== LOGIN/AUTH ====================

export interface LoginRequest {
  username: string;
  password: string;
  companyId?: string; // optional, can be inferred from username
}

export interface LoginResponse {
  session: SecureSessionData;
  // ❌ NO passwordHash, NO user credentials
}



// ==================== PERMISSION TYPES ====================

export interface Permission {
  id: string;
  key: string; // e.g., "users.view", "salary.approve"
  label: string;
  category: 'users' | 'employees' | 'salary' | 'attendance' | 'reports' | 'settings' | 'audit';
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoleDefinition {
  id: string;
  name: UserRole;
  label: string;
  description?: string;
  permissions: string[];
  isSystem: boolean; // system roles cannot be deleted
  status: 'active' | 'disabled';
  createdAt: number;
  updatedAt: number;
}

// ==================== EMPLOYEE TYPES (from original) ====================

export interface EmployeeDocument {
  id: string;
  companyId: string;
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
  idNumber?: string;
  createdAt: number;
  updatedAt: number;
}

// ==================== ATTENDANCE TYPES ====================

export type ShiftType = 'morning' | 'evening';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'outside_shift';

export interface AttendanceRule {
  afterMinutes: number;
}

export interface AttendanceDocument {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  checkIn: number; // timestamp
  checkOut?: number;
  workingHours: number;
  status: AttendanceStatus;
  shiftType?: ShiftType;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  isManualOverride?: boolean;
  overrideReason?: string;
  auditTrail?: AttendanceAuditLog[];
  createdAt: number;
  updatedAt?: number;
}

export interface AttendanceAuditLog {
  id: string;
  action: 'manual_override' | 'check_in' | 'check_out' | 'mark_absent';
  changedBy: string;
  changedAt: number;
  reason?: string;
}

// ==================== SALARY TYPES ====================

export interface SalaryCycleDocument {
  id: string; // YYYY-MM
  companyId: string;
  month: number;
  year: number;
  status: 'draft' | 'approved' | 'paid' | 'closed';
  processedBy: string;
  processedAt: number;
}

export interface SalaryRecordDocument {
  id: string;
  companyId: string;
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
  paidAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ==================== SETTINGS TYPES ====================

export interface AttendanceShiftSettings {
  shiftType: ShiftType;
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  lateRule: AttendanceRule;
  absenceRule: AttendanceRule;
}

export interface GeneralSettingsDocument {
  companyId: string;
  shopName: string;
  logoUrl?: string;
  dailyWorkingHours: number;
  overtimeRateType: 'auto' | 'fixed';
  fixedOvertimeRate: number;
  globalCurrency: string;
  workStartTime: string;
  workEndTime: string;
  shiftType: ShiftType;
  gracePeriodMinutes: number;
  lateRule: AttendanceRule;
  absenceRule: AttendanceRule;
  shifts: Record<ShiftType, AttendanceShiftSettings>;
  updatedAt: number;
}

// ==================== QUERY RESULT TYPES ====================

export interface QueryResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface SingleResult<T> {
  data: T | null;
  error?: string;
}
