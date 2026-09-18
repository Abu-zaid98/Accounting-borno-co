import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Users, CalendarClock, Timer, 
  Wallet, FileBarChart, Settings, LogOut, ShieldCheck, Gift, WalletCards 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    {
      path: '/dashboard',
      label: 'لوحة التحكم',
      icon: <LayoutDashboard size={20} />,
      permission: '' // open to all authenticated users
    },
    {
      path: '/employees',
      label: 'إدارة الموظفين',
      icon: <Users size={20} />,
      permission: 'employees.view'
    },
    {
      path: '/attendance',
      label: 'سجل الدوام اليومي',
      icon: <CalendarClock size={20} />,
      permission: 'attendance.view'
    },
    {
      path: '/overtime',
      label: 'الساعات الإضافية',
      icon: <Timer size={20} />,
      permission: 'overtime.view'
    },
    {
      path: '/financial-transactions',
      label: 'الحركات المالية',
      icon: <WalletCards size={20} />,
      permission: 'employee-financial-transactions.view'
    },
    {
      path: '/salaries',
      label: 'كشف الرواتب',
      icon: <Wallet size={20} />,
      permission: 'salary.view'
    },
    {
      path: '/reports',
      label: 'التقارير المالية',
      icon: <FileBarChart size={20} />,
      permission: 'reports.view'
    },
    {
      path: '/users',
      label: 'المستخدمين والصلاحيات',
      icon: <ShieldCheck size={20} />,
      permission: 'users.view'
    },
    {
      path: '/settings',
      label: 'الإعدادات العامة',
      icon: <Settings size={20} />,
      permission: 'settings.view'
    }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredMenu = menuItems.filter(item => !item.permission || hasPermission(item.permission));

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'المدير العام';
      case 'manager': return 'مدير النظام';
      case 'accountant': return 'المحاسب المالي';
      default: return 'مستخدم';
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-brand-950/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 right-0 w-72 h-screen bg-brand-950 text-white z-50 flex flex-col overflow-hidden
        transition-transform duration-300 shadow-2xl border-l border-brand-900/50
        lg:translate-x-0 lg:static lg:shrink-0 lg:w-72 lg:h-screen
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header / Logo */}
        <div className="h-20 shrink-0 flex items-center gap-3 px-6 border-b border-brand-900/30">
          <div className="w-10 h-10 rounded-xl bg-gold-400 flex items-center justify-center text-brand-950 shadow-md">
            <Gift size={24} className="animate-bounce" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white tracking-wide">البورنو المحاسبي</h1>
            <span className="text-[10px] text-brand-300">للهدايا والتغليف الفاخر</span>
          </div>
        </div>

        {/* Navigation Menu (Independent internal scroll) */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin overscroll-contain">
          {filteredMenu.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                ${isActive 
                  ? 'bg-gradient-to-l from-brand-700 to-brand-600 text-white shadow-lg shadow-brand-900/40 border-r-4 border-gold-400' 
                  : 'text-brand-200 hover:bg-brand-900/50 hover:text-white'
                }
              `}
            >
              <span className="text-gold-300">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Card at bottom */}
        {user && (
          <div className="shrink-0 p-4 border-t border-brand-900/30 bg-brand-900/20">
            <div className="flex items-center gap-3 p-2 bg-brand-900/40 rounded-xl mb-3">
              <div className="w-10 h-10 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center font-bold text-gold-400 text-base">
                {user.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate text-white">{user.fullName}</p>
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 font-medium">
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-red-300 hover:text-white hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all font-medium text-sm cursor-pointer"
            >
              <LogOut size={16} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
