import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { formatCurrency } from '../../utils/currency';
import type { EmployeeFinancialTransaction, FinancialTransactionType, EmployeeDocument } from '../../types';
import { 
  WalletCards, Plus, Edit3, Trash2, Search, Calendar, 
  Filter, X, ShieldAlert, CheckCircle2, AlertCircle
} from 'lucide-react';

export const FinancialTransactions: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const { settings } = useSettings();
  const currencySymbol = settings?.globalCurrency ?? settings?.currency ?? '₪';

  const canView = hasPermission('employee-financial-transactions.view');
  const canCreate = hasPermission('employee-financial-transactions.create');
  const canEdit = hasPermission('employee-financial-transactions.edit');
  const canDelete = hasPermission('employee-financial-transactions.delete');

  const [transactions, setTransactions] = useState<EmployeeFinancialTransaction[]>([]);
  const [types, setTypes] = useState<FinancialTransactionType[]>([]);
  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [cycles, setCycles] = useState<any[]>([]); // To track locked cycles

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<EmployeeFinancialTransaction | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    typeId: '',
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [deleteTarget, setDeleteTarget] = useState<EmployeeFinancialTransaction | null>(null);

  const loadData = async () => {
    try {
      const [trans, trTypes, emps, cycs] = await Promise.all([
        dbService.getFinancialTransactions(),
        dbService.getFinancialTransactionTypes(),
        dbService.getEmployees(),
        dbService.getSalaryCycles()
      ]);
      setTransactions(trans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setTypes(trTypes);
      setEmployees(emps.filter(e => e.status === 'active'));
      setCycles(cycs);
    } catch (error) {
      console.error('Failed to load financial transactions data', error);
    }
  };

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [canView]);

  const handleOpenModal = (transaction?: EmployeeFinancialTransaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        employeeId: transaction.employeeId,
        typeId: transaction.typeId,
        title: transaction.title,
        amount: transaction.amount.toString(),
        date: transaction.date,
        notes: transaction.notes || ''
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        employeeId: '',
        typeId: '',
        title: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.typeId || !formData.amount || !formData.date || !formData.title) {
      alert('يرجى تعبئة الحقول المطلوبة');
      return;
    }

    const employee = employees.find(emp => emp.id === formData.employeeId);
    const type = types.find(t => t.id === formData.typeId);

    if (!employee || !type) return;

    const [year, month] = formData.date.split('-');
    const monthCycle = `${year}-${month}`;

    try {
      if (editingTransaction) {
        await dbService.updateFinancialTransaction(editingTransaction.id, {
          employeeId: formData.employeeId,
          employeeName: employee.fullName,
          typeId: formData.typeId,
          typeName: type.name,
          category: type.category,
          title: formData.title,
          amount: Number(formData.amount),
          date: formData.date,
          monthCycle: monthCycle,
          source: 'manual', // Convert to manual upon edit so it doesn't get wiped by salary regeneration
          notes: formData.notes,
        });
      } else {
        const newTransaction: EmployeeFinancialTransaction = {
          id: `ft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          employeeId: formData.employeeId,
          employeeName: employee.fullName,
          typeId: formData.typeId,
          typeName: type.name,
          category: type.category,
          title: formData.title,
          amount: Number(formData.amount),
          date: formData.date,
          monthCycle: monthCycle,
          source: 'manual',
          status: 'pending',
          notes: formData.notes,
          addedBy: user?.fullName || 'System',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await dbService.addFinancialTransaction(newTransaction);
      }
      handleCloseModal();
      loadData();
    } catch (error) {
      alert('حدث خطأ أثناء حفظ الحركة المالية');
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.deleteFinancialTransaction(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (error) {
      alert('حدث خطأ أثناء حذف الحركة المالية');
      console.error(error);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = filterMonth ? t.monthCycle === filterMonth : true;
    const matchesType = filterType !== 'all' ? t.typeId === filterType : true;
    const matchesEmployee = filterEmployee !== 'all' ? t.employeeId === filterEmployee : true;

    return matchesSearch && matchesMonth && matchesType && matchesEmployee;
  });

  const isTransactionLocked = (trans: EmployeeFinancialTransaction) => {
    const cycle = cycles.find(c => c.id === trans.monthCycle);
    if (cycle && (cycle.status === 'approved' || cycle.status === 'paid' || cycle.status === 'closed')) {
      return true;
    }
    return false;
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-brand-100">
        <ShieldAlert size={64} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">صلاحية غير متوفرة</h2>
        <p className="text-sm text-gray-500 mt-2">عذراً، ليس لديك صلاحية للوصول إلى الحركات المالية.</p>
      </div>
    );
  }

  // Generate month options
  const monthOptions = Array.from(new Set(transactions.map(t => t.monthCycle)))
    .sort((a, b) => b.localeCompare(a));
  
  if (!monthOptions.includes(filterMonth)) {
    monthOptions.unshift(filterMonth);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <WalletCards className="text-brand-600" />
            الحركات المالية للموظفين
          </h1>
          <p className="text-xs text-gray-400 mt-1">إدارة المكافآت، الخصومات، السلف والتسويات المالية بشكل يومي وتراكمي.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="px-5 py-2.5 bg-gradient-to-l from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة حركة مالية جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث باسم الموظف أو عنوان الحركة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="relative min-w-[140px]">
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full pr-9 pl-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none appearance-none"
            >
              <option value="">كل الأشهر</option>
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[140px]">
            <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pr-9 pl-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none appearance-none"
            >
              <option value="all">كل الأنواع</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[150px]">
            <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full pr-9 pl-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none appearance-none"
            >
              <option value="all">كل الموظفين</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <WalletCards size={48} className="mx-auto text-gray-300 animate-pulse" />
            <h3 className="font-bold text-gray-700 text-sm">لا توجد حركات مالية</h3>
            <p className="text-xs text-gray-400">لم يتم العثور على حركات مالية مطابقة للبحث أو الفلاتر المحددة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-brand-50/50 border-b border-brand-100 text-xs font-bold text-gray-500">
                  <th className="p-4.5">الموظف</th>
                  <th className="p-4.5">تاريخ الحركة</th>
                  <th className="p-4.5">نوع الحركة والتفاصيل</th>
                  <th className="p-4.5">المبلغ</th>
                  <th className="p-4.5 text-center">المصدر والحالة</th>
                  <th className="p-4.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50 text-xs">
                {filteredTransactions.map(trans => (
                  <tr key={trans.id} className="hover:bg-brand-50/20 transition-all">
                    <td className="p-4.5 font-bold text-gray-800">
                      {trans.employeeName}
                    </td>
                    <td className="p-4.5 text-gray-600 font-medium">
                      {new Date(trans.date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="p-4.5">
                      <span className="font-bold text-gray-800 block">{trans.title}</span>
                      <span className="text-[10px] text-gray-500 block">{trans.typeName}</span>
                      {trans.notes && <span className="text-[10px] text-gray-400 mt-1 block truncate max-w-xs">{trans.notes}</span>}
                    </td>
                    <td className="p-4.5">
                      <span className={`font-black text-sm ${trans.category === 'BONUS' ? 'text-green-600' : 'text-red-600'}`}>
                        {trans.category === 'BONUS' ? '+' : '-'}{formatCurrency(trans.amount, currencySymbol)}
                      </span>
                    </td>
                    <td className="p-4.5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {trans.source === 'system' ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">نظام تلقائي</span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">إدخال يدوي</span>
                        )}
                        
                        {trans.status === 'applied' ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <CheckCircle2 size={12} /> معتمدة براتب
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                            <AlertCircle size={12} /> قيد الانتظار
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4.5">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && (
                          <button
                            onClick={() => handleOpenModal(trans)}
                            disabled={isTransactionLocked(trans)}
                            className={`p-2 rounded-lg border transition-all ${
                              isTransactionLocked(trans)
                              ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' 
                              : 'bg-brand-50 hover:bg-brand-100 text-brand-700 border-brand-100 cursor-pointer'
                            }`}
                            title={isTransactionLocked(trans) ? "لا يمكن تعديل حركة تابعة لكشف رواتب معتمد أو مقفل" : "تعديل الحركة"}
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(trans)}
                            disabled={isTransactionLocked(trans)}
                            className={`p-2 rounded-lg border transition-all ${
                              isTransactionLocked(trans)
                              ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                              : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-100 cursor-pointer'
                            }`}
                            title={isTransactionLocked(trans) ? "لا يمكن حذف حركة تابعة لكشف رواتب معتمد أو مقفل" : "حذف الحركة"}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-brand-100 overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">
                {editingTransaction ? 'تعديل الحركة المالية' : 'إضافة حركة مالية جديدة'}
              </h2>
              <button onClick={handleCloseModal} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">الموظف <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                  disabled={!!editingTransaction}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-60"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.fullName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">نوع الحركة <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.typeId}
                    onChange={(e) => {
                      const t = types.find(type => type.id === e.target.value);
                      setFormData({
                        ...formData, 
                        typeId: e.target.value,
                        title: t ? t.name : formData.title
                      });
                    }}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="">اختر النوع...</option>
                    {types.filter(t => !t.isSystem || t.name === 'تسوية راتب').map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category === 'BONUS' ? 'إضافة' : 'خصم'})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">تاريخ الحركة <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">عنوان الحركة (يظهر في الكشف) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: سلفة نقدية مستعجلة"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">المبلغ ({currencySymbol}) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">ملاحظات إضافية (اختياري)</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-100">
                <button 
                  type="button" 
                  onClick={handleCloseModal} 
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-brand-600 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  حفظ الحركة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="تأكيد حذف الحركة المالية"
        description={`هل أنت متأكد من حذف الحركة: "${deleteTarget?.title}" بقيمة ${formatCurrency(deleteTarget?.amount || 0, currencySymbol)} للموظف ${deleteTarget?.employeeName}؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="تأكيد الحذف"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default FinancialTransactions;
