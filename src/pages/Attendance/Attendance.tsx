import React, { useEffect, useState } from 'react';
import { dbService } from '../../services/db';
import {
  calculateAttendanceStatus,
  calculateWorkingHours,
  getShiftSettings,
} from '../../services/attendance';
import type { AttendanceAuditLog, AttendanceDocument, AttendanceShiftSettings, AttendanceStatus, EmployeeDocument, GeneralSettingsDocument, ShiftType } from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import {
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  CalendarClock,
  CheckCircle,
  Edit,
  Save,
  Search,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';

const statusLabel: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  outside_shift: 'خارج الدوام',
};

const statusClass: Record<AttendanceStatus, string> = {
  present: 'bg-green-50 text-green-700 border-green-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  outside_shift: 'bg-gray-50 text-gray-700 border-gray-200',
};

const toDateTimeLocal = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string) => value ? new Date(value).toISOString() : undefined;

export const Attendance: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDocument[]>([]);
  const [settings, setSettings] = useState<GeneralSettingsDocument | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<AttendanceDocument | null>(null);
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('present');
  const [overrideReason, setOverrideReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AttendanceDocument | null>(null);
  const [entryModal, setEntryModal] = useState<{
    mode: 'check_in' | 'check_out';
    employee?: EmployeeDocument;
    record?: AttendanceDocument;
  } | null>(null);
  const [entryShiftType, setEntryShiftType] = useState<ShiftType>('morning');
  const [entryDateTime, setEntryDateTime] = useState('');
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreateAttendance = hasPermission('attendance.create');
  const canEditAttendance = hasPermission('attendance.edit');
  const canDeleteAttendance = hasPermission('attendance.delete');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emps, atts, appSettings] = await Promise.all([
        dbService.getEmployees(),
        dbService.getAttendance(selectedDate),
        dbService.getSettings(),
      ]);
      setEmployees(emps.filter(e => e.status === 'active'));
      setAttendance(atts);
      setSettings(appSettings);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const createAudit = (
    action: AttendanceAuditLog['action'],
    before: Partial<AttendanceDocument>,
    after: Partial<AttendanceDocument>,
    reason?: string
  ): AttendanceAuditLog => ({
    id: `audit_${Date.now()}`,
    action,
    changedBy: 'system',
    changedAt: new Date().toISOString(),
    before,
    after,
    ...(reason !== undefined && { reason }),
  });

  const getShiftByType = (shiftType: ShiftType, employee?: EmployeeDocument): AttendanceShiftSettings | null => {
    if (!settings) return null;
    const base = settings.shifts?.[shiftType] ?? getShiftSettings(settings, employee);
    return {
      ...base,
      shiftType,
      workStartTime: base.workStartTime,
      workEndTime: base.workEndTime,
      gracePeriodMinutes: employee?.gracePeriodMinutes ?? base.gracePeriodMinutes,
      lateRule: employee?.lateRule ?? base.lateRule,
      absenceRule: employee?.absenceRule ?? base.absenceRule,
    };
  };

  const openCheckInModal = (emp: EmployeeDocument) => {
    if (!canCreateAttendance) {
      showToast('error', 'لا تملك صلاحية تسجيل الحضور');
      return;
    }
    const shift = settings ? getShiftSettings(settings, emp) : null;
    setEntryModal({ mode: 'check_in', employee: emp });
    setEntryShiftType(shift?.shiftType ?? 'morning');
    setEntryDateTime(toDateTimeLocal(new Date(`${selectedDate}T${shift?.workStartTime ?? '08:00'}:00`).toISOString()));
  };

  const openCheckOutModal = (record: AttendanceDocument) => {
    if (!canCreateAttendance) {
      showToast('error', 'لا تملك صلاحية تسجيل الانصراف');
      return;
    }
    setEntryModal({ mode: 'check_out', record });
    setEntryShiftType(record.shiftType ?? 'morning');
    setEntryDateTime(toDateTimeLocal(new Date().toISOString()));
  };

  const handleSaveEntry = async () => {
    if (!settings || !entryModal || !entryDateTime) {
      showToast('error', 'يرجى تحديد الوقت قبل الحفظ');
      return;
    }
    const selectedIso = fromDateTimeLocal(entryDateTime) ?? new Date().toISOString();

    try {
      if (entryModal.mode === 'check_in' && entryModal.employee) {
      const emp = entryModal.employee;
      const shift = getShiftByType(entryShiftType, emp);
      if (!shift) return;

    const baseRecord: AttendanceDocument = {
      id: `${emp.id}_${selectedDate}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      date: selectedDate,
        checkIn: selectedIso,
      status: 'present',
      workingHours: 0,
      shiftType: shift.shiftType,
      scheduledStartTime: shift.workStartTime,
      scheduledEndTime: shift.workEndTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

      const status = calculateAttendanceStatus(baseRecord, shift);
      const record = {
        ...baseRecord,
        status,
        auditTrail: [createAudit('check_in', {}, { status, checkIn: baseRecord.checkIn, shiftType: shift.shiftType })],
      };

      await dbService.recordAttendance(record);
      showToast('success', 'تم تسجيل الحضور', `${emp.fullName} - ${statusLabel[status]}`);
    }

      if (entryModal.mode === 'check_out' && entryModal.record) {
      const currentRecord = entryModal.record;
      const updatedRec: AttendanceDocument = {
        ...currentRecord,
        checkOut: selectedIso,
        workingHours: calculateWorkingHours(currentRecord.checkIn, selectedIso),
        updatedAt: new Date().toISOString(),
        auditTrail: [
          ...(currentRecord.auditTrail ?? []),
          createAudit('check_out', { checkOut: currentRecord.checkOut }, { checkOut: selectedIso }),
        ],
      };

      await dbService.recordAttendance(updatedRec);
      showToast('success', 'تم تسجيل الانصراف', `عدد الساعات: ${updatedRec.workingHours}`);
    }

      setEntryModal(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving attendance entry:', error);
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', `فشل حفظ السجل: ${msg}`);
    }
  };

  const handleMarkAbsent = async (emp: EmployeeDocument) => {
    if (!canCreateAttendance) {
      showToast('error', 'لا تملك صلاحية تسجيل الغياب');
      return;
    }
    if (!settings) return;
    const shift = getShiftSettings(settings, emp);
    const checkIn = new Date(`${selectedDate}T00:00:00`).toISOString();
    const record: AttendanceDocument = {
      id: `${emp.id}_${selectedDate}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      date: selectedDate,
      checkIn,
      checkOut: checkIn,
      status: 'absent',
      workingHours: 0,
      shiftType: shift.shiftType,
      scheduledStartTime: shift.workStartTime,
      scheduledEndTime: shift.workEndTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditTrail: [createAudit('mark_absent', {}, { status: 'absent' })],
    };

    try {
      await dbService.recordAttendance(record);
      showToast('success', 'تم تسجيل الغياب', emp.fullName);
      await fetchData();
    } catch (error) {
      console.error('Error marking absent:', error);
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', `فشل تسجيل الغياب: ${msg}`);
    }
  };

  const openManualEdit = (record: AttendanceDocument) => {
    if (!canEditAttendance) {
      showToast('error', 'لا تملك صلاحية تعديل سجل الحضور');
      return;
    }
    setEditingRecord(record);
    setManualCheckIn(toDateTimeLocal(record.checkIn));
    setManualCheckOut(toDateTimeLocal(record.checkOut));
    setManualStatus(record.status);
    setOverrideReason(record.overrideReason ?? '');
  };

  const handleManualSave = async () => {
    if (!editingRecord) return;
    const checkIn = fromDateTimeLocal(manualCheckIn) ?? editingRecord.checkIn;
    const checkOut = fromDateTimeLocal(manualCheckOut);
    const updated: AttendanceDocument = {
      ...editingRecord,
      checkIn,
      checkOut,
      status: manualStatus,
      workingHours: calculateWorkingHours(checkIn, checkOut),
      isManualOverride: true,
      overrideReason,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...(editingRecord.auditTrail ?? []),
        createAudit(
          'manual_override',
          {
            checkIn: editingRecord.checkIn,
            checkOut: editingRecord.checkOut,
            status: editingRecord.status,
            workingHours: editingRecord.workingHours,
          },
          { checkIn, checkOut, status: manualStatus },
          overrideReason
        ),
      ],
    };

    try {
      await dbService.recordAttendance(updated);
      showToast('success', 'تم حفظ تعديل الحضور');
      setEditingRecord(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving manual attendance edit:', error);
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', `فشل حفظ تعديل الحضور: ${msg}`);
    }
  };

  const confirmDeleteAttendance = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.deleteAttendance(deleteTarget.id);
      showToast('success', 'تم حذف سجل الحضور');
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', `فشل حذف سجل الحضور: ${msg}`);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">حضور وانصراف الموظفين</h1>
          <p className="text-xs text-gray-400 mt-1">تسجيل الدوام حسب قواعد الشفتات المحددة من لوحة الإعدادات.</p>
        </div>
        <div className="relative">
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
            <Calendar size={16} />
          </span>
          <input
            type="date"
            className="py-2.5 pr-10 pl-4 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {settings && (
        <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs text-xs text-gray-600 flex flex-wrap gap-3">
          <span className="font-bold text-brand-900">القواعد الحالية:</span>
          <span>{settings.shiftType === 'morning' ? 'صباحي' : 'مسائي'}</span>
          <span>{settings.workStartTime} - {settings.workEndTime}</span>
          <span>سماح {settings.gracePeriodMinutes} دقيقة</span>
          <span>تأخير بعد {settings.lateRule.afterMinutes} دقيقة</span>
          <span>غياب بعد {settings.absenceRule.afterMinutes} دقيقة</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold text-gray-400">حاضرون</span>
          <p className="text-xl font-black text-green-600">{presentCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold text-gray-400">متأخرون</span>
          <p className="text-xl font-black text-amber-600">{lateCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold text-gray-400">غائبون</span>
          <p className="text-xl font-black text-red-600">{absentCount}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs">
        <div className="relative w-full">
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="البحث باسم الموظف..."
            className="w-full py-2.5 pr-10 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-right"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-brand-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-50 animate-pulse rounded-2xl" />)}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <CalendarClock size={48} className="mx-auto text-gray-300" />
            <h3 className="font-bold text-gray-700 text-sm">لا يوجد موظفون نشطون</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-brand-50/50 border-b border-brand-100 text-xs font-bold text-gray-500">
                  <th className="p-4.5">الموظف</th>
                  <th className="p-4.5">الشفت</th>
                  <th className="p-4.5">الحالة</th>
                  <th className="p-4.5">الدخول</th>
                  <th className="p-4.5">الخروج</th>
                  <th className="p-4.5">الساعات</th>
                  <th className="p-4.5 text-center">التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50 text-xs">
                {filteredEmployees.map(emp => {
                  const record = attendance.find(a => a.employeeId === emp.id);
                  const shift = settings ? getShiftSettings(settings, emp) : null;

                  return (
                    <tr key={emp.id} className="hover:bg-brand-50/20 transition-all">
                      <td className="p-4.5 font-bold text-gray-800">
                        <span className="block">{emp.fullName}</span>
                        <span className="text-[10px] text-gray-400">{emp.employeeNo}</span>
                      </td>
                      <td className="p-4.5 text-gray-600 font-medium">
                        {shift ? `${shift.shiftType === 'morning' ? 'صباحي' : 'مسائي'} (${shift.workStartTime}-${shift.workEndTime})` : '-'}
                      </td>
                      <td className="p-4.5">
                        {record ? (
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${statusClass[record.status]}`}>
                            {statusLabel[record.status]}
                            {record.isManualOverride ? ' / معدل' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-semibold italic">لم يتم التسجيل بعد</span>
                        )}
                      </td>
                      <td className="p-4.5 font-medium text-gray-700">
                        {record && record.status !== 'absent' ? new Date(record.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="p-4.5 font-medium text-gray-700">
                        {record?.checkOut ? new Date(record.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="p-4.5 font-bold text-brand-900">{record?.workingHours ? `${record.workingHours} ساعة` : <span className="text-gray-300">-</span>}</td>
                      <td className="p-4.5">
                        <div className="flex items-center justify-center gap-2">
                          {!record ? (
                            <>
                              {canCreateAttendance ? (
                                <>
                                  <button onClick={() => openCheckInModal(emp)} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer">
                                    <UserCheck size={12} />
                                    <span>حضور</span>
                                  </button>
                                  <button onClick={() => handleMarkAbsent(emp)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer">
                                    <UserX size={12} />
                                    <span>غياب</span>
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">غير مصرح لك بالتحضير</span>
                              )}
                            </>
                          ) : (
                            <>
                              {record.status !== 'absent' && !record.checkOut && canCreateAttendance && (
                                <button onClick={() => openCheckOutModal(record)} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer">
                                  <ArrowRightLeft size={12} />
                                  <span>انصراف</span>
                                </button>
                              )}
                              {record.checkOut && <CheckCircle size={14} className="text-green-500" />}
                              {canEditAttendance && (
                                <button onClick={() => openManualEdit(record)} className="p-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg border border-brand-100 cursor-pointer" title="تعديل يدوي">
                                  <Edit size={13} />
                                </button>
                              )}
                              {canDeleteAttendance && (
                                <button onClick={() => setDeleteTarget(record)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-100 cursor-pointer" title="حذف">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRecord && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-brand-100 overflow-hidden max-h-[90svh] flex flex-col">
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">تعديل سجل الحضور يدوياً</h2>
              <button onClick={() => setEditingRecord(null)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 bg-amber-50 border-r-4 border-amber-500 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                <AlertCircle size={16} />
                <span>سيتم حفظ كل تعديل في سجل تدقيق داخل سجل الحضور.</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">وقت الدخول</label>
                  <input type="datetime-local" className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs" value={manualCheckIn} onChange={(e) => setManualCheckIn(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">وقت الانصراف</label>
                  <input type="datetime-local" className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs" value={manualCheckOut} onChange={(e) => setManualCheckOut(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-600">الحالة</label>
                  <select className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right" value={manualStatus} onChange={(e) => setManualStatus(e.target.value as AttendanceStatus)}>
                    <option value="present">حاضر</option>
                    <option value="late">متأخر</option>
                    <option value="absent">غائب</option>
                    <option value="outside_shift">خارج الدوام</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-600">سبب التعديل</label>
                  <textarea rows={3} className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-brand-100 pt-4">
                <button onClick={() => setEditingRecord(null)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer">إلغاء</button>
                <button onClick={handleManualSave} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md">
                  <Save size={14} />
                  <span>حفظ التعديل</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {entryModal && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-brand-100 overflow-hidden max-h-[90svh] flex flex-col">
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">
                {entryModal.mode === 'check_in' ? 'تسجيل دخول الموظف' : 'تسجيل انصراف الموظف'}
              </h2>
              <button onClick={() => setEntryModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {entryModal.mode === 'check_in' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">دوام هذا اليوم</label>
                  <select
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                    value={entryShiftType}
                    onChange={(e) => setEntryShiftType(e.target.value as ShiftType)}
                  >
                    <option value="morning">صباحي</option>
                    <option value="evening">مسائي</option>
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">
                  {entryModal.mode === 'check_in' ? 'ساعة الوصول الفعلية' : 'ساعة الانصراف الفعلية'}
                </label>
                <input
                  type="datetime-local"
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  value={entryDateTime}
                  onChange={(e) => setEntryDateTime(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-brand-100 pt-4">
                <button onClick={() => setEntryModal(null)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer">إلغاء</button>
                <button onClick={handleSaveEntry} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md">
                  <Save size={14} />
                  <span>حفظ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="تأكيد حذف سجل الحضور"
        description={`سيتم حذف سجل ${deleteTarget?.employeeName ?? ''} ليوم ${deleteTarget?.date ?? ''}. لا يمكن التراجع عن هذه العملية.`}
        confirmText="حذف السجل"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={confirmDeleteAttendance}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Attendance;
