import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/db';
import type { EmployeeDocument } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import {
  Users, Plus, Search, Filter, Edit, Trash2, Archive,
  X, Check, AlertCircle, Briefcase, QrCode
} from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { EmployeeQrModal } from '../../components/employees/EmployeeQrModal';
import { LoadingState } from '../../components/ui/LoadingState';

const employeeSchema = zod.object({
  fullName: zod.string().min(3, 'الاسم الكامل يجب أن لا يقل عن 3 أحرف'),
  phone: zod.string().regex(/^[0-9+ ]{9,15}$/, 'رقم الجوال غير صحيح'),
  address: zod.string().min(5, 'العنوان مطلوب بدقة'),
  jobTitle: zod.string().min(2, 'المسمى الوظيفي مطلوب'),
  department: zod.string().min(2, 'القسم مطلوب'),
  basicSalary: zod.number().min(1000, 'الراتب الأساسي يجب أن لا يقل عن 1000'),
  shiftType: zod.enum(['morning', 'evening']),
  shiftStartTime: zod.string().min(1, 'بداية الشفت مطلوبة'),
  shiftEndTime: zod.string().min(1, 'نهاية الشفت مطلوبة'),
  gracePeriodMinutes: zod.number().min(0),
  lateAfterMinutes: zod.number().min(0),
  absenceAfterMinutes: zod.number().min(0),
  hireDate: zod.string().min(1, 'تاريخ التوظيف مطلوب'),
  status: zod.enum(['active', 'suspended', 'archived']),
  idNumber: zod.string().regex(/^\d{7,15}$/, 'رقم الهوية غير صحيح').optional(),
  avatarUrl: zod.string().optional(),
});

type EmployeeFormFields = zod.infer<typeof employeeSchema>;

