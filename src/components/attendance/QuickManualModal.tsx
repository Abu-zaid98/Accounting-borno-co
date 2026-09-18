import React, { useState } from 'react';
import { X, Clock, AlertTriangle, Calendar, Save } from 'lucide-react';
import type { EmployeeDocument, AttendanceDocument, OvertimeDocument, EmployeeFinancialTransaction } from '../../types';
import { dbService } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useSettings } from '../../context/SettingsContext';

interface QuickManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'overtime' | 'late_penalty' | 'details';
  employee: EmployeeDocument | null;
  selectedMonth: string; // YYYY-MM
  monthAttendance: AttendanceDocument[];
  onSuccess: () => void;
}

export const QuickManualModal: React.FC<QuickManualModalProps> = ({
  isOpen,
  onClose,
  mode,
  employee,
  selectedMonth,
  monthAttendance,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { settings } = useSettings();

  // Overtime Form State
  const [otHours, setOtHours] = useState<number>(1);
  const [otDate, setOtDate] = useState<string>(
    `${selectedMonth}-${String(new Date().getDate()).padStart(2, '0')}`
  );
  const [otReason, setOtReason] = useState<string>('ساعات عمل إضافية معتمدة');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Late Penalty / Deduction State
  const [penaltyAmount, setPenaltyAmount] = useState<number>(50);
  const [penaltyType, setPenaltyType] = useState<'late' | 'penalty'>('late');
  const [penaltyReason, setPenaltyReason] = useState<string>('خصم تأخير عن مواعيد العمل المقررة');
  const [penaltyDate, setPenaltyDate] = useState<string>(
    `${selectedMonth}-${String(new Date().getDate()).padStart(2, '0')}`
  );

  if (!isOpen || !employee) return null;

  // Calculate standard hourly rate for overtime: (salary / 26 / dailyHours) * 1.5
  const dailyHours = settings?.dailyWorkingHours || 8;
  const standardHourlyRate =
    settings?.overtimeRateType === 'fixed' && (settings?.fixedOvertimeRate || 0) > 0
      ? settings.fixedOvertimeRate
      : Number(((employee.basicSalary / 26 / dailyHours) * 1.5).toFixed(2));
  const calculatedOtAmount = Number((otHours * standardHourlyRate).toFixed(2));

  // Handle saving Overtime
  const handleSaveOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otHours <= 0) {
      showToast('error', 'يرجى تحديد عدد ساعات إضافية أكبر من الصفر');
      return;
    }

    setIsSubmitting(true);
    try {
      const newOt: OvertimeDocument = {
        id: `ot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        employeeId: employee.id,
        employeeName: employee.fullName,
        date: otDate,
        hours: Number(otHours),
        reason: otReason,
        hourlyRate: standardHourlyRate,
        totalAmount: calculatedOtAmount,
        salaryCycleId: selectedMonth,
        createdAt: new Date().toISOString(),
      };

      await dbService.addOvertime(newOt);
      showToast('success', `تم تسجيل ${otHours} ساعة إضافية للموظف (${employee.fullName}) بنجاح`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to add overtime:', err);
      showToast('error', 'تعذر حفظ الساعات الإضافية، يرجى المحاولة ثانية');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle saving Late / Penalty Deduction
  const handleSavePenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (penaltyAmount <= 0) {
      showToast('error', 'يرجى إدخال مبلغ خصم صالح');
      return;
    }

    setIsSubmitting(true);
    try {
      const typeName = penaltyType === 'late' ? 'خصم تأخير' : 'جزاء إداري';
      const newTransaction: EmployeeFinancialTransaction = {
        id: `ft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        employeeId: employee.id,
        employeeName: employee.fullName,
        typeId: penaltyType === 'late' ? 'sys_late_deduction' : 'sys_penalty_deduction',
        typeName,
        category: 'DEDUCTION',
        title: penaltyReason || typeName,
        amount: Number(penaltyAmount),
        date: penaltyDate,
        monthCycle: selectedMonth,
        source: 'manual',
        status: 'pending',
        notes: `مسجل يدوياً عبر مركز تحكم الدوام - ${user?.fullName || 'المشرف'}`,
        addedBy: user?.fullName || 'المشرف',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dbService.addFinancialTransaction(newTransaction);
      showToast(
        'success',
        `تم تسجيل ${typeName} بمبلغ ${penaltyAmount} ${settings?.globalCurrency || 'ر.س'} للموظف (${employee.fullName})`
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to add deduction transaction:', err);
      showToast('error', 'تعذر تسجيل الخصم، يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter attendance for this specific employee in the current month
  const empMonthlyLogs = monthAttendance
    .filter((a) => a.employeeId === employee.id && a.date.startsWith(selectedMonth))
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-gray-100 text-right animate-scale-in my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            {mode === 'overtime' && (
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
                <Clock className="w-5 h-5" />
              </div>
            )}
            {mode === 'late_penalty' && (
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            {mode === 'details' && (
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-700">
                <Calendar className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-brand-950 text-base sm:text-lg">
                {mode === 'overtime' && 'إضافة ساعات إضافية معتمدة'}
                {mode === 'late_penalty' && 'إضافة خصم تأخير / جزاء إداري'}
                {mode === 'details' && `سجل دوام الشهر (${selectedMonth})`}
              </h3>
              <p className="text-xs text-gray-500">
                الموظف: <span className="font-bold text-gray-800">{employee.fullName}</span> ({employee.jobTitle})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Overtime Form */}
        {mode === 'overtime' && (
          <form onSubmit={handleSaveOvertime} className="space-y-4 text-xs sm:text-sm">
            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-emerald-900 font-semibold">معدل احتساب الساعة الإضافية</p>
                <p className="text-[11px] text-emerald-700">
                  {standardHourlyRate} {settings?.globalCurrency || 'ر.س'} / ساعة
                </p>
              </div>
              <div className="text-left">
                <p className="text-emerald-900 font-semibold">الإجمالي المقدر</p>
                <p className="text-base font-bold text-emerald-700">
                  {calculatedOtAmount} {settings?.globalCurrency || 'ر.س'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">عدد الساعات الإضافية</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={otHours}
                  onChange={(e) => setOtHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={otDate}
                  onChange={(e) => setOtDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">بيان / سبب الساعات الإضافية</label>
              <input
                type="text"
                value={otReason}
                onChange={(e) => setOtReason(e.target.value)}
                placeholder="مثال: تغطية ضغط عمل في تغليف هدايا المناسبات"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'جارٍ الحفظ...' : 'حفظ واحتساب في الراتب'}</span>
              </button>
            </div>
          </form>
        )}

        {/* 2. Late Penalty / Deduction Form */}
        {mode === 'late_penalty' && (
          <form onSubmit={handleSavePenalty} className="space-y-4 text-xs sm:text-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPenaltyType('late');
                  setPenaltyReason('خصم تأخير عن مواعيد العمل المقررة');
                }}
                className={`flex-1 py-2 rounded-xl font-bold border transition text-center ${
                  penaltyType === 'late'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                خصم تأخير
              </button>
              <button
                type="button"
                onClick={() => {
                  setPenaltyType('penalty');
                  setPenaltyReason('جزاء إداري / مخالفة سلوكية أو وظيفية');
                }}
                className={`flex-1 py-2 rounded-xl font-bold border transition text-center ${
                  penaltyType === 'penalty'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                جزاء إداري
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  مبلغ الخصم ({settings?.globalCurrency || 'ر.س'})
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-bold text-center text-rose-700 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">تاريخ الخصم</label>
                <input
                  type="date"
                  value={penaltyDate}
                  onChange={(e) => setPenaltyDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">السبب / الملاحظات</label>
              <input
                type="text"
                value={penaltyReason}
                onChange={(e) => setPenaltyReason(e.target.value)}
                placeholder="سبب الخصم وملاحظات الإدارة..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <p className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
              💡 سيتم إدراج هذا الخصم تلقائياً في دورة راتب شهر ({selectedMonth}) للموظف ويخصم من الصافي عند الصرف.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'جارٍ التسجيل...' : 'تثبيت الخصم'}</span>
              </button>
            </div>
          </form>
        )}

        {/* 3. Details View (Monthly Daily Attendance Logs) */}
        {mode === 'details' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-brand-50/50 p-2.5 rounded-xl text-xs font-semibold text-brand-950">
              <span>إجمالي السجلات: {empMonthlyLogs.length} يوم</span>
              <span>
                مجموع الساعات المنجزة:{' '}
                {empMonthlyLogs.reduce((sum, a) => sum + (a.workingHours || 0), 0).toFixed(1)} ساعة
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl">
              {empMonthlyLogs.length > 0 ? (
                empMonthlyLogs.map((log) => (
                  <div key={log.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50">
                    <div>
                      <span className="font-bold text-gray-800">{log.date}</span>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>
                          دخول:{' '}
                          {log.status !== 'absent'
                            ? new Date(log.checkIn).toLocaleTimeString('ar-SA', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                        <span>•</span>
                        <span>
                          خروج:{' '}
                          {log.checkOut
                            ? new Date(log.checkOut).toLocaleTimeString('ar-SA', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="text-left flex items-center gap-2">
                      <span className="font-bold text-brand-950">
                        {log.workingHours > 0 ? `${log.workingHours} س` : '—'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'late'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status === 'present' ? 'حاضر' : log.status === 'late' ? 'متأخر' : 'غائب'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-xs">
                  لا توجد سجلات دوام مسجلة لهذا الموظف خلال شهر {selectedMonth}.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
