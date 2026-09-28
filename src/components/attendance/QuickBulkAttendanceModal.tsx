import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Users,
  Sun,
  Moon,
  Clock,
  Calendar,
  Search,
  CheckCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type {
  EmployeeDocument,
  AttendanceDocument,
  ShiftType,
  AttendanceAuditLog,
  GeneralSettingsDocument,
} from '../../types';
import { dbService } from '../../services/db';
import { useToast } from '../ui/Toast';
import { calculateWorkingHours } from '../../services/attendance';
import { toWesternDigits } from '../../utils/arabicDigits';

interface QuickBulkAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  employees: EmployeeDocument[];
  attendance: AttendanceDocument[];
  preSelectedEmployeeIds?: string[];
  settings: GeneralSettingsDocument | null;
  onSuccess: () => Promise<void> | void;
}

interface EmployeeRowState {
  employeeId: string;
  employee: EmployeeDocument;
  selected: boolean;
  shiftType: ShiftType;
  checkInTime: string;  // "HH:mm" (e.g. 10:00 or 12:00)
  checkOutTime: string; // "HH:mm" (e.g. 18:00 or 20:00)
  isManualAdjusted: boolean;
  notes: string;
}

export const QuickBulkAttendanceModal: React.FC<QuickBulkAttendanceModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  employees,
  attendance,
  preSelectedEmployeeIds = [],
  settings,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Bulk configuration controls
  const [bulkShiftStrategy, setBulkShiftStrategy] = useState<'individual' | 'morning' | 'evening'>('individual');

  // Employee rows state
  const [rows, setRows] = useState<EmployeeRowState[]>([]);

  // Shift defaults from settings
  // Evening: 12:00 to 20:00 (12:00 م إلى 8:00 م)
  // Morning: 09:00 / 10:00 to 18:00
  const morningStart = settings?.shifts?.morning?.workStartTime || '09:00';
  const morningEnd = settings?.shifts?.morning?.workEndTime || '18:00';
  const eveningStart = settings?.shifts?.evening?.workStartTime || '12:00';
  const eveningEnd = settings?.shifts?.evening?.workEndTime || '20:00';

  const getShiftTimes = (shift: ShiftType, _emp?: EmployeeDocument) => {
    if (shift === 'evening') {
      return {
        start: eveningStart, // Configured evening start time
        end: eveningEnd, // Configured evening end time
      };
    }
    // Morning shift: use employee's custom morning hours if configured, otherwise settings/defaults
    const empMorningStart = _emp?.shiftType === 'morning' ? _emp.shiftStartTime : undefined;
    const empMorningEnd = _emp?.shiftType === 'morning' ? _emp.shiftEndTime : undefined;
    return {
      start: empMorningStart || morningStart,
      end: empMorningEnd || morningEnd,
    };
  };

  // Helper to calculate duration in hours between two time strings
  const getRowWorkingHours = (inTime: string, outTime: string) => {
    const [inH, inM] = (inTime || '00:00').split(':').map(Number);
    const [outH, outM] = (outTime || '00:00').split(':').map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;
    const diffMinutes = Math.max(0, outMinutes - inMinutes);
    return Math.round((diffMinutes / 60) * 10) / 10;
  };

  // Initialize rows whenever modal opens or inputs change
  useEffect(() => {
    if (!isOpen) return;

    // Map which employees already have attendance on this selectedDate
    const attendedEmpIds = new Set(attendance.map((a) => a.employeeId));

    const initialRows: EmployeeRowState[] = employees.map((emp) => {
      const alreadyAttended = attendedEmpIds.has(emp.id);
      const isPreSelected = preSelectedEmployeeIds.length > 0
        ? preSelectedEmployeeIds.includes(emp.id)
        : !alreadyAttended; // Default to unrecorded employees

      const empShift: ShiftType = emp.shiftType || 'morning';
      const shiftTimes = getShiftTimes(empShift, emp);

      return {
        employeeId: emp.id,
        employee: emp,
        selected: isPreSelected,
        shiftType: empShift,
        checkInTime: shiftTimes.start,
        checkOutTime: shiftTimes.end,
        isManualAdjusted: false,
        notes: '',
      };
    });

    setRows(initialRows);
    setBulkShiftStrategy('individual');
    setSearchTerm('');
  }, [isOpen, selectedDate, employees, attendance, preSelectedEmployeeIds, settings]);

  // Apply bulk shift strategy - updates all employees to selected shift and its start/end times
  const handleBulkShiftChange = (strategy: 'individual' | 'morning' | 'evening') => {
    setBulkShiftStrategy(strategy);
    setRows((prev) =>
      prev.map((row) => {
        let newShift: ShiftType = row.shiftType;
        if (strategy === 'morning') newShift = 'morning';
        else if (strategy === 'evening') newShift = 'evening';
        else newShift = row.employee.shiftType || 'morning';

        const times = getShiftTimes(newShift, row.employee);

        return {
          ...row,
          shiftType: newShift,
          checkInTime: times.start,
          checkOutTime: times.end,
          isManualAdjusted: false,
        };
      })
    );
  };

  // Toggle select all
  const handleToggleSelectAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  // Toggle single employee select
  const handleToggleRowSelect = (employeeId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.employeeId === employeeId ? { ...r, selected: !r.selected } : r))
    );
  };

  // Change single employee shift - automatically updates check-in and check-out to shift times
  const handleRowShiftChange = (employeeId: string, shift: ShiftType) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeId !== employeeId) return r;
        const times = getShiftTimes(shift, r.employee);
        return {
          ...r,
          shiftType: shift,
          checkInTime: times.start, // 12:00 for evening or 10:00/09:00 for morning
          checkOutTime: times.end,  // 20:00 for evening or 18:00 for morning
          isManualAdjusted: false,
          notes: '',
        };
      })
    );
  };

  // Manually edit check-in time for an employee
  const handleRowCheckInChange = (employeeId: string, time: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeId !== employeeId) return r;
        const times = getShiftTimes(r.shiftType, r.employee);
        return {
          ...r,
          checkInTime: time,
          isManualAdjusted: time !== times.start || r.checkOutTime !== times.end,
        };
      })
    );
  };

  // Manually edit check-out time for an employee
  const handleRowCheckOutChange = (employeeId: string, time: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeId !== employeeId) return r;
        const times = getShiftTimes(r.shiftType, r.employee);
        return {
          ...r,
          checkOutTime: time,
          isManualAdjusted: r.checkInTime !== times.start || time !== times.end,
        };
      })
    );
  };

  // Change note for an employee
  const handleRowNoteChange = (employeeId: string, note: string) => {
    setRows((prev) =>
      prev.map((r) => (r.employeeId === employeeId ? { ...r, notes: note } : r))
    );
  };

  // Filtered rows for search
  const filteredRows = useMemo(() => {
    return rows.filter(
      (r) =>
        r.employee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employee.employeeNo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rows, searchTerm]);

  const selectedCount = rows.filter((r) => r.selected).length;


  // Helper to create ISO timestamp from a date (YYYY-MM-DD) and a time string (HH:mm)
  const createIsoTimestamp = (dateStr: string, timeStr: string): string => {
    const cleanTime = toWesternDigits(timeStr);
    // Build a Date object using the provided date and cleaned time
    const isoDate = new Date(`${dateStr}T${cleanTime}:00`);
    return isoDate.toISOString();
  };

  // Submit Bulk Full Attendance (Check-in + Check-out = Full Shift)
  const handleSubmit = async () => {
    const targetRows = rows.filter((r) => r.selected);
    if (targetRows.length === 0) {
      showToast('error', 'يرجى تحديد موظف واحد على الأقل لتسجيل حضوره');
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const newAttendanceRecords: AttendanceDocument[] = [];
      const employeeUpdatePromises: Promise<void>[] = [];

      for (const row of targetRows) {
        const shiftTimes = getShiftTimes(row.shiftType, row.employee);
        const checkInIso = createIsoTimestamp(selectedDate, row.checkInTime);
        const checkOutIso = createIsoTimestamp(selectedDate, row.checkOutTime);
        const workingHours = calculateWorkingHours(checkInIso, checkOutIso, []);
        const id = `${row.employeeId}_${selectedDate}`;

        const auditTrail: AttendanceAuditLog[] = [
          {
            id: `audit_${Date.now()}_${row.employeeId}`,
            action: 'check_out',
            changedBy: 'system',
            changedAt: nowIso,
            after: {
              checkIn: checkInIso,
              checkOut: checkOutIso,
              workingHours,
              status: 'checked_out',
              shiftType: row.shiftType,
            },
            reason: row.notes || (row.isManualAdjusted ? 'تحضير دوام كامل مع تعديل يدوي للوقت' : 'تحضير جماعي لدوام كامل'),
          },
        ];

        const record: AttendanceDocument = {
          id,
          employeeId: row.employeeId,
          employeeName: row.employee.fullName,
          date: selectedDate,
          checkIn: checkInIso,
          checkOut: checkOutIso,
          workingHours,
          status: 'checked_out', // Full shift completed
          shiftType: row.shiftType,
          scheduledStartTime: shiftTimes.start,
          scheduledEndTime: shiftTimes.end,
          temporaryExits: [],
          isManualOverride: row.isManualAdjusted,
          overrideReason: row.notes || undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
          auditTrail,
        };

        newAttendanceRecords.push(record);

        // If shiftType changed from employee's default, persist to employee profile as well
        if (
          row.shiftType !== row.employee.shiftType ||
          (row.shiftType === 'evening' && row.employee.shiftStartTime !== '12:00')
        ) {
          employeeUpdatePromises.push(
            dbService.updateEmployee(row.employeeId, {
              shiftType: row.shiftType,
              shiftStartTime: shiftTimes.start,
              shiftEndTime: shiftTimes.end,
            })
          );
        }
      }

      // Batch save attendance records
      await dbService.recordAttendanceBatch(newAttendanceRecords);

      // Await employee profile updates if any
      if (employeeUpdatePromises.length > 0) {
        await Promise.all(employeeUpdatePromises);
      }

      showToast(
        'success',
        'تم تسجيل الدوام الكامل بنجاح',
        `تم تحضير ${targetRows.length} موظف (حضور وانصراف كامل) لتاريخ ${selectedDate}`
      );

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit bulk attendance:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `فشل في تسجيل الحضور الجماعي: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Format date display in Arabic
  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-brand-100 flex flex-col max-h-[92vh] overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-100 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-300 shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">التحضير السريع والجماعي (دوام كامل)</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-gold-400/20 border border-gold-400/30 text-gold-300 text-[11px] font-bold">
                  {selectedCount} محدد
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-brand-200 mt-0.5">
                <Calendar size={13} className="text-gold-400" />
                <span>تاريخ التحضير: </span>
                <span className="font-bold text-white underline decoration-gold-400">{selectedDate}</span>
                <span className="text-brand-300">({formattedDate})</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Strategy Bar (Bulk Shift controls & Explanation) */}
        <div className="p-4 bg-brand-50/40 border-b border-brand-100 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Shift Strategy Selection */}
            <div className="flex-1 bg-white p-3 rounded-2xl border border-brand-100 shadow-2xs space-y-1.5">
              <label className="text-[11px] font-bold text-brand-950 flex items-center gap-1.5">
                <Clock size={13} className="text-gold-600" />
                <span>تحديد وردية وساعات الدوام للجميع بنقرة واحدة:</span>
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleBulkShiftChange('individual')}
                  className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${bulkShiftStrategy === 'individual'
                    ? 'bg-brand-900 text-gold-300 border-brand-900 shadow-xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  <span className="block text-[11px]">حسب جدول كل موظف</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkShiftChange('morning')}
                  className={`py-2 px-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${bulkShiftStrategy === 'morning'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    <Sun size={13} />
                    <span className="text-[11px] font-black">دوام صباحي للكل</span>
                  </div>
                  <span className="text-[10px] opacity-90 font-mono" dir="ltr">
                    {morningStart} - {morningEnd}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkShiftChange('evening')}
                  className={`py-2 px-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${bulkShiftStrategy === 'evening'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    <Moon size={13} />
                    <span className="text-[11px] font-black">دوام مسائي للكل</span>
                  </div>
                  <span className="text-[10px] opacity-90 font-mono" dir="ltr">
                    {eveningStart} - {eveningEnd} (12 - 8 م)
                  </span>
                </button>
              </div>
            </div>

            {/* Note badge */}
            <div className="md:w-72 bg-emerald-50/70 border border-emerald-200 p-3 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900">
              <Sparkles size={18} className="text-emerald-600 shrink-0" />
              <div className="leading-snug">
                <span className="font-bold block">تسجيل دوام كامل تلقائي:</span>
                <span className="text-[11px] text-emerald-800">
                  يتم توثيق الحضور والانصراف معاً واحتساب الساعات كاملة دون الحاجة لإنصراف يدوي لكل موظف.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Filter & Select All row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedCount === rows.length && rows.length > 0}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-900 focus:ring-brand-500 cursor-pointer accent-brand-900"
                />
                <span>تحديد الكل ({rows.length})</span>
              </label>

              <button
                type="button"
                onClick={() =>
                  setRows((prev) => {
                    const attendedIds = new Set(attendance.map((a) => a.employeeId));
                    return prev.map((r) => ({ ...r, selected: !attendedIds.has(r.employeeId) }));
                  })
                }
                className="text-[11px] font-bold text-brand-700 hover:text-brand-900 underline px-2 cursor-pointer"
              >
                تحديد غير المسجلين فقط
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="بحث عن موظف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-1.5 pr-8 pl-3 bg-white border border-gray-200 rounded-xl text-xs text-right focus:ring-2 focus:ring-brand-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Interactive Employee Rows Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredRows.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100">
              <AlertCircle size={32} className="text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-600">لا يوجد موظفون مطابقون لبحثك</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((row) => {
                const hours = getRowWorkingHours(row.checkInTime, row.checkOutTime);
                const hasExistingRecord = attendance.some((a) => a.employeeId === row.employeeId);

                return (
                  <div
                    key={row.employeeId}
                    className={`rounded-2xl border p-3 transition-all ${row.selected
                      ? 'bg-brand-50/30 border-brand-200 shadow-2xs'
                      : 'bg-gray-50/50 border-gray-200 opacity-60'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Employee Identification */}
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => handleToggleRowSelect(row.employeeId)}
                          className="w-4 h-4 rounded text-brand-900 focus:ring-brand-500 cursor-pointer accent-brand-900 shrink-0"
                        />
                        <div className="w-8 h-8 rounded-xl bg-brand-900 text-gold-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {row.employee.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 truncate">
                              {row.employee.fullName}
                            </span>
                            {hasExistingRecord && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-200 shrink-0">
                                مسجل مسبقاً (سيُحدّث)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 block">
                            {row.employee.employeeNo} • {row.employee.jobTitle}
                          </span>
                        </div>
                      </div>

                      {/* Controls: Shift switch & Full Shift Check-In / Check-Out */}
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {/* Inline Shift Switcher */}
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleRowShiftChange(row.employeeId, 'morning')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${row.shiftType === 'morning'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-gray-600 hover:text-gray-900'
                              }`}
                          >
                            <Sun size={11} />
                            <span>صباحي</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowShiftChange(row.employeeId, 'evening')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${row.shiftType === 'evening'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-gray-600 hover:text-gray-900'
                              }`}
                          >
                            <Moon size={11} />
                            <span>مسائي</span>
                          </button>
                        </div>

                        {/* Shift Times indicator label */}
                        <span className="text-[10px] text-brand-700 font-bold hidden md:inline">
                          {row.shiftType === 'evening' ? '(12 إلى 8 م)' : '(صباحي)'}
                        </span>

                        {/* Check-in Time input */}
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-2xs">
                          <span className="text-[10px] font-bold text-gray-500">دخول:</span>
                          <input
                            type="time"
                            value={row.checkInTime}
                            onChange={(e) => handleRowCheckInChange(row.employeeId, e.target.value)}
                            className="text-xs font-bold text-gray-900 focus:outline-hidden text-center w-16"
                          />
                        </div>

                        {/* Check-out Time input */}
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-2xs">
                          <span className="text-[10px] font-bold text-gray-500">انصراف:</span>
                          <input
                            type="time"
                            value={row.checkOutTime}
                            onChange={(e) => handleRowCheckOutChange(row.employeeId, e.target.value)}
                            className="text-xs font-bold text-gray-900 focus:outline-hidden text-center w-16"
                          />
                        </div>

                        {/* Working hours badge */}
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold shrink-0">
                          {hours} س • دوام كامل
                        </span>
                      </div>
                    </div>

                    {/* Note / Manual Reason Input (if adjusted) */}
                    {row.isManualAdjusted && (
                      <div className="mt-2 pt-2 border-t border-brand-100/60 flex items-center gap-2">
                        <span className="text-[10px] text-amber-700 font-bold shrink-0">سبب التعديل:</span>
                        <input
                          type="text"
                          placeholder="ملاحظة أو سبب تعديل الساعات (اختياري)..."
                          value={row.notes}
                          onChange={(e) => handleRowNoteChange(row.employeeId, e.target.value)}
                          className="w-full py-1 px-2.5 bg-white border border-amber-200 rounded-lg text-[11px] text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-brand-100 bg-gray-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Users size={16} className="text-brand-900" />
            <span>
              جاهز لتسجيل دوام كامل لـ{' '}
              <strong className="text-brand-950 font-black">{selectedCount}</strong> موظف في تاريخ{' '}
              <strong className="text-brand-950 font-black">{selectedDate}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              disabled={loading || selectedCount === 0}
              onClick={handleSubmit}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جارٍ تسجيل الدوام الكامل...</span>
                </>
              ) : (
                <>
                  <CheckCheck size={16} />
                  <span>تأكيد تسجيل دوام كامل ({selectedCount}) موظف</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
