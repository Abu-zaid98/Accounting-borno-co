import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { motion } from 'framer-motion';
import { Gift, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

const loginSchema = zod.object({
  email: zod.string().min(1, 'البريد الإلكتروني مطلوب').email('صيغة البريد الإلكتروني غير صحيحة'),
  password: zod.string().min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف'),
  rememberMe: zod.boolean().optional(),
});

type LoginFormFields = zod.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormFields) => {
    setLoading(true);
    setServerError(null);
    try {
      await login(data.email, data.password, data.rememberMe);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setServerError(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-brand-50 via-brand-100 to-brand-200/50 p-4 md:p-6 lg:p-8 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-5xl w-full bg-white/85 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 overflow-hidden flex flex-col md:flex-row min-h-[600px]"
      >
        {/* Left Side: Aesthetic Brand Promo (Hidden on Mobile) */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950 p-12 flex-col justify-between relative overflow-hidden">
          {/* Ornamental backgrounds */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gold-400 flex items-center justify-center text-brand-950 shadow-lg">
              <Gift size={22} />
            </div>
            <span className="font-bold text-xl text-white tracking-wider">البورنو</span>
          </div>

          <div className="my-auto relative z-10 space-y-6">
            <h1 className="text-4xl font-extrabold text-white leading-tight">
              نظام المحاسبة <br />
              <span className="text-gold-300 font-bold">المتكامل لإدارة الهدايا</span>
            </h1>
            <p className="text-brand-200 text-sm leading-relaxed max-w-md">
              الخيار الاحترافي الأول لمتاجر الهدايا والتغليفات الراقية. إدارة ملفات الموظفين، الحضور والانصراف، احتساب الساعات الإضافية التلقائي، وإصدار مسيرات الرواتب بكشوف معتمدة A4 بضغطة زر.
            </p>
          </div>

          <div className="relative z-10 text-xs text-brand-300 flex items-center gap-1">
            <span>جميع الحقوق محفوظة © {new Date().getFullYear()} Eng.Mohammed ElJoujo</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white">
          <div className="mb-8 text-center md:text-right">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">مرحباً بك مجدداً</h2>
            <p className="text-gray-400 text-sm">سجل دخولك لمتابعة شؤون متجرك المالية والإدارية</p>
          </div>

          {serverError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-50 border-r-4 border-red-500 rounded-xl flex items-start gap-3 text-red-700 text-xs leading-relaxed"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 pointer-events-none">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  dir="ltr"
                  placeholder="admin@arbahy.com"
                  className={`w-full py-3 pr-11 pl-4 bg-gray-50/80 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                    ${errors.email ? 'border-red-400' : 'border-gray-200 focus:border-brand-500'}
                  `}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-[10px] pr-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">كلمة المرور</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 pointer-events-none">
                  <Lock size={16} />
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 hover:text-brand-500 transition-all cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <input
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  placeholder="••••••••"
                  className={`w-full py-3 pr-11 pl-11 bg-gray-50/80 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-right
                    ${errors.password ? 'border-red-400' : 'border-gray-200 focus:border-brand-500'}
                  `}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-[10px] pr-1">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Help */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4.5 h-4.5 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-500"
                  {...register('rememberMe')}
                />
                <span>تذكرني على هذا الجهاز</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-l from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <span>تسجيل الدخول للنظام</span>
              )}
            </button>
          </form>

          {/* Quick Login credentials display for demo */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs text-gray-500 text-center">
            <p>تجريبياً:</p>
            <p>البريد الإلكتروني: <code className="bg-gray-100 px-1 rounded">admin@gmail.com</code></p>
            <p>كلمة المرور: <code className="bg-gray-100 px-1 rounded">admin123</code></p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
