import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { dbService } from '../../services/db';
import type { EmployeeDocument, AttendanceDocument, OvertimeDocument } from '../../types';
import {
  Users, CalendarClock, Ban, Timer, Wallet,
  ArrowUpRight, ArrowDownRight, Plus, UserCheck, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/currency';

export const Dashboard: React.FC = () => {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDocument[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();
  const currency = settings?.globalCurrency ?? settings?.currency ?? 'ر.س';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const emps = await dbService.getEmployees();
        const atts = await dbService.getAttendance(today);
        const ovs = await dbService.getOvertimeRecords();

        setEmployees(emps);
        setAttendance(atts);
        setOvertimes(ovs);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeEmployees = employees.filter(e => e.status === 'active');
  const suspendedEmployees = employees.filter(e => e.status === 'suspended');

  // Calculate attendance details for today
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const absentCount = activeEmployees.length - presentCount;

  // Calculate salary cycle details
  const totalSalaries = activeEmployees.reduce((sum, e) => sum + e.basicSalary, 0);
  const totalOvertimeHours = overtimes.reduce((sum, o) => sum + o.hours, 0);
  const totalOvertimeAmount = overtimes.reduce((sum, o) => sum + o.totalAmount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-3xl animate-pulse border border-brand-100"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-white rounded-3xl lg:col-span-2 animate-pulse border border-brand-100"></div>
          <div className="h-96 bg-white rounded-3xl animate-pulse border border-brand-100"></div>
        </div>
      </div>
    );
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome banner */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden bg-gradient-to-l from-brand-950 via-brand-900 to-brand-800 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-brand-900/50"
      >
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-gold-400/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-brand-500/15 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide">أهلاً بك في لوحة تحكم إدارة الموظفين - البورنو 👋</h1>
            <p className="text-brand-200 text-sm max-w-xl leading-relaxed">
              تتيح لك المنصة متابعة شؤون الموظفين، وتسجيل الحضور والغياب اليومي وساعات العمل الإضافي، ومعالجة الرواتب الشهرية لمحل الهدايا الفاخر بكل دقة وسلاسة.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {hasPermission('attendance.view') && (
              <Link
                to="/attendance"
                className="px-5 py-2.5 bg-gold-400 hover:bg-gold-500 text-brand-950 rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck size={16} />
                <span>تحضير اليوم</span>
              </Link>
            )}
            {hasPermission('employees.create') && (
              <Link
                to="/employees"
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} />
                <span>إضافة موظف</span>
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Cards Section */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Total Employees */}
        <div className="bg-white rounded-3xl p-6 border border-brand-100 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400">إجمالي الموظفين</span>
            <p className="text-3xl font-extrabold text-gray-800">{employees.length}</p>
            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full w-fit">
              <ArrowUpRight size={12} />
              <span>{activeEmployees.length} نشط</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users size={26} />
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white rounded-3xl p-6 border border-brand-100 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400">الحضور اليوم</span>
            <p className="text-3xl font-extrabold text-gray-800">{presentCount}</p>
            <div className="flex items-center gap-1 text-[10px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded-full w-fit">
              <Clock size={12} />
              <span>{lateCount} تأخير اليوم</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gold-50 text-gold-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarClock size={26} />
          </div>
        </div>

        {/* Absent Today */}
        <div className="bg-white rounded-3xl p-6 border border-brand-100 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400">الغياب اليوم</span>
            <p className="text-3xl font-extrabold text-gray-800">{absentCount}</p>
            <div className="flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full w-fit">
              <ArrowDownRight size={12} />
              <span>{suspendedEmployees.length} موقوف مؤقتاً</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Ban size={26} />
          </div>
        </div>

        {/* Total Month Salaries */}
        <div className="bg-white rounded-3xl p-6 border border-brand-100 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400">إجمالي الرواتب الأساسية</span>
            <p className="text-3xl font-extrabold text-gray-800">{formatCurrency(totalSalaries, currency)}</p>
            <div className="flex items-center gap-1 text-[10px] text-gold-700 font-bold bg-gold-50 px-2 py-0.5 rounded-full w-fit">
              <Timer size={12} />
              <span>{totalOvertimeHours} ساعة إضافية مسجلة</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Wallet size={26} />
          </div>
        </div>
      </motion.div>

      {/* Main Charts & Table section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right Pane: Department Distribution & Overtime Details */}
        {hasPermission('overtime.view') ? (
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 bg-white rounded-3xl p-6 border border-brand-100 shadow-xs space-y-6"
          >
            <div className="flex items-center justify-between border-b border-brand-50 pb-4">
              <div>
                <h3 className="font-bold text-gray-800 text-base">إحصائيات الساعات الإضافية والأجور الموزعة</h3>
                <p className="text-xs text-gray-400 mt-1">توزيع العمل الإضافي المعتمد والمبالغ المستحقة المقدرة</p>
              </div>
              <Link to="/overtime" className="text-xs text-brand-600 hover:text-brand-800 font-bold flex items-center gap-0.5">
                <span>عرض السجلات</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {/* Custom CSS/SVG Graph demonstrating recent activities */}
            <div className="space-y-5">
              <div className="flex items-end justify-between h-48 pt-6 border-b border-gray-100 px-4">
                {employees.slice(0, 3).map((emp, i) => {
                  const empOvs = overtimes.filter(o => o.employeeId === emp.id);
                  const hrs = empOvs.reduce((sum, o) => sum + o.hours, 0);
                  const heightPercent = Math.min(100, Math.max(10, (hrs / 20) * 100)); // normalized max 20 hours

                  return (
                    <div key={emp.id} className="flex flex-col items-center gap-2 w-1/3 group">
                      <span className="text-[10px] font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hrs} ساعة ({formatCurrency(empOvs.reduce((s, o) => s + o.totalAmount, 0), currency)})
                      </span>
                      <div
                        className={`w-12 bg-gradient-to-t rounded-t-xl transition-all duration-500 cursor-pointer shadow-md group-hover:shadow-lg
                          ${i === 0 ? 'from-brand-600 to-brand-400' : i === 1 ? 'from-gold-500 to-gold-400' : 'from-indigo-600 to-indigo-400'}
                        `}
                        style={{ height: `${heightPercent}%` }}
                      ></div>
                      <span className="text-[11px] font-medium text-gray-500 truncate max-w-[120px]">{emp.fullName.split(' ')[0]}</span>
                    </div>
                  );
                })}
                {employees.length === 0 && (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                    لا توجد بيانات ساعات إضافية مسجلة بعد.
                  </div>
                )}
              </div>

              {/* Visual indicators */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                    <Timer size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold">إجمالي الإضافي المالي</span>
                    <span className="text-sm font-bold text-brand-950">{formatCurrency(totalOvertimeAmount, currency)}</span>
                  </div>
                </div>
                <div className="p-4 bg-gold-50/50 rounded-2xl border border-gold-100/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-100 text-gold-700 flex items-center justify-center shrink-0">
                    <Clock size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold">إجمالي ساعات العمل الزائد</span>
                    <span className="text-sm font-bold text-gold-950">{totalOvertimeHours} ساعة</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="lg:col-span-2 hidden lg:block"></div>
        )}

        {/* Left Pane: Staff Quick Attendance Audit */}
        {hasPermission('attendance.view') && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-3xl p-6 border border-brand-100 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-brand-50 pb-4 mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 text-base">حالة تحضير الموظفين</h3>
                  <p className="text-xs text-gray-400 mt-1">تتبع الحاضرين والغايبين لليوم</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-100 text-gold-800 font-bold">
                  اليوم
                </span>
              </div>

              {/* Attendance quick list */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {activeEmployees.slice(0, 4).map(emp => {
                  const record = attendance.find(a => a.employeeId === emp.id);
                  return (
                    <div key={emp.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-brand-50/40 transition-all text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-600 shrink-0">
                          {emp.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{emp.fullName}</p>
                          <span className="text-[10px] text-gray-400">{emp.jobTitle}</span>
                        </div>
                      </div>
                      <div>
                        {record ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px]
                          ${record.status === 'present' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}
                        `}>
                            {record.status === 'present' ? 'حاضر' : 'متأخر'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-red-50 text-red-700 border border-red-200">
                            غائب / لم يحضر
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {activeEmployees.length === 0 && (
                  <div className="py-6 text-center text-xs text-gray-400">
                    لا توجد سجلات موظفين نشطة حالياً.
                  </div>
                )}
              </div>
            </div>

            <Link
              to="/attendance"
              className="w-full mt-4 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 hover:text-brand-900 border border-brand-100 rounded-xl font-bold text-xs text-center transition-all flex items-center justify-center gap-1"
            >
              <span>فتح تحضير الموظفين بالكامل</span>
              <ArrowUpRight size={14} />
            </Link>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
