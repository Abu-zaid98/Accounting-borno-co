import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../../services/db';
import { useSettings } from '../../context/SettingsContext';
import type { EmployeeDocument, SalaryCycleDocument, SalaryRecordDocument, OvertimeDocument } from '../../types';
import { useReactToPrint } from 'react-to-print';
import { formatCurrency } from '../../utils/currency';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import {
  Wallet, Plus, CheckCircle, Printer, Calendar,
  Edit3, X, FileText, Gift, Building, Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Salaries: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('salary.create');
  const canEdit = hasPermission('salary.edit');
  const canDelete = hasPermission('salary.delete');
  const canApprove = hasPermission('salary.approve');
  const canPay = hasPermission('salary.pay');

  const [cycles, setCycles] = useState<SalaryCycleDocument[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [records, setRecords] = useState<SalaryRecordDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeDocument[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryRecordDocument | null>(null);
  const [viewingPayslip, setViewingPayslip] = useState<SalaryRecordDocument | null>(null);
  const [generateConfirm, setGenerateConfirm] = useState<{ month: number; year: number; cycleId: string; isReplacement?: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalaryRecordDocument | null>(null);
  const [paidConfirmOpen, setPaidConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [deleteCycleConfirm, setDeleteCycleConfirm] = useState(false);

  const { settings } = useSettings();
  const currencySymbol = settings?.globalCurrency ?? settings?.currency ?? '₪';

  // Edit Form States
  const [manualBonuses, setManualBonuses] = useState<number>(0);
  const [manualDeductions, setManualDeductions] = useState<number>(0);

  // Print Ref
  const printComponentRef = useRef<HTMLDivElement>(null);

  const fetchBaseData = async () => {
    try {
      const cycs = await dbService.getSalaryCycles();
      const emps = await dbService.getEmployees();
      const ovs = await dbService.getOvertimeRecords();

      setCycles(cycs);
      setEmployees(emps);
      setOvertimes(ovs);

      if (cycs.length > 0 && !selectedCycleId) {
        setSelectedCycleId(cycs[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRecords = async () => {
    if (!selectedCycleId) return;
    try {
      const recs = await dbService.getSalaryRecords(selectedCycleId);
      setRecords(recs);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [selectedCycleId]);

  // Generate new Salary Cycle
  const requestGenerateCycle = () => {
    const month = new Date().getMonth() + 1; // 1-indexed
    const year = new Date().getFullYear();
    const cycleId = `${year}-${String(month).padStart(2, '0')}`;

    const existingCycle = cycles.find(c => c.id === cycleId);
    if (existingCycle) {
      if (existingCycle.status === 'approved' || existingCycle.status === 'paid' || existingCycle.status === 'closed') {
        alert("⚠️ لا يمكن إعادة توليد الكشف لأن كشف هذا الشهر تم اعتماده أو قفله.");
        return;
      } else {
        // It's a draft, prompt to replace
        setGenerateConfirm({ month, year, cycleId, isReplacement: true });
        return;
      }
    }

    setGenerateConfirm({ month, year, cycleId, isReplacement: false });
  };

  const handleGenerateCycle = async () => {
    if (!generateConfirm) return;
    const { month, year, cycleId } = generateConfirm;
    setIsProcessing(true);
    try {
      // 1. Create Cycle Doc
      const newCycle: SalaryCycleDocument = {
        id: cycleId,
        month,
        year,
        status: 'draft',
        processedBy: "أحمد مراد - المحاسب المالي",
        processedAt: new Date().toISOString()
      };

      // 2. Generate Records for all active employees
      const activeEmps = employees.filter(e => e.status === 'active');
      const salaryRecords: SalaryRecordDocument[] = [];

      for (const emp of activeEmps) {
        // Calculate total overtime hours and amount in this month
        const empOvs = overtimes.filter(o => o.employeeId === emp.id && o.date.startsWith(cycleId));
        const totalOvsHours = empOvs.reduce((sum, o) => sum + o.hours, 0);
        const totalOvsAmount = empOvs.reduce((sum, o) => sum + o.totalAmount, 0);

        // Fetch absent count from attendance for this month
        const monthlyAttendance = await dbService.getAttendance();
        const absentCount = monthlyAttendance.filter(
          a => a.employeeId === emp.id && a.date.startsWith(cycleId) && a.status === 'absent'
        ).length;

        // Equation absent deduction
        const absentDeduction = Math.round((emp.basicSalary / 26) * absentCount);

        const netSal = emp.basicSalary + totalOvsAmount - absentDeduction;

        salaryRecords.push({
          id: `${cycleId}_${emp.id}`,
          cycleId,
          employeeId: emp.id,
          employeeNo: emp.employeeNo,
          employeeName: emp.fullName,
          jobTitle: emp.jobTitle,
          basicSalary: emp.basicSalary,
          overtimeHours: totalOvsHours,
          overtimeAmount: totalOvsAmount,
          bonuses: 0,
          deductions: absentDeduction,
          netSalary: netSal,
          status: 'unpaid',
          advances: 0
        });
      }

      if (generateConfirm.isReplacement) {
        await dbService.deleteSalaryCycle(cycleId);
      }
      await dbService.createSalaryCycle(newCycle, salaryRecords);
      setGenerateConfirm(null);
      await fetchBaseData();
      setSelectedCycleId(cycleId);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء معالجة كشف الرواتب.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditRecord = (rec: SalaryRecordDocument) => {
    setEditingRecord(rec);
    setManualBonuses(rec.bonuses);
    setManualDeductions(rec.deductions);
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRecord) return;

    const netSal = editingRecord.basicSalary + editingRecord.overtimeAmount + manualBonuses - manualDeductions;

    try {
      await dbService.updateSalaryRecord(editingRecord.id, {
        bonuses: manualBonuses,
        deductions: manualDeductions,
        netSalary: netSal
      });
      setEditingRecord(null);
      await fetchRecords();
    } catch (error) {
      alert("حدث خطأ أثناء تحديث بيانات الراتب.");
    }
  };

  const handleDeleteSalaryRecord = async (rec: SalaryRecordDocument) => {
    setDeleteTarget(rec);
  };

  const confirmDeleteSalaryRecord = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.deleteSalaryRecord(deleteTarget.id);
      setDeleteTarget(null);
      await fetchRecords();
    } catch (error) {
      alert("حدث خطأ أثناء حذف سجل الراتب.");
    }
  };

  const handleMarkCyclePaid = async () => {
    if (!selectedCycleId) return;
    setPaidConfirmOpen(true);
  };

  const confirmMarkCyclePaid = async () => {
    if (!selectedCycleId) return;
    try {
      await dbService.updateSalaryCycleStatus(selectedCycleId, 'paid');
      setPaidConfirmOpen(false);
      await fetchBaseData();
      await fetchRecords();
    } catch (error) {
      alert("حدث خطأ أثناء صرف الرواتب.");
    }
  };

  const handleApproveCycle = async () => {
    if (!selectedCycleId) return;
    setApproveConfirmOpen(true);
  };

  const confirmApproveCycle = async () => {
    if (!selectedCycleId) return;
    try {
      await dbService.updateSalaryCycleStatus(selectedCycleId, 'approved');
      setApproveConfirmOpen(false);
      await fetchBaseData();
      await fetchRecords();
    } catch (error) {
      alert("حدث خطأ أثناء اعتماد الرواتب.");
    }
  };

  const confirmDeleteCycle = async () => {
    if (!selectedCycleId) return;
    try {
      await dbService.deleteSalaryCycle(selectedCycleId);
      setDeleteCycleConfirm(false);
      await fetchBaseData();
      setSelectedCycleId(cycles.length > 1 ? cycles.find(c => c.id !== selectedCycleId)?.id || '' : '');
    } catch (error: any) {
      alert(error.message || "حدث خطأ أثناء حذف الكشف.");
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printComponentRef,
    documentTitle: viewingPayslip ? `كشف_راتب_${viewingPayslip.employeeName}` : 'كشف_رواتب',
  });

  const activeCycle = cycles.find(c => c.id === selectedCycleId);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إداري ومحاسب كشوفات الرواتب</h1>
          <p className="text-xs text-gray-400 mt-1">توليد الكشف الشهري التلقائي، مراجعة المستحقات، ورفع الكشوفات للطباعة الرسمية.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Select active cycle */}
          {cycles.length > 0 && (
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
                <Calendar size={16} />
              </span>
              <select
                className="py-2.5 pr-10 pl-4 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer appearance-none"
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
              >
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>كشف رواتب شهر {c.id}</option>
                ))}
              </select>
            </div>
          )}

          {canCreate && (
            <button
              onClick={requestGenerateCycle}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-gradient-to-l from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Plus size={16} />
              <span>{isProcessing ? 'جاري المعالجة...' : 'توليد كشف الشهر الحالي'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Salary List & Audit Section */}
      {selectedCycleId ? (
        <div className="space-y-4 animate-fade-in">
          {/* Cycle State Header */}
          <div className="bg-white p-5 rounded-2xl border border-brand-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 font-bold block">حالة دورة الرواتب النشطة</span>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-gray-800">كشف رواتب ({selectedCycleId})</span>
                {activeCycle?.status === 'paid' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                    مدفوع ومقفل (Locked)
                  </span>
                ) : activeCycle?.status === 'approved' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    معتمد (Approved)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                    مسودة قيد المراجعة (Draft)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeCycle?.status === 'draft' && (
                <>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteCycleConfirm(true)}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Trash2 size={16} />
                      <span>حذف الكشف</span>
                    </button>
                  )}
                  {canApprove && (
                    <button
                      onClick={handleApproveCycle}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <CheckCircle size={16} />
                      <span>اعتماد الكشف</span>
                    </button>
                  )}
                </>
              )}
              {activeCycle?.status === 'approved' && canPay && (
                <button
                  onClick={handleMarkCyclePaid}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <CheckCircle size={16} />
                  <span>تسجيل كمدفوع (قفل نهائي)</span>
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-3xl border border-brand-100 shadow-xs overflow-hidden">
            {records.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Wallet size={48} className="mx-auto text-gray-300 animate-pulse" />
                <h3 className="font-bold text-gray-700 text-sm">كشف فارغ</h3>
                <p className="text-xs text-gray-400">لا توجد سجلات رواتب مضافة في مسار هذا الشهر بعد.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-brand-50/50 border-b border-brand-100 text-xs font-bold text-gray-500">
                      <th className="p-4.5">الموظف</th>
                      <th className="p-4.5">الراتب الأساسي</th>
                      <th className="p-4.5">الدوام الإضافي (ساعات/قيمة)</th>
                      <th className="p-4.5">المكافآت</th>
                      <th className="p-4.5">الخصومات (غياب/خصم)</th>
                      <th className="p-4.5">صافي الراتب المستحق</th>
                      <th className="p-4.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-50 text-xs">
                    {records.map(rec => (
                      <tr key={rec.id} className="hover:bg-brand-50/20 transition-all">
                        <td className="p-4.5 font-bold text-gray-800">
                          <div>
                            <span className="block">{rec.employeeName}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{rec.jobTitle} ({rec.employeeNo})</span>
                          </div>
                        </td>
                        <td className="p-4.5 font-semibold text-gray-700">{formatCurrency(rec.basicSalary, currencySymbol)}</td>
                        <td className="p-4.5">
                          <span className="font-bold text-brand-900 block">{rec.overtimeHours} ساعة</span>
                          <span className="text-[10px] text-emerald-600 block mt-0.5">+{formatCurrency(rec.overtimeAmount, currencySymbol)}</span>
                        </td>
                        <td className="p-4.5 font-bold text-green-700">+{formatCurrency(rec.bonuses, currencySymbol)}</td>
                        <td className="p-4.5 font-bold text-red-600">-{formatCurrency(rec.deductions, currencySymbol)}</td>
                        <td className="p-4.5 font-black text-sm text-brand-950 bg-brand-50/10">
                          {formatCurrency(rec.netSalary, currencySymbol)}
                        </td>
                        <td className="p-4.5">
                          <div className="flex items-center justify-center gap-2">
                            {activeCycle?.status === 'draft' && (
                              <>
                                {canEdit && (
                                  <button
                                    onClick={() => handleOpenEditRecord(rec)}
                                    className="p-2 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg border border-brand-100 cursor-pointer"
                                    title="تعديل المكافآت والخصومات"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteSalaryRecord(rec)}
                                    className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 cursor-pointer"
                                    title="حذف سجل الراتب"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => setViewingPayslip(rec)}
                              className="p-2 bg-gold-50 hover:bg-gold-100 text-gold-700 rounded-lg border border-gold-200 cursor-pointer"
                              title="كشف الراتب الفردي A4"
                            >
                              <FileText size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-16 rounded-3xl border border-brand-100 shadow-xs text-center space-y-4">
          <Wallet size={56} className="mx-auto text-brand-300 animate-bounce" />
          <div className="space-y-1.5">
            <h3 className="font-bold text-gray-700 text-sm">لم يتم إنشاء أي دورة رواتب بعد</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">توليد الكشف الشهري يجمع بيانات موظفي المحل وحضورهم والعمل الإضافي دفعة واحدة وبدقة محاسبية مطلقة.</p>
          </div>
          <button
            onClick={requestGenerateCycle}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer"
          >
            توليد كشف رواتب فوراً
          </button>
        </div>
      )}

      {/* Popup 1: Edit Record (Bonuses & Deductions) */}
      {editingRecord && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-brand-100 overflow-hidden animate-scale-in max-h-[90svh] flex flex-col">
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">تعديل رواتب: {editingRecord.employeeName}</h2>
              <button onClick={() => setEditingRecord(null)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500">الراتب الأساسي</label>
                  <p className="text-sm font-bold text-gray-800">{formatCurrency(editingRecord.basicSalary, currencySymbol)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500">قيمة الإضافي المستحقة</label>
                  <p className="text-sm font-bold text-emerald-600">+{formatCurrency(editingRecord.overtimeAmount, currencySymbol)}</p>
                </div>
              </div>

              {/* Edit Bonuses */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">المكافآت الإضافية والعمولات ({currencySymbol})</label>
                <input
                  type="number"
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                  value={manualBonuses}
                  onChange={(e) => setManualBonuses(Number(e.target.value))}
                />
              </div>

              {/* Edit Deductions */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">الخصومات المباشرة والعقوبات ({currencySymbol})</label>
                <input
                  type="number"
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                  value={manualDeductions}
                  onChange={(e) => setManualDeductions(Number(e.target.value))}
                />
              </div>

              {/* Live Preview */}
              <div className="p-4 bg-brand-50 border border-brand-100 rounded-2xl text-xs text-brand-900 space-y-1">
                <span className="font-bold text-brand-950 block">الصافي المتوقع للراتب:</span>
                <p className="text-lg font-black text-brand-700">
                  {formatCurrency(editingRecord.basicSalary + editingRecord.overtimeAmount + manualBonuses - manualDeductions, currencySymbol)}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-100">
                <button onClick={() => setEditingRecord(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer">إلغاء</button>
                <button onClick={handleSaveEditedRecord} className="px-5 py-2 bg-brand-600 text-white rounded-xl font-bold text-xs cursor-pointer">حفظ التغييرات</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup 2: A4 Printable payslip template */}
      {viewingPayslip && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-brand-100 overflow-hidden flex flex-col max-h-[90svh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50 no-print">
              <h2 className="font-bold text-gray-800 text-sm">معاينة كشف الراتب الرسمي A4 جاهز للطباعة</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Printer size={14} />
                  <span>طباعة ورقية / حفظ PDF</span>
                </button>
                <button
                  onClick={() => setViewingPayslip(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* A4 Payslip Paper area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-gray-100/50 scrollbar-thin">
              <div
                ref={printComponentRef}
                className="bg-white mx-auto shadow-sm p-8 max-w-[21cm] min-h-[29.7cm] border border-gray-300 rounded-sm font-sans text-xs leading-relaxed text-gray-900"
                style={{ direction: 'rtl' }}
              >
                {/* Payslip Header */}
                <div className="flex items-center justify-between border-b-2 border-brand-900 pb-6 mb-8">
                  <div className="space-y-1.5">
                    <h1 className="text-xl font-extrabold text-brand-950 tracking-wide">البورنو لخدمات تغليف الهدايا والزهور</h1>
                    <p className="text-gray-500 font-medium text-[10px]">قسم الموارد البشرية والشؤون المالية</p>
                    <span className="inline-block text-[9px] text-gray-400">غزة - شارع الشهداء - مقابل برج فلسطين</span>
                  </div>
                  <div className="text-left space-y-1">
                    <div className="w-12 h-12 rounded-xl bg-brand-950 text-white flex items-center justify-center font-bold text-lg mx-auto shadow-md">
                      <Gift size={26} />
                    </div>
                    <span className="text-[10px] font-bold text-brand-950 tracking-widest block text-center mt-1">البورنو</span>
                  </div>
                </div>

                <h2 className="text-center font-black text-sm text-gray-800 border py-2 bg-brand-50/50 border-brand-100 rounded-lg mb-8 uppercase tracking-wider">
                  كشف راتب موظف تفصيلي لشهر ({viewingPayslip.cycleId})
                </h2>

                {/* Employee details grid */}
                <div className="grid grid-cols-2 gap-y-4 border p-5 rounded-2xl border-gray-200 mb-8 bg-gray-50/40">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">اسم الموظف المستفيد:</span>
                    <span className="font-bold text-gray-800 text-sm">{viewingPayslip.employeeName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">الرقم الوظيفي:</span>
                    <span className="font-bold text-gray-800 text-sm">{viewingPayslip.employeeNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">المسمى الوظيفي:</span>
                    <span className="font-bold text-gray-800 text-sm">{viewingPayslip.jobTitle}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">تاريخ إصدار الكشف:</span>
                    <span className="font-bold text-gray-800 text-sm">{new Date().toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>

                {/* Salary details table */}
                <div className="space-y-4 mb-10">
                  <h3 className="font-bold text-gray-800 text-xs border-r-4 border-gold-500 pr-2">تفاصيل المفردات والأجور الموزعة</h3>
                  <table className="w-full text-right border-collapse text-xs border">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300 font-bold text-gray-700">
                        <th className="p-3">المكون المحاسبي</th>
                        <th className="p-3">التفاصيل والتبرير</th>
                        <th className="p-3 text-left">المبلغ المستحق ({currencySymbol})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="p-3 font-bold text-gray-800">الراتب الأساسي للشهر</td>
                        <td className="p-3 text-gray-500">الأجر الشهري المتفق عليه في العقد الرسمي</td>
                        <td className="p-3 text-left font-semibold text-gray-700">{formatCurrency(viewingPayslip.basicSalary, currencySymbol)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-gray-800">أجور الساعات الإضافية</td>
                        <td className="p-3 text-gray-500">إجمالي {viewingPayslip.overtimeHours} ساعة دوام إضافي معتمد</td>
                        <td className="p-3 text-left font-semibold text-green-700">+{formatCurrency(viewingPayslip.overtimeAmount, currencySymbol)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-gray-800">المكافآت والعمولات</td>
                        <td className="p-3 text-gray-500">حوافز إنتاجية وتعديلات يدوية مالية</td>
                        <td className="p-3 text-left font-semibold text-green-700">+{formatCurrency(viewingPayslip.bonuses, currencySymbol)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-gray-800 text-red-700">الاستقطاعات والخصومات</td>
                        <td className="p-3 text-gray-500">أيام الغياب أو العقوبات أو الخصم المالي المباشر</td>
                        <td className="p-3 text-left font-semibold text-red-600">-{formatCurrency(viewingPayslip.deductions, currencySymbol)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Final Net Salary display */}
                <div className="flex justify-end mb-12">
                  <div className="w-1/2 p-5 bg-brand-950 text-white rounded-2xl flex items-center justify-between shadow-md">
                    <div>
                      <span className="text-[10px] text-brand-300 font-bold block">صافي الراتب المستحق النهائي</span>
                      <span className="text-[9px] text-brand-400 block mt-0.5">(شامل الإضافي والمكافآت بعد الخصم)</span>
                    </div>
                    <span className="text-xl font-black text-gold-300">{formatCurrency(viewingPayslip.netSalary, currencySymbol)}</span>
                  </div>
                </div>

                {/* Bank / Transfer note */}
                <div className="p-4 bg-gold-50/50 border border-gold-100 rounded-xl mb-12 flex items-center gap-3">
                  <Building size={16} className="text-gold-700" />
                  <p className="text-[10px] text-gold-900 leading-relaxed">
                    <strong>تنويه محاسبي:</strong> يتم تحويل هذا الراتب تلقائياً لحساب الموظف البنكي المعتمد المسجل في ملفه الشخصي بحلول نهاية الدورة المالية الجارية.
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 text-center mt-12 pt-8 border-t border-dashed border-gray-300">
                  <div className="space-y-4">
                    <span className="font-bold text-gray-600 block text-[10px]">توقيع المشرف المالي / المحاسب</span>
                    <div className="h-10"></div>
                    <span className="text-gray-400 text-[10px] block">أحمد مراد - المحاسب</span>
                  </div>
                  <div className="space-y-4">
                    <span className="font-bold text-gray-600 block text-[10px]">توقيع الموظف المستفيد</span>
                    <div className="h-10"></div>
                    <span className="text-gray-400 text-[10px] block">أقر باستلام المستحقات الجارية</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={Boolean(generateConfirm)}
        title={generateConfirm?.isReplacement ? "تأكيد تحديث الكشف المبدئي" : "تأكيد توليد كشف الرواتب"}
        description={generateConfirm?.isReplacement ? `سيتم إلغاء المسودة الحالية لشهر (${generateConfirm?.month} - ${generateConfirm?.year}) وإعادة حساب الكشف بالكامل لتضمين أحدث تعديلات الحضور والغياب.` : `سيتم توليد كشف رواتب تلقائي لشهر (${generateConfirm?.month} - ${generateConfirm?.year}) لجميع الموظفين النشطين.`}
        confirmText={generateConfirm?.isReplacement ? "إعادة الحساب والتحديث" : "توليد الكشف"}
        cancelText="إلغاء"
        variant="info"
        onConfirm={handleGenerateCycle}
        onCancel={() => setGenerateConfirm(null)}
      />
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="تأكيد حذف سجل الراتب"
        description={`سيتم حذف سجل الراتب للموظف "${deleteTarget?.employeeName ?? ''}".`}
        confirmText="حذف السجل"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={confirmDeleteSalaryRecord}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        isOpen={approveConfirmOpen}
        title="تأكيد اعتماد كشف الرواتب"
        description="سيتم اعتماد الكشف، ولن تتمكن من تعديل السجلات أو حذفها أو إعادة الحساب التلقائي بعد الاعتماد."
        confirmText="اعتماد (Approve)"
        cancelText="إلغاء"
        variant="info"
        onConfirm={confirmApproveCycle}
        onCancel={() => setApproveConfirmOpen(false)}
      />
      <ConfirmModal
        isOpen={paidConfirmOpen}
        title="تأكيد صرف كشف الرواتب"
        description="سيتم صرف الكشف وتحويل حالته إلى مدفوع نهائياً."
        confirmText="صرف نهائي (Locked)"
        cancelText="إلغاء"
        variant="warning"
        onConfirm={confirmMarkCyclePaid}
        onCancel={() => setPaidConfirmOpen(false)}
      />
      <ConfirmModal
        isOpen={deleteCycleConfirm}
        title="تأكيد حذف كشف الرواتب بالكامل"
        description="سيتم حذف الكشف وجميع السجلات المتعلقة به. هذا الإجراء لا يمكن التراجع عنه."
        confirmText="حذف الكشف"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={confirmDeleteCycle}
        onCancel={() => setDeleteCycleConfirm(false)}
      />
    </div>
  );
};
export default Salaries;
