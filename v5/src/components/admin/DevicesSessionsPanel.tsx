import React, { useEffect, useState } from 'react';
import {
  Laptop,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from 'lucide-react';
import {
  SessionInfoRecord,
  TrustedDeviceRecord,
  UserPublicProfile,
} from '../../types/cms';
import { adminFetch } from '../../utils/mediaHelpers';

interface DevicesSessionsPanelProps {
  users: UserPublicProfile[];
  initialUserId?: string;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export const DevicesSessionsPanel: React.FC<DevicesSessionsPanelProps> = ({
  users,
  initialUserId = 'all',
  onNotify,
}) => {
  const [devices, setDevices] = useState<TrustedDeviceRecord[]>([]);
  const [sessions, setSessions] = useState<SessionInfoRecord[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>(initialUserId);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setFilterUserId(initialUserId);
  }, [initialUserId]);

  const loadData = async (uid: string) => {
    setLoading(true);
    try {
      const qs = uid && uid !== 'all' ? `?userId=${encodeURIComponent(uid)}` : '';
      const res = await adminFetch(`/api/admin/devices-sessions${qs}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'تعذر تحميل الأجهزة والجلسات' }));
        onNotify('err', err.error || 'تعذر تحميل البيانات');
        return;
      }
      const json = await res.json();
      setDevices(json.devices || []);
      setSessions(json.sessions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filterUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserId]);

  const handleRevokeDevice = async (deviceId: string) => {
    setBusyId(deviceId);
    try {
      const res = await adminFetch(`/api/admin/devices/${deviceId}/revoke`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر إلغاء الثقة بالجهاز');
        return;
      }
      setDevices(json.devices || []);
      setSessions(json.sessions || []);
      onNotify('ok', 'تم إلغاء الثقة بالجهاز وإنهاء جلساته فوراً. سيُطلب OTP عند الدخول مجدداً.');
    } finally {
      setBusyId(null);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      const res = await adminFetch(`/api/admin/sessions/${sessionId}/terminate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر إنهاء الجلسة');
        return;
      }
      setDevices(json.devices || []);
      setSessions(json.sessions || []);
      onNotify('ok', 'تم إنهاء الجلسة الأمنية فوراً.');
    } finally {
      setBusyId(null);
    }
  };

  const handleTerminateAllUser = async (userId: string) => {
    setBusyId(`all-${userId}`);
    try {
      const res = await adminFetch(`/api/admin/users/${userId}/terminate-sessions`, {
        method: 'POST',
        body: JSON.stringify({ revokeDevices: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر إنهاء جلسات المستخدم');
        return;
      }
      setDevices(json.devices || []);
      setSessions(json.sessions || []);
      onNotify('ok', 'تم إنهاء جميع جلسات المستخدم وإلغاء ثقة أجهزته فوراً.');
    } finally {
      setBusyId(null);
    }
  };

  const shownDevices =
    statusFilter === 'active' ? devices.filter((d) => d.isTrusted) : devices;
  const shownSessions =
    statusFilter === 'active' ? sessions.filter((s) => s.isActive) : sessions;

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-display font-bold text-[#0B1F3A]">
            <Laptop className="w-5 h-5 text-[#0D9488]" />
            <span>الأجهزة الموثوقة والجلسات النشطة</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            مراقبة جميع الأجهزة المعتمدة والجلسات المرتبطة بالحسابات، مع صلاحية إلغاء الثقة أو إنهاء أي جلسة فوراً.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">جميع المستخدمين</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.maskedPhone})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active')}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">الكل (المعتمد والملغى)</option>
            <option value="active">النشط والموثوق فقط</option>
          </select>

          <button
            type="button"
            onClick={() => loadData(filterUserId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث</span>
          </button>

          {filterUserId !== 'all' && (
            <button
              type="button"
              disabled={busyId === `all-${filterUserId}`}
              onClick={() => handleTerminateAllUser(filterUserId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>إنهاء جميع جلسات وأجهزة هذا المستخدم</span>
            </button>
          )}
        </div>
      </div>

      {/* Trusted Devices Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-display font-bold text-[#0B1F3A]">
          الأجهزة المسجلة والموثوقة ({shownDevices.length})
        </h3>

        {loading ? (
          <p className="text-xs text-slate-500">جاري تحميل بيانات الأجهزة...</p>
        ) : shownDevices.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد أجهزة مسجلة مطابقة للتصفية الحالية.</p>
        ) : (
          <div className="space-y-3">
            {shownDevices.map((dev) => (
              <div
                key={dev.id}
                className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#0B1F3A]" />
                    <span className="text-sm font-bold text-[#0B1F3A]">
                      {dev.deviceLabel}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded ${
                        dev.isTrusted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {dev.isTrusted ? (
                        <>
                          <ShieldCheck className="w-3 h-3" />
                          <span>جهاز موثوق</span>
                        </>
                      ) : (
                        <>
                          <ShieldOff className="w-3 h-3" />
                          <span>ثقة ملغاة</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      المستخدم: <strong>{dev.userFullName}</strong> (@{dev.userUsername})
                    </span>
                    <span dir="ltr" className="font-mono-num">
                      {dev.maskedPhone}
                    </span>
                    <span>الإدارة الأساسية: {dev.primaryDepartmentName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-num">
                    <span>أول ظهور: {new Date(dev.firstSeenAt).toLocaleString('ar-SA')}</span>
                    <span>آخر نشاط: {new Date(dev.lastSeenAt).toLocaleString('ar-SA')}</span>
                    {dev.lastIp && <span>IP: {dev.lastIp}</span>}
                  </div>
                </div>

                {dev.isTrusted && (
                  <button
                    type="button"
                    disabled={busyId === dev.id}
                    onClick={() => handleRevokeDevice(dev.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    <span>إلغاء الثقة وإنهاء جلساته</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-display font-bold text-[#0B1F3A]">
          سجل الجلسات الأمنية ({shownSessions.length})
        </h3>

        {loading ? (
          <p className="text-xs text-slate-500">جاري تحميل الجلسات...</p>
        ) : shownSessions.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد جلسات مطابقة للتصفية الحالية.</p>
        ) : (
          <div className="space-y-2.5">
            {shownSessions.map((ses) => (
              <div
                key={ses.id}
                className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#0B1F3A]">
                      {ses.userFullName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono-num" dir="ltr">
                      {ses.maskedPhone}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[11px] rounded ${
                        ses.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {ses.isActive
                        ? 'جلسة نشطة'
                        : ses.revokedReason === 'user_logout'
                          ? 'خروج طوعي'
                          : ses.revokedReason === 'account_suspended'
                            ? 'أُنهيت (إيقاف الحساب)'
                            : ses.revokedReason === 'device_trust_revoked'
                              ? 'أُنهيت (إلغاء ثقة الجهاز)'
                              : ses.revokedAt
                                ? 'منتهية إدارياً'
                                : 'منتهية الصلاحية'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>الجهاز: {ses.deviceLabel}</span>
                    <span>الإدارة: {ses.primaryDepartmentName}</span>
                    {ses.ipAddress && (
                      <span className="font-mono-num">IP: {ses.ipAddress}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-num flex flex-wrap gap-x-4">
                    <span>البدء: {new Date(ses.createdAt).toLocaleString('ar-SA')}</span>
                    <span>آخر نشاط: {new Date(ses.lastActivityAt).toLocaleString('ar-SA')}</span>
                  </div>
                </div>

                {ses.isActive && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === ses.id}
                      onClick={() => handleTerminateSession(ses.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>إنهاء الجلسة</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `all-${ses.userId}`}
                      onClick={() => handleTerminateAllUser(ses.userId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>إنهاء جميع جلساته</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
