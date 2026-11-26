import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  Film,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Youtube,
} from 'lucide-react';
import {
  AuditLogEntry,
  CmsData,
  CustomSection,
  Department,
  KpiMetric,
  MediaItem,
  MediaType,
  UserPublicProfile,
} from '../../types/cms';
import {
  adminFetch,
  extractYouTubeId,
  getYouTubeThumbnailUrl,
  readJsonSafe,
  uploadMediaFile,
} from '../../utils/mediaHelpers';
import {
  ACCESS_SCOPE_LABELS,
  ADMIN_ONLY_PERMISSIONS,
  GRANULAR_PERMISSIONS,
  ROLE_LABELS,
  hasPermission,
} from '../../utils/rbac';
import { AuditLogsPanel } from './AuditLogsPanel';
import { ContractManagerAdminPanel } from './ContractManagerAdminPanel';
import { DepartmentWorkspacePanel } from './DepartmentWorkspacePanel';
import { DevicesSessionsPanel } from './DevicesSessionsPanel';
import { ExternalSettingsPanel } from './ExternalSettingsPanel';
import { UsersManagementPanel } from './UsersManagementPanel';

interface DeptDirectoryItem {
  id: string;
  code: string;
  name: string;
}

interface AdminWorkspacePayload {
  currentUser: UserPublicProfile;
  departmentDirectory: DeptDirectoryItem[];
  canManageFullCms: boolean;
  canViewAllDepartments: boolean;
  hasUnpublishedChanges: boolean;
  lastPublishedAt: string;
  internalNotes: string;
  auditLog: AuditLogEntry[];
  published: CmsData;
  draft: CmsData;
  users: UserPublicProfile[];
}

interface SessionState {
  loading: boolean;
  authenticated: boolean;
  needsBootstrap: boolean;
  authMode: 'password';
  hasTrustedDeviceCookie: boolean;
  needsInitialPasswordSetup?: boolean;
  initialPasswordTokenConfigured?: boolean;
  mustChangePassword?: boolean;
  user?: UserPublicProfile;
}

interface AdminPortalProps {
  onNavigatePublic: () => void;
  onPublishedUpdated: (published: CmsData) => void;
}

type AdminTabId =
  | 'dept-workspace'
  | 'external-settings'
  | 'contract-manager-admin'
  | 'users'
  | 'devices-sessions'
  | 'audit-logs'
  | 'hero'
  | 'departments'
  | 'sections'
  | 'achievements'
  | 'media'
  | 'internal';

