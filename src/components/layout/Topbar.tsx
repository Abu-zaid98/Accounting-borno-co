import React, { useState, useEffect } from 'react';
import { Menu, Calendar, Bell, ChevronLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface TopbarProps {
  onMenuToggle: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuToggle }) => {
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(new Date().toLocaleDateString('ar-SA', options));
  }, []);

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard': return 'لوحة التحكم والإحصائيات الكلية';
      case '/employees': return 'ملفات موظفي المتجر';
      case '/attendance': return 'سجل التحضير اليومي والدوام';
      case '/overtime': return 'سجل الساعات الإضافية والأجور';
      case '/salaries': return 'كشوفات ومستحقات الرواتب';
      case '/reports': return 'التقارير والمخرجات المالية';
      case '/users': return 'إدارة مستخدمي النظام والصلاحيات';
      case '/settings': return 'إعدادات النظام العامة والمعادلات';
      default: return 'النظام المحاسبي لإدارة شؤون الموظفين';
    }
  };

  return (
    <header className="h-20 bg-white border-b border-brand-100 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Right side: Page Title & Mobile Toggle */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-brand-700 hover:bg-brand-50 transition-all border border-brand-100 cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 className="font-bold text-lg text-gray-800 leading-tight">
            {getPageTitle(location.pathname)}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-brand-500 font-medium mt-1">
            <span>الرئيسية</span>
            <ChevronLeft size={12} />
            <span className="text-gray-500">{getPageTitle(location.pathname).split(' ')[0]}</span>
          </div>
        </div>
      </div>

      {/* Left side: Date & Notifications */}
      <div className="flex items-center gap-4">
        {/* Date Display */}
        <div className="hidden md:flex items-center gap-2.5 px-4 py-2 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-800 font-medium">
          <Calendar size={15} className="text-brand-500" />
          <span>{currentDate}</span>
        </div>

        {/* Notifications mock icon */}
        <div className="relative">
          <button className="p-2.5 rounded-xl hover:bg-brand-50 text-gray-500 hover:text-brand-700 transition-all border border-brand-100 cursor-pointer">
            <Bell size={18} />
          </button>
          <span className="absolute top-1 left-1 w-2.5 h-2.5 bg-gold-500 border-2 border-white rounded-full animate-ping"></span>
        </div>
      </div>
    </header>
  );
};
