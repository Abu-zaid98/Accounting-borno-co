import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/db';
import { useSettings } from '../../context/SettingsContext';
import { DEFAULT_ATTENDANCE_SETTINGS } from '../../services/attendance';
import type { AttendanceShiftSettings, ShiftType } from '../../types';
import { Settings as  Save, CheckCircle2, Gift, Building2, Timer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const shiftLabels: Record<ShiftType, string> = {
  morning: 'صباحي',
  evening: 'مسائي',
};

export const Settings: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');

  const [shopName, setShopName] = useState('');
  const [dailyWorkingHours, setDailyWorkingHours] = useState(8);
  const [overtimeRateType, setOvertimeRateType] = useState<'auto' | 'fixed'>('auto');
  const [fixedOvertimeRate, setFixedOvertimeRate] = useState(25);
  const [globalCurrency, setGlobalCurrency] = useState('ر.س');
  const [shiftType, setShiftType] = useState<'morning' | 'evening'>('morning');
  const [shiftDrafts, setShiftDrafts] = useState<Record<ShiftType, AttendanceShiftSettings>>(DEFAULT_ATTENDANCE_SETTINGS.shifts);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const { settings, loading, refreshSettings } = useSettings();

  useEffect(() => {
    if (!settings) return;
    setShopName(settings.shopName);
    setDailyWorkingHours(settings.dailyWorkingHours);
    setOvertimeRateType(settings.overtimeRateType);
    setFixedOvertimeRate(settings.fixedOvertimeRate);
    setGlobalCurrency(settings.globalCurrency ?? settings.currency ?? 'ر.س');
    setShiftType(settings.shiftType);
    // (Global states removed from UI, keeping shifts only)
    setShiftDrafts({
      ...DEFAULT_ATTENDANCE_SETTINGS.shifts,
      ...(settings.shifts ?? {}),
    });
  }, [settings]);

  const updateShiftDraft = (
    shift: ShiftType,
    patch: Partial<AttendanceShiftSettings>
  ) => {
    setShiftDrafts(current => ({
      ...current,
      [shift]: {
        ...current[shift],
        ...patch,
        shiftType: shift,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.updateSettings({
        shopName,
        dailyWorkingHours,
        overtimeRateType,
        fixedOvertimeRate,
        globalCurrency,
        currency: globalCurrency,
        shiftType,
        workStartTime: shiftDrafts[shiftType].workStartTime,
        workEndTime: shiftDrafts[shiftType].workEndTime,
        gracePeriodMinutes: shiftDrafts[shiftType].gracePeriodMinutes,
        lateRule: shiftDrafts[shiftType].lateRule,
        absenceRule: shiftDrafts[shiftType].absenceRule,
        shifts: shiftDrafts,
      });
      await refreshSettings();
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      alert("حدث خطأ أثناء حفظ الإعدادات.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-gray-400">جاري تحميل إعدادات المتجر المحاسبية...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {showSuccessToast && (
        <div className="fixed bottom-6 left-6 bg-emerald-600 border border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={18} />
          <span className="text-xs font-bold font-sans">تم حفظ الإعدادات المحاسبية بنجاح!</span>
        </div>
      )}

      {/* Header section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">الإعدادات العامة وإعدادات الرواتب</h1>
        <p className="text-xs text-gray-400 mt-1">تهيئة البيانات الإدارية العامة لمحلات الهدايا وتعيين قيم ومعدلات الساعات الإضافية الرسمية.</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right side inputs */}
        <div className="lg:col-span-2 space-y-6 bg-white p-6 md:p-8 rounded-3xl border border-brand-100 shadow-xs">
          
          {/* Shop Details */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 text-xs border-r-4 border-gold-500 pr-2 flex items-center gap-1.5">
              <Building2 size={16} className="text-gray-500" />
              <span>هوية المحل التجارية</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">اسم المتجر / المحل (عربي)</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="البورنو لخدمات تغليف الهدايا"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">العملة الافتراضية</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                  value={globalCurrency}
                  onChange={(e) => setGlobalCurrency(e.target.value)}
                  placeholder="ر.س"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-brand-50">
            <h3 className="font-bold text-gray-800 text-xs border-r-4 border-gold-500 pr-2 flex items-center gap-1.5">
              <Timer size={16} className="text-gray-500" />
              <span>إعدادات الحضور والشفتات</span>
            </h3>

            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 mb-6">
              <div className="max-w-xs space-y-2">
                <label className="text-xs font-bold text-gray-800">نوع الشفت الافتراضي للمتجر</label>
                <select
                  disabled={!canEdit}
                  className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs text-right font-bold text-brand-700 focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value as 'morning' | 'evening')}
                >
                  <option value="morning">الشفت الصباحي</option>
                  <option value="evening">الشفت المسائي</option>
                </select>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  سيتم اعتماد هذا الشفت كافتراضي للموظفين الجدد وسيتم تطبيق قوانينه بشكل أساسي عند حساب التأخير والغياب ما لم يتم تخصيص شفت للموظف.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {(Object.keys(shiftDrafts) as ShiftType[]).map((shift) => (
                <div key={shift} className="border border-brand-100 rounded-2xl p-4 bg-gray-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-brand-900">نظام دوام {shiftLabels[shift]}</h4>
                    <span className="text-[10px] font-bold text-gray-400">قاعدة حالية</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-600">بداية الشفت</label>
                      <input
                        type="time"
                        disabled={!canEdit}
                        className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs text-right disabled:opacity-75 disabled:cursor-not-allowed"
                        value={shiftDrafts[shift].workStartTime}
                        onChange={(e) => updateShiftDraft(shift, { workStartTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-600">نهاية الشفت</label>
                      <input
                        type="time"
                        disabled={!canEdit}
                        className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs text-right disabled:opacity-75 disabled:cursor-not-allowed"
                        value={shiftDrafts[shift].workEndTime}
                        onChange={(e) => updateShiftDraft(shift, { workEndTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-600">السماح</label>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs text-right disabled:opacity-75 disabled:cursor-not-allowed"
                        value={shiftDrafts[shift].gracePeriodMinutes}
                        onChange={(e) => updateShiftDraft(shift, { gracePeriodMinutes: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-600">التأخير بعد</label>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs text-right disabled:opacity-75 disabled:cursor-not-allowed"
                        value={shiftDrafts[shift].lateRule.afterMinutes}
                        onChange={(e) => updateShiftDraft(shift, { lateRule: { afterMinutes: Number(e.target.value) } })}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-bold text-gray-600">الغياب بعد</label>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs text-right disabled:opacity-75 disabled:cursor-not-allowed"
                        value={shiftDrafts[shift].absenceRule.afterMinutes}
                        onChange={(e) => updateShiftDraft(shift, { absenceRule: { afterMinutes: Number(e.target.value) } })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>


          </div>

          {/* Overtime & Working Hours Settings */}
          <div className="space-y-4 pt-6 border-t border-brand-50">
            <h3 className="font-bold text-gray-800 text-xs border-r-4 border-gold-500 pr-2 flex items-center gap-1.5">
              <Timer size={16} className="text-gray-500" />
              <span>محددات ومعادلات الدوام الإضافي</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">ساعات الدوام اليومية الرسمية</label>
                <input
                  type="number"
                  disabled={!canEdit}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                  value={dailyWorkingHours}
                  onChange={(e) => setDailyWorkingHours(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">طريقة احتساب الساعة الإضافية</label>
                <select
                  disabled={!canEdit}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right disabled:opacity-75 disabled:cursor-not-allowed"
                  value={overtimeRateType}
                  onChange={(e: any) => setOvertimeRateType(e.target.value)}
                >
                  <option value="auto">تلقائي من الراتب الأساسي (1.5x)</option>
                  <option value="fixed">سعر ساعة ثابت ومحدد</option>
                </select>
              </div>
            </div>

            {overtimeRateType === 'fixed' && (
              <div className="space-y-1 max-w-xs animate-scale-in">
                <label className="text-xs font-bold text-gray-600">سعر الساعة الإضافية الثابت ({globalCurrency})</label>
                <input
                  type="number"
                  disabled={!canEdit}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-right focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                  value={fixedOvertimeRate}
                  onChange={(e) => setFixedOvertimeRate(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center justify-end pt-6 border-t border-brand-50">
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-l from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Save size={16} />
                <span>حفظ الإعدادات المالية</span>
              </button>
            </div>
          )}
        </div>

        {/* Left side details/help banner */}
        <div className="space-y-6">
          <div className="bg-brand-950 text-white p-6 rounded-3xl border border-brand-900 shadow-lg space-y-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400 text-brand-950 flex items-center justify-center font-bold">
              <Gift size={20} />
            </div>
            <h3 className="font-bold text-base text-white">معادلات احتساب الرواتب التلقائية</h3>
            <div className="space-y-3 text-[11px] text-brand-200 leading-relaxed">
              <p>• <strong>الأجر الأساسي بالساعة:</strong> الراتب الأساسي ÷ 30 يوماً ÷ عدد ساعات العمل اليومية الرسمية.</p>
              <p>• <strong>قيمة الأجر الإضافي التلقائي:</strong> الساعات الإضافية المعتمدة × أجر ساعة العمل الأساسية × مضاعف 1.5x المعتمد بالمملكة وقوانين العمل.</p>
              <p>• <strong>الخصومات التلقائية للغياب:</strong> (الراتب الأساسي ÷ 30 يوماً) × عدد أيام الغياب المسجلة بالتحضير.</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
export default Settings;
