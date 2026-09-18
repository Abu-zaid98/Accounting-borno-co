import type {
  AttendanceDocument,
  AttendanceShiftSettings,
  AttendanceStatus,
  EmployeeDocument,
  GeneralSettingsDocument,
  ShiftType,
  TemporaryExitRecord,
} from '../types';

export const DEFAULT_SHIFT_MORNING: AttendanceShiftSettings = {
  shiftType: 'morning',
  workStartTime: '09:00',
  workEndTime: '18:00',
  gracePeriodMinutes: 0,
  lateRule: { afterMinutes: 0 },
  absenceRule: { afterMinutes: 480 },
};

export const DEFAULT_SHIFT_EVENING: AttendanceShiftSettings = {
  shiftType: 'evening',
  workStartTime: '12:00',
  workEndTime: '21:00',
  gracePeriodMinutes: 0,
  lateRule: { afterMinutes: 0 },
  absenceRule: { afterMinutes: 480 },
};

export const DEFAULT_ATTENDANCE_SETTINGS: Pick<
  GeneralSettingsDocument,
  'workStartTime' | 'workEndTime' | 'shiftType' | 'gracePeriodMinutes' | 'lateRule' | 'absenceRule' | 'shifts'
> = {
  workStartTime: DEFAULT_SHIFT_MORNING.workStartTime,
  workEndTime: DEFAULT_SHIFT_MORNING.workEndTime,
  shiftType: DEFAULT_SHIFT_MORNING.shiftType,
  gracePeriodMinutes: 0,
  lateRule: { afterMinutes: 0 },
  absenceRule: { afterMinutes: 480 },
  shifts: {
    morning: DEFAULT_SHIFT_MORNING,
    evening: DEFAULT_SHIFT_EVENING,
  },
};

/**
 * استخراج إعدادات ومواعيد الوردية من جدول الموظف المعتمد
 * يتم تحديد Morning/Evening من Schedule الموظف حصراً وليس من وقت وصوله الفعلي
 */
export const getShiftSettings = (
  settings: GeneralSettingsDocument,
  employee?: EmployeeDocument
): AttendanceShiftSettings => {
  const shiftType: ShiftType = employee?.shiftType ?? settings.shiftType ?? 'morning';
  const defaultBase = shiftType === 'evening' ? DEFAULT_SHIFT_EVENING : DEFAULT_SHIFT_MORNING;
  const configuredShift = settings.shifts?.[shiftType] ?? defaultBase;

  return {
    ...configuredShift,
    shiftType,
    workStartTime: employee?.shiftStartTime || configuredShift.workStartTime,
    workEndTime: employee?.shiftEndTime || configuredShift.workEndTime,
    gracePeriodMinutes: 0,
    lateRule: { afterMinutes: 0 },
    absenceRule: { afterMinutes: 480 },
  };
};

/**
 * لا يوجد حساب تأخير أو إضافي أو خصم
 * النظام يسجل الحضور كـ حاضر بمجرد الدخول
 */
export const calculateAttendanceStatus = (
  log: Pick<AttendanceDocument, 'status'>,
  _settings?: AttendanceShiftSettings
): AttendanceStatus => {
  if (log.status === 'absent') return 'absent';
  if (log.status === 'temporary_exit') return 'temporary_exit';
  if (log.status === 'checked_out') return 'checked_out';
  return 'present';
};

/**
 * حساب ساعات العمل الفعلية المسجلة فقط كبيانات (مع استبعاد فترات الخروج المؤقت)
 */
export const calculateWorkingHours = (
  checkIn?: string,
  checkOut?: string,
  temporaryExits?: TemporaryExitRecord[]
): number => {
  if (!checkIn) return 0;
  const endMs = checkOut ? new Date(checkOut).getTime() : Date.now();
  const startMs = new Date(checkIn).getTime();
  let durationMs = Math.max(0, endMs - startMs);

  // استبعاد فترات الخروج المؤقت
  if (temporaryExits && temporaryExits.length > 0) {
    for (const exit of temporaryExits) {
      if (exit.exitTime) {
        const exitMs = new Date(exit.exitTime).getTime();
        const returnMs = exit.returnTime ? new Date(exit.returnTime).getTime() : endMs;
        const outDuration = Math.max(0, returnMs - exitMs);
        durationMs = Math.max(0, durationMs - outDuration);
      }
    }
  }

  return Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;
};

