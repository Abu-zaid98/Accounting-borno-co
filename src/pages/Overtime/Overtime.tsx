import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/db';
import type { EmployeeDocument, OvertimeDocument, GeneralSettingsDocument } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import {
  Timer, Plus, Search, Clock,
  Trash2, Check, AlertCircle, X, DollarSign
} from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/ui/LoadingState';

const overtimeSchema = zod.object({
  employeeId: zod.string().min(1, 'يرجى اختيار الموظف'),
  date: zod.string().min(1, 'يرجى تحديد التاريخ'),
  hours: zod.number().min(0.5, 'الحد الأدنى نصف ساعة').max(8, 'الحد الأقصى 8 ساعات يومياً'),
  reason: zod.string().min(3, 'يرجى كتابة سبب العمل الإضافي بالتفصيل'),
});

type OvertimeFormFields = zod.infer<typeof overtimeSchema>;

export const Overtime: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('overtime.create');
  const canEdit = hasPermission('overtime.edit');

  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeDocument[]>([]);
  const [settings, setSettings] = useState<GeneralSettingsDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OvertimeDocument | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OvertimeFormFields>({
    resolver: zodResolver(overtimeSchema),
    defaultValues: {
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      hours: 1,
      reason: '',
    }
  });

  const selectedEmployeeId = watch('employeeId');
  const enteredHours = watch('hours');
  const currency = settings?.globalCurrency ?? settings?.currency ?? '₪';

  const fetchData = async () => {
    setLoading(true);
    try {
      const emps = await dbService.getEmployees();
      const activeEmps = emps.filter(e => e.status === 'active');
      const recs = await dbService.getOvertimeRecords();
      const appSettings = await dbService.getSettings();

      setEmployees(activeEmps);
      setOvertimeRecords(recs);
      setSettings(appSettings);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = () => {
    reset({
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      hours: 1,
      reason: '',
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const getCalculatedRate = (emp: EmployeeDocument) => {
    if (!settings) return 0;
    if (settings.overtimeRateType === 'fixed') {
      return settings.fixedOvertimeRate;
    }
    // Equation: Salary / 26 / workingHours * 1.5 multiplier standard
    const hourlyBase = emp.basicSalary / 26 / settings.dailyWorkingHours;
    return Math.round(hourlyBase * 1.5 * 10) / 10;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.deleteOvertime(deleteTarget.id);
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      alert("حدث خطأ أثناء الحذف.");
    }
  };

  const onSubmit = async (data: OvertimeFormFields) => {
    setErrorMsg(null);
    const emp = employees.find(e => e.id === data.employeeId);
    if (!emp || !settings) {
      setErrorMsg("خطأ في جلب بيانات الموظف أو إعدادات النظام.");
      return;
    }

    const calculatedHourlyRate = getCalculatedRate(emp);
    const totalOvertimeAmount = Math.round(data.hours * calculatedHourlyRate);

    const newRecord: OvertimeDocument = {
      id: `ov_${Date.now()}`,
      employeeId: data.employeeId,
      employeeName: emp.fullName,
      date: data.date,
      hours: data.hours,
      reason: data.reason,
      hourlyRate: calculatedHourlyRate,
      totalAmount: totalOvertimeAmount,
      createdAt: new Date().toISOString()
    };

    try {
      await dbService.addOvertime(newRecord);
      setIsModalOpen(false);
      await fetchData();
    } catch (error: any) {
      setErrorMsg(error.message || "حدث خطأ أثناء إضافة السجل.");
    }
  };

  // Live calculations for preview in form
  const getSelectedEmployeeDetails = () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return null;
    const rate = getCalculatedRate(emp);
    const total = Math.round(enteredHours * rate);
    return { rate, total, name: emp.fullName };
  };

  const liveDetails = getSelectedEmployeeDetails();

  const filteredRecords = overtimeRecords.filter(rec =>
    rec.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rec.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إدارة الساعات الإضافية</h1>
          <p className="text-xs text-gray-400 mt-1">تسجيل الساعات الإضافية للموظفين واحتساب قيمتها المالية بناءً على إعدادات الرواتب.</p>
        </div>
        {canCreate && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-l from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة سجل إضافي</span>
          </button>
        )}
      </div>

      {/* Summary indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-brand-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">إجمالي الساعات المسجلة</span>
            <p className="text-xl font-black text-gray-800">{overtimeRecords.reduce((sum, r) => sum + r.hours, 0)} ساعة عمل إضافي</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-brand-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">إجمالي الأجور المستحقة</span>
            <p className="text-xl font-black text-gray-800">{formatCurrency(overtimeRecords.reduce((sum, r) => sum + r.totalAmount, 0), currency)}</p>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs">
        <div className="relative">
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="البحث باسم الموظف أو سبب الساعات الإضافية..."
            className="w-full py-2.5 pr-10 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-right"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Overtime Logs List */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingState
            message="جارٍ تحميل سجلات الساعات الإضافية المعتمدة..."
            subMessage="يتم احتساب مستحقات الموظفين من قاعدة البيانات"
            variant="card"
          />
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Timer size={48} className="mx-auto text-gray-300 animate-pulse" />
            <h3 className="font-bold text-gray-700 text-sm">لا توجد سجلات ساعات إضافية</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">لم يتم تسجيل أي نشاطات عمل إضافي للموظفين حتى الآن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-brand-50/50 border-b border-brand-100 text-xs font-bold text-gray-500">
                  <th className="p-4.5">الموظف</th>
                  <th className="p-4.5">التاريخ</th>
                  <th className="p-4.5">عدد الساعات</th>
                  <th className="p-4.5">سعر الساعة المقدر</th>
                  <th className="p-4.5">إجمالي الأجر الإضافي</th>
                  <th className="p-4.5">السبب والتبرير المحاسبي</th>
                  <th className="p-4.5 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50 text-xs">
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-brand-50/20 transition-all">
                    <td className="p-4.5 font-bold text-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gold-50 text-gold-700 flex items-center justify-center font-bold text-xs">
                          {rec.employeeName.charAt(0)}
                        </div>
                        <span>{rec.employeeName}</span>
                      </div>
                    </td>
                    <td className="p-4.5 text-gray-600 font-medium">{rec.date}</td>
                    <td className="p-4.5 font-bold text-brand-900">{rec.hours} ساعة</td>
                    <td className="p-4.5 text-gray-500">{formatCurrency(rec.hourlyRate, currency)}</td>
                    <td className="p-4.5 font-bold text-emerald-700">{formatCurrency(rec.totalAmount, currency)}</td>
                    <td className="p-4.5 text-gray-500 font-medium max-w-xs truncate" title={rec.reason}>
                      {rec.reason}
                    </td>
                    <td className="p-4.5 text-center">
                      {canEdit && (
                        <button
                          onClick={() => setDeleteTarget(rec)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all border border-red-100 cursor-pointer"
                          title="إلغاء السجل"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Overtime Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-brand-100 overflow-hidden animate-scale-in max-h-[90svh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">تسجيل ساعات عمل إضافية</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-brand-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 border-r-4 border-red-500 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Select Employee */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">اختر الموظف</label>
                  <select
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.employeeId ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('employeeId')}
                  >
                    <option value="">-- اختر الموظف --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.fullName} ({e.jobTitle} - راتب: {formatCurrency(e.basicSalary, currency)})</option>
                    ))}
                  </select>
                  {errors.employeeId && <p className="text-red-500 text-[10px]">{errors.employeeId.message}</p>}
                </div>

                {/* Overtime Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">تاريخ الدوام الإضافي</label>
                  <input
                    type="date"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.date ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('date')}
                  />
                  {errors.date && <p className="text-red-500 text-[10px]">{errors.date.message}</p>}
                </div>

                {/* Hours */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">عدد الساعات الإضافية</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="مثال: 2"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.hours ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('hours', { valueAsNumber: true })}
                  />
                  {errors.hours && <p className="text-red-500 text-[10px]">{errors.hours.message}</p>}
                </div>

                {/* Reason */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">السبب وتبرير العمل الإضافي</label>
                  <textarea
                    placeholder="مثال: تجهيز هدايا وتغليفات طلبات العملاء الكبيرة لعيد الفطر المبارك وتوصيلها."
                    rows={3}
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.reason ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('reason')}
                  />
                  {errors.reason && <p className="text-red-500 text-[10px]">{errors.reason.message}</p>}
                </div>

                {/* Live Calculation Preview */}
                {liveDetails && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-900 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-emerald-950 mb-0.5">💰 معاينة الاحتساب المالي الفوري:</p>
                    <p>• الموظف المستفيد: <span className="font-bold">{liveDetails.name}</span></p>
                    <p>• أجر الساعة الإضافية المقدر (1.5x): <span className="font-bold">{formatCurrency(liveDetails.rate, currency)} / ساعة</span></p>
                    <p>• صافي المستحقات الإضافية لهذا اليوم: <span className="font-black text-sm text-emerald-700">{formatCurrency(liveDetails.total, currency)}</span></p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-brand-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>جاري التسجيل...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>تسجيل وإضافة</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="تأكيد حذف الإضافي"
        description={`سيتم حذف سجل الساعات الإضافية للموظف "${deleteTarget?.employeeName ?? ''}".`}
        confirmText="حذف السجل"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
export default Overtime;
