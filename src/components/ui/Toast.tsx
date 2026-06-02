import React, { useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-500" />,
  error:   <XCircle size={18} className="text-red-500" />,
  warning: <AlertTriangle size={18} className="text-amber-500" />,
  info:    <Info size={18} className="text-blue-500" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-white',
  error:   'border-red-200 bg-white',
  warning: 'border-amber-200 bg-white',
  info:    'border-blue-200 bg-white',
};

const barMap: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast_${Date.now()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 left-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm p-4 rounded-2xl border shadow-xl ${bgMap[t.type]}`}
            style={{ animation: 'slideInLeft 0.25s cubic-bezier(.4,0,.2,1)' }}
          >
            <div className="shrink-0 mt-0.5">{iconMap[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">{t.title}</p>
              {t.message && <p className="text-xs text-gray-500 mt-0.5">{t.message}</p>}
              <div
                className={`h-0.5 mt-2 rounded-full ${barMap[t.type]}`}
                style={{ animation: 'shrinkBar 4s linear forwards' }}
              />
            </div>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 text-gray-400 hover:text-gray-600 cursor-pointer mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shrinkBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export default ToastProvider;
