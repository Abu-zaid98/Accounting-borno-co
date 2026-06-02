import React, { useEffect } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  requireSuperAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission, requireSuperAdmin = false }) => {
  const { user, loading, hasPermission, refreshUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      refreshUser();
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-height-svh flex items-center justify-center bg-brand-50 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
          <p className="text-brand-700 font-medium text-lg">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if ((requireSuperAdmin && user.role !== 'super_admin') || (permission && !hasPermission(permission))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-brand-100 p-8 text-center animate-fade-in">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">وصول غير مصرح به!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الشاشة. يرجى التواصل مع مشرف النظام لمراجعة أذونات حسابك.
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
