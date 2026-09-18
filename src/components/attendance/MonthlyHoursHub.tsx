import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Search,
  PlusCircle,
  MinusCircle,
  Eye,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Users,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import type {
  EmployeeDocument,
  AttendanceDocument,
  OvertimeDocument,
  EmployeeFinancialTransaction,
} from '../../types';
import { dbService } from '../../services/db';
import { useSettings } from '../../context/SettingsContext';
import { QuickManualModal } from './QuickManualModal';
import { LoadingState } from '../ui/LoadingState';

export const MonthlyHoursHub: React.FC = () => {
  const { settings } = useSettings();

  // Current Month default (YYYY-MM)
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data States
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDocument[]>([]);
  const [overtimeList, setOvertimeList] = useState<OvertimeDocument[]>([]);
  const [transactions, setTransactions] = useState<EmployeeFinancialTransaction[]>([]);

  // Modal State
  const [modalMode, setModalMode] = useState<'overtime' | 'late_penalty' | 'details' | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDocument | null>(null);

  // Fetch all relevant data for the month
  const fetchData = async () => {
    setLoading(true);
    try {
      const [emps, atts, ots, fts] = await Promise.all([
        dbService.getEmployees(),
        dbService.getAttendance(),
        dbService.getOvertimeRecords(),
        dbService.getFinancialTransactions(selectedMonth),
      ]);

      setEmployees(emps.filter((e: EmployeeDocument) => e.status === 'active'));
      setAttendance(atts.filter((a: AttendanceDocument) => a.date.startsWith(selectedMonth)));
      setOvertimeList(ots.filter((o: OvertimeDocument) => o.date.startsWith(selectedMonth)));
      setTransactions(fts);
    } catch (err) {
      console.error('Error loading monthly hours hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Navigate months
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(
      `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(
      `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(defaultMonth);
  };

  // Expected standard monthly hours per employee: Standard 26 working days * daily hours
  const standardDailyHours = settings?.dailyWorkingHours || 8;
  const standardMonthlyTarget = standardDailyHours * 26; // approx 208 hours

  // Aggregated data per employee
  const employeeSummaries = useMemo(() => {
    return employees
      .filter((emp) => emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((emp) => {
        // Attendance logs for this employee this month
        const logs = attendance.filter((a) => a.employeeId === emp.id);
        const actualHours = Number(
          logs.reduce((sum, a) => sum + (a.workingHours || 0), 0).toFixed(1)
        );
        const presentDays = logs.filter((a) => a.status === 'present').length;
        const lateDays = logs.filter((a) => a.status === 'late').length;
        const absentDays = logs.filter((a) => a.status === 'absent').length;

        // Overtime for this employee this month
        const empOvertimes = overtimeList.filter((o) => o.employeeId === emp.id);
        const totalOtHours = empOvertimes.reduce((sum, o) => sum + (o.hours || 0), 0);
        const totalOtAmount = empOvertimes.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        // Deductions recorded for this employee this month
        const empDeductions = transactions.filter(
          (t) => t.employeeId === emp.id && t.category === 'DEDUCTION'
        );
        const totalDeductions = empDeductions.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Percentage achieved of target
        const percentage = Math.min(
          100,
          Math.round((actualHours / standardMonthlyTarget) * 100)
        );

        return {
          employee: emp,
          actualHours,
          presentDays,
          lateDays,
          absentDays,
          totalOtHours,
          totalOtAmount,
          totalDeductions,
          percentage,
          targetHours: standardMonthlyTarget,
        };
      });
  }, [employees, attendance, overtimeList, transactions, searchTerm, standardMonthlyTarget]);

  // Overall KPIs
  const totalCompanyHours = employeeSummaries
    .reduce((sum, s) => sum + s.actualHours, 0)
    .toFixed(0);
  const totalCompanyOtHours = employeeSummaries
    .reduce((sum, s) => sum + s.totalOtHours, 0)
    .toFixed(1);
  const totalCompanyDeductions = employeeSummaries.reduce(
    (sum, s) => sum + s.totalDeductions,
    0
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Controls & Month Navigation Bar */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Month Selector Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1">
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white text-gray-700 rounded-lg transition"
              title="الشهر التالي"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-brand-950 px-2 py-1 outline-none text-center"
            />
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white text-gray-700 rounded-lg transition"
              title="الشهر السابق"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleCurrentMonth}
            className="px-3 py-2 text-xs font-bold text-brand-900 bg-brand-50 hover:bg-brand-100 rounded-xl transition border border-brand-200/60"
          >
            الشهر الحالي
          </button>

          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-brand-900 hover:bg-gray-100 rounded-xl transition"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث باسم الموظف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 transition"
          />
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-brand-950 to-brand-900 text-white p-3 sm:p-4 rounded-2xl shadow-md flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs text-brand-200 font-medium">إجمالي ساعات العمل</p>
            <p className="text-xl sm:text-2xl font-black mt-1">{totalCompanyHours} <span className="text-xs font-normal">ساعة</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-brand-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">إجمالي الموظفين</p>
            <p className="text-xl sm:text-2xl font-black text-brand-950 mt-1">{employees.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">ساعات الإضافي المسجلة</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{totalCompanyOtHours} <span className="text-xs font-normal">ساعة</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">إجمالي الخصومات اليدوية</p>
            <p className="text-xl sm:text-2xl font-black text-rose-600 mt-1">{totalCompanyDeductions} <span className="text-xs font-normal">{settings?.globalCurrency || 'ر.س'}</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* MOBILE-FIRST: Cards View for Mobile & Tablet (< md screens) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <LoadingState
            message="جارٍ احتساب وتجميع ساعات الشهر..."
            subMessage="تتم مراجعة سجلات الحضور والانصراف لكل موظف"
            variant="card"
          />
        ) : employeeSummaries.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl text-gray-400 text-xs">
            لا يوجد موظفون مطابقون لبحثك.
          </div>
        ) : (
          employeeSummaries.map((summary) => (
            <div
              key={summary.employee.id}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3"
            >
              {/* Employee Top Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-brand-900 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {summary.employee.fullName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-950 text-sm">{summary.employee.fullName}</h4>
                    <p className="text-[11px] text-gray-500">{summary.employee.jobTitle} • {summary.employee.shiftType === 'morning' ? 'صباحي' : 'مسائي'}</p>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-base font-black text-brand-950">{summary.actualHours}</span>
                  <span className="text-[10px] text-gray-400 block">ساعة فعلية</span>
                </div>
              </div>

              {/* Progress Bar of Target */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                  <span className="text-gray-500">نسبة استيفاء الدوام</span>
                  <span className="text-brand-900 font-bold">{summary.actualHours} / {summary.targetHours} س ({summary.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${summary.percentage >= 90
                        ? 'bg-emerald-500'
                        : summary.percentage >= 70
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    style={{ width: `${Math.min(100, summary.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Attendance & Financial Badges */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded-lg font-bold">
                  <span>حضور</span>
                  <p className="text-xs">{summary.presentDays} يوم</p>
                </div>
                <div className="bg-amber-50 text-amber-800 p-1.5 rounded-lg font-bold">
                  <span>تأخر</span>
                  <p className="text-xs">{summary.lateDays} يوم</p>
                </div>
                <div className="bg-rose-50 text-rose-800 p-1.5 rounded-lg font-bold">
                  <span>غياب</span>
                  <p className="text-xs">{summary.absentDays} يوم</p>
                </div>
                <div className="bg-brand-50 text-brand-900 p-1.5 rounded-lg font-bold">
                  <span>إضافي</span>
                  <p className="text-xs">+{summary.totalOtHours} س</p>
                </div>
              </div>

              {/* Action Buttons (One-Touch Actions) */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100">
                <button
                  onClick={() => {
                    setSelectedEmployee(summary.employee);
                    setModalMode('overtime');
                  }}
                  className="flex items-center justify-center gap-1 py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition border border-emerald-200/60"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>إضافي</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedEmployee(summary.employee);
                    setModalMode('late_penalty');
                  }}
                  className="flex items-center justify-center gap-1 py-2 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs transition border border-rose-200/60"
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>خصم تأخير</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedEmployee(summary.employee);
                    setModalMode('details');
                  }}
                  className="flex items-center justify-center gap-1 py-2 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs transition border border-gray-200/60"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>الأيام</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP TABLE: Rich Table View (>= md screens) */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold">
              <tr>
                <th className="p-3.5">الموظف</th>
                <th className="p-3.5 text-center">الوردية</th>
                <th className="p-3.5 text-center">الساعات المنجزة</th>
                <th className="p-3.5 text-center">نسبة الإنجاز</th>
                <th className="p-3.5 text-center">حضور / تأخير / غياب</th>
                <th className="p-3.5 text-center">الساعات الإضافية</th>
                <th className="p-3.5 text-center">الخصومات المسجلة</th>
                <th className="p-3.5 text-center">إجراءات التحكم الفوري</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <LoadingState
                      message="جارٍ تحميل واحتساب ساعات العمل الشهرية..."
                      subMessage="مزامنة الإضافي والخصومات من قاعدة البيانات"
                      variant="card"
                    />
                  </td>
                </tr>
              ) : employeeSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    لا توجد بيانات للموظفين في هذا الشهر.
                  </td>
                </tr>
              ) : (
                employeeSummaries.map((summary) => (
                  <tr key={summary.employee.id} className="hover:bg-brand-50/20 transition">
                    {/* Employee Info */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-brand-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {summary.employee.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-brand-950">{summary.employee.fullName}</p>
                          <p className="text-[11px] text-gray-500">{summary.employee.jobTitle}</p>
                        </div>
                      </div>
                    </td>

                    {/* Shift */}
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700">
                        {summary.employee.shiftType === 'morning' ? 'صباحي' : 'مسائي'}
                      </span>
                    </td>

                    {/* Actual Hours */}
                    <td className="p-3.5 text-center">
                      <span className="font-black text-brand-950 text-base">{summary.actualHours}</span>
                      <span className="text-gray-400 text-xs"> / {summary.targetHours} س</span>
                    </td>

                    {/* Percentage Progress */}
                    <td className="p-3.5 text-center w-36">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-700">{summary.percentage}%</span>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${summary.percentage >= 90
                                ? 'bg-emerald-500'
                                : summary.percentage >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            style={{ width: `${Math.min(100, summary.percentage)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Attendance breakdown */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700" title="أيام الحضور">
                          {summary.presentDays} ح
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700" title="أيام التأخير">
                          {summary.lateDays} ت
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700" title="أيام الغياب">
                          {summary.absentDays} غ
                        </span>
                      </div>
                    </td>

                    {/* Overtime */}
                    <td className="p-3.5 text-center">
                      {summary.totalOtHours > 0 ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                          +{summary.totalOtHours} س ({summary.totalOtAmount} {settings?.globalCurrency || 'ر.س'})
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Deductions */}
                    <td className="p-3.5 text-center">
                      {summary.totalDeductions > 0 ? (
                        <span className="font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg">
                          -{summary.totalDeductions} {settings?.globalCurrency || 'ر.س'}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedEmployee(summary.employee);
                            setModalMode('overtime');
                          }}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition border border-emerald-200"
                          title="إضافة ساعات إضافية يدوياً"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEmployee(summary.employee);
                            setModalMode('late_penalty');
                          }}
                          className="p-1.5 text-rose-700 hover:bg-rose-50 rounded-lg transition border border-rose-200"
                          title="إضافة خصم تأخير أو جزاء يدوياً"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEmployee(summary.employee);
                            setModalMode('details');
                          }}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition border border-gray-200"
                          title="عرض سجل البصمات اليومية للشهر"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Action Modal */}
      <QuickManualModal
        isOpen={modalMode !== null}
        mode={modalMode || 'overtime'}
        employee={selectedEmployee}
        selectedMonth={selectedMonth}
        monthAttendance={attendance}
        onClose={() => {
          setModalMode(null);
          setSelectedEmployee(null);
        }}
        onSuccess={fetchData}
      />
    </div>
  );
};
