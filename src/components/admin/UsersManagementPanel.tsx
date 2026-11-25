import React, { useMemo, useState } from 'react';
import {
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Phone,
  Plus,
  Shield,
  Ticket,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  AccountStatus,
  DepartmentAccessScope,
  PermissionKey,
  UserPublicProfile,
  UserRole,
} from '../../types/cms';
import { adminFetch } from '../../utils/mediaHelpers';
import {
  ACCESS_SCOPE_LABELS,
  ADMIN_ONLY_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  GRANULAR_PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from '../../utils/rbac';

interface DeptOption {
  id: string;
  code: string;
  name: string;
}

interface UsersManagementPanelProps {
  currentUser: UserPublicProfile;
  users: UserPublicProfile[];
  departments: DeptOption[];
  onUsersUpdated: (users: UserPublicProfile[]) => void;
  onInspectDevices: (userId: string) => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

const ASSIGNABLE_ROLES: UserRole[] = [
  'super_admin',
  'project_manager',
  'department_manager',
  'engineer',
  'supervisor',
  'employee',
];

export const UsersManagementPanel: React.FC<UsersManagementPanelProps> = ({
  currentUser,
  users,
  departments,
  onUsersUpdated,
  onInspectDevices,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('engineer');
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState<string>(
    departments[0]?.id || ''
  );
  const [departmentAccessScope, setDepartmentAccessScope] =
    useState<DepartmentAccessScope>('primary_only');
  const [allowedDepartmentIds, setAllowedDepartmentIds] = useState<string[]>([]);
  const [status, setStatus] = useState<AccountStatus>('active');
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Admin temporary password reset / recovery token state
  const [resetTarget, setResetTarget] = useState<UserPublicProfile | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [issuedRecovery, setIssuedRecovery] = useState<{
    user: UserPublicProfile;
    token: string;
    expiresAt: string;
  } | null>(null);
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => map.set(d.id, `${d.code} · ${d.name}`));
    return map;
  }, [departments]);

  const permLabelMap = useMemo(() => {
    const map = new Map<PermissionKey, string>();
    [...GRANULAR_PERMISSIONS, ...ADMIN_ONLY_PERMISSIONS].forEach((p) =>
      map.set(p.key, p.label)
    );
    return map;
  }, []);

  if (currentUser.role !== 'super_admin') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        إدارة المستخدمين وإنشاء الحسابات وتعديل نطاق الإدارات محصورة بمدير النظام الرئيسي (Super Admin) فقط.
      </div>
    );
  }

  const openCreateForm = () => {
    const defaultDept = departments[0]?.id || '';
    setEditingUserId(null);
    setFullName('');
    setJobTitle('');
    setUsername('');
    setPhone('');
    setInitialPassword('');
    setShowInitialPassword(false);
    setRole('employee');
    setPrimaryDepartmentId(defaultDept);
    setDepartmentAccessScope('primary_only');
    setAllowedDepartmentIds(defaultDept ? [defaultDept] : []);
    setStatus('active');
    setPermissions([]);
    setShowForm(true);
  };

  const openEditForm = (target: UserPublicProfile) => {
    setEditingUserId(target.id);
    setFullName(target.fullName);
    setJobTitle(target.jobTitle);
    setUsername(target.username);
    setPhone(target.phone);
    setRole(target.role);
    setPrimaryDepartmentId(target.primaryDepartmentId);
    setDepartmentAccessScope(target.departmentAccessScope);
    setAllowedDepartmentIds(
      target.allowedDepartmentIds.length > 0
        ? target.allowedDepartmentIds
        : [target.primaryDepartmentId]
    );
    setStatus(target.status);
    setPermissions([...target.permissions]);
    setShowForm(true);
  };

  const handleRoleSelect = (nextRole: UserRole) => {
    setRole(nextRole);
    if (nextRole === 'super_admin') {
      setDepartmentAccessScope('all');
    } else if (nextRole === 'project_manager' && !editingUserId) {
      setDepartmentAccessScope('all');
    } else if (!editingUserId) {
      setDepartmentAccessScope('primary_only');
    }

    if (!editingUserId) {
      // Preset helper for non-employee roles while still fully editable by checkboxes
      if (nextRole === 'employee') {
        setPermissions([]);
      } else {
        setPermissions([...DEFAULT_ROLE_PERMISSIONS[nextRole]]);
      }
    }
  };

  const togglePerm = (perm: PermissionKey) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleAllowedDept = (deptId: string) => {
    if (deptId === primaryDepartmentId) return; // Primary dept is always included
    setAllowedDepartmentIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const effectiveScope: DepartmentAccessScope =
        role === 'super_admin' ? 'all' : departmentAccessScope;
      const effectiveAllowed =
        effectiveScope === 'specific'
          ? Array.from(new Set([primaryDepartmentId, ...allowedDepartmentIds]))
          : [];

      if (editingUserId) {
        const res = await adminFetch(`/api/admin/users/${editingUserId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName,
            jobTitle,
            phone,
            role,
            primaryDepartmentId,
            departmentAccessScope: effectiveScope,
            allowedDepartmentIds: effectiveAllowed,
            status,
            permissions,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          onNotify('err', json.error || 'تعذر تحديث بيانات المستخدم');
          return;
        }
        onUsersUpdated(json.users);
        onNotify('ok', `تم تحديث حساب (${json.user.fullName}) ونطاقه وصلاحياته.`);
        setShowForm(false);
      } else {
        const res = await adminFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            jobTitle,
            username,
            phone,
            initialPassword,
            role,
            primaryDepartmentId,
            departmentAccessScope: effectiveScope,
            allowedDepartmentIds: effectiveAllowed,
            status,
            permissions,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          onNotify('err', json.error || 'تعذر إنشاء الحساب');
          return;
        }
        onUsersUpdated(json.users);
        setInitialPassword('');
        onNotify(
          'ok',
          `تم إنشاء حساب (${json.user.fullName}) باسم المستخدم @${json.user.username}.`
        );
        setShowForm(false);
      }
    } catch {
      onNotify('err', 'تعذر الاتصال بالخادم أثناء حفظ الحساب.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ temporaryPassword: tempPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر تعيين كلمة المرور المؤقتة');
        return;
      }
      if (Array.isArray(json.users)) {
        onUsersUpdated(json.users);
      }
      setTempPassword('');
      onNotify(
        'ok',
        json.message || `تم تعيين كلمة مرور مؤقتة لحساب (@${resetTarget.username}) وإبطال جلساته.`
      );
      setResetTarget(null);
    } catch {
      onNotify('err', 'تعذر الاتصال بالخادم أثناء تعيين كلمة المرور.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleIssueRecoveryToken = async (target: UserPublicProfile) => {
    try {
      const res = await adminFetch(`/api/admin/users/${target.id}/recovery-token`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر إصدار رمز الاستعادة الإداري');
        return;
      }
      setCopiedRecovery(false);
      setIssuedRecovery({
        user: target,
        token: String(json.recoveryToken || ''),
        expiresAt: String(json.expiresAt || ''),
      });
      onNotify('ok', `تم إصدار رمز استعادة إداري لمرة واحدة لحساب @${target.username}.`);
    } catch {
      onNotify('err', 'تعذر الاتصال بالخادم لإصدار رمز الاستعادة.');
    }
  };

  const handleToggleStatus = async (target: UserPublicProfile) => {
    const endpoint =
      target.status === 'active'
        ? `/api/admin/users/${target.id}/suspend`
        : `/api/admin/users/${target.id}/activate`;
    const res = await adminFetch(endpoint, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      onNotify('err', json.error || 'تعذر تغيير حالة الحساب');
      return;
    }
    onUsersUpdated(json.users);
    onNotify(
      'ok',
      target.status === 'active'
        ? `تم إيقاف حساب (${target.fullName}) وإلغاء جميع جلساته وأجهزته الموثوقة فوراً.`
        : `تمت إعادة تفعيل حساب (${target.fullName}).`
    );
  };

  const filteredUsers = users.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterDept !== 'all' && u.primaryDepartmentId !== filterDept) return false;
    if (filterStatus !== 'all' && u.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.jobTitle.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.maskedPhone.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-display font-bold text-[#0B1F3A]">
            <Users className="w-5 h-5 text-[#0D9488]" />
            <span>إدارة المستخدمين والصلاحيات ونطاق الإدارات</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            إنشاء الحسابات وإدارة كلمات المرور والصلاحيات محصور بـ Super Admin فقط. تسجيل الدخول يتم باسم المستخدم وكلمة المرور المحمية بتشفير Argon2id.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-lg cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>إنشاء حساب مستخدم جديد</span>
        </button>
      </div>

      {/* Add / Edit User Form */}
      {showForm && (
        <form
          onSubmit={handleSaveUser}
          className="bg-white border-2 border-[#0D9488]/40 rounded-xl p-6 space-y-5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-base font-display font-bold text-[#0B1F3A]">
              {editingUserId ? 'تعديل حساب المستخدم وصلاحياته ونطاقه' : 'بيانات الحساب الجديد'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                الاسم الكامل *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="الاسم الثلاثي الرسمي"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
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
                placeholder="مثال: مهندس شبكات / مشرف صيانة"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                اسم المستخدم (إنجليزي) *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingUserId)}
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. eng.khalid"
                className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                رقم الجوال السعودي *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX أو +9665XXXXXXXX"
                  className="w-full pr-9 pl-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {!editingUserId && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  كلمة المرور المبدئية (10 أحرف فأكثر، حروف + أرقام) *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type={showInitialPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    autoComplete="new-password"
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder="كلمة مرور قوية مبدئية"
                    className="w-full pr-9 pl-9 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInitialPassword((v) => !v)}
                    className="absolute left-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showInitialPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                الدور الوظيفي *
              </label>
              <select
                value={role}
                disabled={editingUserId === currentUser.id}
                onChange={(e) => handleRoleSelect(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                حالة الحساب *
              </label>
              <select
                value={status}
                disabled={editingUserId === currentUser.id}
                onChange={(e) => setStatus(e.target.value as AccountStatus)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
              >
                <option value="active">نشط (يحق له تسجيل الدخول)</option>
                <option value="suspended">موقوف (يُحظر دخوله وتُلغى جلساته)</option>
              </select>
            </div>
          </div>

          {/* Primary Department + Department Access Scope */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
              <Building2 className="w-4 h-4 text-[#0D9488]" />
              <span>الإدارة الأساسية ونطاق الوصول إلى الإدارات</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  الإدارة الأساسية التابع لها المستخدم (إدارة واحدة إلزامية) *
                </label>
                <select
                  required
                  value={primaryDepartmentId}
                  onChange={(e) => {
                    const nextPrimary = e.target.value;
                    setPrimaryDepartmentId(nextPrimary);
                    setAllowedDepartmentIds((prev) =>
                      Array.from(new Set([nextPrimary, ...prev]))
                    );
                  }}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
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
                  نطاق الوصول إلى الإدارات *
                </label>
                <select
                  value={role === 'super_admin' ? 'all' : departmentAccessScope}
                  disabled={role === 'super_admin'}
                  onChange={(e) =>
                    setDepartmentAccessScope(e.target.value as DepartmentAccessScope)
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                >
                  <option value="primary_only">{ACCESS_SCOPE_LABELS.primary_only}</option>
                  <option value="specific">{ACCESS_SCOPE_LABELS.specific}</option>
                  <option value="all">{ACCESS_SCOPE_LABELS.all}</option>
                </select>
              </div>
            </div>

            {role !== 'super_admin' && departmentAccessScope === 'specific' && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-medium text-slate-700">
                  حدد الإدارات المصرح للمستخدم بالوصول إليها (الإدارة الأساسية مشمولة تلقائياً):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {departments.map((d) => {
                    const isPrimary = d.id === primaryDepartmentId;
                    const checked = isPrimary || allowedDepartmentIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                          isPrimary
                            ? 'bg-[#0B1F3A]/5 border-[#0B1F3A]/30 font-bold'
                            : checked
                              ? 'bg-[#0D9488]/10 border-[#0D9488] cursor-pointer'
                              : 'bg-white border-slate-200 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isPrimary}
                          checked={checked}
                          onChange={() => toggleAllowedDept(d.id)}
                          className="accent-[#0D9488]"
                        />
                        <span className="truncate">
                          {d.code} · {d.name} {isPrimary ? '(أساسية)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Granular Permissions Picker */}
          {role !== 'super_admin' && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-[#0B1F3A]">
                    مصفوفة الصلاحيات التفصيلية المستقلة
                  </h4>
                  <p className="text-xs text-slate-500">
                    يُتحقق من كل صلاحية على الخادم بدقة ولا تُمنح أي صلاحية غير محددة هنا.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermissions([])}
                  className="text-xs text-slate-600 underline cursor-pointer"
                >
                  إلغاء تحديد الكل
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {GRANULAR_PERMISSIONS.map((perm) => {
                  const checked = permissions.includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-colors cursor-pointer ${
                        checked
                          ? 'bg-[#0D9488]/10 border-[#0D9488]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePerm(perm.key)}
                        className="mt-0.5 accent-[#0D9488]"
                      />
                      <div>
                        <div className="font-bold text-[#0B1F3A]">{perm.label}</div>
                        <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          {perm.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {(role === 'project_manager' || role === 'department_manager') && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A]">
                    <Shield className="w-4 h-4 text-[#0D9488]" />
                    <span>صلاحية إضافية اختيارية (سجل المراجعة فقط)</span>
                  </div>
                  <label className="p-3 rounded-lg bg-white border border-slate-200 flex items-start gap-2.5 text-xs cursor-pointer max-w-md">
                    <input
                      type="checkbox"
                      checked={permissions.includes('view_audit_logs')}
                      onChange={() => togglePerm('view_audit_logs')}
                      className="mt-0.5 accent-[#0D9488]"
                    />
                    <div>
                      <div className="font-bold text-[#0B1F3A]">الاطلاع على سجل المراجعة</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        يسمح بالاطلاع على سجل العمليات ضمن النطاق الإداري المصرح به فقط.
                      </div>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{editingUserId ? 'حفظ التعديلات' : 'اعتماد وإنشاء الحساب'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الجوال أو اسم المستخدم..."
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">جميع الأدوار</option>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">جميع الإدارات الأساسية</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">جميع الحالات</option>
          <option value="active">نشط</option>
          <option value="suspended">موقوف</option>
        </select>
      </div>

      {/* Users Cards */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            لا توجد حسابات مطابقة لمعايير البحث الحالية.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const primaryDeptLabel =
              deptNameMap.get(u.primaryDepartmentId) || u.primaryDepartmentId;
            const isSelf = u.id === currentUser.id;

            return (
              <div
                key={u.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-display font-bold text-[#0B1F3A]">
                        {u.fullName}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-[#0B1F3A] text-white">
                        {ROLE_LABELS[u.role]}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {u.status === 'active' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        <span>{u.status === 'active' ? 'نشط' : 'موقوف'}</span>
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>المسمى: {u.jobTitle}</span>
                      <span>
                        المعرف: <code className="font-mono-num">@{u.username}</code>
                      </span>
                      <span>
                        الجوال:{' '}
                        <code dir="ltr" className="font-mono-num text-[#0B1F3A]">
                          {u.maskedPhone}
                        </code>
                      </span>
                      <span>الإدارة الأساسية: {primaryDeptLabel}</span>
                      <span>نطاق الوصول: {ACCESS_SCOPE_LABELS[u.departmentAccessScope]}</span>
                    </div>

                    {u.departmentAccessScope === 'specific' && u.allowedDepartmentIds.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        الإدارات المصرح بها:{' '}
                        {u.allowedDepartmentIds
                          .map((id) => deptNameMap.get(id) || id)
                          .join(' · ')}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل / صلاحيات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setResetTarget(u);
                        setTempPassword('');
                        setShowTempPassword(false);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>كلمة مرور مؤقتة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleIssueRecoveryToken(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#0F766E] bg-[#0D9488]/10 hover:bg-[#0D9488]/20 rounded-lg cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>رمز استعادة (15د)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onInspectDevices(u.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>الأجهزة والجلسات</span>
                    </button>

                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                          u.status === 'active'
                            ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                            : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {u.status === 'active' ? (
                          <>
                            <Ban className="w-3.5 h-3.5" />
                            <span>إيقاف الحساب</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>إعادة تفعيل</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-500 ml-1">
                    الصلاحيات المفعلة:
                  </span>
                  {u.role === 'super_admin' ? (
                    <span className="px-2 py-0.5 text-[11px] bg-[#0D9488]/10 text-[#0F766E] rounded font-medium">
                      كافة صلاحيات مدير النظام الرئيسي
                    </span>
                  ) : u.permissions.length === 0 ? (
                    <span className="px-2 py-0.5 text-[11px] bg-slate-100 text-slate-500 rounded">
                      لم تُمنح صلاحيات تشغيلية بعد
                    </span>
                  ) : (
                    u.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 text-[11px] bg-[#F1F5F9] text-[#0B1F3A] border border-slate-200 rounded"
                      >
                        {permLabelMap.get(perm) || perm}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Temporary Password Reset by Super Admin */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAdminResetPassword}
            className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="bg-[#102A4C] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-display font-bold">
                <KeyRound className="w-4 h-4 text-[#5EEAD4]" />
                <span>تعيين كلمة مرور مؤقتة (@{resetTarget.username})</span>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                سيتم تشفير كلمة المرور المؤقتة بـ Argon2id وإبطال جميع الجلسات النشطة للحساب مع إلزامه بتغييرها لاحقاً.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  كلمة المرور المؤقتة الجديدة (10 أحرف على الأقل، حروف + أرقام)
                </label>
                <div className="relative">
                  <input
                    type={showTempPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    autoComplete="new-password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full pr-3.5 pl-10 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTempPassword((v) => !v)}
                    className="absolute left-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showTempPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-5 py-2 text-xs font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {resetSubmitting ? 'جاري التعيين...' : 'اعتماد كلمة المرور المؤقتة'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal: One-Time Administrative Recovery Token */}
      {issuedRecovery && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#102A4C] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-display font-bold">
                <Ticket className="w-4 h-4 text-[#5EEAD4]" />
                <span>رمز الاستعادة الإداري لمرة واحدة</span>
              </div>
              <button
                type="button"
                onClick={() => setIssuedRecovery(null)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                سلّم هذا الرمز لصاحب الحساب (<strong>@{issuedRecovery.user.username}</strong>) عبر قناة موثوقة. الرمز صالح لمدة 15 دقيقة ويُستخدم مرة واحدة فقط ولا يُخزّن كنص صريح في قاعدة البيانات.
              </p>
              <div
                dir="ltr"
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono-num text-xs break-all select-all text-[#0B1F3A]"
              >
                {issuedRecovery.token}
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(issuedRecovery.token);
                      setCopiedRecovery(true);
                      window.setTimeout(() => setCopiedRecovery(false), 2000);
                    } catch {
                      // fallback ignored
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0D9488] text-white rounded-lg cursor-pointer"
                >
                  {copiedRecovery ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRecovery ? 'تم النسخ' : 'نسخ الرمز'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIssuedRecovery(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