const MEDIA_CATEGORIES: MediaItem['category'][] = [
  'محطات المياه',
  'إصلاح الانكسارات',
  'أعمال الشبكات',
  'المختبرات والجودة',
  'السلامة المهنية',
  'أخرى',
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onNavigatePublic,
  onPublishedUpdated,
}) => {
  const [session, setSession] = useState<SessionState>({
    loading: true,
    authenticated: false,
    needsBootstrap: false,
    authMode: 'password',
    hasTrustedDeviceCookie: false,
    needsInitialPasswordSetup: false,
    initialPasswordTokenConfigured: false,
  });

  // Username + Password Login states (OTP & Unifonic disabled)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [initialSetupOpen, setInitialSetupOpen] = useState(false);
  const [initialBootstrapToken, setInitialBootstrapToken] = useState('');
  const [showInitialBootstrapToken, setShowInitialBootstrapToken] = useState(false);
  const [initialNewPassword, setInitialNewPassword] = useState('');
  const [initialConfirmPassword, setInitialConfirmPassword] = useState('');
  const [showInitialPasswords, setShowInitialPasswords] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Authenticated Change Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showModalPasswords, setShowModalPasswords] = useState(false);
  const [passwordModalBusy, setPasswordModalBusy] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);

  // Authenticated workspace state
  const [workspace, setWorkspace] = useState<AdminWorkspacePayload | null>(null);
  const [draft, setDraft] = useState<CmsData | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTabId>('dept-workspace');
  const [devicesFilterUserId, setDevicesFilterUserId] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Department structure editor state (Super Admin)
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDiv, setNewDeptDiv] = useState('قطاع العمليات التشغيلية');

  // Custom section state
  const [secTitle, setSecTitle] = useState('');
  const [secSubtitle, setSecSubtitle] = useState('');
  const [secBody, setSecBody] = useState('');
  const [secHighlights, setSecHighlights] = useState('');

  // KPI form state
  const [kpiLabel, setKpiLabel] = useState('');
  const [kpiValue, setKpiValue] = useState('');
  const [kpiUnit, setKpiUnit] = useState('');
  const [kpiCategory, setKpiCategory] = useState<KpiMetric['category']>('التشغيل');
  const [kpiNote, setKpiNote] = useState('');

  // Media gallery form state
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCategory, setMediaCategory] =
    useState<MediaItem['category']>('محطات المياه');
  const [mediaLocation, setMediaLocation] = useState('');
  const [mediaDesc, setMediaDesc] = useState('');

  const applyWorkspacePayload = (payload: AdminWorkspacePayload) => {
    setWorkspace(payload);
    setDraft(payload.draft);
    setInternalNotes(payload.internalNotes || '');
    setSession((prev) => ({
      ...prev,
      authenticated: true,
      user: payload.currentUser,
    }));
    if (!selectedDeptId && payload.draft.departments[0]) {
      setSelectedDeptId(payload.draft.departments[0].id);
    }
    if (payload.canViewAllDepartments) {
      onPublishedUpdated(payload.published);
    }
  };

  const loadWorkspace = async () => {
    const res = await adminFetch('/api/admin/workspace');
    if (res.status === 401 || res.status === 403) {
      setSession((prev) => ({ ...prev, authenticated: false, user: undefined }));
      setWorkspace(null);
      return;
    }
    if (res.ok) {
      const payload = (await res.json()) as AdminWorkspacePayload;
      applyWorkspacePayload(payload);
      setActiveTab('dept-workspace');
    }
  };

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const res = await adminFetch('/api/auth/session');
        if (!res.ok) throw new Error('Session check failed');
        const data = await res.json();
        if (!active) return;
        setSession({
          loading: false,
          authenticated: Boolean(data.authenticated),
          needsBootstrap: Boolean(data.needsBootstrap),
          authMode: 'password',
          hasTrustedDeviceCookie: Boolean(data.hasTrustedDeviceCookie),
          needsInitialPasswordSetup: Boolean(data.needsInitialPasswordSetup),
          initialPasswordTokenConfigured: Boolean(data.initialPasswordTokenConfigured),
          mustChangePassword: Boolean(data.mustChangePassword),
          user: data.user,
        });
        if (data.authenticated) {
          await loadWorkspace();
        }
      } catch {
        if (active) {
          setSession({
            loading: false,
            authenticated: false,
            needsBootstrap: false,
            authMode: 'password',
            hasTrustedDeviceCookie: false,
            needsInitialPasswordSetup: false,
            initialPasswordTokenConfigured: false,
          });
        }
      }
    }
    checkSession();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setAuthSubmitting(true);
    try {
      const res = await adminFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const { data: json } = await readJsonSafe<{
        error?: string;
        user?: UserPublicProfile;
        mustChangePassword?: boolean;
      }>(res);
      if (!res.ok) {
        setAuthError(
          json?.error || `اسم المستخدم أو كلمة المرور غير صحيحة (HTTP ${res.status}).`
        );
        return;
      }
      setLoginPassword('');
      setSession((prev) => ({
        ...prev,
        loading: false,
        authenticated: true,
        needsBootstrap: false,
        authMode: 'password',
        hasTrustedDeviceCookie: true,
        mustChangePassword: Boolean(json?.mustChangePassword),
        user: json?.user,
      }));
      await loadWorkspace();
    } catch {
      setAuthError('تعذر الاتصال بالخادم.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleInitialPasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    if (initialNewPassword !== initialConfirmPassword) {
      setAuthError('كلمة المرور الجديدة وتأكيدها غير متطابقتين.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await adminFetch('/api/auth/initial-password', {
        method: 'POST',
        body: JSON.stringify({
          bootstrapToken: initialBootstrapToken.trim(),
          newPassword: initialNewPassword,
          confirmPassword: initialConfirmPassword,
        }),
      });
      const { data: json } = await readJsonSafe<{ error?: string; message?: string }>(res);
      if (!res.ok) {
        setAuthError(
          json?.error || `تعذر تعيين كلمة المرور الأولى (HTTP ${res.status}).`
        );
        return;
      }
      setInitialBootstrapToken('');
      setInitialNewPassword('');
      setInitialConfirmPassword('');
      setInitialSetupOpen(false);
      setLoginUsername('yousef.elalfy');
      setSession((prev) => ({
        ...prev,
        needsInitialPasswordSetup: false,
        initialPasswordTokenConfigured: false,
      }));
      setAuthInfo(
        json?.message ||
          'تم تعيين كلمة المرور الأولى لحساب yousef.elalfy وإغلاق هذا المسار نهائياً. يمكنك تسجيل الدخول الآن.'
      );
    } catch {
      setAuthError('تعذر الاتصال بالخادم.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setAuthError('تأكيد كلمة المرور الجديدة غير متطابق.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await adminFetch('/api/auth/password/recover', {
        method: 'POST',
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          recoveryToken: recoveryToken.trim(),
          newPassword: recoveryNewPassword,
          confirmPassword: recoveryConfirmPassword,
        }),
      });
      const { data: json } = await readJsonSafe<{ error?: string; message?: string }>(res);
      if (!res.ok) {
        setAuthError(
          json?.error || `تعذر استعادة كلمة المرور (HTTP ${res.status}).`
        );
        return;
      }
      setLoginUsername(recoveryUsername.trim());
      setRecoveryToken('');
      setRecoveryNewPassword('');
      setRecoveryConfirmPassword('');
      setRecoveryMode(false);
      setAuthInfo(
        json?.message ||
          'تم تعيين كلمة المرور الجديدة بنجاح عبر الإجراء الإداري. يمكنك تسجيل الدخول الآن.'
      );
    } catch {
      setAuthError('تعذر الاتصال بالخادم.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordModalError(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordModalError('تأكيد كلمة المرور الجديدة غير متطابق.');
      return;
    }
    setPasswordModalBusy(true);
    try {
      const res = await adminFetch('/api/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });
      const { data: json } = await readJsonSafe<{ error?: string; message?: string }>(res);
      if (!res.ok) {
        setPasswordModalError(
          json?.error || `تعذر تغيير كلمة المرور (HTTP ${res.status}).`
        );
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowModalPasswords(false);
      setShowPasswordModal(false);
      setSession((prev) => ({
        ...prev,
        mustChangePassword: false,
        user: prev.user ? { ...prev.user, mustChangePassword: false } : prev.user,
      }));
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              currentUser: { ...prev.currentUser, mustChangePassword: false },
            }
          : prev
      );
      setBannerMsg({
        type: 'ok',
        text:
          json?.message ||
          'تم تغيير كلمة المرور بنجاح وإبطال جميع الجلسات السابقة وتجديد جلستك الحالية.',
      });
    } catch {
      setPasswordModalError('تعذر الاتصال بالخادم.');
    } finally {
      setPasswordModalBusy(false);
    }
  };

  const handleLogout = async () => {
    await adminFetch('/api/auth/logout', { method: 'POST' });
    setSession((prev) => ({
      ...prev,
      authenticated: false,
      user: undefined,
    }));
    setWorkspace(null);
    setDraft(null);
    setLoginPassword('');
    setRecoveryMode(false);
    setShowPasswordModal(false);
    setAuthInfo(null);
    setAuthError(null);
  };

  const saveDraftToServer = async (nextDraft: CmsData, customMessage?: string) => {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await adminFetch('/api/admin/draft', {
        method: 'PUT',
        body: JSON.stringify(nextDraft),
      });
      if (res.status === 401) {
        setSession((prev) => ({ ...prev, authenticated: false }));
        return;
      }
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'فشل الحفظ');
      }
      applyWorkspacePayload(payload as AdminWorkspacePayload);
      setBannerMsg({
        type: 'ok',
        text: customMessage || 'تم حفظ التعديلات في مسودة النظام.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذر حفظ المسودة',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePublishAll = async () => {
    if (!draft || !workspace) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const bodyPayload = workspace.canManageFullCms ? { draft } : {};
      const res = await adminFetch('/api/admin/publish', {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      if (res.status === 401) {
        setSession((prev) => ({ ...prev, authenticated: false }));
        return;
      }
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'تعذر النشر');
      }
      applyWorkspacePayload(payload as AdminWorkspacePayload);
      setBannerMsg({
        type: 'ok',
        text: 'تم اعتماد ونشر المحتوى المحدّث على الواجهة العامة للزوار.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذر نشر المحتوى للعامة.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardDraft = async () => {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await adminFetch('/api/admin/discard-draft', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      applyWorkspacePayload(payload as AdminWorkspacePayload);
      setBannerMsg({ type: 'ok', text: 'تمت إعادة المسودة لتطابق النسخة المنشورة حالياً.' });
    } catch {
      setBannerMsg({ type: 'err', text: 'تعذر تجاهل المسودة.' });
    } finally {
      setBusy(false);
    }
  };

  const permLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    [...GRANULAR_PERMISSIONS, ...ADMIN_ONLY_PERMISSIONS].forEach((p) =>
      map.set(p.key, p.label)
    );
    return map;
  }, []);

  if (session.loading) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="text-lg font-display font-bold">بوابة الإدارة والصلاحيات</div>
          <p className="text-sm text-slate-300">جاري التحقق من الجلسة والأجهزة الموثوقة...</p>
        </div>
      </div>
    );
  }

  // Username & Password Login Screen (Zero OTP / Zero Unifonic / Zero Public Signup)
  if (!session.authenticated) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex flex-col justify-between p-4 sm:p-6">
        <div className="max-w-md w-full mx-auto my-auto bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="bg-[#102A4C] text-white px-6 py-6 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs text-[#5EEAD4] mb-2">
              <Lock className="w-4 h-4" />
              <span>بوابة الدخول الموحّدة · اسم المستخدم وكلمة المرور</span>
            </div>
            <h1 className="text-xl font-display font-bold">
              {recoveryMode
                ? 'استعادة كلمة المرور عبر إجراء إداري'
                : 'تسجيل دخول فريق المشروع والإدارة'}
            </h1>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {recoveryMode
                ? 'تتطلب الاستعادة رمز تفويض إداري صالح لمرة واحدة (15 دقيقة) صادر عن مدير النظام الرئيسي أو الخادم.'
                : 'الدخول مقتصر على الحسابات المعتمدة فقط باستخدام اسم المستخدم وكلمة المرور المحمية بتشفير Argon2id.'}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {session.needsBootstrap && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  النظام قيد التهيئة الأولية ولم يُنشأ أول حساب مدير نظام رئيسي بعد. يتوجب على مالك النظام إتمام إجراء التهيئة المعزول على الخادم أولاً.
                </span>
              </div>
            )}

            {!session.needsBootstrap && session.needsInitialPasswordSetup && !session.initialPasswordTokenConfigured && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  لإتمام تعيين كلمة المرور الأولى لحساب <code dir="ltr" className="font-mono-num">yousef.elalfy</code> من المتصفح في بيئة التطوير، يلزم أولاً ضبط متغير <code dir="ltr" className="font-mono-num">BOOTSTRAP_ADMIN_TOKEN</code> (16+ حرفاً) داخل <strong>Secrets</strong> على الخادم.
                </span>
              </div>
            )}

            {!session.needsBootstrap && session.needsInitialPasswordSetup && session.initialPasswordTokenConfigured && !initialSetupOpen && !recoveryMode && (
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2.5">
                <div className="text-xs font-bold text-[#0B1F3A]">
                  التهيئة الأولية لكلمة مرور مدير النظام الرئيسي (مرة واحدة)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  حساب <code dir="ltr" className="font-mono-num font-semibold">yousef.elalfy</code> لم تُعيَّن له كلمة مرور بعد. يمكنك تعيينها الآن باستخدام <code dir="ltr" className="font-mono-num">BOOTSTRAP_ADMIN_TOKEN</code>، وسيُغلق هذا الخيار نهائياً فور الحفظ.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInitialSetupOpen(true);
                    setAuthError(null);
                    setAuthInfo(null);
                  }}
                  className="w-full py-2 text-xs font-medium text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-lg cursor-pointer"
                >
                  تعيين كلمة المرور الأولى لحساب yousef.elalfy
                </button>
              </div>
            )}

            {authInfo && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                {authInfo}
              </div>
            )}

            {initialSetupOpen && session.needsInitialPasswordSetup && session.initialPasswordTokenConfigured ? (
              <form onSubmit={handleInitialPasswordSetup} className="space-y-3.5">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  الحساب المستهدف حصراً: <code dir="ltr" className="font-mono-num font-bold text-[#0B1F3A]">yousef.elalfy</code>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    رمز التفويض السري (BOOTSTRAP_ADMIN_TOKEN)
                  </label>
                  <div className="relative">
                    <input
                      type={showInitialBootstrapToken ? 'text' : 'password'}
                      required
                      dir="ltr"
                      autoComplete="off"
                      value={initialBootstrapToken}
                      onChange={(e) => setInitialBootstrapToken(e.target.value)}
                      placeholder="أدخل الرمز المضبوط في Secrets"
                      className="w-full pr-3.5 pl-10 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInitialBootstrapToken((prev) => !prev)}
                      className="absolute left-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showInitialBootstrapToken ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    كلمة المرور الجديدة (10 أحرف فأكثر، حروف + أرقام)
                  </label>
                  <div className="relative">
                    <input
                      type={showInitialPasswords ? 'text' : 'password'}
                      required
                      dir="ltr"
                      autoComplete="new-password"
                      value={initialNewPassword}
                      onChange={(e) => setInitialNewPassword(e.target.value)}
                      className="w-full pr-3.5 pl-10 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInitialPasswords((prev) => !prev)}
                      className="absolute left-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showInitialPasswords ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    type={showInitialPasswords ? 'text' : 'password'}
                    required
                    dir="ltr"
                    autoComplete="new-password"
                    value={initialConfirmPassword}
                    onChange={(e) => setInitialConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>

                {authError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {authError}
                  </div>
                )}

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInitialSetupOpen(false);
                      setInitialBootstrapToken('');
                      setAuthError(null);
                    }}
                    className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    رجوع
                  </button>
                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {authSubmitting ? 'جاري الحفظ...' : 'حفظ كلمة المرور الأولى'}
                  </button>
                </div>
              </form>
            ) : !recoveryMode ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    اسم المستخدم
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      required
                      dir="ltr"
                      autoComplete="username"
                      disabled={session.needsBootstrap}
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="yousef.elalfy"
                      className="w-full pr-10 pl-3.5 py-2.5 text-sm font-mono-num border border-slate-300 rounded-lg disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      dir="ltr"
                      autoComplete="current-password"
                      disabled={session.needsBootstrap}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pr-10 pl-10 py-2.5 text-sm font-mono-num border border-slate-300 rounded-lg disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      aria-label={showLoginPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute left-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting || session.needsBootstrap}
                  className="w-full py-2.5 text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {authSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    disabled={session.needsBootstrap}
                    onClick={() => {
                      setRecoveryMode(true);
                      setRecoveryUsername(loginUsername);
                      setAuthError(null);
                      setAuthInfo(null);
                    }}
                    className="text-xs text-[#0D9488] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    استعادة كلمة المرور عبر رمز تفويض إداري
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRecoverPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    autoComplete="username"
                    value={recoveryUsername}
                    onChange={(e) => setRecoveryUsername(e.target.value)}
                    placeholder="yousef.elalfy"
                    className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    رمز الاستعادة الإداري (لمرة واحدة)
                  </label>
                  <input
                    type="password"
                    required
                    dir="ltr"
                    autoComplete="one-time-code"
                    value={recoveryToken}
                    onChange={(e) => setRecoveryToken(e.target.value)}
                    placeholder="أدخل الرمز الصادر من الإدارة"
                    className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    كلمة المرور الجديدة (10 أحرف على الأقل تشمل حروفاً وأرقاماً)
                  </label>
                  <div className="relative">
                    <input
                      type={showRecoveryPassword ? 'text' : 'password'}
                      required
                      dir="ltr"
                      autoComplete="new-password"
                      value={recoveryNewPassword}
                      onChange={(e) => setRecoveryNewPassword(e.target.value)}
                      className="w-full pr-3.5 pl-10 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPassword((prev) => !prev)}
                      className="absolute left-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showRecoveryPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    type={showRecoveryPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    autoComplete="new-password"
                    value={recoveryConfirmPassword}
                    onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>

                {authError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {authError}
                  </div>
                )}

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryMode(false);
                      setAuthError(null);
                    }}
                    className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    رجوع
                  </button>
                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {authSubmitting ? 'جاري التحديث...' : 'اعتماد كلمة المرور الجديدة'}
                  </button>
                </div>
              </form>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onNavigatePublic}
                className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#0B1F3A] cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة إلى الموقع العام</span>
              </button>
              <span className="text-slate-400">الحسابات تُنشأ من الإدارة فقط</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!draft || !workspace) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">جاري تحميل مساحة العمل المصرح بها...</p>
      </div>
    );
  }

  const user = workspace.currentUser;
  const isSuperAdmin = user.role === 'super_admin';
  const isFullSystem = workspace.canManageFullCms;
  const hasGlobalScope = isSuperAdmin || user.departmentAccessScope === 'all';
  const canViewAudit = isSuperAdmin || hasPermission(user, 'view_audit_logs');
  const canPublishGlobal = hasGlobalScope && hasPermission(user, 'approve_publish');

  const primaryDeptName =
    workspace.departmentDirectory.find((d) => d.id === user.primaryDepartmentId)?.name ||
    user.primaryDepartmentId;

  const visibleTabs: { id: AdminTabId; label: string }[] = [
    {
      id: 'dept-workspace',
      label: hasGlobalScope ? 'الإدارات والمراجعة والتقارير' : 'مساحة عمل الإدارة',
    },
  ];

  if (isSuperAdmin) {
    visibleTabs.push(
      { id: 'users', label: 'إدارة المستخدمين والصلاحيات' },
      { id: 'devices-sessions', label: 'الأجهزة والجلسات النشطة' }
    );
  }

  if (canViewAudit) {
    visibleTabs.push({ id: 'audit-logs', label: 'سجل المراجعة الدائم' });
  }

  if (isFullSystem) {
    visibleTabs.push(
      { id: 'external-settings', label: 'إعدادات الواجهة الخارجية' },
      { id: 'contract-manager-admin', label: 'إدارة بيانات مدير العقد' },
      { id: 'hero', label: 'الواجهة والتعريف' },
      { id: 'departments', label: 'هيكلة الإدارات' },
      { id: 'sections', label: 'الأقسام المضافة' }
    );
  }

  if (hasGlobalScope) {
    visibleTabs.push(
      { id: 'achievements', label: 'المؤشرات والرسوم' },
      { id: 'media', label: 'المعرض العام' }
    );
  }

  if (isFullSystem) {
    visibleTabs.push({ id: 'internal', label: 'الملاحظات والنسخ الاحتياطي' });
  }

  const effectiveTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : visibleTabs[0].id;

  const selectedDept =
    draft.departments.find((d) => d.id === selectedDeptId) || draft.departments[0];

  const updateSelectedDept = (patch: Partial<Department>) => {
    if (!selectedDept) return;
    setDraft({
      ...draft,
      departments: draft.departments.map((d) =>
        d.id === selectedDept.id ? { ...d, ...patch } : d
      ),
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B1F3A] flex flex-col">
      {/* Role-Aware Admin Header */}
      <header className="sticky top-0 z-40 bg-[#0B1F3A] text-white border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#5EEAD4] shrink-0 mt-1" />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-display font-bold">
                <span>بوابة إدارة مشروع مياه جدة</span>
                <span className="px-2 py-0.5 text-[11px] font-medium bg-[#0D9488] text-white rounded">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                <span>
                  {user.fullName} ({user.jobTitle})
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#5EEAD4]">الإدارة الأساسية: {primaryDeptName}</span>
                <span aria-hidden="true">·</span>
                <span>النطاق: {ACCESS_SCOPE_LABELS[user.departmentAccessScope]}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isFullSystem && (
              <button
                type="button"
                disabled={busy}
                onClick={() => saveDraftToServer(draft)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ مسودة النظام</span>
              </button>
            )}

            {canPublishGlobal && (
              <button
                type="button"
                disabled={busy}
                onClick={handlePublishAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>اعتماد ونشر للعامة</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPasswordModalError(null);
                setShowPasswordModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#5EEAD4]" />
              <span>تغيير كلمة المرور</span>
            </button>

            <button
              type="button"
              onClick={onNavigatePublic}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white text-[#0B1F3A] hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>الموقع العام</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-200 hover:text-white hover:bg-red-900/40 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {(user.mustChangePassword || session.mustChangePassword) && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700" />
              <span>
                تنبيه أمني: كلمة المرور الحالية مؤقتة. يُنصح بتغييرها الآن عبر زر تغيير كلمة المرور.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPasswordModalError(null);
                setShowPasswordModal(true);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-amber-700 text-white rounded-lg cursor-pointer"
            >
              تغيير كلمة المرور الآن
            </button>
          </div>
        )}

        {/* Session Permissions Strip */}
        <div className="mb-5 bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-[#0B1F3A]">صلاحيات جلستك الحالية:</span>
          {isSuperAdmin ? (
            <span className="px-2 py-0.5 rounded bg-[#0D9488]/10 text-[#0F766E] font-medium">
              صلاحية شاملة لمدير النظام الرئيسي (Super Admin)
            </span>
          ) : user.permissions.length === 0 ? (
            <span className="text-slate-500">لا توجد صلاحيات مفعلة حالياً</span>
          ) : (
            user.permissions.map((p) => (
              <span
                key={p}
                className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-slate-200 text-[#0B1F3A]"
              >
                {permLabelMap.get(p) || p}
              </span>
            ))
          )}
        </div>

        {bannerMsg && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
              bannerMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{bannerMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              className="text-xs underline cursor-pointer"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-xl overflow-x-auto mb-8">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                effectiveTab === tab.id
                  ? 'bg-[#0B1F3A] text-white'
                  : 'text-slate-600 hover:text-[#0B1F3A] hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Scoped Department Workspace */}
        {effectiveTab === 'dept-workspace' && (
          <DepartmentWorkspacePanel
            currentUser={user}
            departments={draft.departments}
            onWorkspaceReload={(payload) =>
              applyWorkspacePayload(payload as AdminWorkspacePayload)
            }
            onNotify={(type, text) => setBannerMsg({ type, text })}
          />
        )}

        {/* Tab: Super Admin User & RBAC Management */}
        {effectiveTab === 'users' && isSuperAdmin && (
          <UsersManagementPanel
            currentUser={user}
            users={workspace.users}
            departments={workspace.departmentDirectory}
            onUsersUpdated={(nextUsers) =>
              setWorkspace((prev) => (prev ? { ...prev, users: nextUsers } : prev))
            }
            onInspectDevices={(uid) => {
              setDevicesFilterUserId(uid);
              setActiveTab('devices-sessions');
            }}
            onNotify={(type, text) => setBannerMsg({ type, text })}
          />
        )}

        {/* Tab: Trusted Devices & Sessions */}
        {effectiveTab === 'devices-sessions' && isSuperAdmin && (
          <DevicesSessionsPanel
            users={workspace.users}
            initialUserId={devicesFilterUserId}
            onNotify={(type, text) => setBannerMsg({ type, text })}
          />
        )}

        {/* Tab: Persistent Audit Logs */}
        {effectiveTab === 'audit-logs' && canViewAudit && (
          <AuditLogsPanel users={workspace.users} isSuperAdmin={isSuperAdmin} />
        )}

        {/* Tab: External Showcase & Interface Settings */}
        {effectiveTab === 'external-settings' && isFullSystem && (
          <ExternalSettingsPanel
            settings={draft.externalPortalSettings}
            canPublishGlobal={canPublishGlobal}
            onChange={(nextSettings) =>
              setDraft({ ...draft, externalPortalSettings: nextSettings })
            }
            onWorkspaceReload={(payload) =>
              applyWorkspacePayload(payload as AdminWorkspacePayload)
            }
            onPublishAll={handlePublishAll}
            onNotify={(type, text) => setBannerMsg({ type, text })}
          />
        )}

        {/* Tab: Contract Manager Profile Editor */}
        {effectiveTab === 'contract-manager-admin' && isFullSystem && (
          <ContractManagerAdminPanel
            profile={draft.contractManagerProfile}
            canPublishGlobal={canPublishGlobal}
            onChange={(nextProfile) =>
              setDraft({ ...draft, contractManagerProfile: nextProfile })
            }
            onWorkspaceReload={(payload) =>
              applyWorkspacePayload(payload as AdminWorkspacePayload)
            }
            onPublishAll={handlePublishAll}
            onNotify={(type, text) => setBannerMsg({ type, text })}
          />
        )}

        {/* Tab: Hero & Overview */}
        {effectiveTab === 'hero' && isFullSystem && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-display font-bold">
              تحرير الواجهة الرئيسية والتعريف المؤسسي
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  العنوان الرئيسي للمشروع
                </label>
                <input
                  type="text"
                  value={draft.hero.title}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hero: { ...draft.hero, title: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  بيانات العقد المرجعية
                </label>
                <input
                  type="text"
                  value={draft.hero.contractLabel}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hero: { ...draft.hero, contractLabel: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                العنوان الفرعي
              </label>
              <input
                type="text"
                value={draft.hero.subtitle}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    hero: { ...draft.hero, subtitle: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الوصف التمهيدي
              </label>
              <textarea
                rows={3}
                value={draft.hero.description}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    hero: { ...draft.hero, description: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  رابط صورة الواجهة الرئيسية
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={draft.hero.heroImageUrl}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hero: { ...draft.hero, heroImageUrl: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0D9488]" />
                  <span>رفع صورة واجهة جديدة</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadMediaFile(file);
                        setDraft({
                          ...draft,
                          hero: { ...draft.hero, heroImageUrl: url },
                        });
                        setBannerMsg({
                          type: 'ok',
                          text: 'تم رفع الصورة. احفظ المسودة أو انشرها.',
                        });
                      } catch (err) {
                        setBannerMsg({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'فشل رفع الصورة',
                        });
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.hero.useVideoBackdrop}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hero: { ...draft.hero, useVideoBackdrop: e.target.checked },
                    })
                  }
                />
                <span>تشغيل فيديو في الواجهة الرئيسية بدلاً من الصورة</span>
              </label>
              {draft.hero.useVideoBackdrop && (
                <input
                  type="text"
                  dir="ltr"
                  value={draft.hero.heroVideoUrl}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hero: { ...draft.hero, heroVideoUrl: e.target.value },
                    })
                  }
                  placeholder="رابط YouTube أو رابط MP4"
                  className="w-full px-3.5 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => saveDraftToServer(draft)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg cursor-pointer"
              >
                حفظ في المسودة
              </button>
            </div>
          </div>
        )}

        {/* Tab: Project Organization Structure */}
        {effectiveTab === 'departments' && isFullSystem && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-display font-bold">
                إدارة المشروع العليا (رأس الهيكل التنظيمي)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={draft.projectDirectorate.title}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      projectDirectorate: {
                        ...draft.projectDirectorate,
                        title: e.target.value,
                      },
                    })
                  }
                  placeholder="اسم إدارة المشروع"
                  className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={draft.projectDirectorate.headPlaceholder}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      projectDirectorate: {
                        ...draft.projectDirectorate,
                        headPlaceholder: e.target.value,
                      },
                    })
                  }
                  placeholder="اسم مدير المشروع الرسمي"
                  className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <textarea
                rows={2}
                value={draft.projectDirectorate.mandate}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    projectDirectorate: {
                      ...draft.projectDirectorate,
                      mandate: e.target.value,
                    },
                  })
                }
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-display font-bold">إضافة إدارة أو قسم جديد للهيكل</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="اسم الإدارة الجديدة"
                  className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={newDeptDiv}
                  onChange={(e) => setNewDeptDiv(e.target.value)}
                  placeholder="القطاع التنظيمي"
                  className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newDeptName.trim()) return;
                    const codeNum = String(draft.departments.length + 1).padStart(2, '0');
                    const created: Department = {
                      id: `dept-${Date.now()}`,
                      code: `ORG-${codeNum}`,
                      name: newDeptName.trim(),
                      parentDivision: newDeptDiv.trim() || 'قطاع العمليات التشغيلية',
                      headPlaceholder: 'مدير القسم (خانة لإدخال الاسم الرسمي)',
                      summary: 'وحدة تنظيمية مضافة من لوحة الإدارة.',
                      responsibilities: ['مهام الإدارة قابلة للتحديث.'],
                      dailyOperations: ['الأعمال اليومية قابلة للتحديث.'],
                      fieldTeams: [
                        {
                          id: `tm-${Date.now()}`,
                          teamName: 'الفريق التشغيلي',
                          roleDescription: 'المهام الميدانية للقسم.',
                          shiftOrReadinessNote: 'قابل للتحديد',
                        },
                      ],
                      departmentKpis: [
                        {
                          id: `dk-${Date.now()}`,
                          label: 'مؤشر أداء القسم',
                          value: '00.0%',
                          unit: 'نموذج تجريبي',
                          targetNote: 'قابل للتحديث',
                          isSampleData: true,
                        },
                      ],
                      mediaItems: [],
                      reports: [],
                      excelFiles: [],
                      interfaces: 'يتكامل مع الإدارات ذات العلاقة.',
                      kpiFocus: 'قابل للتحديد',
                    };
                    setDraft({
                      ...draft,
                      departments: [...draft.departments, created],
                    });
                    setSelectedDeptId(created.id);
                    setNewDeptName('');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0D9488] rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إدراج في الهيكل</span>
                </button>
              </div>
            </div>

            {selectedDept && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <select
                    value={selectedDept.id}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {draft.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} · {d.name}
                      </option>
                    ))}
                  </select>
                  {draft.departments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const remaining = draft.departments.filter(
                          (d) => d.id !== selectedDept.id
                        );
                        setDraft({ ...draft, departments: remaining });
                        if (remaining[0]) setSelectedDeptId(remaining[0].id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-red-700 border border-red-200 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الإدارة من الهيكل</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={selectedDept.name}
                    onChange={(e) => updateSelectedDept({ name: e.target.value })}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={selectedDept.parentDivision}
                    onChange={(e) => updateSelectedDept({ parentDivision: e.target.value })}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={selectedDept.headPlaceholder}
                    onChange={(e) => updateSelectedDept({ headPlaceholder: e.target.value })}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveDraftToServer(draft)}
                    className="px-5 py-2 text-sm font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
                  >
                    حفظ هيكلة الإدارات
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Custom Sections */}
        {effectiveTab === 'sections' && isFullSystem && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-base font-display font-bold">
              <FilePlus2 className="w-5 h-5 text-[#0D9488]" />
              <span>إضافة قسم توثيقي جديد للموقع</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={secTitle}
                onChange={(e) => setSecTitle(e.target.value)}
                placeholder="عنوان القسم الجديد"
                className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={secSubtitle}
                onChange={(e) => setSecSubtitle(e.target.value)}
                placeholder="عنوان فرعي مختصر"
                className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <textarea
              rows={4}
              value={secBody}
              onChange={(e) => setSecBody(e.target.value)}
              placeholder="نص ومحتوى القسم التفصيلي..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />

            <textarea
              rows={3}
              value={secHighlights}
              onChange={(e) => setSecHighlights(e.target.value)}
              placeholder="نقاط رئيسية (كل نقطة في سطر)"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />

            <button
              type="button"
              onClick={() => {
                if (!secTitle.trim() || !secBody.trim()) return;
                const nextNum = String(13 + draft.customSections.length).padStart(2, '0');
                const created: CustomSection = {
                  id: `custom-${Date.now()}`,
                  chapterNumber: nextNum,
                  title: secTitle.trim(),
                  subtitle: secSubtitle.trim(),
                  body: secBody.trim(),
                  highlights: secHighlights
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean),
                  createdAt: new Date().toLocaleDateString('ar-SA'),
                };
                const nextDraft = {
                  ...draft,
                  customSections: [...draft.customSections, created],
                };
                setDraft(nextDraft);
                saveDraftToServer(nextDraft, 'تمت إضافة القسم الجديد إلى المسودة.');
                setSecTitle('');
                setSecSubtitle('');
                setSecBody('');
                setSecHighlights('');
              }}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg cursor-pointer"
            >
              إدراج القسم في المسودة
            </button>

            {draft.customSections.length > 0 && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                {draft.customSections.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-bold">
                        {s.chapterNumber}. {s.title}
                      </div>
                      <div className="text-xs text-slate-500">{s.subtitle}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextDraft = {
                          ...draft,
                          customSections: draft.customSections.filter((x) => x.id !== s.id),
                        };
                        setDraft(nextDraft);
                        saveDraftToServer(nextDraft);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Project Achievements & KPIs */}
        {effectiveTab === 'achievements' && hasGlobalScope && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-display font-bold">
                  مؤشرات الأداء والإنجازات العامة للمشروع
                </h2>
                {hasPermission(user, 'edit_kpis') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const res = await adminFetch('/api/admin/kpis', {
                        method: 'PUT',
                        body: JSON.stringify({ kpis: draft.kpis }),
                      });
                      const json = await res.json();
                      if (!res.ok) {
                        setBannerMsg({ type: 'err', text: json.error || 'تعذر الحفظ' });
                        return;
                      }
                      applyWorkspacePayload(json as AdminWorkspacePayload);
                      setBannerMsg({ type: 'ok', text: 'تم تحديث مؤشرات المشروع بنجاح.' });
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
                  >
                    حفظ تعديلات المؤشرات
                  </button>
                )}
              </div>

              {hasPermission(user, 'edit_kpis') && hasPermission(user, 'add_data') && (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <input
                    type="text"
                    value={kpiLabel}
                    onChange={(e) => setKpiLabel(e.target.value)}
                    placeholder="عنوان المؤشر"
                    className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={kpiValue}
                    onChange={(e) => setKpiValue(e.target.value)}
                    placeholder="القيمة"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
                  />
                  <input
                    type="text"
                    value={kpiUnit}
                    onChange={(e) => setKpiUnit(e.target.value)}
                    placeholder="الوحدة"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!kpiLabel.trim() || !kpiValue.trim()) return;
                      const created: KpiMetric = {
                        id: `kpi-${Date.now()}`,
                        label: kpiLabel.trim(),
                        value: kpiValue.trim(),
                        unit: kpiUnit.trim() || 'وحدة',
                        periodNote: kpiNote.trim() || 'بيان محدث من لوحة الإدارة',
                        category: kpiCategory,
                        isSampleData: false,
                      };
                      setDraft({ ...draft, kpis: [...draft.kpis, created] });
                      setKpiLabel('');
                      setKpiValue('');
                      setKpiUnit('');
                      setKpiNote('');
                    }}
                    className="px-3 py-2 text-xs font-medium text-white bg-[#0D9488] rounded-lg cursor-pointer"
                  >
                    إضافة مؤشر
                  </button>
                </div>
              )}

              <div className="space-y-2.5 pt-2">
                {draft.kpis.map((kpi, idx) => (
                  <div
                    key={kpi.id}
                    className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <input
                      type="text"
                      disabled={!hasPermission(user, 'edit_kpis')}
                      value={kpi.label}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          kpis: draft.kpis.map((k, i) =>
                            i === idx ? { ...k, label: e.target.value } : k
                          ),
                        })
                      }
                      className="sm:col-span-5 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded disabled:bg-slate-100"
                    />
                    <input
                      type="text"
                      disabled={!hasPermission(user, 'edit_kpis')}
                      value={kpi.value}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          kpis: draft.kpis.map((k, i) =>
                            i === idx
                              ? { ...k, value: e.target.value, isSampleData: false }
                              : k
                          ),
                        })
                      }
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono-num disabled:bg-slate-100"
                    />
                    <input
                      type="text"
                      disabled={!hasPermission(user, 'edit_kpis')}
                      value={kpi.unit}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          kpis: draft.kpis.map((k, i) =>
                            i === idx ? { ...k, unit: e.target.value } : k
                          ),
                        })
                      }
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded disabled:bg-slate-100"
                    />
                    <select
                      disabled={!hasPermission(user, 'edit_kpis')}
                      value={kpi.category}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          kpis: draft.kpis.map((k, i) =>
                            i === idx
                              ? { ...k, category: e.target.value as KpiMetric['category'] }
                              : k
                          ),
                        })
                      }
                      className="sm:col-span-2 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded disabled:bg-slate-100"
                    >
                      <option value="التشغيل">التشغيل</option>
                      <option value="الصيانة">الصيانة</option>
                      <option value="الشبكات">الشبكات</option>
                      <option value="الجودة">الجودة</option>
                      <option value="السلامة">السلامة</option>
                    </select>
                    {hasPermission(user, 'delete_data') && (
                      <button
                        type="button"
                        disabled={draft.kpis.length <= 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            kpis: draft.kpis.filter((k) => k.id !== kpi.id),
                          })
                        }
                        className="sm:col-span-1 p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer flex justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Global Media Gallery */}
        {effectiveTab === 'media' && hasGlobalScope && (
          <div className="space-y-6">
            {(hasPermission(user, 'upload_images') ||
              hasPermission(user, 'upload_videos') ||
              hasPermission(user, 'add_youtube')) && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-display font-bold">
                    إضافة صورة أو فيديو إلى المعرض العام
                  </h2>
                  <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg">
                    {hasPermission(user, 'upload_images') && (
                      <button
                        type="button"
                        onClick={() => setMediaType('image')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md cursor-pointer ${
                          mediaType === 'image'
                            ? 'bg-white text-[#0B1F3A] shadow-sm'
                            : 'text-slate-600'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>صورة</span>
                      </button>
                    )}
                    {hasPermission(user, 'add_youtube') && (
                      <button
                        type="button"
                        onClick={() => setMediaType('youtube')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md cursor-pointer ${
                          mediaType === 'youtube'
                            ? 'bg-white text-[#0B1F3A] shadow-sm'
                            : 'text-slate-600'
                        }`}
                      >
                        <Youtube className="w-3.5 h-3.5" />
                        <span>YouTube</span>
                      </button>
                    )}
                    {hasPermission(user, 'upload_videos') && (
                      <button
                        type="button"
                        onClick={() => setMediaType('video')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md cursor-pointer ${
                          mediaType === 'video'
                            ? 'bg-white text-[#0B1F3A] shadow-sm'
                            : 'text-slate-600'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>فيديو ميداني</span>
                      </button>
                    )}
                  </div>
                </div>

                {mediaType !== 'youtube' && (
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                    <Upload className="w-4 h-4 text-[#0D9488]" />
                    <span>رفع ملف إلى الخادم</span>
                    <input
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : 'video/mp4,video/webm'}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadMediaFile(file);
                          setMediaUrl(url);
                          if (!mediaTitle) setMediaTitle(file.name.replace(/\.[^.]+$/, ''));
                          setBannerMsg({ type: 'ok', text: 'تم رفع الملف إلى الخادم بنجاح.' });
                        } catch (err) {
                          setBannerMsg({
                            type: 'err',
                            text: err instanceof Error ? err.message : 'تعذر رفع الملف',
                          });
                        }
                      }}
                    />
                  </label>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="عنوان العمل / التوثيق"
                    className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder={
                      mediaType === 'youtube'
                        ? 'https://www.youtube.com/watch?v=...'
                        : '/uploads/...'
                    }
                    className="px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                  <select
                    value={mediaCategory}
                    onChange={(e) =>
                      setMediaCategory(e.target.value as MediaItem['category'])
                    }
                    className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {MEDIA_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={mediaLocation}
                    onChange={(e) => setMediaLocation(e.target.value)}
                    placeholder="الموقع / القطاع"
                    className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <input
                  type="text"
                  value={mediaDesc}
                  onChange={(e) => setMediaDesc(e.target.value)}
                  placeholder="وصف مختصر"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />

                <button
                  type="button"
                  onClick={async () => {
                    if (!mediaTitle.trim() || !mediaUrl.trim()) return;
                    let finalUrl = mediaUrl.trim();
                    let thumbnailUrl: string | undefined;
                    if (mediaType === 'youtube') {
                      const ytId = extractYouTubeId(finalUrl);
                      if (!ytId) {
                        setBannerMsg({ type: 'err', text: 'رابط YouTube غير صالح.' });
                        return;
                      }
                      thumbnailUrl = getYouTubeThumbnailUrl(ytId);
                      finalUrl = `https://www.youtube.com/watch?v=${ytId}`;
                    }
                    const item: MediaItem = {
                      id: `med-${Date.now()}`,
                      type: mediaType,
                      title: mediaTitle.trim(),
                      description:
                        mediaDesc.trim() || 'توثيق ميداني لأعمال قطاع المياه بمدينة جدة.',
                      category: mediaCategory,
                      location: mediaLocation.trim() || 'موقع عمل — جدة',
                      dateLabel: new Date().toLocaleDateString('ar-SA'),
                      url: finalUrl,
                      thumbnailUrl,
                    };
                    const res = await adminFetch('/api/admin/media', {
                      method: 'POST',
                      body: JSON.stringify(item),
                    });
                    const json = await res.json();
                    if (!res.ok) {
                      setBannerMsg({ type: 'err', text: json.error || 'تعذر الإضافة' });
                      return;
                    }
                    applyWorkspacePayload(json as AdminWorkspacePayload);
                    setMediaTitle('');
                    setMediaUrl('');
                    setMediaLocation('');
                    setMediaDesc('');
                    setBannerMsg({ type: 'ok', text: 'تمت إضافة العنصر للمعرض في المسودة.' });
                  }}
                  className="px-5 py-2 text-sm font-medium text-white bg-[#0D9488] rounded-lg cursor-pointer"
                >
                  إضافة للمعرض
                </button>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="text-sm font-bold">عناصر المعرض ({draft.media.length})</div>
              {draft.media.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <div className="font-bold text-[#0B1F3A]">{m.title}</div>
                    <div className="text-slate-500">
                      {m.type} · {m.category} · {m.location}
                    </div>
                  </div>
                  {hasPermission(user, 'delete_data') && (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await adminFetch(`/api/admin/media/${m.id}`, {
                          method: 'DELETE',
                        });
                        const json = await res.json();
                        if (!res.ok) {
                          setBannerMsg({ type: 'err', text: json.error || 'تعذر الحذف' });
                          return;
                        }
                        applyWorkspacePayload(json as AdminWorkspacePayload);
                        setBannerMsg({ type: 'ok', text: 'تم حذف عنصر الوسائط.' });
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Internal Notes & Backup (Super Admin / manage_system) */}
        {effectiveTab === 'internal' && isFullSystem && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-display font-bold">
                الملاحظات الإدارية الداخلية (محمية — لا تظهر للزوار)
              </h2>
              <textarea
                rows={4}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-4 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer"
                >
                  تجاهل تعديلات المسودة والرجوع للنسخة المنشورة
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await adminFetch('/api/admin/internal-notes', {
                      method: 'PUT',
                      body: JSON.stringify({ notes: internalNotes }),
                    });
                    if (res.ok) {
                      applyWorkspacePayload((await res.json()) as AdminWorkspacePayload);
                      setBannerMsg({ type: 'ok', text: 'تم حفظ الملاحظات الداخلية.' });
                    }
                  }}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
                >
                  حفظ الملاحظات الداخلية
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-display font-bold">
                النسخ الاحتياطي وإعادة الضبط
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(draft, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `jeddah-water-draft-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير المسودة JSON</span>
                </button>

                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0D9488]" />
                  <span>استيراد JSON إلى المسودة</span>
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const parsed = JSON.parse(await file.text()) as CmsData;
                        if (!parsed.hero || !parsed.departments) {
                          throw new Error('ملف غير صالح');
                        }
                        await saveDraftToServer(parsed, 'تم استيراد النسخة إلى المسودة.');
                      } catch {
                        setBannerMsg({ type: 'err', text: 'تعذر قراءة ملف JSON.' });
                      }
                    }}
                  />
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await adminFetch('/api/admin/reset', {
                      method: 'POST',
                      body: JSON.stringify({ alsoPublish: false }),
                    });
                    if (res.ok) {
                      applyWorkspacePayload((await res.json()) as AdminWorkspacePayload);
                      setBannerMsg({
                        type: 'ok',
                        text: 'تمت إعادة ضبط المسودة إلى القالب الافتراضي (النسخة المنشورة لم تتأثر).',
                      });
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة ضبط المسودة إلى القالب الافتراضي</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Authenticated Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleChangePassword}
            className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="bg-[#102A4C] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-display font-bold">
                <KeyRound className="w-4 h-4 text-[#5EEAD4]" />
                <span>تغيير كلمة المرور</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                عند حفظ كلمة المرور الجديدة، سيتم إبطال جميع الجلسات النشطة الأخرى وتجديد جلستك الحالية تلقائياً.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  كلمة المرور الحالية
                </label>
                <input
                  type={showModalPasswords ? 'text' : 'password'}
                  required
                  dir="ltr"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  كلمة المرور الجديدة (10 أحرف على الأقل، تشمل حروفاً وأرقاماً)
                </label>
                <input
                  type={showModalPasswords ? 'text' : 'password'}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type={showModalPasswords ? 'text' : 'password'}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showModalPasswords}
                  onChange={(e) => setShowModalPasswords(e.target.checked)}
                />
                <span>إظهار كلمات المرور</span>
              </label>

              {passwordModalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {passwordModalError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={passwordModalBusy}
                  className="px-5 py-2 text-xs font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {passwordModalBusy ? 'جاري التحديث...' : 'حفظ كلمة المرور الجديدة'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
