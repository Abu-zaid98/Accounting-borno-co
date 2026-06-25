import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/db';
import type { EmployeeDocument, AttendanceDocument, OvertimeDocument, SalaryRecordDocument } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import {
  Printer, FileSpreadsheet, Search, Calendar
} from 'lucide-react';

type ReportType = 'employees' | 'salaries' | 'attendance' | 'overtime' | 'financial_statement';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('employees');
  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDocument[]>([]);
  const [overtime, setOvertime] = useState<OvertimeDocument[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecordDocument[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<import('../../types').EmployeeFinancialTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('2026-05'); // YYYY-MM default
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const { settings } = useSettings();
  const currency = settings?.globalCurrency ?? settings?.currency ?? 'شيكل';

  const fetchData = async () => {
    setLoading(true);
    try {
      const emps = await dbService.getEmployees();
      const atts = await dbService.getAttendance();
      const ovs = await dbService.getOvertimeRecords();
      const cycles = await dbService.getSalaryCycles();
      const trans = await dbService.getFinancialTransactions();

      setEmployees(emps);
      setAttendance(atts);
      setOvertime(ovs);
      setFinancialTransactions(trans);

      // Fetch all records for all cycles to aggregate if needed
      const allRecords: SalaryRecordDocument[] = [];
      for (const cyc of cycles) {
        const cycRecs = await dbService.getSalaryRecords(cyc.id);
        allRecords.push(...cycRecs);
      }
      setSalaryRecords(allRecords);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // CSV Exporter (Excel support)
  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM for Arabic support in Excel
    const filename = `تقرير_${reportType}_${selectedMonth}.csv`;

    if (reportType === 'employees') {
      csvContent += "الرقم الوظيفي,الاسم الكامل,الجوال,القسم,المسمى الوظيفي,الراتب الأساسي,تاريخ التوظيف,الحالة\n";
      employees.forEach(e => {
        csvContent += `${e.employeeNo},${e.fullName},${e.phone},${e.department},${e.jobTitle},${e.basicSalary},${e.hireDate},${e.status === 'active' ? 'نشط' : 'موقف'}\n`;
      });
    } else if (reportType === 'salaries') {
      csvContent += "الرقم الوظيفي,اسم الموظف,المسمى الوظيفي,الشهر,الراتب الأساسي,الإضافي,المكافآت,الخصومات,صافي الراتب\n";
      const recs = salaryRecords.filter(r => r.cycleId === selectedMonth);
      recs.forEach(r => {
        csvContent += `${r.employeeNo},${r.employeeName},${r.jobTitle},${r.cycleId},${r.basicSalary},${r.overtimeAmount},${r.bonuses},${r.deductions},${r.netSalary}\n`;
      });
    } else if (reportType === 'attendance') {
      csvContent += "الموظف,التاريخ,الحالة,ساعات العمل الفعلية\n";
      const atts = attendance.filter(a => a.date.startsWith(selectedMonth));
      atts.forEach(a => {
        csvContent += `${a.employeeName},${a.date},${a.status === 'present' ? 'حاضر' : a.status === 'late' ? 'متأخر' : 'غائب'},${a.workingHours}\n`;
      });
    } else if (reportType === 'overtime') {
      csvContent += "الموظف,التاريخ,الساعات,أجر الساعة,الإجمالي المستحق,السبب\n";
      const ovs = overtime.filter(o => o.date.startsWith(selectedMonth));
      ovs.forEach(o => {
        csvContent += `${o.employeeName},${o.date},${o.hours},${o.hourlyRate},${o.totalAmount},${o.reason}\n`;
      });
    } else if (reportType === 'financial_statement') {
      csvContent += "التاريخ,نوع الحركة,عنوان الحركة,المبلغ,الحالة,الشهر المالي\n";
      const trans = financialTransactions.filter(t => t.employeeId === selectedEmployeeId);
      trans.forEach(t => {
        const amountSign = t.category === 'BONUS' ? '+' : '-';
        csvContent += `${t.date},${t.typeName},${t.title},${amountSign}${t.amount},${t.status === 'applied' ? 'معتمدة' : 'قيد الانتظار'},${t.monthCycle}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header section (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">مركز التقارير المحاسبية والإدارية</h1>
          <p className="text-xs text-gray-400 mt-1">توليد وطباعة التقارير الرسمية لكافة نشاطات الموظفين والدوام والرواتب.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>تصدير Excel (CSV)</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
          >
            <Printer size={16} />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Control panel (Hidden on print) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-3xl border border-brand-100 shadow-xs no-print">
        {/* Report Type Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-600">اختر نوع التقرير المطلوبة</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button
              onClick={() => setReportType('employees')}
              className={`flex-1 py-2.5 text-[11px] font-bold text-center cursor-pointer transition-all
                ${reportType === 'employees' ? 'bg-brand-950 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
              `}
            >
              الموظفين
            </button>
            <button
              onClick={() => setReportType('salaries')}
              className={`flex-1 py-2.5 text-[11px] font-bold text-center cursor-pointer transition-all
                ${reportType === 'salaries' ? 'bg-brand-950 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
              `}
            >
              الرواتب
            </button>
            <button
              onClick={() => setReportType('attendance')}
              className={`flex-1 py-2.5 text-[11px] font-bold text-center cursor-pointer transition-all
                ${reportType === 'attendance' ? 'bg-brand-950 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
              `}
            >
              الدوام
            </button>
            <button
              onClick={() => setReportType('overtime')}
              className={`flex-1 py-2.5 text-[11px] font-bold text-center cursor-pointer transition-all
                ${reportType === 'overtime' ? 'bg-brand-950 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
              `}
            >
              الإضافي
            </button>
            <button
              onClick={() => setReportType('financial_statement')}
              className={`flex-1 py-2.5 text-[11px] font-bold text-center cursor-pointer transition-all border-r border-gray-200
                ${reportType === 'financial_statement' ? 'bg-brand-950 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
              `}
            >
              كشف حساب موظف
            </button>
          </div>
        </div>

        {/* Date / Month Picker */}
        {reportType !== 'employees' && reportType !== 'financial_statement' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600">اختر الشهر المحاسبي</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
                <Calendar size={16} />
              </span>
              <input
                type="month"
                className="w-full py-2.5 pr-10 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-hidden"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Employee Picker for Financial Statement */}
        {reportType === 'financial_statement' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600">اختر الموظف</label>
            <select
              className="w-full py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-hidden"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="">-- اختر الموظف --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        {reportType !== 'financial_statement' && (
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-xs font-bold text-gray-600">تصفية وبحث فوري</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="البحث باسم الموظف أو البيانات المذكورة..."
                className="w-full py-2.5 pr-10 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Printable Report Output Container */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-xs p-8 print:border-none print:shadow-none">

        {/* Report Header for Print Only */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-brand-950 pb-4 mb-6">
          <div>
            <h2 className="text-lg font-black text-brand-950">البورنو لتغليف الهدايا الراقية والزهور</h2>
            <p className="text-[10px] text-gray-400">قسم الموارد البشرية والرواتب</p>
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold block text-gray-800">التاريخ: {new Date().toLocaleDateString('ar-SA')}</span>
            <span className="text-[9px] text-gray-400">تقرير رسمي مصدق</span>
          </div>
        </div>

        {/* Report Title */}
        <div className="text-center mb-6">
          <h2 className="text-base font-extrabold text-gray-800">
            {reportType === 'employees' && 'تقرير الموظفين النشطين والمؤرشفين'}
            {reportType === 'salaries' && `تقرير كشف الرواتب لشهر (${selectedMonth})`}
            {reportType === 'attendance' && `تقرير حضور وغياب الموظفين لشهر (${selectedMonth})`}
            {reportType === 'overtime' && `تقرير الساعات الإضافية المعتمدة لشهر (${selectedMonth})`}
            {reportType === 'financial_statement' && selectedEmployeeId && `كشف حساب مالي للموظف: ${employees.find(e => e.id === selectedEmployeeId)?.fullName}`}
            {reportType === 'financial_statement' && !selectedEmployeeId && `كشف حساب مالي للموظف (يرجى تحديد الموظف)`}
          </h2>
          <span className="text-[10px] text-gray-400 block mt-1">البورنو لإدارة متاجر تغليف الهدايا</span>
        </div>

        {/* Report Content Table */}
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400">جاري تجميع البيانات وتوليد التقرير...</div>
        ) : (
          <div className="overflow-x-auto">
            {/* EMPLOYEES REPORT */}
            {reportType === 'employees' && (
              <table className="w-full text-right border-collapse text-xs border">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700">
                    <th className="p-3 border">الرقم الوظيفي</th>
                    <th className="p-3 border">اسم الموظف</th>
                    <th className="p-3 border">المسمى الوظيفي</th>
                    <th className="p-3 border">القسم المالي</th>
                    <th className="p-3 border">الراتب الأساسي</th>
                    <th className="p-3 border">تاريخ التوظيف</th>
                    <th className="p-3 border">حالة الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employees.filter(e => e.fullName.includes(searchTerm)).map(e => (
                    <tr key={e.id}>
                      <td className="p-3 border font-bold text-brand-900">{e.employeeNo}</td>
                      <td className="p-3 border font-semibold text-gray-800">{e.fullName}</td>
                      <td className="p-3 border text-gray-600">{e.jobTitle}</td>
                      <td className="p-3 border text-gray-500">{e.department}</td>
                      <td className="p-3 border font-bold text-emerald-700">{formatCurrency(e.basicSalary, currency)}</td>
                      <td className="p-3 border text-gray-500">{e.hireDate}</td>
                      <td className="p-3 border font-bold text-gray-600">{e.status === 'active' ? 'نشط' : 'موقف / مؤرشف'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* SALARIES REPORT */}
            {reportType === 'salaries' && (
              <table className="w-full text-right border-collapse text-xs border">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700">
                    <th className="p-3 border">الرقم الوظيفي</th>
                    <th className="p-3 border">اسم الموظف</th>
                    <th className="p-3 border">الراتب الأساسي</th>
                    <th className="p-3 border">الإضافي المستحق</th>
                    <th className="p-3 border">العمولات والمكافآت</th>
                    <th className="p-3 border">الاستقطاعات والخصم</th>
                    <th className="p-3 border">صافي الراتب المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salaryRecords.filter(r => r.cycleId === selectedMonth && r.employeeName.includes(searchTerm)).map(r => (
                    <tr key={r.id}>
                      <td className="p-3 border font-bold text-brand-900">{r.employeeNo}</td>
                      <td className="p-3 border font-semibold text-gray-800">{r.employeeName}</td>
                      <td className="p-3 border text-gray-600">{formatCurrency(r.basicSalary, currency)}</td>
                      <td className="p-3 border text-green-700 font-semibold">+{formatCurrency(r.overtimeAmount, currency)}</td>
                      <td className="p-3 border text-green-700 font-semibold">+{formatCurrency(r.bonuses, currency)}</td>
                      <td className="p-3 border text-red-600 font-semibold">-{formatCurrency(r.deductions, currency)}</td>
                      <td className="p-3 border font-black text-brand-950 bg-gray-50/50">{formatCurrency(r.netSalary, currency)}</td>
                    </tr>
                  ))}
                  {salaryRecords.filter(r => r.cycleId === selectedMonth).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-400">لا توجد سجلات رواتب معالجة لهذا الشهر بعد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* ATTENDANCE REPORT */}
            {reportType === 'attendance' && (
              <table className="w-full text-right border-collapse text-xs border">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700">
                    <th className="p-3 border">اسم الموظف</th>
                    <th className="p-3 border">التاريخ</th>
                    <th className="p-3 border">وقت الحضور</th>
                    <th className="p-3 border">وقت الانصراف</th>
                    <th className="p-3 border">ساعات الدوام اليومي</th>
                    <th className="p-3 border">الحالة الموثقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendance.filter(a => a.date.startsWith(selectedMonth) && a.employeeName.includes(searchTerm)).map(a => (
                    <tr key={a.id}>
                      <td className="p-3 border font-semibold text-gray-800">{a.employeeName}</td>
                      <td className="p-3 border text-gray-600">{a.date}</td>
                      <td className="p-3 border text-gray-500">
                        {a.status !== 'absent' ? new Date(a.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="p-3 border text-gray-500">
                        {a.checkOut ? new Date(a.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="p-3 border font-bold text-brand-950">{a.workingHours > 0 ? `${a.workingHours} ساعة` : '—'}</td>
                      <td className="p-3 border">
                        <span className={`font-bold
                          ${a.status === 'present' ? 'text-green-600' : a.status === 'late' ? 'text-amber-600' : 'text-red-600'}
                        `}>
                          {a.status === 'present' ? 'حاضر' : a.status === 'late' ? 'متأخر' : 'غائب'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {attendance.filter(a => a.date.startsWith(selectedMonth)).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400">لا توجد سجلات دوام مسجلة في هذا الشهر.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* OVERTIME REPORT */}
            {reportType === 'overtime' && (
              <table className="w-full text-right border-collapse text-xs border">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700">
                    <th className="p-3 border">الموظف</th>
                    <th className="p-3 border">التاريخ</th>
                    <th className="p-3 border">الساعات الإضافية</th>
                    <th className="p-3 border">سعر الساعة</th>
                    <th className="p-3 border">إجمالي المستحق</th>
                    <th className="p-3 border">سبب العمل الإضافي المعتمد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {overtime.filter(o => o.date.startsWith(selectedMonth) && o.employeeName.includes(searchTerm)).map(o => (
                    <tr key={o.id}>
                      <td className="p-3 border font-semibold text-gray-800">{o.employeeName}</td>
                      <td className="p-3 border text-gray-600">{o.date}</td>
                      <td className="p-3 border font-bold text-brand-950">{o.hours} ساعة إضافي</td>
                      <td className="p-3 border text-gray-500">{formatCurrency(o.hourlyRate, currency)}</td>
                      <td className="p-3 border font-bold text-emerald-700">{formatCurrency(o.totalAmount, currency)}</td>
                      <td className="p-3 border text-gray-500 font-medium max-w-xs truncate">{o.reason}</td>
                    </tr>
                  ))}
                  {overtime.filter(o => o.date.startsWith(selectedMonth)).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400">لا توجد سجلات ساعات إضافية في هذا الشهر.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* FINANCIAL STATEMENT REPORT */}
            {reportType === 'financial_statement' && (
              <table className="w-full text-right border-collapse text-xs border">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300 font-bold text-gray-700">
                    <th className="p-3 border">التاريخ</th>
                    <th className="p-3 border">نوع الحركة المالية</th>
                    <th className="p-3 border">التفاصيل / المبرر</th>
                    <th className="p-3 border">المبلغ</th>
                    <th className="p-3 border">الدورة المالية</th>
                    <th className="p-3 border">حالة الحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {financialTransactions
                    .filter(t => t.employeeId === selectedEmployeeId)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(t => (
                    <tr key={t.id}>
                      <td className="p-3 border text-gray-600">{new Date(t.date).toLocaleDateString('ar-SA')}</td>
                      <td className="p-3 border font-semibold text-gray-800">{t.typeName}</td>
                      <td className="p-3 border text-gray-600">{t.title}</td>
                      <td className="p-3 border font-bold text-left" dir="ltr">
                        <span className={t.category === 'BONUS' ? 'text-green-600' : 'text-red-600'}>
                          {t.category === 'BONUS' ? '+' : '-'}{formatCurrency(t.amount, currency)}
                        </span>
                      </td>
                      <td className="p-3 border text-gray-500 font-medium">{t.monthCycle}</td>
                      <td className="p-3 border font-bold text-brand-950">{t.status === 'applied' ? 'معتمدة ومقفلة' : 'قيد الانتظار'}</td>
                    </tr>
                  ))}
                  {(!selectedEmployeeId || financialTransactions.filter(t => t.employeeId === selectedEmployeeId).length === 0) && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400">
                        {selectedEmployeeId ? 'لا توجد حركات مالية مسجلة لهذا الموظف.' : 'يرجى اختيار الموظف لعرض كشف الحساب الخاص به.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {selectedEmployeeId && (
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                    <tr>
                      <td colSpan={3} className="p-4 border text-left text-gray-700">إجمالي الحركات (تراكمي)</td>
                      <td className="p-4 border text-left text-brand-950 font-black text-sm" dir="ltr">
                        {formatCurrency(
                          financialTransactions
                            .filter(t => t.employeeId === selectedEmployeeId)
                            .reduce((sum, t) => sum + (t.category === 'BONUS' ? t.amount : -t.amount), 0),
                          currency
                        )}
                      </td>
                      <td colSpan={2} className="p-4 border"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        )}

        {/* Signatures for Print Only */}
        <div className="hidden print:grid grid-cols-2 gap-8 text-center mt-12 pt-8 border-t border-dashed border-gray-300">
          <div>
            <span className="font-bold text-[10px] text-gray-600 block">إعداد وتدقيق المحاسب المالي</span>
            <div className="h-12"></div>
            <span className="text-gray-400 text-[10px] block">التوقيع</span>
          </div>
          <div>
            <span className="font-bold text-[10px] text-gray-600 block">اعتماد الإدارة والمدير العام</span>
            <div className="h-12"></div>
            <span className="text-gray-400 text-[10px] block">الختم والتوقيع الرسمي</span>
          </div>
        </div>

      </div>
    </div>
  );
};
export default Reports;
