import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import type { EmployeeDocument } from '../../types';
import { X, Printer, Download, QrCode, ShieldCheck, Clock, Building } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface EmployeeQrModalProps {
  employee: EmployeeDocument | null;
  onClose: () => void;
}

export const EmployeeQrModal: React.FC<EmployeeQrModalProps> = ({ employee, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const badgeRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!employee) return;
    // We encode a standard JSON payload or fallback to employee.id
    const payload = JSON.stringify({
      type: 'EMP_ATTENDANCE',
      id: employee.id,
      employeeNo: employee.employeeNo,
    });

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 1,
      color: {
        dark: '#361e28', // Brand 950 color
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));
  }, [employee]);

  if (!employee) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${employee.employeeNo}_${employee.fullName}.png`;
    a.click();
  };

  const shiftLabel = employee.shiftType === 'evening' ? 'الوردية المسائية' : 'الوردية الصباحية';
  const shiftType = employee.shiftType || settings?.shiftType || 'morning';
  const shiftStart =
    employee.shiftStartTime ||
    settings?.shifts?.[shiftType]?.workStartTime ||
    (shiftType === 'evening' ? '12:00' : '09:00');
  const shiftEnd =
    employee.shiftEndTime ||
    settings?.shifts?.[shiftType]?.workEndTime ||
    (shiftType === 'evening' ? '21:00' : '18:00');
  const shiftTime = `${shiftStart} - ${shiftEnd}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/60 backdrop-blur-xs overflow-y-auto cursor-pointer"
      onClick={onClose}
    >
      {/* Modal Card */}
      <div
        className="bg-white rounded-3xl shadow-2xl border border-brand-100 max-w-md w-full overflow-hidden animate-fade-in my-8 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Hidden in Print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100 bg-brand-50/50 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-950 text-gold-400">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">بطاقة الـ QR الرسمية</h3>
              <p className="text-xs text-brand-600">لتسجيل الدوام والحضور الذكي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Badge Card for Display & Printing */}
        <div className="p-6">
          <div
            ref={badgeRef}
            className="bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950 text-white rounded-2xl p-6 shadow-xl border-2 border-gold-400/40 relative overflow-hidden"
          >
            {/* Top decorative gold line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600"></div>

            {/* Shop Watermark & Header */}
            <div className="text-center pb-4 border-b border-brand-800/60 mb-4">
              <span className="text-[10px] tracking-widest text-gold-400 font-bold block mb-1">
                البورنو لخدمات تغليف الهدايا الراقية
              </span>
              <h4 className="text-base font-extrabold text-white">بطاقة تعريف دوام الموظف</h4>
            </div>

            {/* Employee Details & Avatar */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-400/10 border-2 border-gold-400/40 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                {employee.avatarUrl ? (
                  <img src={employee.avatarUrl} alt={employee.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-gold-400">
                    {employee.fullName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate leading-snug">{employee.fullName}</h3>
                <p className="text-xs text-brand-200 font-medium truncate">{employee.jobTitle}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-gold-400/20 text-gold-300 font-semibold border border-gold-400/30">
                    <ShieldCheck size={12} />
                    {employee.employeeNo}
                  </span>
                </div>
              </div>
            </div>

            {/* Shift & Department Details */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-brand-950/70 border border-brand-800/80 text-xs mb-4">
              <div className="flex items-center gap-1.5 text-brand-200">
                <Building size={13} className="text-gold-400 shrink-0" />
                <span className="truncate">{employee.department}</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-200">
                <Clock size={13} className="text-gold-400 shrink-0" />
                <span className="truncate">{shiftLabel} ({shiftTime})</span>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-3 rounded-2xl shadow-lg flex flex-col items-center justify-center mx-auto max-w-[220px]">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Employee QR" className="w-48 h-48 object-contain" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-xs animate-pulse">
                  جارٍ إنشاء الكود...
                </div>
              )}
              <span className="text-[10px] text-gray-500 font-semibold tracking-wider mt-1.5">
                {employee.employeeNo}
              </span>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[10px] text-brand-300/80">
                يُمسح هذا الكود عند الدخول، الخروج المؤقت، العودة والانصراف
              </p>
            </div>
          </div>
        </div>

        {/* Actions Footer - Hidden in Print */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-brand-100 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            إغلاق
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs flex items-center gap-2 hover:bg-white transition-all cursor-pointer shadow-xs"
            >
              <Download size={15} />
              <span>تحميل الرمز (PNG)</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-brand-950 hover:bg-brand-900 text-gold-400 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Printer size={15} />
              <span>طباعة البطاقة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