export const Employees: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('employees.create');
  const canEdit = hasPermission('employees.edit');
  const canDelete = hasPermission('employees.delete');

  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDocument | null>(null);
  const [selectedQrEmployee, setSelectedQrEmployee] = useState<EmployeeDocument | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<EmployeeDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocument | null>(null);
  const { settings } = useSettings();
  const currency = settings?.globalCurrency ?? settings?.currency ?? '₪';

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormFields>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      address: '',
      jobTitle: '',
      department: '',
      basicSalary: 4000,
      shiftType: settings?.shiftType ?? 'morning',
      shiftStartTime: settings?.workStartTime ?? '08:00',
      shiftEndTime: settings?.workEndTime ?? '16:00',
      gracePeriodMinutes: settings?.gracePeriodMinutes ?? 10,
      lateAfterMinutes: settings?.lateRule?.afterMinutes ?? 10,
      absenceAfterMinutes: settings?.absenceRule?.afterMinutes ?? 240,
      hireDate: new Date().toISOString().split('T')[0],
      status: 'active',
      avatarUrl: '',
    }
  });

  /** حساب أوقات الشفت من الإعدادات أو القيم الافتراضية الثابتة */
  const getShiftDefaults = (shiftType: 'morning' | 'evening') => ({
    shiftStartTime:
      settings?.shifts?.[shiftType]?.workStartTime ??
      (shiftType === 'evening' ? '12:00' : '09:00'),
    shiftEndTime:
      settings?.shifts?.[shiftType]?.workEndTime ??
      (shiftType === 'evening' ? '20:00' : '18:00'),
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await dbService.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    reset({
      fullName: '',
      phone: '',
      address: '',
      jobTitle: '',
      department: '',
      basicSalary: 4000,
      shiftType: settings?.shiftType ?? 'morning',
      shiftStartTime: settings?.shifts?.[settings?.shiftType ?? 'morning']?.workStartTime ?? settings?.workStartTime ?? '09:00',
      shiftEndTime: settings?.shifts?.[settings?.shiftType ?? 'morning']?.workEndTime ?? settings?.workEndTime ?? '18:00',
      gracePeriodMinutes: settings?.gracePeriodMinutes ?? 10,
      lateAfterMinutes: settings?.lateRule?.afterMinutes ?? 10,
      absenceAfterMinutes: settings?.absenceRule?.afterMinutes ?? 240,
      hireDate: new Date().toISOString().split('T')[0],
      status: 'active',
      avatarUrl: '',
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: EmployeeDocument) => {
    setEditingEmployee(emp);
    reset({
      fullName: emp.fullName,
      phone: emp.phone,
      address: emp.address,
      jobTitle: emp.jobTitle,
      department: emp.department,
      basicSalary: emp.basicSalary,
      shiftType: emp.shiftType ?? settings?.shiftType ?? 'morning',
      shiftStartTime: emp.shiftStartTime ?? settings?.shifts?.[emp.shiftType ?? 'morning']?.workStartTime ?? settings?.workStartTime ?? '09:00',
      shiftEndTime: emp.shiftEndTime ?? settings?.shifts?.[emp.shiftType ?? 'morning']?.workEndTime ?? settings?.workEndTime ?? '18:00',
      gracePeriodMinutes: emp.gracePeriodMinutes ?? settings?.gracePeriodMinutes ?? 10,
      lateAfterMinutes: emp.lateRule?.afterMinutes ?? settings?.lateRule?.afterMinutes ?? 10,
      absenceAfterMinutes: emp.absenceRule?.afterMinutes ?? settings?.absenceRule?.afterMinutes ?? 240,
      hireDate: emp.hireDate,
      status: emp.status ?? 'active',
      avatarUrl: emp.avatarUrl || '',
      idNumber: emp.idNumber ?? '',
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      await dbService.updateEmployee(archiveTarget.id, { status: 'archived' });
      setArchiveTarget(null);
      await fetchEmployees();
    } catch (err: any) {
      alert("حدث خطأ أثناء أرشفة سجل الموظف.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.deleteEmployee(deleteTarget.id);
      setDeleteTarget(null);
      await fetchEmployees();
    } catch (err: any) {
      alert("حدث خطأ أثناء حذف الموظف.");
    }
  };

  const onSubmit = async (data: EmployeeFormFields) => {
    setErrorMsg(null);
    try {
      if (editingEmployee) {
        // Update Employee
        await dbService.updateEmployee(editingEmployee.id, {
          ...data,
          status: data.status ?? 'active',
          idNumber: data.idNumber ?? editingEmployee.idNumber,
          lateRule: { afterMinutes: data.lateAfterMinutes },
          absenceRule: { afterMinutes: data.absenceAfterMinutes },
        });
      } else {
        // Create Employee
        const newEmp: EmployeeDocument = {
          id: `emp_${Date.now()}`,
          employeeNo: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
          fullName: data.fullName,
          phone: data.phone,
          address: data.address,
          jobTitle: data.jobTitle,
          department: data.department,
          basicSalary: data.basicSalary,
          shiftType: data.shiftType,
          shiftStartTime: data.shiftStartTime,
          shiftEndTime: data.shiftEndTime,
          gracePeriodMinutes: data.gracePeriodMinutes,
          lateRule: { afterMinutes: data.lateAfterMinutes },
          absenceRule: { afterMinutes: data.absenceAfterMinutes },
          hireDate: data.hireDate,
          status: data.status ?? 'active',
          idNumber: data.idNumber,

          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await dbService.createEmployee(newEmp);
      }
      setIsModalOpen(false);
      await fetchEmployees();
    } catch (err: any) {
      setErrorMsg(err.message || "فشلت العملية. يرجى مراجعة البيانات.");
    }
  };

  // Filtration logic
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.idNumber ?? '').includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    const matchesDept = deptFilter === 'all' || emp.department === deptFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  const getUniqueDepartments = () => {
    const depts = employees.map(e => e.department);
    return Array.from(new Set(depts));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">نشط</span>;
      case 'suspended':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">موقوف مؤقتاً</span>;
      case 'archived':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200">مؤرشف</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إدارة ملفات الموظفين</h1>
          <p className="text-xs text-gray-400 mt-1">عرض، إضافة، وتعديل بيانات موظفي المحل وأرشفتهم.</p>
        </div>
        {canCreate && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-l from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة موظف جديد</span>
          </button>
        )}
      </div>

      {/* Filter and search bar */}
      <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-xs flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative w-full md:w-1/3">
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="البحث بالاسم أو الرقم الوظيفي أو رقم الهوية..."
            className="w-full py-2.5 pr-10 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-right"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter by status */}
        <div className="relative w-full sm:w-1/2 md:w-1/4">
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
            <Filter size={16} />
          </span>
          <select
            className="w-full py-2.5 pr-10 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-right appearance-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات الوظيفية</option>
            <option value="active">نشط</option>
            <option value="suspended">موقوف مؤقتاً</option>
            <option value="archived">مؤرشف</option>
          </select>
        </div>

        {/* Filter by Department */}
        <div className="relative w-full sm:w-1/2 md:w-1/4">
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
            <Briefcase size={16} />
          </span>
          <select
            className="w-full py-2.5 pr-10 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-right appearance-none"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">كل الأقسام</option>
            {getUniqueDepartments().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Data Table */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingState
            message="جارٍ تحميل بيانات وسجلات الموظفين..."
            subMessage="يتم جلب الملفات الوظيفية والرواتب والورديات"
            variant="card"
          />
        ) : filteredEmployees.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Users size={48} className="mx-auto text-gray-300 animate-bounce" />
            <h3 className="font-bold text-gray-700 text-sm">لا يوجد موظفون مسجلون</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">لم يتم العثور على أي بيانات مطابقة لشروط البحث أو الفلترة التي حددتها.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-brand-50/50 border-b border-brand-100 text-xs font-bold text-gray-500">
                  <th className="p-4.5">الرقم الوظيفي</th>
                  <th className="p-4.5">رقم الهوية</th>

                  <th className="p-4.5">الموظف</th>
                  <th className="p-4.5">رقم الجوال</th>
                  <th className="p-4.5">القسم والمسمى</th>
                  <th className="p-4.5">الراتب الأساسي</th>
                  <th className="p-4.5">تاريخ التوظيف</th>
                  <th className="p-4.5">الحالة</th>
                  <th className="p-4.5 text-center no-print">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50 text-xs">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-brand-50/20 transition-all">
                    <td className="p-4.5 font-mono font-bold text-brand-700">{emp.employeeNo}</td>
                    <td className="p-4.5 text-gray-600">{emp.idNumber ?? '-'}</td>

                    <td className="p-4.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={emp.fullName}
                          className="w-10 h-10 rounded-xl object-cover border border-brand-100"
                        />
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{emp.fullName}</p>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{emp.address}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4.5 font-medium text-gray-600" dir="ltr">{emp.phone}</td>
                    <td className="p-4.5">
                      <span className="font-semibold text-gray-700">{emp.jobTitle}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">{emp.department}</span>
                    </td>
                    <td className="p-4.5 font-bold text-emerald-700">{formatCurrency(emp.basicSalary, currency)}</td>
                    <td className="p-4.5 text-gray-500">{emp.hireDate}</td>
                    <td className="p-4.5">{getStatusBadge(emp.status)}</td>
                    <td className="p-4.5 text-center no-print">
                      <div className="flex items-center justify-center gap-2">
                        {/* بطاقة الـ QR */}
                        <button
                          type="button"
                          onClick={() => setSelectedQrEmployee(emp)}
                          className="p-2 bg-gold-50 hover:bg-gold-100 text-gold-700 rounded-lg transition-all border border-gold-200 cursor-pointer shadow-xs"
                          title="عرض وطباعة بطاقة الـ QR"
                        >
                          <QrCode size={14} />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(emp)}
                              className="p-2 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg transition-all border border-brand-100 cursor-pointer"
                              title="تعديل الموظف"
                            >
                              <Edit size={14} />
                            </button>
                            {emp.status !== 'archived' && (
                              <button
                                onClick={() => setArchiveTarget(emp)}
                                className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-all border border-gray-200 cursor-pointer"
                                title="أرشفة الموظف"
                              >
                                <Archive size={14} />
                              </button>
                            )}
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(emp)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all border border-red-100 cursor-pointer"
                            title="حذف نهائي"
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

      {/* Modal for Add / Edit Employee */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-brand-100 overflow-hidden animate-scale-in max-h-[90svh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">
                {editingEmployee ? `تعديل ملف الموظف: ${editingEmployee.fullName}` : 'إضافة موظف جديد لقائمة المحل'}
              </h2>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">الاسم الكامل للموظف</label>
                  <input
                    type="text"
                    placeholder="محمد علي"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.fullName ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('fullName')}
                  />
                  {errors.fullName && <p className="text-red-500 text-[10px]">{errors.fullName.message}</p>}
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">رقم الجوال</label>
                  <input
                    type="text"
                    placeholder="0591234567"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.phone ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('phone')}
                  />
                  {errors.phone && <p className="text-red-500 text-[10px]">{errors.phone.message}</p>}
                </div>

                {/* Address */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-600">العنوان بالتفصيل</label>
                  <input
                    type="text"
                    placeholder="غزة - الرمال الشمالي - شارع الثورة"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.address ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('address')}
                  />
                  {errors.address && <p className="text-red-500 text-[10px]">{errors.address.message}</p>}
                </div>

                {/* Job Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">المسمى الوظيفي</label>
                  <input
                    type="text"
                    placeholder="مصمم زهور طبيعية وتنسيق هدايا"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.jobTitle ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('jobTitle')}
                  />
                  {errors.jobTitle && <p className="text-red-500 text-[10px]">{errors.jobTitle.message}</p>}
                </div>

                {/* ID Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">رقم هوية الموظف</label>
                  <input
                    type="text"
                    placeholder="123456789"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.idNumber ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('idNumber')}
                  />
                  {errors.idNumber && <p className="text-red-500 text-[10px]">{errors.idNumber.message}</p>}
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">القسم</label>
                  <input
                    type="text"
                    placeholder="قسم الهدايا والتغليف"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.department ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('department')}
                  />
                  {errors.department && <p className="text-red-500 text-[10px]">{errors.department.message}</p>}
                </div>

                {/* Basic Salary */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">الراتب الأساسي ({currency})</label>
                  <input
                    type="number"
                    placeholder="5000"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.basicSalary ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('basicSalary', { valueAsNumber: true })}
                  />
                  {errors.basicSalary && <p className="text-red-500 text-[10px]">{errors.basicSalary.message}</p>}
                </div>

                {/* Schedule & Shift Settings */}
                <div className="sm:col-span-2 p-3.5 bg-brand-50/60 rounded-2xl border border-brand-100/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold text-brand-950 block">جدول ومواعيد دوام الموظف</label>
                      <span className="text-[10px] text-brand-600">يحدد يدوياً Start Time و End Time (الدوام يتبع جدول الموظف)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const def = getShiftDefaults('morning');
                          setValue('shiftType', 'morning');
                          setValue('shiftStartTime', def.shiftStartTime);
                          setValue('shiftEndTime', def.shiftEndTime);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-brand-100 text-brand-800 border border-brand-200 transition-all cursor-pointer shadow-xs"
                      >
                        صباحي ({getShiftDefaults('morning').shiftStartTime} - {getShiftDefaults('morning').shiftEndTime})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const def = getShiftDefaults('evening');
                          setValue('shiftType', 'evening');
                          setValue('shiftStartTime', def.shiftStartTime);
                          setValue('shiftEndTime', def.shiftEndTime);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-brand-100 text-brand-800 border border-brand-200 transition-all cursor-pointer shadow-xs"
                      >
                        مسائي ({getShiftDefaults('evening').shiftStartTime} - {getShiftDefaults('evening').shiftEndTime})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-700">نوع الوردية</label>
                      <select
                        className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-right"
                        {...register('shiftType')}
                        onChange={(e) => {
                          const val = e.target.value as 'morning' | 'evening';
                          const def = getShiftDefaults(val);
                          setValue('shiftType', val);
                          setValue('shiftStartTime', def.shiftStartTime);
                          setValue('shiftEndTime', def.shiftEndTime);
                        }}
                      >
                        <option value="morning">وردية صباحية (Morning)</option>
                        <option value="evening">وردية مسائية (Evening)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-700">وقت البدء (Start Time)</label>
                      <input
                        type="time"
                        className={`w-full py-2 px-3 bg-white border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-right
                          ${errors.shiftStartTime ? 'border-red-400' : 'border-gray-200'}
                        `}
                        {...register('shiftStartTime')}
                      />
                      {errors.shiftStartTime && <p className="text-red-500 text-[10px]">{errors.shiftStartTime.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-700">وقت الانتهاء (End Time)</label>
                      <input
                        type="time"
                        className={`w-full py-2 px-3 bg-white border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-right
                          ${errors.shiftEndTime ? 'border-red-400' : 'border-gray-200'}
                        `}
                        {...register('shiftEndTime')}
                      />
                      {errors.shiftEndTime && <p className="text-red-500 text-[10px]">{errors.shiftEndTime.message}</p>}
                    </div>
                  </div>
                </div>



                {/* Hire Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">تاريخ التوظيف</label>
                  <input
                    type="date"
                    className={`w-full py-2.5 px-3 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                      ${errors.hireDate ? 'border-red-400' : 'border-gray-200'}
                    `}
                    {...register('hireDate')}
                  />
                  {errors.hireDate && <p className="text-red-500 text-[10px]">{errors.hireDate.message}</p>}
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">حالة الموظف</label>
                  <select
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right"
                    {...register('status')}
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">موقوف مؤقتاً</option>
                    <option value="archived">مؤرشف</option>
                  </select>
                </div>

                {/* Avatar URL (Mock upload) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">رابط الصورة الشخصية (اختياري)</label>
                  <input
                    type="text"
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white text-right"
                    {...register('avatarUrl')}
                  />
                </div>
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
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>حفظ الموظف</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={Boolean(archiveTarget)}
        title="تأكيد أرشفة الموظف"
        description={`سيتم أرشفة سجل الموظف "${archiveTarget?.fullName ?? ''}" وإخفاؤه من الموظفين النشطين.`}
        confirmText="أرشفة"
        cancelText="إلغاء"
        variant="warning"
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="تأكيد حذف الموظف"
        description={`سيتم حذف الموظف "${deleteTarget?.fullName ?? ''}" نهائياً من النظام.`}
        confirmText="حذف نهائي"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* نافذة عرض وطباعة بطاقة الـ QR للموظف */}
      <EmployeeQrModal
        employee={selectedQrEmployee}
        onClose={() => setSelectedQrEmployee(null)}
      />
    </div>
  );
};
