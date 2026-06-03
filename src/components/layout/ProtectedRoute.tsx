import React, { useEffect } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
}

/**
 * ProtectedRoute - حماية المسارات بناءً على المصادقة والصلاحيات
 * 
 * - يتحقق من isAuthenticated
 * - يتحقق من الصلاحيات من قاعدة البيانات
 * - رسائل خطأ واضحة
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  permissions = [],
  requireAll = false,
}) => {
  const { isAuthenticated, isLoading, hasPermission, hasAllPermissions, hasAnyPermission, refreshUser } = useAuth();
  const location = useLocation();

  // تحديث الصلاحيات عند تغيير المسار
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      refreshUser();
    }
  }, [location.pathname, isAuthenticated, isLoading, refreshUser]);

  // حالة التحميل
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
          <p className="text-brand-700 font-medium text-lg">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  // لم يتم تسجيل الدخول
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // التحقق من الصلاحيات
  const hasRequiredPermissions = () => {
    if (permission) {
      return hasPermission(permission);
    }

    if (permissions.length > 0) {
      return requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);
    }

    return true;
  };

  if (!hasRequiredPermissions()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-brand-100 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">وصول غير مصرح به</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الشاشة.
            يرجى التواصل مع مشرف النظام.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg"
          >
            <Home size={18} />
            <span>العودة للرئيسية</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
