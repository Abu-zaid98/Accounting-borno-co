import React from 'react';
import { AlertTriangle, Trash2, Info, CheckCircle2, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig: Record<ConfirmVariant, {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  confirmBtn: string;
  titleColor: string;
}> = {
  danger: {
    icon: <Trash2 size={22} />,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmBtn: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200',
    titleColor: 'text-red-700',
  },
  warning: {
    icon: <AlertTriangle size={22} />,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200',
    titleColor: 'text-amber-700',
  },
  info: {
    icon: <Info size={22} />,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
    titleColor: 'text-blue-700',
  },
  success: {
    icon: <CheckCircle2 size={22} />,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200',
    titleColor: 'text-emerald-700',
  },
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const cfg = variantConfig[variant];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(10,15,40,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden max-h-[90svh] flex flex-col"
        style={{ animation: 'scaleIn 0.18s cubic-bezier(.4,0,.2,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div className={`w-12 h-12 rounded-2xl ${cfg.iconBg} ${cfg.iconColor} flex items-center justify-center shadow-sm`}>
            {cfg.icon}
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-4 pb-6 space-y-2 overflow-y-auto">
          <h3 className={`text-base font-extrabold ${cfg.titleColor}`}>{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md ${cfg.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmModal;
