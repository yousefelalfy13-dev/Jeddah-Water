import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  Youtube,
} from 'lucide-react';
import {
  Department,
  DepartmentKpi,
  MediaItem,
  UserPublicProfile,
} from '../../types/cms';
import {
  adminFetch,
  extractYouTubeId,
  getYouTubeThumbnailUrl,
  uploadMediaFile,
} from '../../utils/mediaHelpers';
import { hasPermission } from '../../utils/rbac';

interface DepartmentWorkspacePanelProps {
  currentUser: UserPublicProfile;
  departments: Department[];
  onWorkspaceReload: (payload: unknown) => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

const MEDIA_CATEGORIES: MediaItem['category'][] = [
  'محطات المياه',
  'إصلاح الانكسارات',
  'أعمال الشبكات',
  'المختبرات والجودة',
  'السلامة المهنية',
  'أخرى',
];

export const DepartmentWorkspacePanel: React.FC<DepartmentWorkspacePanelProps> = ({
  currentUser,
  departments,
  onWorkspaceReload,
  onNotify,
}) => {
  const canSwitchDept =
    departments.length > 1 ||
    currentUser.role === 'super_admin' ||
    currentUser.departmentAccessScope !== 'primary_only';

  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    currentUser.primaryDepartmentId || departments[0]?.id || ''
  );

  const activeDept =
    departments.find((d) => d.id === selectedDeptId) || departments[0];

  const [name, setName] = useState('');
  const [parentDivision, setParentDivision] = useState('');
  const [headPlaceholder, setHeadPlaceholder] = useState('');
  const [summary, setSummary] = useState('');
  const [responsibilitiesText, setResponsibilitiesText] = useState('');
  const [dailyOpsText, setDailyOpsText] = useState('');
  const [kpis, setKpis] = useState<DepartmentKpi[]>([]);

  const canUploadImg = hasPermission(currentUser, 'upload_images');
  const canUploadVid = hasPermission(currentUser, 'upload_videos');
  const canAddYt = hasPermission(currentUser, 'add_youtube');
  const canUploadExcel = hasPermission(currentUser, 'upload_excel');

  const firstAllowedMediaType: 'image' | 'video' | 'youtube' = canUploadImg
    ? 'image'
    : canUploadVid
      ? 'video'
      : 'youtube';

  const [mediaType, setMediaType] = useState<'image' | 'video' | 'youtube'>(
    firstAllowedMediaType
  );
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [alsoGallery, setAlsoGallery] = useState(true);
  const [mediaCategory, setMediaCategory] =
    useState<MediaItem['category']>('محطات المياه');

  const [repTitle, setRepTitle] = useState('');
  const [repPeriod, setRepPeriod] = useState('');
  const [repSummary, setRepSummary] = useState('');

  const [excelTitle, setExcelTitle] = useState('');
  const [excelFileName, setExcelFileName] = useState('');
  const [excelUrl, setExcelUrl] = useState('');

