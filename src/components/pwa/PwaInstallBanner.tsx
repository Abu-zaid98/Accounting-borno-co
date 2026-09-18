import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export const PwaInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIos, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    // Check if user dismissed it during this session
    const isDismissed = sessionStorage.getItem('pwa_banner_dismissed') === 'true';
    if (isDismissed) setDismissed(true);
  }, []);

  if (isInstalled || dismissed) return null;
  // Show if installable OR on iOS (Safari doesn't fire beforeinstallprompt)
  if (!isInstallable && !isIos) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
    } else {
      await promptInstall();
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 border-b border-brand-800/80 text-white px-3 sm:px-4 py-2 sm:py-2.5 shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm z-40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="font-bold text-white truncate">تثبيت تطبيق البورنو على هاتفك</p>
            <p className="text-[11px] text-brand-200 hidden sm:block truncate">
              استمتع بالوصول السريع، شاشة كاملة، وتجربة سلسة بدون متصفح
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-brand-950 font-bold rounded-lg shadow transition text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تثبيت التطبيق</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-brand-300 hover:text-white rounded-lg hover:bg-brand-800/50 transition"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 text-right animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="font-bold text-brand-950 text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-600" />
                تثبيت على أجهزة آيفون (iOS)
              </h3>
              <button
                onClick={() => setShowIosModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
              <div className="flex items-start gap-2.5 p-2.5 bg-brand-50/70 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-brand-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <p>اضغط على زر <strong>المشاركة (Share <Share className="w-3.5 h-3.5 inline mx-0.5" />)</strong> في شريط متصفح Safari السفلي.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 bg-brand-50/70 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-brand-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <p>مرر للأسفل واضغط على <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 bg-brand-50/70 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-brand-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <p>اضغط على <strong>إضافة (Add)</strong> في الزاوية العلوية ليظهر التطبيق كأيقونة على شاشتك الرئيسية.</p>
              </div>
            </div>
            <button
              onClick={() => setShowIosModal(false)}
              className="mt-5 w-full py-2.5 bg-brand-900 hover:bg-brand-950 text-white font-bold rounded-xl text-xs transition"
            >
              فهمت ذلك
            </button>
          </div>
        </div>
      )}
    </>
  );
};
