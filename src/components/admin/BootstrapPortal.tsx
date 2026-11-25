import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { adminFetch, readJsonSafe } from '../../utils/mediaHelpers';

interface DeptOption {
  id: string;
  code: string;
  name: string;
}

interface BootstrapPortalProps {
  onNavigateAdmin: () => void;
  onNavigatePublic: () => void;
}

export const BootstrapPortal: React.FC<BootstrapPortalProps> = ({
  onNavigateAdmin,
  onNavigatePublic,
}) => {
  const [loading, setLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [smsMode, setSmsMode] = useState<'unifonic' | 'mock'>('mock');
  const [unifonicConfigured, setUnifonicConfigured] = useState(false);
  const [bootstrapTokenConfigured, setBootstrapTokenConfigured] = useState<boolean | null>(null);
  const [departments, setDepartments] = useState<DeptOption[]>([]);

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [showBootstrapToken, setShowBootstrapToken] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('مدير النظام الرئيسي');
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devMockOtp, setDevMockOtp] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      try {
        const res = await adminFetch('/api/bootstrap/status');
        const { data: json } = await readJsonSafe<{
          needsBootstrap?: boolean;
          smsMode?: string;
          unifonicConfigured?: boolean;
          bootstrapTokenConfigured?: boolean;
          departments?: DeptOption[];
        }>(res);
        if (!res.ok || !json) throw new Error('status error');
        if (!active) return;
        setNeedsBootstrap(Boolean(json.needsBootstrap));
        setSmsMode(json.smsMode === 'unifonic' ? 'unifonic' : 'mock');
        setUnifonicConfigured(Boolean(json.unifonicConfigured));
        setBootstrapTokenConfigured(
          typeof json.bootstrapTokenConfigured === 'boolean'
            ? json.bootstrapTokenConfigured
            : null
        );
        const depts: DeptOption[] = Array.isArray(json.departments) ? json.departments : [];
        setDepartments(depts);
        if (depts[0]) {
          setPrimaryDepartmentId(depts.find((d) => d.id === 'dept-pm')?.id || depts[0].id);
        }
      } catch {
        if (active) setErrorMsg('تعذر التحقق من حالة التهيئة الأولية.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((c) => (c > 1 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (password !== confirmPassword) {
      setErrorMsg('كلمة المرور وتأكيدها غير متطابقتين.');
      return;
    }
    if (password.length < 10) {
      setErrorMsg('كلمة المرور يجب أن تكون 10 أحرف على الأقل وتحتوي على حروف وأرقام.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/bootstrap/verify', {
        method: 'POST',
        body: JSON.stringify({
          bootstrapToken: bootstrapToken.trim(),
          fullName,
          username,
          phone,
          jobTitle,
          primaryDepartmentId,
          password,
          confirmPassword,
        }),
      });
      const { data: json } = await readJsonSafe<{ error?: string }>(res);
      if (!res.ok) {
        setErrorMsg(
          json?.error ||
            (res.status === 401 || res.status === 403
              ? 'رمز التفويض الخاص بالتهيئة الأولية غير صحيح أو مرفوض.'
              : `تعذر إتمام التهيئة الأولية (HTTP ${res.status}).`)
        );
        return;
      }
      onNavigateAdmin();
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyDevOtp = async () => {
    if (!devMockOtp) return;
    try {
      await navigator.clipboard.writeText(devMockOtp);
      setCopiedOtp(true);
      window.setTimeout(() => setCopiedOtp(false), 2000);
    } catch {
      // Fallback: fill input directly if clipboard permission is unavailable
      setOtpCode(devMockOtp);
    }
  };

  const handleVerifyBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/bootstrap/verify', {
        method: 'POST',
        body: JSON.stringify({
          bootstrapToken: bootstrapToken.trim(),
          fullName,
          username,
          phone,
          jobTitle,
          primaryDepartmentId,
          otpCode,
        }),
      });
      const { data: json } = await readJsonSafe<{ error?: string }>(res);
      if (!res.ok) {
        setErrorMsg(
          json?.error ||
            (res.status === 401 || res.status === 403
              ? 'رمز التفويض أو رمز التحقق غير صحيح.'
              : `تعذر إتمام التهيئة الأولية (HTTP ${res.status}).`)
        );
        return;
      }
      setDevMockOtp(null);
      onNavigateAdmin();
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="text-lg font-display font-bold">بوابة التهيئة الأولية للنظام</div>
          <p className="text-sm text-slate-300">جاري فحص حالة قاعدة البيانات...</p>
        </div>
      </div>
    );
  }

  if (!needsBootstrap) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-display font-bold text-[#0B1F3A]">
              بوابة التهيئة الأولية مغلقة نهائياً
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              تمت تهيئة أول حساب مدير نظام رئيسي (Super Admin) في قاعدة البيانات مسبقاً. لاعتبارات أمنية، تم تعطيل هذا المسار تلقائياً ولا يمكن إنشاء حسابات جديدة من هنا.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="flex-1 py-2.5 text-xs sm:text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg cursor-pointer"
            >
              الانتقال إلى تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={onNavigatePublic}
              className="flex-1 py-2.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              العودة للموقع العام
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1F3A] flex flex-col justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="bg-[#102A4C] text-white px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-[#5EEAD4] mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>إجراء التهيئة الأمنية لمرة واحدة (First-Run Bootstrap)</span>
          </div>
          <h1 className="text-xl font-display font-bold">
            إنشاء أول حساب مدير نظام رئيسي (Super Admin)
          </h1>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            يتطلب هذا الإجراء رمز التفويض السري من الخادم والتحقق من ملكية رقم الجوال السعودي عبر رمز OTP. يُغلق هذا المسار تلقائياً فور اعتماد الحساب.
          </p>
        </div>

        <form
          onSubmit={step === 'form' ? handleRequestOtp : handleVerifyBootstrap}
          className="p-6 space-y-4"
        >
          {smsMode === 'mock' ? (
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2 leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-700" />
              <span>
                وضع الاختبار التطويري (<code dir="ltr" className="font-mono-num">AUTH_SMS_MODE=mock</code>) مفعّل: سيتم توليد رمز تحقق عشوائي وعرضه مؤقتاً داخل هذه الصفحة (إلى جانب سجلات الخادم) لإتمام التهيئة الأولية فقط، ويُمنع هذا الوضع تماماً في الإنتاج.
              </span>
            </div>
          ) : (
            !unifonicConfigured && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  تنبيه: وضع Unifonic محدد لكن مفاتيح <code dir="ltr" className="font-mono-num">UNIFONIC_APP_SID</code> و <code dir="ltr" className="font-mono-num">UNIFONIC_SENDER_ID</code> غير مضبوطة.
                </span>
              </div>
            )
          )}

          {step === 'form' ? (
            <>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    رمز التفويض السري (BOOTSTRAP_ADMIN_TOKEN / سجل الخادم) *
                  </label>
                  {bootstrapTokenConfigured !== null && (
                    <span className="text-[11px] text-slate-500">
                      {bootstrapTokenConfigured
                        ? 'مصدر الخادم: متغير البيئة Secrets'
                        : 'مصدر الخادم: رمز الجلسة المؤقت'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type={showBootstrapToken ? 'text' : 'password'}
                    required
                    dir="ltr"
                    value={bootstrapToken}
                    onChange={(e) => setBootstrapToken(e.target.value)}
                    placeholder="أدخل رمز التفويض من الخادم"
                    className="w-full pr-10 pl-10 py-2.5 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBootstrapToken((v) => !v)}
                    aria-label={showBootstrapToken ? 'إخفاء رمز التفويض' : 'إظهار رمز التفويض'}
                    className="absolute left-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showBootstrapToken ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    الاسم الكامل *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="الاسم الرسمي"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المسمى الوظيفي *
                  </label>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    اسم المستخدم (إنجليزي) *
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. director.jeddah"
                    className="w-full px-3.5 py-2.5 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    رقم الجوال السعودي *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="w-full pr-10 pl-3.5 py-2.5 text-sm font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  الإدارة الأساسية التابع لها *
                </label>
                <select
                  required
                  value={primaryDepartmentId}
                  onChange={(e) => setPrimaryDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  كلمة المرور *
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="10 أحرف على الأقل، حروف وأرقام"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  تأكيد كلمة المرور *
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {infoMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {smsMode === 'mock' && needsBootstrap && devMockOtp && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">
                      رمز OTP التجريبي المؤقت (وضع التطوير فقط)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyDevOtp}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-white border border-amber-300 rounded-md text-amber-900 hover:bg-amber-100 cursor-pointer"
                    >
                      {copiedOtp ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الرمز</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div
                    dir="ltr"
                    className="py-2 px-3 bg-white border border-amber-200 rounded-lg text-center text-2xl font-bold tracking-[0.45em] font-mono-num text-[#0B1F3A] select-all"
                  >
                    {devMockOtp}
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    صالح لمدة 5 دقائق لمرة واحدة لإتمام التهيئة الأولية، ولا يظهر في بيئة الإنتاج أو بعد إنشاء أول Super Admin.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  أدخل رمز التحقق المكون من 6 أرقام
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center text-xl tracking-[0.4em] font-mono-num border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setStep('form');
                    setOtpCode('');
                    setDevMockOtp(null);
                    setCopiedOtp(false);
                  }}
                  className="underline cursor-pointer"
                >
                  تعديل البيانات
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || submitting}
                  onClick={handleRequestOtp}
                  className="text-[#0D9488] font-medium disabled:opacity-50 cursor-pointer"
                >
                  {cooldown > 0
                    ? `إعادة الإرسال خلال ${cooldown} ث`
                    : 'إعادة إرسال الرمز'}
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg cursor-pointer disabled:opacity-50"
          >
            {submitting
              ? 'جاري المعالجة...'
              : step === 'form'
                ? 'إتمام التهيئة وإنشاء حساب المدير'
                : 'تأكيد الرمز واعتماد أول Super Admin'}
          </button>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onNavigatePublic}
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#0B1F3A] cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة للموقع العام</span>
            </button>
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="text-slate-500 hover:text-[#0B1F3A] cursor-pointer"
            >
              صفحة تسجيل الدخول
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
