import React from 'react';
import { WifiOff } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export const OfflineAlert: React.FC = () => {
  const { isOnline } = usePwaInstall();

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white text-xs sm:text-sm font-medium py-1.5 px-3 flex items-center justify-center gap-2 shadow-md animate-slide-down sticky top-0 z-50">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>أنت تعمل حالياً دون اتصال بالإنترنت (Offline Mode). البيانات محفوظة محلياً.</span>
    </div>
  );
};
