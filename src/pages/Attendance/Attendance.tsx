import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dbService } from '../../services/db';
import { calculateWorkingHours } from '../../services/attendance';
import { useSettings } from '../../context/SettingsContext';
import type {
  AttendanceAuditLog,
  AttendanceDocument,
  AttendanceStatus,
  EmployeeDocument,
  GeneralSettingsDocument,
  TemporaryExitRecord,
} from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { LoadingState } from '../../components/ui/LoadingState';
import { QrAttendanceScanner } from '../../components/attendance/QrAttendanceScanner';
import { MonthlyHoursHub } from '../../components/attendance/MonthlyHoursHub';
import {
  Calendar,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  X,
  Search,
  QrCode,
  ArrowRightLeft,
  LogOut,
  CheckCircle2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

const statusLabel: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  temporary_exit: 'خروج مؤقت',
  checked_out: 'تم الانصراف',
  absent: 'غائب',
  late: 'حاضر',
  outside_shift: 'حاضر',
};

const statusClass: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  temporary_exit: 'bg-amber-50 text-amber-700 border-amber-200',
  checked_out: 'bg-gray-100 text-gray-700 border-gray-300',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  outside_shift: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const toDateTimeLocal = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string) => (value ? new Date(value).toISOString() : undefined);

/** استخراج أوقات الشفت من إعدادات النظام أو بيانات الموظف */
const resolveShiftTimes = (
  emp: EmployeeDocument,
  settings: GeneralSettingsDocument | null
) => {
  const shiftType = emp.shiftType || settings?.shiftType || 'morning';
  const shiftSettings = settings?.shifts?.[shiftType];
  return {
    shiftType,
    scheduledStartTime:
      emp.shiftStartTime ||
      shiftSettings?.workStartTime ||
      (shiftType === 'evening' ? '12:00' : '09:00'),
    scheduledEndTime:
      emp.shiftEndTime ||
      shiftSettings?.workEndTime ||
      (shiftType === 'evening' ? '21:00' : '18:00'),
  };
};

