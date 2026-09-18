import React from 'react';
import { Loader2, Gift } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  variant?: 'card' | 'page' | 'inline' | 'skeleton';
  className?: string;
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'جارٍ تحميل البيانات...',
  subMessage = 'يرجى الانتظار لحظات بينما يتم جلب وتحديث السجلات',
  variant = 'card',
  className = '',
  rows = 3,
}) => {
  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-center gap-2 py-4 text-brand-900 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        <span className="text-xs font-bold">{message}</span>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={`relative bg-white rounded-3xl border border-brand-100/80 p-6 overflow-hidden shadow-xs ${className}`}>
        {/* Background placeholder pulses */}
        <div className="space-y-3 opacity-30">
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="h-16 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>

        {/* Floating Center Badge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 backdrop-blur-[1px] p-4 text-center">
          <div className="relative mb-3 flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Gift className="w-6 h-6 text-brand-950 animate-bounce" />
            </div>
            <Loader2 className="w-16 h-16 text-amber-500/80 animate-spin absolute" strokeWidth={1.5} />
          </div>
          <h4 className="font-extrabold text-brand-950 text-sm">{message}</h4>
          {subMessage && <p className="text-[11px] text-gray-500 mt-1 max-w-xs">{subMessage}</p>}
        </div>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={`min-h-[50vh] flex flex-col items-center justify-center p-6 text-center ${className}`}>
        <div className="relative mb-4 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Gift className="w-7 h-7 text-brand-950 animate-bounce" />
          </div>
          <Loader2 className="w-20 h-20 text-amber-500/80 animate-spin absolute" strokeWidth={1.5} />
        </div>
        <h3 className="font-black text-brand-950 text-base sm:text-lg mb-1">{message}</h3>
        {subMessage && <p className="text-xs text-gray-500 max-w-sm">{subMessage}</p>}
      </div>
    );
  }

  // Default: 'card'
  return (
    <div className={`bg-white rounded-3xl border border-brand-100/80 p-8 sm:p-12 text-center flex flex-col items-center justify-center shadow-xs ${className}`}>
      <div className="relative mb-3.5 flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 flex items-center justify-center shadow-md shadow-amber-500/20">
          <Gift className="w-6 h-6 text-brand-950 animate-bounce" />
        </div>
        <Loader2 className="w-16 h-16 text-amber-500/80 animate-spin absolute" strokeWidth={1.5} />
      </div>
      <h4 className="font-extrabold text-brand-950 text-sm sm:text-base">{message}</h4>
      {subMessage && <p className="text-xs text-gray-500 mt-1 max-w-xs">{subMessage}</p>}
    </div>
  );
};