  const [newKpiLabel, setNewKpiLabel] = useState('');
  const [newKpiValue, setNewKpiValue] = useState('');
  const [newKpiUnit, setNewKpiUnit] = useState('');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeDept) return;
    setName(activeDept.name);
    setParentDivision(activeDept.parentDivision);
    setHeadPlaceholder(activeDept.headPlaceholder);
    setSummary(activeDept.summary);
    setResponsibilitiesText(activeDept.responsibilities.join('\n'));
    setDailyOpsText(activeDept.dailyOperations.join('\n'));
    setKpis(activeDept.departmentKpis || []);
  }, [activeDept]);

  useEffect(() => {
    setMediaType(firstAllowedMediaType);
  }, [firstAllowedMediaType]);

  if (!activeDept) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        لا توجد إدارات متاحة ضمن نطاق الوصول المحدد لهذا الحساب.
      </div>
    );
  }

  const canView = hasPermission(currentUser, 'view_data');
  const canEditData = hasPermission(currentUser, 'edit_data');
  const canAddData = hasPermission(currentUser, 'add_data');
  const canDelete = hasPermission(currentUser, 'delete_data');
  const canEditKpis = hasPermission(currentUser, 'edit_kpis');
  const canAddReports = hasPermission(currentUser, 'add_reports');
  const canApprove = hasPermission(currentUser, 'approve_publish');
  const canAnyMedia = canUploadImg || canUploadVid || canAddYt;

  if (
    !canView &&
    !canEditData &&
    !canAnyMedia &&
    !canAddReports &&
    !canEditKpis &&
    !canUploadExcel &&
    !canApprove
  ) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
        <div className="text-base font-display font-bold text-[#0B1F3A]">
          {activeDept.name}
        </div>
        <p className="text-sm text-slate-500">
          لم يتم تفويض صلاحيات تشغيلية لحسابك بعد. يرجى مراجعة مدير النظام الرئيسي (Super Admin).
        </p>
      </div>
    );
  }

  const handleSaveDepartmentInfo = async () => {
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/departments/${activeDept.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          parentDivision,
          headPlaceholder,
          summary,
          responsibilities: responsibilitiesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          dailyOperations: dailyOpsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر حفظ بيانات الإدارة');
        return;
      }
      onWorkspaceReload(json);
      onNotify('ok', `تم حفظ بيانات (${activeDept.name}) في المسودة.`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDepartmentKpis = async (nextKpis: DepartmentKpi[]) => {
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/departments/${activeDept.id}/kpis`, {
        method: 'PUT',
        body: JSON.stringify({ departmentKpis: nextKpis }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر تحديث مؤشرات الإدارة');
        return;
      }
      onWorkspaceReload(json);
      onNotify('ok', 'تم تحديث مؤشرات الأداء الخاصة بالإدارة.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMedia = async () => {
    if (!mediaTitle.trim() || !mediaUrl.trim()) {
      onNotify('err', 'يرجى إدخال عنوان ورابط الوسائط.');
      return;
    }

    let finalUrl = mediaUrl.trim();
    let thumbnailUrl: string | undefined;
    if (mediaType === 'youtube') {
      const ytId = extractYouTubeId(finalUrl);
      if (!ytId) {
        onNotify('err', 'رابط YouTube غير صالح.');
        return;
      }
      finalUrl = `https://www.youtube.com/watch?v=${ytId}`;
      thumbnailUrl = getYouTubeThumbnailUrl(ytId);
    }

    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/departments/${activeDept.id}/media`, {
        method: 'POST',
        body: JSON.stringify({
          type: mediaType,
          title: mediaTitle.trim(),
          caption: mediaCaption.trim(),
          url: finalUrl,
          alsoAddToGallery: alsoGallery,
          category: mediaCategory,
          location: activeDept.name,
          thumbnailUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر إضافة الوسائط');
        return;
      }
      onWorkspaceReload(json);
      setMediaTitle('');
      setMediaCaption('');
      setMediaUrl('');
      onNotify('ok', 'تمت إضافة الوسائط إلى مسودة الإدارة.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDeptMedia = async (mediaId: string) => {
    const res = await adminFetch(
      `/api/admin/departments/${activeDept.id}/media/${mediaId}`,
      { method: 'DELETE' }
    );
    const json = await res.json();
    if (!res.ok) {
      onNotify('err', json.error || 'تعذر حذف العنصر');
      return;
    }
    onWorkspaceReload(json);
    onNotify('ok', 'تم حذف عنصر الوسائط.');
  };

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repTitle.trim() || !repSummary.trim()) return;
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/departments/${activeDept.id}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          title: repTitle.trim(),
          summary: repSummary.trim(),
          periodLabel: repPeriod.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر إضافة التقرير');
        return;
      }
      onWorkspaceReload(json);
      setRepTitle('');
      setRepPeriod('');
      setRepSummary('');
      onNotify('ok', 'تم حفظ التقرير التشغيلي بانتظار الاعتماد.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    const res = await adminFetch(
      `/api/admin/departments/${activeDept.id}/reports/${reportId}`,
      { method: 'DELETE' }
    );
    const json = await res.json();
    if (!res.ok) {
      onNotify('err', json.error || 'تعذر حذف التقرير');
      return;
    }
    onWorkspaceReload(json);
    onNotify('ok', 'تم حذف التقرير.');
  };

  const handleAddExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelTitle.trim() || !excelUrl.trim()) {
      onNotify('err', 'يرجى رفع ملف Excel وإدخال العنوان.');
      return;
    }
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/departments/${activeDept.id}/excel`, {
        method: 'POST',
        body: JSON.stringify({
          title: excelTitle.trim(),
          fileName: excelFileName.trim() || `${excelTitle.trim()}.xlsx`,
          url: excelUrl.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر إرفاق ملف Excel');
        return;
      }
      onWorkspaceReload(json);
      setExcelTitle('');
      setExcelFileName('');
      setExcelUrl('');
      onNotify('ok', `تم رفع وإرفاق ملف Excel ضمن (${activeDept.name}).`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteExcel = async (fileId: string) => {
    const res = await adminFetch(
      `/api/admin/departments/${activeDept.id}/excel/${fileId}`,
      { method: 'DELETE' }
    );
    const json = await res.json();
    if (!res.ok) {
      onNotify('err', json.error || 'تعذر حذف الملف');
      return;
    }
    onWorkspaceReload(json);
    onNotify('ok', 'تم حذف ملف Excel.');
  };

  const handleApproveDepartment = async (publishLive: boolean) => {
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/departments/${activeDept.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ publishLive }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify('err', json.error || 'تعذر اعتماد المحتوى');
        return;
      }
      onWorkspaceReload(json);
      onNotify(
        'ok',
        publishLive
          ? `تم اعتماد ونشر محتوى وتقارير (${activeDept.name}) للعامة.`
          : `تم اعتماد محتوى (${activeDept.name}) داخلياً.`
      );
    } finally {
      setBusy(false);
    }
  };

  const reports = activeDept.reports || [];
  const excelFiles = activeDept.excelFiles || [];
  const isPrimarySelected = activeDept.id === currentUser.primaryDepartmentId;

  return (
    <div className="space-y-6">
      {/* Department Selector & Approval Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-[240px]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#0D9488] font-bold">
            <Building2 className="w-4 h-4" />
            <span>
              {canSwitchDept
                ? `الإدارات المصرح بها في نطاقك (${departments.length})`
                : 'نطاق الإدارة الأساسية المصرح به'}
            </span>
            {isPrimarySelected && (
              <span className="px-2 py-0.5 text-[10px] bg-[#0B1F3A] text-white rounded">
                إدارتك الأساسية
              </span>
            )}
          </div>
          {canSwitchDept ? (
            <select
              value={activeDept.id}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="mt-1 w-full max-w-md px-3.5 py-2 text-sm font-bold border border-slate-300 rounded-lg bg-white text-[#0B1F3A]"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.name}
                  {d.id === currentUser.primaryDepartmentId ? ' (الأساسية)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <h2 className="text-lg font-display font-bold text-[#0B1F3A]">
              {activeDept.code} · {activeDept.name}
            </h2>
          )}
        </div>

        {canApprove && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleApproveDepartment(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />
              <span>اعتماد داخلي للإدارة</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleApproveDepartment(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-lg cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>اعتماد ونشر محتوى الإدارة</span>
            </button>
          </div>
        )}
      </div>

      {/* Department Profile & Tasks */}
      {(canView || canEditData) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-display font-bold text-[#0B1F3A]">
              بيانات الإدارة والمسؤوليات والأعمال اليومية
            </h3>
            {!canEditData && (
              <span className="px-2.5 py-1 text-[11px] bg-slate-100 text-slate-600 rounded">
                عرض فقط
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                اسم الإدارة
              </label>
              <input
                type="text"
                disabled={!canEditData}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                القطاع التنظيمي
              </label>
              <input
                type="text"
                disabled={!canEditData}
                value={parentDivision}
                onChange={(e) => setParentDivision(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                المسؤول / مدير الإدارة
              </label>
              <input
                type="text"
                disabled={!canEditData}
                value={headPlaceholder}
                onChange={(e) => setHeadPlaceholder(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              التعريف العام
            </label>
            <textarea
              rows={2}
              disabled={!canEditData}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                المسؤوليات الرئيسية (سطر لكل بند)
              </label>
              <textarea
                rows={4}
                disabled={!canEditData}
                value={responsibilitiesText}
                onChange={(e) => setResponsibilitiesText(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                الأعمال اليومية (سطر لكل بند)
              </label>
              <textarea
                rows={4}
                disabled={!canEditData}
                value={dailyOpsText}
                onChange={(e) => setDailyOpsText(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
          </div>

          {canEditData && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveDepartmentInfo}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ تعديلات الإدارة</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Department KPIs */}
      {(canView || canEditKpis) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-display font-bold text-[#0B1F3A]">
              مؤشرات الأداء الخاصة بالإدارة
            </h3>
            {canEditKpis && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSaveDepartmentKpis(kpis)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ المؤشرات</span>
              </button>
            )}
          </div>

          {canEditKpis && canAddData && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-[#F8FAFC] border border-slate-200">
              <input
                type="text"
                value={newKpiLabel}
                onChange={(e) => setNewKpiLabel(e.target.value)}
                placeholder="اسم المؤشر الجديد"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
              />
              <input
                type="text"
                value={newKpiValue}
                onChange={(e) => setNewKpiValue(e.target.value)}
                placeholder="القيمة"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded bg-white font-mono-num"
              />
              <input
                type="text"
                value={newKpiUnit}
                onChange={(e) => setNewKpiUnit(e.target.value)}
                placeholder="الوحدة"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newKpiLabel.trim() || !newKpiValue.trim()) return;
                  const created: DepartmentKpi = {
                    id: `${activeDept.id}-k-${Date.now()}`,
                    label: newKpiLabel.trim(),
                    value: newKpiValue.trim(),
                    unit: newKpiUnit.trim() || '%',
                    targetNote: 'مؤشر معتمد من لوحة الإدارة',
                    isSampleData: false,
                  };
                  const next = [...kpis, created];
                  setKpis(next);
                  setNewKpiLabel('');
                  setNewKpiValue('');
                  setNewKpiUnit('');
                  handleSaveDepartmentKpis(next);
                }}
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#0D9488] rounded cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مؤشر</span>
              </button>
            </div>
          )}

          <div className="space-y-2">
            {kpis.map((k, idx) => (
              <div
                key={k.id}
                className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
              >
                <input
                  type="text"
                  disabled={!canEditKpis}
                  value={k.label}
                  onChange={(e) =>
                    setKpis((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                    )
                  }
                  className="sm:col-span-5 px-2.5 py-1.5 bg-white border border-slate-300 rounded disabled:bg-slate-100"
                />
                <input
                  type="text"
                  disabled={!canEditKpis}
                  value={k.value}
                  onChange={(e) =>
                    setKpis((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? { ...x, value: e.target.value, isSampleData: false }
                          : x
                      )
                    )
                  }
                  className="sm:col-span-3 px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono-num disabled:bg-slate-100"
                />
                <input
                  type="text"
                  disabled={!canEditKpis}
                  value={k.unit}
                  onChange={(e) =>
                    setKpis((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x))
                    )
                  }
                  className="sm:col-span-3 px-2.5 py-1.5 bg-white border border-slate-300 rounded disabled:bg-slate-100"
                />
                {canDelete && (
                  <button
                    type="button"
                    disabled={kpis.length <= 1}
                    onClick={() => {
                      const next = kpis.filter((x) => x.id !== k.id);
                      setKpis(next);
                      handleSaveDepartmentKpis(next);
                    }}
                    className="sm:col-span-1 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer flex justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Excel Files Section (Strictly gated by upload_excel / view_data) */}
      {(canView || canUploadExcel) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-base font-display font-bold text-[#0B1F3A]">
            <FileSpreadsheet className="w-5 h-5 text-[#0D9488]" />
            <span>جداول البيانات وملفات Excel ({excelFiles.length})</span>
          </div>

          {canUploadExcel && (
            <form
              onSubmit={handleAddExcel}
              className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#0B1F3A] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0D9488]" />
                  <span>اختيار ملف Excel (.xlsx / .xls / .csv)</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadMediaFile(file);
                        setExcelUrl(url);
                        setExcelFileName(file.name);
                        if (!excelTitle) setExcelTitle(file.name.replace(/\.[^.]+$/, ''));
                        onNotify('ok', 'تم رفع ملف Excel إلى الخادم.');
                      } catch (err) {
                        onNotify(
                          'err',
                          err instanceof Error ? err.message : 'تعذر رفع ملف Excel'
                        );
                      }
                    }}
                  />
                </label>
                {excelFileName && (
                  <span className="text-xs text-emerald-700 font-mono-num">
                    جاهز للإرفاق: {excelFileName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={excelTitle}
                  onChange={(e) => setExcelTitle(e.target.value)}
                  placeholder="وصف أو عنوان ملف Excel *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={excelUrl}
                  onChange={(e) => setExcelUrl(e.target.value)}
                  placeholder="/uploads/..."
                  className="px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0D9488] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>حفظ وإرفاق ملف Excel للإدارة</span>
              </button>
            </form>
          )}

          {canView && (
            <div className="space-y-2">
              {excelFiles.length === 0 ? (
                <p className="text-xs text-slate-500">لا توجد ملفات Excel مرفقة لهذه الإدارة بعد.</p>
              ) : (
                excelFiles.map((xf) => (
                  <div
                    key={xf.id}
                    className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#0B1F3A]">{xf.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono-num">
                        {xf.fileName} · رفع بواسطة: {xf.uploadedBy}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={xf.url}
                        download={xf.fileName}
                        className="px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] bg-white border border-slate-300 rounded hover:bg-slate-50"
                      >
                        تنزيل
                      </a>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExcel(xf.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Department Media Upload / YouTube */}
      {(canView || canAnyMedia) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-display font-bold text-[#0B1F3A]">
            توثيق الأعمال الميدانية (صور · فيديو · YouTube)
          </h3>

          {canAnyMedia && (
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {canUploadImg && (
                  <button
                    type="button"
                    onClick={() => setMediaType('image')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer ${
                      mediaType === 'image'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>صورة ميدانية</span>
                  </button>
                )}
                {canUploadVid && (
                  <button
                    type="button"
                    onClick={() => setMediaType('video')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer ${
                      mediaType === 'video'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>رفع فيديو</span>
                  </button>
                )}
                {canAddYt && (
                  <button
                    type="button"
                    onClick={() => setMediaType('youtube')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer ${
                      mediaType === 'youtube'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <Youtube className="w-3.5 h-3.5" />
                    <span>رابط YouTube</span>
                  </button>
                )}
              </div>

              {mediaType !== 'youtube' && (
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#0B1F3A] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0D9488]" />
                  <span>
                    {mediaType === 'image'
                      ? 'اختيار صورة للرفع إلى الخادم'
                      : 'اختيار ملف فيديو (MP4/WebM) للرفع'}
                  </span>
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
                        onNotify('ok', 'تم رفع الملف إلى الخادم بنجاح.');
                      } catch (err) {
                        onNotify(
                          'err',
                          err instanceof Error ? err.message : 'تعذر رفع الملف'
                        );
                      }
                    }}
                  />
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="عنوان التوثيق"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
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
                  className="px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
                />
                <select
                  value={mediaCategory}
                  onChange={(e) =>
                    setMediaCategory(e.target.value as MediaItem['category'])
                  }
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {MEDIA_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="وصف أو تعليق ميداني مختصر"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoGallery}
                    onChange={(e) => setAlsoGallery(e.target.checked)}
                    className="accent-[#0D9488]"
                  />
                  <span>إدراج نسخة أيضاً في معرض الصور والفيديوهات العام (بعد الاعتماد)</span>
                </label>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAddMedia}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#0D9488] rounded-lg cursor-pointer"
                >
                  إرفاق التوثيق للإدارة
                </button>
              </div>
            </div>
          )}

          {canView && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeDept.mediaItems.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0B1F3A] truncate">
                        {m.title}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded ${
                          m.approvalStatus === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {m.approvalStatus === 'draft' ? 'مسودة' : 'معتمد'}
                      </span>
                    </div>
                    <div className="text-slate-500 mt-0.5 truncate">
                      {m.type} · {m.caption}
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDeptMedia(m.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Department Operational Reports */}
      {(canView || canAddReports) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-base font-display font-bold text-[#0B1F3A]">
            <FileText className="w-5 h-5 text-[#0D9488]" />
            <span>التقارير التشغيلية التابعة للإدارة ({reports.length})</span>
          </div>

          {canAddReports && (
            <form
              onSubmit={handleAddReport}
              className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={repTitle}
                  onChange={(e) => setRepTitle(e.target.value)}
                  placeholder="عنوان التقرير التشغيلي *"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={repPeriod}
                  onChange={(e) => setRepPeriod(e.target.value)}
                  placeholder="الفترة الزمنية (مثال: الأسبوع الرابع — الشهر الحالي)"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <textarea
                rows={3}
                required
                value={repSummary}
                onChange={(e) => setRepSummary(e.target.value)}
                placeholder="ملخص التقرير والإنجازات الميدانية والتوصيات *"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة التقرير</span>
              </button>
            </form>
          )}

          {canView && (
            <div className="space-y-2.5">
              {reports.length === 0 ? (
                <p className="text-xs text-slate-500">
                  لا توجد تقارير مضافة لهذه الإدارة بعد.
                </p>
              ) : (
                reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#0B1F3A]">
                          {rep.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] rounded ${
                            rep.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rep.status === 'approved' ? 'معتمد' : 'مسودة قيد المراجعة'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {rep.summary}
                      </p>
                      <div className="text-[11px] text-slate-500">
                        الفترة: {rep.periodLabel} · أعدّه: {rep.authorName}
                        {rep.approvedBy ? ` · اعتمده: ${rep.approvedBy}` : ''}
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReport(rep.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
