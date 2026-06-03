import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { Gift, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Error is handled in context and displayed automatically
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl mix-blend-screen animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-indigo-600/20 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 w-full max-w-md p-8"
      >
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle gradient border effect */}
          <div className="absolute inset-0 border-2 border-transparent rounded-3xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

          {/* Logo Section */}
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-600 to-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-500/30 mb-4"
            >
              <Gift className="text-slate-900 w-8 h-8" />
            </motion.div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-1">
              البورنو المحاسبي
            </h1>
            <p className="text-slate-300/80 text-sm tracking-widest mt-1">النظام الإداري والمالي الفاخر</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center"
              >
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-yellow-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearError(); }}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pr-12 pl-4 text-white placeholder-slate-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-right"
                  placeholder="اسم المستخدم"
                  dir="rtl"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-yellow-400 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pr-12 pl-4 text-white placeholder-slate-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-right"
                  placeholder="كلمة المرور"
                  dir="rtl"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-400 text-slate-950 font-bold py-3.5 px-4 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -skew-x-12 -translate-x-full" />
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </>
                )}
              </div>
            </button>
          </form>

        </div>
      </motion.div>
    </div>
  );
};
