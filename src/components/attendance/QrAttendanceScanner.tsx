import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import type { AttendanceDocument, EmployeeDocument, TemporaryExitRecord } from '../../types';
import { dbService } from '../../services/db';
import { calculateWorkingHours } from '../../services/attendance';
import { useSettings } from '../../context/SettingsContext';
import {
  Camera,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  ArrowRightLeft,
  Zap,
  Volume2,
  VolumeX,
  Upload,
  Keyboard,
  SwitchCamera,
  Search,
} from 'lucide-react';

interface QrAttendanceScannerProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeDocument[];
  todayDate: string;
  attendanceRecords: AttendanceDocument[];
  onAttendanceUpdated: () => Promise<void>;
}

interface CameraDevice {
  id: string;
  label: string;
}

export const QrAttendanceScanner: React.FC<QrAttendanceScannerProps> = ({
  isOpen,
  onClose,
  employees,
  todayDate,
  attendanceRecords,
  onAttendanceUpdated,
}) => {
  const { settings } = useSettings();
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'upload'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    employeeName?: string;
  } | null>(null);

  // When a present employee is scanned, choose temporary exit or final check-out
  const [choicePrompt, setChoicePrompt] = useState<{
    employee: EmployeeDocument;
    record: AttendanceDocument;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ id: string; time: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Audio chime via Web Audio API
  const playBeep = (type: 'success' | 'warning' = 'success') => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  const triggerVibration = () => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
  };

  // Stop current camera cleanly
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error clearing scanner:', e);
      }
      html5QrCodeRef.current = null;
    }
  };

  // Start Camera with exact deviceId or fallbacks
  const startCamera = async (deviceId?: string) => {
    const scannerId = 'attendance-qr-reader';
    const scannerElem = document.getElementById(scannerId);
    if (!scannerElem) return;

    await stopScanner();

    try {
      setCameraError(null);
      setScannerReady(false);

      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      // 1. Get available cameras if not already populated
      let targetId = deviceId;
      if (!targetId) {
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            setAvailableCameras(cameras);
            // Look for back camera
            const backCam = cameras.find((c) => /back|rear|environment|خلف/i.test(c.label));
            targetId = backCam ? backCam.id : cameras[0].id;
            setSelectedCameraId(targetId);
          }
        } catch (camErr) {
          console.warn('Could not enumerate cameras, will use generic constraints:', camErr);
        }
      }

      // 2. Start scanning with exact camera ID if available, or fallback to simple constraints
      const cameraConfig = targetId ? targetId : { facingMode: 'user' };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleQrScanned(decodedText);
        },
        () => {
          // Ignore frame scan parsing errors
        }
      );

      setScannerReady(true);
    } catch (err: unknown) {
      console.error('Camera start error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Timeout') || msg.includes('AbortError') || msg.includes('NotAllowedError')) {
        setCameraError(
          'الكاميرا مشغولة أو استغرقت وقتاً طويلاً للتشغيل. يمكنك اختيار كاميرا أخرى، أو استخدام إدخال رقم الموظف يدوياً بالأسفل.'
        );
      } else {
        setCameraError(`تعذر فتح الكاميرا: ${msg}`);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    if (activeTab === 'camera') {
      const timer = setTimeout(() => {
        startCamera(selectedCameraId || undefined);
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, activeTab, selectedCameraId]);

  // Handle scanned string
  const handleQrScanned = async (text: string) => {
    if (isProcessing || choicePrompt) return;

    // Cooldown check (prevent repeated rapid scans of the same code within 3.5s)
    const now = Date.now();
    if (
      lastScannedRef.current &&
      lastScannedRef.current.id === text &&
      now - lastScannedRef.current.time < 3500
    ) {
      return;
    }

    // Parse decoded text
    let targetEmployeeId = text.trim();
    try {
      if (text.startsWith('{') && text.endsWith('}')) {
        const parsed = JSON.parse(text);
        if (parsed.id) targetEmployeeId = parsed.id;
        else if (parsed.employeeNo) targetEmployeeId = parsed.employeeNo;
      }
    } catch {
      // Use raw text
    }

    const employee = employees.find(
      (e) =>
        e.id === targetEmployeeId ||
        e.employeeNo.toLowerCase() === targetEmployeeId.toLowerCase() ||
        e.fullName.toLowerCase() === targetEmployeeId.toLowerCase()
    );

    if (!employee) {
      playBeep('warning');
      setFeedback({
        type: 'error',
        title: 'رمز غير معرّف',
        message: `لم يتم العثور على موظف مطابق للرمز (${targetEmployeeId}) في قائمة الموظفين النشطين.`,
      });
      return;
    }

    lastScannedRef.current = { id: text, time: now };

    // Identify current attendance record for today
    const currentRecord = attendanceRecords.find(
      (r) => r.employeeId === employee.id && r.date === todayDate
    );

    await processAttendanceStateMachine(employee, currentRecord);
  };

  // State Machine logic
  const processAttendanceStateMachine = async (
    employee: EmployeeDocument,
    record?: AttendanceDocument
  ) => {
    const nowIso = new Date().toISOString();
    const formattedTime = new Date().toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // CASE 1: No record today -> Check-In (دخول)
    if (!record || record.status === 'absent') {
      setIsProcessing(true);
      try {
        const shiftType = employee.shiftType || settings?.shiftType || 'morning';
        const shiftSettings = settings?.shifts?.[shiftType];
        const scheduledStartTime =
          employee.shiftStartTime ||
          shiftSettings?.workStartTime ||
          (shiftType === 'evening' ? '12:00' : '09:00');
        const scheduledEndTime =
          employee.shiftEndTime ||
          shiftSettings?.workEndTime ||
          (shiftType === 'evening' ? '21:00' : '18:00');

        const newRecord: AttendanceDocument = {
          id: `${employee.id}_${todayDate}`,
          employeeId: employee.id,
          employeeName: employee.fullName,
          date: todayDate,
          checkIn: nowIso,
          workingHours: 0,
          status: 'present',
          shiftType,
          scheduledStartTime,
          scheduledEndTime,
          temporaryExits: [],
          createdAt: nowIso,
          updatedAt: nowIso,
          auditTrail: [
            {
              id: `audit_${Date.now()}`,
              action: 'check_in',
              changedBy: 'qr_scanner',
              changedAt: nowIso,
              after: { checkIn: nowIso, status: 'present', shiftType },
            },
          ],
        };

        await dbService.recordAttendance(newRecord);
        await onAttendanceUpdated();
        playBeep('success');
        triggerVibration();
        setFeedback({
          type: 'success',
          title: 'تسجيل دخول ناجح',
          message: `تم توثيق وقت الحضور: ${formattedTime} (الوردية: ${
            shiftType === 'evening' ? 'مسائية' : 'صباحية'
          })`,
          employeeName: employee.fullName,
        });
      } catch (err: unknown) {
        console.error(err);
        const msg = err instanceof Error ? err.message : String(err);
        setFeedback({ type: 'error', title: 'فشل التسجيل', message: msg });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // CASE 2: In Temporary Exit -> Return to work (عودة من خروج مؤقت)
    if (record.status === 'temporary_exit') {
      setIsProcessing(true);
      try {
        const updatedExits: TemporaryExitRecord[] = [...(record.temporaryExits || [])];
        const openExitIdx = updatedExits.findIndex((e) => !e.returnTime);
        if (openExitIdx !== -1) {
          updatedExits[openExitIdx] = {
            ...updatedExits[openExitIdx],
            returnTime: nowIso,
          };
        } else {
          updatedExits.push({
            id: `exit_${Date.now()}`,
            exitTime: record.updatedAt || nowIso,
            returnTime: nowIso,
          });
        }

        const updatedRecord: AttendanceDocument = {
          ...record,
          status: 'present',
          temporaryExits: updatedExits,
          updatedAt: nowIso,
          auditTrail: [
            ...(record.auditTrail || []),
            {
              id: `audit_${Date.now()}`,
              action: 'temporary_return',
              changedBy: 'qr_scanner',
              changedAt: nowIso,
              after: { status: 'present' },
            },
          ],
        };

        await dbService.recordAttendance(updatedRecord);
        await onAttendanceUpdated();
        playBeep('success');
        triggerVibration();
        setFeedback({
          type: 'success',
          title: 'تسجيل عودة من خروج مؤقت',
          message: `أهلاً بعودتك! تم توثيق وقت العودة: ${formattedTime}`,
          employeeName: employee.fullName,
        });
      } catch (err: unknown) {
        console.error(err);
        const msg = err instanceof Error ? err.message : String(err);
        setFeedback({ type: 'error', title: 'فشل التسجيل', message: msg });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // CASE 3: Checked out -> Closed for today
    if (record.status === 'checked_out') {
      playBeep('warning');
      setFeedback({
        type: 'warning',
        title: 'تم الانصراف مسبقاً',
        message: `الموظف أتم تسجيل الانصراف النهائي لهذا اليوم بالفعل الساعة: ${
          record.checkOut
            ? new Date(record.checkOut).toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'
        }`,
        employeeName: employee.fullName,
      });
      return;
    }

    // CASE 4: Present (حاضر) -> Choose Temporary Exit OR Final Check-out
    if (record.status === 'present') {
      playBeep('success');
      setChoicePrompt({ employee, record });
    }
  };

  // Process Temporary Exit Choice
  const handleConfirmTemporaryExit = async () => {
    if (!choicePrompt) return;
    const { employee, record } = choicePrompt;
    setIsProcessing(true);
    setChoicePrompt(null);
    const nowIso = new Date().toISOString();
    const formattedTime = new Date().toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      const newExit: TemporaryExitRecord = {
        id: `exit_${Date.now()}`,
        exitTime: nowIso,
      };

      const updatedRecord: AttendanceDocument = {
        ...record,
        status: 'temporary_exit',
        temporaryExits: [...(record.temporaryExits || []), newExit],
        updatedAt: nowIso,
        auditTrail: [
          ...(record.auditTrail || []),
          {
            id: `audit_${Date.now()}`,
            action: 'temporary_exit',
            changedBy: 'qr_scanner',
            changedAt: nowIso,
            after: { status: 'temporary_exit' },
          },
        ],
      };

      await dbService.recordAttendance(updatedRecord);
      await onAttendanceUpdated();
      playBeep('success');
      triggerVibration();
      setFeedback({
        type: 'success',
        title: 'تسجيل خروج مؤقت',
        message: `تم توثيق وقت المغادرة المؤقتة: ${formattedTime}`,
        employeeName: employee.fullName,
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', title: 'فشل التسجيل', message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process Final Check-out Choice
  const handleConfirmFinalCheckOut = async () => {
    if (!choicePrompt) return;
    const { employee, record } = choicePrompt;
    setIsProcessing(true);
    setChoicePrompt(null);
    const nowIso = new Date().toISOString();
    const formattedTime = new Date().toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      const hours = calculateWorkingHours(record.checkIn, nowIso, record.temporaryExits);

      const updatedRecord: AttendanceDocument = {
        ...record,
        checkOut: nowIso,
        status: 'checked_out',
        workingHours: hours,
        updatedAt: nowIso,
        auditTrail: [
          ...(record.auditTrail || []),
          {
            id: `audit_${Date.now()}`,
            action: 'check_out',
            changedBy: 'qr_scanner',
            changedAt: nowIso,
            after: { checkOut: nowIso, status: 'checked_out', workingHours: hours },
          },
        ],
      };

      await dbService.recordAttendance(updatedRecord);
      await onAttendanceUpdated();
      playBeep('success');
      triggerVibration();
      setFeedback({
        type: 'success',
        title: 'تسجيل انصراف نهائي',
        message: `تم توثيق الانصراف: ${formattedTime} (إجمالي ساعات العمل: ${hours} ساعة)`,
        employeeName: employee.fullName,
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', title: 'فشل التسجيل', message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual submission handler
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleQrScanned(manualCode.trim());
    setManualCode('');
  };

  // File upload scanner
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFeedback(null);
      const tempScanner = new Html5Qrcode('attendance-qr-reader');
      const decodedResult = await tempScanner.scanFile(file, true);
      await handleQrScanned(decodedResult);
    } catch (err) {
      console.error('File scan error:', err);
      playBeep('warning');
      setFeedback({
        type: 'error',
        title: 'تعذر قراءة الصورة',
        message: 'لم يتم العثور على رمز QR صالح في الصورة المحددة.',
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-950/80 backdrop-blur-xs overflow-y-auto cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-brand-950 border border-brand-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in flex flex-col my-4 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scanner Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-800/80 bg-brand-900/40">
          <div className="flex items-center gap-2.5 text-white">
            <div className="p-2 rounded-xl bg-gold-400 text-brand-950 shadow-md">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">ماسح الـ QR للدوام الذكي</h3>
              <p className="text-[11px] text-brand-300">تسجيل فوري للدخول والخروج المؤقت والانصراف</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl text-brand-300 hover:text-white hover:bg-brand-800/50 transition-all cursor-pointer"
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل التنبيه الصوتي'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-brand-300 hover:text-white hover:bg-brand-800/50 transition-all cursor-pointer"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs: Camera vs Manual Code vs Upload */}
        <div className="flex border-b border-brand-800/60 bg-brand-950/60 px-4 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-brand-300 hover:text-white'
            }`}
          >
            <Camera size={14} />
            <span>كاميرا الهاتف / الجهاز</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-brand-300 hover:text-white'
            }`}
          >
            <Keyboard size={14} />
            <span>إدخال يدوي / باركود</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              fileInputRef.current?.click();
            }}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-brand-300 hover:text-white'
            }`}
          >
            <Upload size={14} />
            <span>رفع صورة QR</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center relative bg-brand-950">
          {/* TAB 1: CAMERA */}
          {activeTab === 'camera' && (
            <div className="w-full flex flex-col items-center">
              {/* Camera Switcher (if multiple cameras available) */}
              {availableCameras.length > 1 && (
                <div className="w-full max-w-[320px] mb-3 flex items-center gap-2">
                  <SwitchCamera size={15} className="text-gold-400 shrink-0" />
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startCamera(e.target.value);
                    }}
                    className="w-full py-1.5 px-2 bg-brand-900 border border-brand-800 rounded-xl text-[11px] text-brand-200 focus:outline-hidden"
                  >
                    {availableCameras.map((cam, idx) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `كاميرا ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Camera Video Frame */}
              <div className="w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden border-2 border-gold-400/40 relative shadow-inner bg-black flex items-center justify-center">
                <div id="attendance-qr-reader" className="w-full h-full object-cover"></div>

                {/* Crosshair Overlay */}
                {scannerReady && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-gold-400/80 rounded-2xl relative">
                      <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-gold-400 rounded-tl"></span>
                      <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-gold-400 rounded-tr"></span>
                      <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-gold-400 rounded-bl"></span>
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-gold-400 rounded-br"></span>
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-lg shadow-gold-400/50"></div>
                    </div>
                  </div>
                )}

                {/* Loading status */}
                {!scannerReady && !cameraError && (
                  <div className="absolute inset-0 bg-brand-950 flex flex-col items-center justify-center text-center p-4">
                    <RefreshCw size={28} className="text-gold-400 animate-spin mb-2" />
                    <p className="text-xs text-brand-200 font-medium">جارٍ تشغيل الكاميرا...</p>
                  </div>
                )}

                {/* Error status & Fallback */}
                {cameraError && (
                  <div className="absolute inset-0 bg-brand-950/95 flex flex-col items-center justify-center text-center p-4">
                    <AlertTriangle size={32} className="text-amber-400 mb-2" />
                    <p className="text-xs text-amber-200 font-bold mb-1">تعذر الاتصال بالكاميرا</p>
                    <p className="text-[11px] text-brand-300 mb-3 px-2 leading-relaxed">
                      {cameraError}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startCamera(selectedCameraId || undefined)}
                        className="px-3 py-1.5 bg-brand-800 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw size={12} />
                        <span>إعادة المحاولة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('manual')}
                        className="px-3 py-1.5 bg-gold-500 hover:bg-gold-600 text-brand-950 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Keyboard size={12} />
                        <span>الإدخال اليدوي</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-brand-300 text-center mt-3 font-medium">
                وجّه الكاميرا نحو بطاقة الموظف أو رمز الـ QR لتسجيل الحركة آلياً
              </p>
            </div>
          )}

          {/* TAB 2: MANUAL ENTRY */}
          {activeTab === 'manual' && (
            <form
              onSubmit={handleManualSubmit}
              className="w-full max-w-[340px] space-y-4 text-right py-4"
            >
              <div className="text-center mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gold-400/10 border border-gold-400/30 text-gold-400 flex items-center justify-center mx-auto mb-2">
                  <Keyboard size={22} />
                </div>
                <h4 className="text-sm font-bold text-white">إدخال رقم أو كود الموظف يدوياً</h4>
                <p className="text-[11px] text-brand-300">
                  يمكنك أيضاً استخدام قارئ الباركود الخارجي (Barcode USB Scanner)
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-brand-200 block">
                  رقم الموظف أو اسمه
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="مثال: EMP-001 أو معرّف الموظف"
                    autoFocus
                    className="w-full py-3 px-4 bg-brand-900/80 border border-brand-700 rounded-2xl text-sm font-bold text-white placeholder-brand-500 focus:outline-hidden focus:ring-2 focus:ring-gold-400 text-right"
                  />
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-400 pointer-events-none">
                    <Search size={16} />
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!manualCode.trim() || isProcessing}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-brand-950 font-extrabold text-sm shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'جارٍ المعالجة...' : 'تسجيل الحركة فوراً'}
              </button>
            </form>
          )}

          {/* TAB 3: UPLOAD */}
          {activeTab === 'upload' && (
            <div className="text-center py-8 space-y-3">
              <Upload size={36} className="text-gold-400 mx-auto animate-bounce" />
              <p className="text-xs text-brand-200">جارٍ قراءة ملف الصورة...</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-brand-800 hover:bg-brand-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                اختيار صورة أخرى
              </button>
            </div>
          )}

          {/* Feedback Alert Banner */}
          {feedback && (
            <div
              className={`w-full mt-4 p-4 rounded-2xl border flex items-start gap-3 animate-fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : feedback.type === 'warning'
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                  : 'bg-red-950/60 border-red-500/40 text-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : feedback.type === 'warning' ? (
                <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                {feedback.employeeName && (
                  <h4 className="font-extrabold text-sm text-white truncate mb-0.5">
                    {feedback.employeeName}
                  </h4>
                )}
                <p className="font-bold text-xs">{feedback.title}</p>
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{feedback.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Choice Prompt: Temporary Exit vs Check-out */}
          {choicePrompt && (
            <div className="w-full mt-4 p-5 rounded-2xl bg-brand-900 border-2 border-gold-400/50 text-white shadow-2xl animate-scale-in">
              <div className="text-center mb-4">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-gold-400/20 text-gold-300 text-[10px] font-bold mb-1">
                  الموظف حاضر حالياً
                </span>
                <h4 className="text-base font-extrabold text-white">
                  {choicePrompt.employee.fullName}
                </h4>
                <p className="text-xs text-brand-300 mt-0.5">اختر نوع العملية المطلوبة الآن:</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleConfirmTemporaryExit}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 transition-all cursor-pointer font-bold text-xs shadow-md"
                >
                  <ArrowRightLeft size={22} className="text-amber-400" />
                  <span>خروج مؤقت</span>
                  <span className="text-[9px] text-amber-300/80 font-normal">استراحة / مشوار خارجي</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmFinalCheckOut}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-red-200 transition-all cursor-pointer font-bold text-xs shadow-md"
                >
                  <LogOut size={22} className="text-red-400" />
                  <span>انصراف نهائي</span>
                  <span className="text-[9px] text-red-300/80 font-normal">نهاية الدوام لليوم</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setChoicePrompt(null)}
                className="w-full mt-3 py-2 text-center text-xs text-brand-400 hover:text-brand-200 transition-all cursor-pointer"
              >
                إلغاء العملية
              </button>
            </div>
          )}
        </div>

        {/* Scanner Footer */}
        <div className="px-5 py-3.5 bg-brand-900/50 border-t border-brand-800/80 flex items-center justify-between text-xs text-brand-300">
          <div className="flex items-center gap-1.5">
            <Zap size={13} className="text-gold-400" />
            <span>حماية من التكرار مفعلة</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand-800 hover:bg-brand-700 text-white font-bold transition-all cursor-pointer shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
