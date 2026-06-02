import type {
  AttendanceDocument,
  AttendanceShiftSettings,
  AttendanceStatus,
  EmployeeDocument,
  GeneralSettingsDocument,
  ShiftType,
} from '../types';

const DEFAULT_SHIFT: AttendanceShiftSettings = {
  shiftType: 'morning',
  workStartTime: '08:00',
  workEndTime: '16:00',
  gracePeriodMinutes: 10,
  lateRule: { afterMinutes: 10 },
  absenceRule: { afterMinutes: 240 },
};

export const DEFAULT_ATTENDANCE_SETTINGS: Pick<
  GeneralSettingsDocument,
  'workStartTime' | 'workEndTime' | 'shiftType' | 'gracePeriodMinutes' | 'lateRule' | 'absenceRule' | 'shifts'
> = {
  workStartTime: DEFAULT_SHIFT.workStartTime,
  workEndTime: DEFAULT_SHIFT.workEndTime,
  shiftType: DEFAULT_SHIFT.shiftType,
  gracePeriodMinutes: DEFAULT_SHIFT.gracePeriodMinutes,
  lateRule: DEFAULT_SHIFT.lateRule,
  absenceRule: DEFAULT_SHIFT.absenceRule,
  shifts: {
    morning: DEFAULT_SHIFT,
    evening: {
      shiftType: 'evening',
      workStartTime: '16:00',
      workEndTime: '00:00',
      gracePeriodMinutes: 10,
      lateRule: { afterMinutes: 10 },
      absenceRule: { afterMinutes: 240 },
    },
  },
};

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
};

const getMinutesFromDate = (value: string): number => {
  const date = new Date(value);
  return (date.getHours() * 60) + date.getMinutes();
};

export const getShiftSettings = (
  settings: GeneralSettingsDocument,
  employee?: EmployeeDocument
): AttendanceShiftSettings => {
  const shiftType: ShiftType = employee?.shiftType ?? settings.shiftType ?? 'morning';
  const configuredShift = settings.shifts?.[shiftType] ?? DEFAULT_ATTENDANCE_SETTINGS.shifts[shiftType];

  return {
    ...configuredShift,
    shiftType,
    workStartTime: employee?.shiftStartTime ?? configuredShift.workStartTime ?? settings.workStartTime,
    workEndTime: employee?.shiftEndTime ?? configuredShift.workEndTime ?? settings.workEndTime,
    gracePeriodMinutes: employee?.gracePeriodMinutes ?? configuredShift.gracePeriodMinutes ?? settings.gracePeriodMinutes,
    lateRule: employee?.lateRule ?? configuredShift.lateRule ?? settings.lateRule,
    absenceRule: employee?.absenceRule ?? configuredShift.absenceRule ?? settings.absenceRule,
  };
};

export const calculateAttendanceStatus = (
  log: Pick<AttendanceDocument, 'checkIn' | 'status'>,
  settings: AttendanceShiftSettings
): AttendanceStatus => {
  if (log.status === 'absent') return 'absent';

  const checkInMinutes = getMinutesFromDate(log.checkIn);
  const startMinutes = timeToMinutes(settings.workStartTime);
  const lateAfter = settings.lateRule?.afterMinutes ?? settings.gracePeriodMinutes ?? 0;
  const absentAfter = settings.absenceRule?.afterMinutes ?? 240;
  const minutesAfterStart = checkInMinutes - startMinutes;

  if (minutesAfterStart < -120) return 'outside_shift';
  if (minutesAfterStart > absentAfter) return 'absent';
  if (minutesAfterStart > lateAfter) return 'late';
  return 'present';
};

export const calculateWorkingHours = (checkIn?: string, checkOut?: string): number => {
  if (!checkIn || !checkOut) return 0;
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round((Math.max(0, diffMs) / (1000 * 60 * 60)) * 10) / 10;
};
