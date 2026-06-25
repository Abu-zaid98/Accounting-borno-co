import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/db';
import type { PermissionDocument, UserDocument } from '../../types';
import { Plus, Edit, Trash2, Shield, UserX, UserCheck, X, Check, AlertCircle, KeyRound } from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import bcrypt from 'bcryptjs';

export const Users: React.FC = () => {
  const { hasPermission, user: currentUser } = useAuth();
  const canCreateUsers = hasPermission('users.create');
  const canEditUsers = hasPermission('users.edit');
  const canDeleteUsers = hasPermission('users.delete');

  const [users, setUsers] = useState<UserDocument[]>([]);
  const [permissions, setPermissions] = useState<PermissionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDocument | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserDocument | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'super_admin' | 'manager' | 'accountant' | 'employee'>('accountant');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newPermissionKey, setNewPermissionKey] = useState('');
  const [newPermissionLabel, setNewPermissionLabel] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const { showToast } = useToast();

  const fallbackPermissions = [
    { id: '1', key: 'employees.view', label: 'عرض الموظفين', category: 'employees' as const },
    { id: '2', key: 'employees.create', label: 'إضافة موظف', category: 'employees' as const },
    { id: '3', key: 'employees.edit', label: 'تعديل موظف', category: 'employees' as const },
    { id: '4', key: 'employees.delete', label: 'حذف موظف', category: 'employees' as const },
    { id: '5', key: 'salary.view', label: 'عرض الرواتب', category: 'salary' as const },
    { id: '6', key: 'salary.create', label: 'توليد كشف رواتب', category: 'salary' as const },
    { id: '7', key: 'salary.edit', label: 'تعديل الرواتب يدوياً', category: 'salary' as const },
    { id: '8', key: 'salary.delete', label: 'حذف كشوفات الرواتب', category: 'salary' as const },
    { id: '9', key: 'salary.approve', label: 'اعتماد وقفل كشوفات الرواتب', category: 'salary' as const },
    { id: '10', key: 'salary.pay', label: 'تأكيد صرف كشوفات الرواتب', category: 'salary' as const },
    { id: '11', key: 'attendance.view', label: 'عرض سجل الحضور والانصراف', category: 'attendance' as const },
    { id: '12', key: 'attendance.create', label: 'تسجيل الحضور/الانصراف', category: 'attendance' as const },
    { id: '13', key: 'attendance.edit', label: 'تعديل سجل الحضور والانصراف', category: 'attendance' as const },
    { id: '14', key: 'attendance.delete', label: 'حذف سجلات الحضور والانصراف', category: 'attendance' as const },
    { id: '15', key: 'overtime.view', label: 'عرض الساعات الإضافية', category: 'attendance' as const },
    { id: '16', key: 'overtime.create', label: 'إضافة ساعات إضافية', category: 'attendance' as const },
    { id: '17', key: 'overtime.edit', label: 'تعديل/حذف الساعات الإضافية', category: 'attendance' as const },
    { id: '18', key: 'reports.view', label: 'عرض التقارير', category: 'reports' as const },
    { id: '19', key: 'reports.print', label: 'طباعة وتصدير التقارير', category: 'reports' as const },
    { id: '20', key: 'settings.view', label: 'عرض الإعدادات العامة', category: 'settings' as const },
    { id: '21', key: 'settings.edit', label: 'تعديل الإعدادات والمعادلات', category: 'settings' as const },
    { id: '22', key: 'users.view', label: 'عرض مستخدمي النظام', category: 'users' as const },
    { id: '23', key: 'users.create', label: 'إضافة مستخدم جديد', category: 'users' as const },
    { id: '24', key: 'users.edit', label: 'تعديل صلاحيات المستخدمين', category: 'users' as const },
    { id: '25', key: 'users.delete', label: 'حذف المستخدمين', category: 'users' as const },
    { id: '26', key: 'departments.view', label: 'عرض الأقسام', category: 'employees' as const },
    { id: '27', key: 'departments.create', label: 'إضافة قسم جديد', category: 'employees' as const },
    { id: '28', key: 'departments.edit', label: 'تعديل الأقسام', category: 'employees' as const },
    { id: '29', key: 'departments.delete', label: 'حذف الأقسام', category: 'employees' as const },
    { id: '30', key: 'dashboard.view', label: 'عرض لوحة القيادة (الرئيسية)', category: 'settings' as const },
    { id: '31', key: 'employee-financial-transactions.view', label: 'عرض الحركات المالية', category: 'employees' as const },
    { id: '32', key: 'employee-financial-transactions.create', label: 'إضافة حركة مالية', category: 'employees' as const },
    { id: '33', key: 'employee-financial-transactions.edit', label: 'تعديل الحركات المالية', category: 'employees' as const },
    { id: '34', key: 'employee-financial-transactions.delete', label: 'حذف الحركات المالية', category: 'employees' as const }
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [data, perms] = await Promise.all([
        dbService.getUsers(),
        dbService.getPermissions(),
      ]);
      setUsers(data);
      setPermissions(perms);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const availablePermissions = fallbackPermissions.map((p) => {
    const existing = permissions.find(dbP => dbP.key === p.key);
    return existing || {
      id: p.id,
      key: p.key,
      label: p.label,
      category: p.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setRole('accountant');
    setUserPermissions([
      'employees.view', 'salary.view', 'attendance.view', 'overtime.view', 'reports.view'
    ]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: UserDocument) => {
    setEditingUser(u);
    setFullName(u.fullName);
    setUsername(u.username || '');
    setPassword('');
    setConfirmPassword('');
    setRole(u.role);
    setUserPermissions(u.permissions || []);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (u: UserDocument) => {
    const nextStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await dbService.updateUser(u.uid, { status: nextStatus });
      showToast('success', nextStatus === 'active' ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم');
      await fetchUsers();
    } catch (error) {
      alert("حدث خطأ أثناء تغيير حالة الحساب.");
    }
  };

  const requestDeleteUser = (u: UserDocument) => {
    setDeleteTarget(u);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.deleteUser(deleteTarget.uid);
      setDeleteTarget(null);
      showToast('success', 'تم حذف المستخدم');
      await fetchUsers();
    } catch (error) {
      alert("حدث خطأ أثناء حذف الحساب.");
    }
  };

  const handlePermissionChange = (permKey: string) => {
    if (userPermissions.includes(permKey)) {
      setUserPermissions(userPermissions.filter(p => p !== permKey));
    } else {
      setUserPermissions([...userPermissions, permKey]);
    }
  };

  const handleSelectAllPermissions = () => {
    setUserPermissions(availablePermissions.map(p => p.key));
  };

  const handleClearAllPermissions = () => {
    setUserPermissions([]);
  };

  const handleCreatePermission = async () => {
    const key = newPermissionKey.trim();
    const label = newPermissionLabel.trim();
    if (!key || !label) {
      showToast('warning', 'أدخل مفتاح الصلاحية واسمها');
      return;
    }
    if (availablePermissions.some(p => p.key === key)) {
      showToast('error', 'هذه الصلاحية موجودة مسبقاً');
      return;
    }
    await dbService.createPermission({
      id: `perm_${Date.now()}`,
      key,
      label,
      category: 'users' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setNewPermissionKey('');
    setNewPermissionLabel('');
    showToast('success', 'تمت إضافة الصلاحية');
    await fetchUsers();
  };

  const handleDeletePermission = async (permission: PermissionDocument) => {
    if (users.some(u => (u.permissions || []).includes(permission.key))) {
      showToast('error', 'لا يمكن حذف صلاحية مرتبطة بمستخدمين');
      return;
    }
    await dbService.deletePermission(permission.id);
    showToast('success', 'تم حذف الصلاحية');
    await fetchUsers();
  };

  const handlePermissionLabelChange = (permissionId: string, label: string) => {
    setPermissions(current => current.map(p => p.id === permissionId ? { ...p, label } : p));
  };

  const handleSavePermission = async (permission: PermissionDocument) => {
    await dbService.updatePermission(permission.id, { label: permission.label });
    showToast('success', 'تم تحديث الصلاحية');
    await fetchUsers();
  };

  const openPasswordModal = (u: UserDocument) => {
    setPasswordTarget(u);
    setResetPassword('');
    setResetConfirmPassword('');
  };

  const handleAdminPasswordChange = async () => {
    if (!passwordTarget) return;
    if (resetPassword.length < 6) {
      showToast('error', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      showToast('error', 'كلمة المرور وتأكيدها غير متطابقين');
      return;
    }
    
    const passwordHash = bcrypt.hashSync(resetPassword, 10);
    await dbService.updateUser(passwordTarget.uid, { passwordHash });
    
    setPasswordTarget(null);
    showToast('success', 'تم تحديث كلمة المرور', 'يمكن للمستخدم تسجيل الدخول بكلمة المرور الجديدة الآن.');
    await fetchUsers();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName || !username) {
      setErrorMsg("يرجى تعبئة كافة الحقول الأساسية.");
      return;
    }

    if (!editingUser) {
      if (password.length < 6) {
        setErrorMsg("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("كلمة المرور وتأكيدها غير متطابقين.");
        return;
      }
    }

    try {
      if (editingUser) {
        const updateData: Partial<UserDocument> = {
          fullName,
          username,
          role,
          permissions: userPermissions
        };

        await dbService.updateUser(editingUser.uid, updateData);
        showToast('success', 'تم تحديث المستخدم');
      } else {
        // التحقق من أن اسم المستخدم غير موجود مسبقاً
        const existingUsers = await dbService.getUsers();
        if (existingUsers.some(u => u.username === username)) {
          setErrorMsg("اسم المستخدم موجود مسبقاً.");
          return;
        }

        const newUser: UserDocument = {
          uid: crypto.randomUUID(),
          fullName,
          username,
          passwordHash: bcrypt.hashSync(password, 10),
          role: role as 'super_admin' | 'manager' | 'accountant' | 'employee',
          permissions: userPermissions,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await dbService.createUser(newUser);
        showToast('success', 'تم إنشاء المستخدم', 'يمكنه تسجيل الدخول بكلمة المرور المحددة.');
      }
      setIsModalOpen(false);
      await fetchUsers();
    } catch (error: any) {
      setErrorMsg(error.message || "حدث خطأ غير متوقع.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إدارة مستخدمي النظام والصلاحيات</h1>
          <p className="text-xs text-gray-400 mt-1">إنشاء حسابات المشرفين والمحاسبين وتعديل أذونات الوصول التفصيلية لكل شاشة.</p>
        </div>
        {canCreateUsers && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-l from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة مستخدم نظام جديد</span>
          </button>
        )}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 animate-pulse rounded-2xl"></div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-brand-50/50 border-b border-brand-100 text-xs font-bold text-gray-500">
                  <th className="p-4.5">المستخدم</th>
                  <th className="p-4.5">اسم المستخدم (للدخول)</th>
                  <th className="p-4.5">الدور الوظيفي</th>
                  <th className="p-4.5">عدد الصلاحيات الممنوحة</th>
                  <th className="p-4.5">الحالة</th>
                  <th className="p-4.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50 text-xs">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-brand-50/20 transition-all">
                    <td className="p-4.5 font-bold text-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
                          {u.fullName.charAt(0)}
                        </div>
                        <span>{u.fullName}</span>
                      </div>
                    </td>
                    <td className="p-4.5 text-gray-600 font-medium">{u.username || u.email}</td>
                    <td className="p-4.5">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px]
                        ${u.role === 'super_admin' ? 'bg-red-50 text-red-700 border border-red-200' :
                          u.role === 'manager' ? 'bg-brand-50 text-brand-700 border border-brand-200' :
                            'bg-gold-50 text-gold-700 border border-gold-200'}
                      `}>
                        {u.role === 'super_admin' ? 'المدير العام' : u.role === 'manager' ? 'مدير نظام' : 'محاسب مالي'}
                      </span>
                    </td>
                    <td className="p-4.5 font-bold text-brand-950">
                      {u.role === 'super_admin' ? 'كامل الصلاحيات (مطلق)' : `${(u.permissions || []).length} صلاحية معتمدة`}
                    </td>
                    <td className="p-4.5">
                      {u.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                          <UserCheck size={14} />
                          <span>نشط</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                          <UserX size={14} />
                          <span>معطل الوصول</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4.5">
                      <div className="flex items-center justify-center gap-2">
                        {canEditUsers && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={u.uid === currentUser?.uid}
                              className={`p-2 rounded-lg transition-all border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                                ${u.status === 'active' ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}
                              `}
                              title={u.uid === currentUser?.uid ? 'لا يمكنك تعطيل حسابك الشخصي' : u.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            >
                              {u.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-2 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg border border-brand-100 cursor-pointer"
                              title="تعديل الصلاحيات"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => openPasswordModal(u)}
                              className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-100 cursor-pointer"
                              title="تغيير كلمة المرور"
                            >
                              <KeyRound size={13} />
                            </button>
                          </>
                        )}
                        {canDeleteUsers && (
                          <button
                            onClick={() => requestDeleteUser(u)}
                            disabled={u.uid === currentUser?.uid}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title={u.uid === currentUser?.uid ? 'لا يمكنك حذف حسابك الشخصي' : 'حذف الحساب'}
                          >
                            <Trash2 size={13} />
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

      {/* Permissions Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-brand-100 overflow-hidden flex flex-col max-h-[90svh]">
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">
                {editingUser ? `تعديل صلاحيات المستخدم: ${editingUser.fullName}` : 'إنشاء حساب مستخدم نظام جديد وصلاحياته'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
              {errorMsg && (
                <div className="p-3 bg-red-50 border-r-4 border-red-500 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">الاسم الكامل للمستخدم</label>
                  <input
                    type="text"
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="أحمد مراد"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">اسم المستخدم (للدخول)</label>
                  <input
                    type="text"
                    dir="ltr"
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="accountant_1"
                  />
                </div>
                {!editingUser && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-600">كلمة المرور</label>
                      <input
                        type="password"
                        className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="******"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-600">تأكيد كلمة المرور</label>
                      <input
                        type="password"
                        className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="******"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-600">الدور الوظيفي الرئيسي</label>
                  <select
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                  >
                    <option value="accountant">محاسب مالي (صلاحيات مالية محدودة)</option>
                    {(currentUser?.role === 'super_admin' || editingUser?.role === 'super_admin') && (
                      <option value="super_admin">المدير العام (كامل الصلاحيات - مطلق)</option>
                    )}
                    <option value="manager">مدير النظام (صلاحيات إدارية ومالية واسعة)</option>
                  </select>
                </div>
              </div>

              {/* Permissions checkboxes */}
              <div className="space-y-3 pt-4 border-t border-brand-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    <Shield size={16} className="text-brand-600" />
                    <span>تخصيص الصلاحيات للشاشات والعمليات</span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllPermissions}
                      className="px-2.5 py-1 text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg cursor-pointer"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllPermissions}
                      className="px-2.5 py-1 text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer"
                    >
                      إلغاء تحديد الكل
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-gray-50/50 rounded-2xl border border-gray-100 scrollbar-thin">
                  {availablePermissions.map(p => {
                    const isCheckboxDisabled = !canEditUsers || (currentUser?.role !== 'super_admin' && !(currentUser?.permissions || []).includes(p.key));
                    const isGlobalEditDisabled = currentUser?.role !== 'super_admin';
                    return (
                      <label key={p.key} className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-gray-100 hover:border-brand-200 transition-all text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={isCheckboxDisabled}
                          className="w-4.5 h-4.5 rounded-sm text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                          checked={userPermissions.includes(p.key)}
                          onChange={() => handlePermissionChange(p.key)}
                        />
                        <input
                          type="text"
                          disabled={isGlobalEditDisabled}
                          className="font-medium text-gray-700 bg-transparent border-none outline-none flex-1 min-w-0 disabled:opacity-75"
                          value={p.label}
                          onChange={(e) => handlePermissionLabelChange(p.id, e.target.value)}
                          onBlur={() => handleSavePermission(p)}
                        />
                        {currentUser?.role === 'super_admin' && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleDeletePermission(p); }}
                            className="mr-auto p-1 text-red-500 hover:bg-red-50 rounded-md"
                            title="حذف الصلاحية"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>
                {currentUser?.role === 'super_admin' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-white rounded-2xl border border-brand-100 animate-fade-in">
                    <input
                      type="text"
                      dir="ltr"
                      className="py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                      value={newPermissionKey}
                      onChange={(e) => setNewPermissionKey(e.target.value)}
                      placeholder="module.action"
                    />
                    <input
                      type="text"
                      className="py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                      value={newPermissionLabel}
                      onChange={(e) => setNewPermissionLabel(e.target.value)}
                      placeholder="اسم الصلاحية"
                    />
                    <button
                      type="button"
                      onClick={handleCreatePermission}
                      className="px-3 py-2.5 bg-brand-50 text-brand-700 border border-brand-100 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      إضافة صلاحية جديدة للنظام
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check size={14} />
                  <span>حفظ وإقرار الصلاحيات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="تأكيد حذف المستخدم"
        description={`سيتم حذف حساب وصول المستخدم "${deleteTarget?.fullName ?? ''}" نهائياً.`}
        confirmText="حذف المستخدم"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
      {passwordTarget && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-brand-100 overflow-hidden max-h-[90svh] flex flex-col">
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
              <h2 className="font-bold text-gray-800 text-base">تغيير كلمة المرور</h2>
              <button onClick={() => setPasswordTarget(null)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-xs text-gray-500">سيتم تحديث كلمة مرور المستخدم: <span className="font-bold text-gray-800">{passwordTarget.fullName}</span></p>
              <input
                type="password"
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="كلمة المرور الجديدة"
              />
              <input
                type="password"
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="تأكيد كلمة المرور الجديدة"
              />
              <div className="flex items-center justify-end gap-3 border-t border-brand-100 pt-4">
                <button onClick={() => setPasswordTarget(null)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer">إلغاء</button>
                <button onClick={handleAdminPasswordChange} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md">
                  <KeyRound size={14} />
                  <span>تحديث كلمة المرور</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Users;