export const Attendance: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDocument[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Scanner modal
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Manual Edit Modal
  const [editingRecord, setEditingRecord] = useState<AttendanceDocument | null>(null);
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('present');
  const [overrideReason, setOverrideReason] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<AttendanceDocument | null>(null);

  // Tab State: 'daily' (Live Punch Log) vs 'monthly' (Monthly Hours & Quick Action Hub)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') === 'monthly' ? 'monthly' : 'daily') as 'daily' | 'monthly';

  const handleTabChange = (tab: 'daily' | 'monthly') => {
    if (tab === 'monthly') {
      setSearchParams({ tab: 'monthly' });
    } else {
      setSearchParams({});
    }
  };

  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const canCreateAttendance = hasPermission('attendance.create');
  const canEditAttendance = hasPermission('attendance.edit');
  const canDeleteAttendance = hasPermission('attendance.delete');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emps, atts] = await Promise.all([
        dbService.getEmployees(),
        dbService.getAttendance(selectedDate),
      ]);
      setEmployees(emps.filter((e) => e.status === 'active'));
      setAttendance(atts);
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

  // Direct manual actions (one-click buttons)
  const handleQuickCheckIn = async (emp: EmployeeDocument) => {
    if (!canCreateAttendance) {
      showToast('error', 'لا تملك صلاحية تسجيل الحضور');
      return;
    }
    const nowIso = new Date().toISOString();
    const { shiftType, scheduledStartTime, scheduledEndTime } = resolveShiftTimes(emp, settings);

    const newRecord: AttendanceDocument = {
      id: `${emp.id}_${selectedDate}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      date: selectedDate,
      checkIn: nowIso,
      workingHours: 0,
      status: 'present',
      shiftType,
      scheduledStartTime,
      scheduledEndTime,
      temporaryExits: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      auditTrail: [createAudit('check_in', {}, { checkIn: nowIso, status: 'present', shiftType })],
    };

    try {
      await dbService.recordAttendance(newRecord);
      showToast('success', 'تم تسجيل الدخول', `${emp.fullName} - حاضر`);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `فشل تسجيل الحضور: ${msg}`);
    }
  };

  const handleQuickTemporaryExit = async (record: AttendanceDocument) => {
    if (!canCreateAttendance) {
      showToast('error', 'لا تملك صلاحية تسجيل الخروج المؤقت');
      return;
    }
    const nowIso = new Date().toISOString();
    const newExit: TemporaryExitRecord = {
      id: `exit_${Date.now()}`,
      exitTime: nowIso,
    };

    const updated: AttendanceDocument = {
      ...record,
      status: 'temporary_exit',
      temporaryExits: [...(record.temporaryExits || []), newExit],
      updatedAt: nowIso,
      auditTrail: [
        ...(record.auditTrail || []),
        createAudit('temporary_exit', { status: record.status }, { status: 'temporary_exit' }),
      ],
    };

    try {
      await dbService.recordAttendance(updated);
      showToast('success', 'تم تسجيل الخروج المؤقت', record.employeeName);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `فشل الخروج المؤقت: ${msg}`);
    }
  };

  const handleQuickTemporaryReturn = async (record: AttendanceDocument) => {
    if (!canCreateAttendance) {
      showToast('error', 'لا تملك صلاحية تسجيل العودة');
      return;
    }
    const nowIso = new Date().toISOString();
    const updatedExits = [...(record.temporaryExits || [])];
    const openExitIdx = updatedExits.findIndex((e) => !e.returnTime);

    if (openExitIdx !== -1) {
      updatedExits[openExitIdx] = {
        ...updatedExits[openExitIdx],
        returnTime: nowIso,
      };
    } else {
      updatedExits.push({
        id: `exit_${Date.now()}`,
        exitTime: record.updatedAt || nowIso,
        returnTime: nowIso,
      });
    }

    const updated: AttendanceDocument = {
      ...record,
      status: 'present',
      temporaryExits: updatedExits,
      updatedAt: nowIso,
      auditTrail: [
        ...(record.auditTrail || []),
        createAudit('temporary_return', { status: record.status }, { status: 'present' }),
      ],
    };

    try {
      await dbService.recordAttendance(updated);
      showToast('success', 'تم تسجيل العودة للعمل', record.employeeName);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `فشل تسجيل العودة: ${msg}`);
    }
  };

  const handleQuickCheckOut = async (record: AttendanceDocument) => {
    if (!canCreateAttendance) {
      showToast('error', 'لا تملك صلاحية تسجيل الانصراف');
      return;
    }
    const nowIso = new Date().toISOString();
    const hours = calculateWorkingHours(record.checkIn, nowIso, record.temporaryExits);

    const updated: AttendanceDocument = {
      ...record,
      checkOut: nowIso,
      status: 'checked_out',
      workingHours: hours,
      updatedAt: nowIso,
      auditTrail: [
        ...(record.auditTrail || []),
        createAudit('check_out', { checkOut: record.checkOut }, { checkOut: nowIso, status: 'checked_out' }),
      ],
    };

    try {
      await dbService.recordAttendance(updated);
      showToast('success', 'تم تسجيل الانصراف', `${record.employeeName} (${hours} ساعة)`);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `فشل تسجيل الانصراف: ${msg}`);
    }
  };

  const handleOpenManualEdit = (record: AttendanceDocument) => {
    if (!canEditAttendance) {
      showToast('error', 'لا تملك صلاحية تعديل سجل الحضور');
      return;
    }
    setEditingRecord(record);
    setManualCheckIn(toDateTimeLocal(record.checkIn));
    setManualCheckOut(toDateTimeLocal(record.checkOut));
    setManualStatus(record.status);
    setOverrideReason(record.overrideReason || '');
  };

  const handleSaveManualEdit = async () => {
    if (!editingRecord) return;
    const checkIn = fromDateTimeLocal(manualCheckIn) || editingRecord.checkIn;
    const checkOut = fromDateTimeLocal(manualCheckOut);
    const hours = calculateWorkingHours(checkIn, checkOut, editingRecord.temporaryExits);

    const updated: AttendanceDocument = {
      ...editingRecord,
      checkIn,
      checkOut,
      status: manualStatus,
      workingHours: hours,
      isManualOverride: true,
      overrideReason,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...(editingRecord.auditTrail || []),
        createAudit(
          'manual_override',
          { checkIn: editingRecord.checkIn, checkOut: editingRecord.checkOut, status: editingRecord.status },
          { checkIn, checkOut, status: manualStatus },
          overrideReason
        ),
      ],
    };

    try {
      await dbService.recordAttendance(updated);
      showToast('success', 'تم حفظ التعديل اليدوي');
      setEditingRecord(null);
      await fetchData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', `فشل حفظ التعديل: ${msg}`);
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
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', `فشل الحذف: ${msg}`);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats calculation
  const presentList = attendance.filter((a) => a.status === 'present');
  const tempExitList = attendance.filter((a) => a.status === 'temporary_exit');
  const checkedOutList = attendance.filter((a) => a.status === 'checked_out');
  const absentCount = Math.max(0, employees.length - (presentList.length + tempExitList.length + checkedOutList.length));

  return (
    <div className="space-y-6">
      {/* Top Tab Switcher: Mobile First Segmented Control */}
      <div className="flex items-center gap-2 p-1.5 bg-brand-50/70 rounded-2xl w-full sm:w-fit border border-brand-200/50 shadow-xs">
        <button
          type="button"
          onClick={() => handleTabChange('daily')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeTab === 'daily'
              ? 'bg-white text-brand-950 shadow-sm border border-gray-200/60'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar size={15} />
          <span>سجل التحضير اليومي (QR)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('monthly')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeTab === 'monthly'
              ? 'bg-gradient-to-r from-brand-950 to-brand-900 text-gold-300 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 size={15} className={activeTab === 'monthly' ? 'text-gold-400' : ''} />
          <span>مركز ساعات الشهر والتحكم الفوري</span>
        </button>
      </div>

      {activeTab === 'monthly' ? (
        <MonthlyHoursHub />
      ) : (
        <>
          {/* Top Header & Quick Actions */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-brand-950 flex items-center gap-2.5">
                <span>سجل الدوام والتحضير اليومي</span>
              </h1>
          <p className="text-xs text-brand-600 mt-1">
            توثيق الحضور والانصراف والخروج المؤقت آلياً بتقنية الـ QR أو يدوياً
          </p>
        </div>

        {/* Date Selector & Primary Action Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-600 pointer-events-none">
              <Calendar size={16} />
            </span>
            <input
              type="date"
              className="py-2.5 pr-9 pl-4 bg-white border border-brand-100 rounded-2xl text-xs font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-xs cursor-pointer"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Big QR Scanner Button (Touch-Friendly Mobile First) */}
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="flex-1 sm:flex-initial py-2.5 px-5 rounded-2xl bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-gold-400 hover:text-white border border-gold-400/40 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-950/20 hover:shadow-xl transition-all cursor-pointer active:scale-95"
          >
            <QrCode size={18} className="text-gold-400 animate-pulse" />
            <span>ماسح الـ QR السريع</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row (Mobile Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-bold block">الحاضرين الآن</span>
            <span className="text-lg font-black text-emerald-700">{presentList.length}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-bold block">في خروج مؤقت</span>
            <span className="text-lg font-black text-amber-700">{tempExitList.length}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
            <LogOut size={20} />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-bold block">تم الانصراف</span>
            <span className="text-lg font-black text-gray-800">{checkedOutList.length}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-red-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <UserX size={20} />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-bold block">لم يحضروا بعد</span>
            <span className="text-lg font-black text-red-700">{absentCount}</span>
          </div>
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="bg-white p-3.5 rounded-2xl border border-brand-100 shadow-xs">
        <div className="relative">
          <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="بحث باسم الموظف أو رقمه الوظيفي..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2.5 pr-10 pl-4 bg-gray-50/70 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right transition-all"
          />
        </div>
      </div>

      {/* Main Content Area: Responsive Mobile Cards + Desktop Table */}
      {loading ? (
        <LoadingState
          message="جارٍ تحميل سجلات الدوام وبصمات الموظفين..."
          subMessage="تتم مزامنة أوقات الحضور والانصراف والخروج المؤقت لحظياً"
          variant="skeleton"
          rows={4}
        />
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-brand-100 shadow-xs">
          <AlertCircle size={36} className="text-brand-300 mx-auto mb-2" />
          <p className="font-bold text-gray-700 text-sm">لا يوجد موظفون مطابقون لبحثك</p>
          <span className="text-xs text-gray-400 mt-1 block">تأكد من وجود موظفين نشطين في النظام</span>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (block on small screens, hidden on sm+) */}
          <div className="block sm:hidden space-y-3">
            {filteredEmployees.map((emp) => {
              const rec = attendance.find((a) => a.employeeId === emp.id);
              const shiftLabel = emp.shiftType === 'evening' ? 'مسائي' : 'صباحي';
              const { scheduledStartTime: st, scheduledEndTime: et } = resolveShiftTimes(emp, settings);
              const shiftTimes = `${st} - ${et}`;
              const exitsCount = rec?.temporaryExits?.length || 0;

              return (
                <div
                  key={emp.id}
                  className="bg-white rounded-2xl border border-brand-100 p-4 shadow-xs space-y-3"
                >
                  {/* Top row: Avatar + Name + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-900 text-gold-400 flex items-center justify-center font-bold text-sm shrink-0 border border-gold-400/30">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-gray-900 truncate leading-snug">{emp.fullName}</h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <span>{emp.employeeNo}</span>
                          <span>•</span>
                          <span className="text-brand-700 font-semibold">{shiftLabel} ({shiftTimes})</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                        rec ? statusClass[rec.status] : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}
                    >
                      {rec ? statusLabel[rec.status] : 'لم يحضر'}
                    </span>
                  </div>

                  {/* Time Summary Row */}
                  {rec && (
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-gray-50 text-[10px] text-gray-600 border border-gray-100">
                      <div>
                        <span className="text-gray-400 block mb-0.5">الحضور:</span>
                        <span className="font-bold text-gray-800">
                          {new Date(rec.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-400 block mb-0.5">خروج مؤقت:</span>
                        <span className="font-bold text-amber-700">
                          {exitsCount > 0 ? `${exitsCount} مرات` : '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-400 block mb-0.5">الانصراف:</span>
                        <span className="font-bold text-gray-800">
                          {rec.checkOut
                            ? new Date(rec.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    {!rec ? (
                      <button
                        type="button"
                        onClick={() => handleQuickCheckIn(emp)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <UserCheck size={15} />
                        <span>تسجيل حضور</span>
                      </button>
                    ) : rec.status === 'present' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickTemporaryExit(rec)}
                          className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                        >
                          <ArrowRightLeft size={14} />
                          <span>خروج مؤقت</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickCheckOut(rec)}
                          className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                        >
                          <LogOut size={14} />
                          <span>انصراف</span>
                        </button>
                      </>
                    ) : rec.status === 'temporary_exit' ? (
                      <button
                        type="button"
                        onClick={() => handleQuickTemporaryReturn(rec)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <CheckCircle2 size={15} />
                        <span>تسجيل العودة للعمل</span>
                      </button>
                    ) : (
                      <span className="flex-1 text-center py-1.5 text-xs text-gray-500 font-semibold bg-gray-100 rounded-xl">
                        أتم دوام اليوم ({rec.workingHours} ساعة)
                      </span>
                    )}

                    {rec && (
                      <div className="flex items-center gap-1">
                        {canEditAttendance && (
                          <button
                            type="button"
                            onClick={() => handleOpenManualEdit(rec)}
                            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
                            title="تعديل"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {canDeleteAttendance && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rec)}
                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-all cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP & TABLET TABLE VIEW (hidden on sm-, block on sm+) */}
          <div className="hidden sm:block bg-white rounded-3xl border border-brand-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-brand-100 bg-brand-50/40 text-brand-900 font-bold text-xs">
                    <th className="p-4">الموظف</th>
                    <th className="p-4">الجدول المعتمد</th>
                    <th className="p-4">وقت الحضور</th>
                    <th className="p-4">الخروج المؤقت</th>
                    <th className="p-4">وقت الانصراف</th>
                    <th className="p-4">ساعات العمل</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50 text-xs">
                  {filteredEmployees.map((emp) => {
                    const rec = attendance.find((a) => a.employeeId === emp.id);
                    const shiftLabel = emp.shiftType === 'evening' ? 'مسائي' : 'صباحي';
                    const { scheduledStartTime: st2, scheduledEndTime: et2 } = resolveShiftTimes(emp, settings);
                    const shiftTimes = `${st2} - ${et2}`;
                    const exits = rec?.temporaryExits || [];

                    return (
                      <tr key={emp.id} className="hover:bg-brand-50/20 transition-all">
                        {/* Employee Details */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-900 text-gold-400 flex items-center justify-center font-bold text-xs shrink-0 border border-gold-400/20">
                              {emp.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{emp.fullName}</p>
                              <span className="text-[10px] text-gray-400 block">{emp.employeeNo} • {emp.jobTitle}</span>
                            </div>
                          </div>
                        </td>

                        {/* Schedule from Employee */}
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-brand-950 text-[11px] block">{shiftLabel}</span>
                            <span className="text-[10px] text-gray-500 font-mono" dir="ltr">{shiftTimes}</span>
                          </div>
                        </td>

                        {/* Check-in time */}
                        <td className="p-4">
                          {rec ? (
                            <span className="font-mono font-semibold text-gray-800" dir="ltr">
                              {new Date(rec.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Temporary exits */}
                        <td className="p-4">
                          {exits.length > 0 ? (
                            <div>
                              <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px]">
                                {exits.length} مرات
                              </span>
                              {rec?.status === 'temporary_exit' && (
                                <span className="text-[10px] text-amber-600 block mt-0.5 font-semibold animate-pulse">
                                  بالخارج حالياً
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Check-out time */}
                        <td className="p-4">
                          {rec?.checkOut ? (
                            <span className="font-mono font-semibold text-gray-800" dir="ltr">
                              {new Date(rec.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Working hours (pure data) */}
                        <td className="p-4">
                          {rec ? (
                            <span className="font-bold text-brand-900">
                              {rec.workingHours > 0 ? `${rec.workingHours} س` : 'جارٍ الاحتساب'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="p-4">
                          <span
                            className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              rec ? statusClass[rec.status] : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                          >
                            {rec ? statusLabel[rec.status] : 'لم يحضر'}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!rec ? (
                              <button
                                type="button"
                                onClick={() => handleQuickCheckIn(emp)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              >
                                <UserCheck size={13} />
                                <span>دخول</span>
                              </button>
                            ) : rec.status === 'present' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleQuickTemporaryExit(rec)}
                                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                  title="خروج مؤقت"
                                >
                                  <ArrowRightLeft size={13} />
                                  <span>مؤقت</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickCheckOut(rec)}
                                  className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                  title="انصراف نهائي"
                                >
                                  <LogOut size={13} />
                                  <span>انصراف</span>
                                </button>
                              </>
                            ) : rec.status === 'temporary_exit' ? (
                              <button
                                type="button"
                                onClick={() => handleQuickTemporaryReturn(rec)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              >
                                <CheckCircle2 size={13} />
                                <span>عودة</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-lg">
                                منجز
                              </span>
                            )}

                            {rec && (
                              <>
                                {canEditAttendance && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenManualEdit(rec)}
                                    className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-all cursor-pointer"
                                    title="تعديل يدوي"
                                  >
                                    <Edit size={13} />
                                  </button>
                                )}
                                {canDeleteAttendance && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(rec)}
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 transition-all cursor-pointer"
                                    title="حذف"
                                  >
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
          </div>
        </>
      )}
        </>
      )}

      {/* QR Scanner Component Modal */}
      <QrAttendanceScanner
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        employees={employees}
        todayDate={selectedDate}
        attendanceRecords={attendance}
        onAttendanceUpdated={fetchData}
      />

      {/* Manual Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-brand-100 max-w-lg w-full overflow-hidden animate-fade-in my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100 bg-brand-50/50">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">تعديل سجل الدوام</h3>
                <p className="text-xs text-brand-600">{editingRecord.employeeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1.5 rounded-lg hover:bg-brand-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700">توقيت الحضور (Check-in)</label>
                <input
                  type="datetime-local"
                  value={manualCheckIn}
                  onChange={(e) => setManualCheckIn(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">توقيت الانصراف (Check-out)</label>
                <input
                  type="datetime-local"
                  value={manualCheckOut}
                  onChange={(e) => setManualCheckOut(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">الحالة</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as AttendanceStatus)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-right"
                >
                  <option value="present">حاضر (Present)</option>
                  <option value="temporary_exit">خروج مؤقت (Temporary Exit)</option>
                  <option value="checked_out">تم الانصراف (Checked Out)</option>
                  <option value="absent">غائب (Absent)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">سبب التعديل اليدوي</label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="اكتب سبب إجراء التعديل اليدوي للتوثيق..."
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-brand-100">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveManualEdit}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="تأكيد حذف سجل الحضور"
        description={`هل أنت متأكد من حذف سجل دوام "${deleteTarget?.employeeName ?? ''}" لهذا اليوم؟`}
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
