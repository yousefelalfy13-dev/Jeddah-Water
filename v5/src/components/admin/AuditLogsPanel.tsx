import React, { useEffect, useState } from 'react';
import { History, RefreshCw, Search } from 'lucide-react';
import { AuditLogEntry, UserPublicProfile } from '../../types/cms';
import { adminFetch } from '../../utils/mediaHelpers';
import { ROLE_LABELS } from '../../utils/rbac';

interface AuditLogsPanelProps {
  users: UserPublicProfile[];
  isSuperAdmin: boolean;
}

export const AuditLogsPanel: React.FC<AuditLogsPanelProps> = ({
  users,
  isSuperAdmin,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId !== 'all') params.set('userId', userId);
      if (search.trim()) params.set('search', search.trim());
      const res = await adminFetch(`/api/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.auditLogs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-display font-bold text-[#0B1F3A]">
            <History className="w-5 h-5 text-[#0D9488]" />
            <span>سجل المراجعة الدائم (Audit Log)</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            توثيق دائم في قاعدة البيانات لجميع عمليات إنشاء الحسابات، تغيير الصلاحيات، طلبات OTP، الأجهزة الموثوقة، الجلسات، ومحاولات الوصول المرفوضة.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadLogs();
        }}
        className="grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بنوع العملية أو الاسم أو التفاصيل..."
            className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>
        {isSuperAdmin && (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">جميع المستخدمين</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} (@{u.username})
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-xs font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
        >
          تطبيق البحث
        </button>
      </form>

      {/* Log Entries */}
      <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-500">جاري تحميل سجل المراجعة...</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد قيود مطابقة للتصفية الحالية.</p>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200 flex flex-wrap items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#0B1F3A]">{entry.action}</span>
                  {entry.actorRole && entry.actorRole !== 'system' && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-white border border-slate-200 text-slate-600">
                      {ROLE_LABELS[entry.actorRole] || entry.actorRole}
                    </span>
                  )}
                  {entry.targetLabel && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#0D9488]/10 text-[#0F766E]">
                      {entry.targetLabel}
                    </span>
                  )}
                </div>
                <p className="text-slate-600 leading-relaxed">{entry.detail}</p>
              </div>
              <div className="text-left text-[11px] text-slate-500 shrink-0">
                <div className="font-medium text-slate-700">{entry.actor}</div>
                <div className="font-mono-num">
                  {new Date(entry.timestamp).toLocaleString('ar-SA')}
                </div>
                {entry.ipAddress && (
                  <div className="font-mono-num text-[10px] text-slate-400">
                    {entry.ipAddress}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
