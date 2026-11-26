import React, { useState } from 'react';
import {
  FileText,
  Film,
  Plus,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  ContractManagerAttachment,
  ContractManagerExperience,
  ContractManagerProfile,
  ContractManagerQualification,
  ContractManagerTraining,
} from '../../types/cms';
import { adminFetch, readJsonSafe, uploadMediaFile } from '../../utils/mediaHelpers';
import { ResilientImage } from '../ResilientImage';

interface ContractManagerAdminPanelProps {
  profile: ContractManagerProfile;
  canPublishGlobal: boolean;
  onChange: (next: ContractManagerProfile) => void;
  onWorkspaceReload: (payload: unknown) => void;
  onPublishAll: () => Promise<void>;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export const ContractManagerAdminPanel: React.FC<ContractManagerAdminPanelProps> = ({
  profile,
  canPublishGlobal,
  onChange,
  onWorkspaceReload,
  onPublishAll,
  onNotify,
}) => {
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Add qualification form
  const [qualTitle, setQualTitle] = useState('');
  const [qualIssuer, setQualIssuer] = useState('');
  const [qualYear, setQualYear] = useState('');
  const [qualKind, setQualKind] = useState<'academic' | 'professional'>('academic');
  const [qualNote, setQualNote] = useState('');

  // Add training form
  const [trnTitle, setTrnTitle] = useState('');
  const [trnProvider, setTrnProvider] = useState('');
  const [trnYear, setTrnYear] = useState('');
  const [trnDuration, setTrnDuration] = useState('');

  // Add experience form
  const [expRole, setExpRole] = useState('');
  const [expOrg, setExpOrg] = useState('');
  const [expPeriod, setExpPeriod] = useState('');
  const [expSummary, setExpSummary] = useState('');
  const [expHighlights, setExpHighlights] = useState('');

  // Add attachment form
  const [attTitle, setAttTitle] = useState('');
  const [attCategory, setAttCategory] = useState<'cv' | 'certificate' | 'credential'>('cv');
  const [attAllowDownload, setAttAllowDownload] = useState(true);

  const handleSaveDraft = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/contract-manager', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      const { data: json } = await readJsonSafe<{ error?: string }>(res);
      if (!res.ok) {
        onNotify('err', json?.error || 'تعذر حفظ مسودة بيانات مدير العقد.');
        return false;
      }
      onWorkspaceReload(json);
      onNotify('ok', 'تم حفظ مسودة بيانات مدير العقد. لن تظهر للعامة إلا بعد تأكيد الموافقة والاعتماد والنشر.');
      return true;
    } catch {
      onNotify('err', 'تعذر الاتصال بالخادم أثناء حفظ بيانات مدير العقد.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFile = async (
    target: 'photoUrl' | 'introVideoUrl' | 'introVideoPosterUrl' | 'attachment',
    file: File
  ) => {
    setUploadingField(target);
    try {
      const url = await uploadMediaFile(file);
      if (target === 'attachment') {
        const nextAtt: ContractManagerAttachment = {
          id: `cm-att-${Date.now()}`,
          title: attTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
          category: attCategory,
          fileUrl: url,
          fileName: file.name,
          allowDownload: attAllowDownload,
          approvedForPublic: profile.consentConfirmed,
        };
        onChange({
          ...profile,
          attachments: [...profile.attachments, nextAtt],
        });
        setAttTitle('');
        onNotify('ok', 'تم إرفاق الملف بالمسودة. تأكد من خلوه من أي بيانات شخصية حساسة قبل الاعتماد.');
      } else {
        onChange({ ...profile, [target]: url });
        onNotify('ok', 'تم رفع الملف وتحديث المسودة.');
      }
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'تعذر رفع الملف.');
    } finally {
      setUploadingField(null);
    }
  };

  const addQualification = () => {
    if (!qualTitle.trim() || !qualIssuer.trim()) {
      onNotify('err', 'يرجى إدخال عنوان المؤهل والجهة المانحة.');
      return;
    }
    const item: ContractManagerQualification = {
      id: `cm-q-${Date.now()}`,
      title: qualTitle.trim(),
      issuer: qualIssuer.trim(),
      year: qualYear.trim(),
      kind: qualKind,
      credentialNote: qualNote.trim(),
    };
    onChange({ ...profile, qualifications: [...profile.qualifications, item] });
    setQualTitle('');
    setQualIssuer('');
    setQualYear('');
    setQualNote('');
  };

  const addTraining = () => {
    if (!trnTitle.trim() || !trnProvider.trim()) {
      onNotify('err', 'يرجى إدخال اسم الدورة والجهة التدريبية.');
      return;
    }
    const item: ContractManagerTraining = {
      id: `cm-t-${Date.now()}`,
      title: trnTitle.trim(),
      provider: trnProvider.trim(),
      year: trnYear.trim(),
      durationNote: trnDuration.trim(),
    };
    onChange({ ...profile, trainings: [...profile.trainings, item] });
    setTrnTitle('');
    setTrnProvider('');
    setTrnYear('');
    setTrnDuration('');
  };

  const addExperience = () => {
    if (!expRole.trim() || !expOrg.trim()) {
      onNotify('err', 'يرجى إدخال المسمى الوظيفي والجهة.');
      return;
    }
    const item: ContractManagerExperience = {
      id: `cm-e-${Date.now()}`,
      roleTitle: expRole.trim(),
      organization: expOrg.trim(),
      period: expPeriod.trim(),
      summary: expSummary.trim(),
      highlights: expHighlights
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onChange({ ...profile, experiences: [...profile.experiences, item] });
    setExpRole('');
    setExpOrg('');
    setExpPeriod('');
    setExpSummary('');
    setExpHighlights('');
  };

  return (
    <div className="space-y-6">
      {/* Header + Save / Publish Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="text-xs font-medium text-[#0284C7] mb-1 inline-flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>إدارة الصفحة التعريفية الرسمية (/contract-manager)</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#0A192F]">
              إدارة بيانات مدير العقد ومرفقاته المعتمدة
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              أي تعديل يُحفظ أولاً في المسودة الداخلية. لا يظهر المحتوى على الواجهة العامة أو في
              محركات البحث إلا بعد تأكيد الموافقة والاعتماد الصريح.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium bg-[#0A192F] hover:bg-[#0F2942] text-white rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ المسودة'}</span>
            </button>

            {canPublishGlobal && (
              <button
                type="button"
                disabled={saving || !profile.consentConfirmed}
                onClick={async () => {
                  const saved = await handleSaveDraft();
                  if (saved) await onPublishAll();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg cursor-pointer disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                <span>اعتماد ونشر للعامة</span>
              </button>
            )}
          </div>
        </div>

        {/* Governance & Consent Gate */}
        <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-amber-900">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>
              <strong>ضابط الخصوصية وحقوق النشر:</strong> تأكد قبل النشر من وجود موافقة صاحب
              البيانات على إتاحة الصورة الشخصية والفيديو والشهادات وملف السيرة الذاتية للعامة
              ومحركات البحث، وحذف أي رقم هوية وطنية أو عنوان سكني خاص أو رقم جوال شخصي من
              المرفقات.
            </span>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-[#0A192F] cursor-pointer">
            <input
              type="checkbox"
              checked={profile.consentConfirmed}
              onChange={(e) =>
                onChange({
                  ...profile,
                  consentConfirmed: e.target.checked,
                  isPublished: e.target.checked ? profile.isPublished : false,
                })
              }
              className="w-4 h-4 accent-[#0284C7]"
            />
            <span>
              أقر بموافقة صاحب البيانات الصريحة على النشر العام وخلو الملفات المرفقة من أي معلومات شخصية حساسة.
            </span>
          </label>

          <label
            className={`flex items-center gap-2.5 text-xs font-bold cursor-pointer ${
              profile.consentConfirmed ? 'text-[#0284C7]' : 'text-slate-400'
            }`}
          >
            <input
              type="checkbox"
              disabled={!profile.consentConfirmed}
              checked={profile.isPublished && profile.consentConfirmed}
              onChange={(e) => onChange({ ...profile, isPublished: e.target.checked })}
              className="w-4 h-4 accent-[#0284C7]"
            />
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              إتاحة ونشر صفحة «بيانات مدير العقد» على الموقع العام وفهرستها في Google بعد الاعتماد
            </span>
          </label>
        </div>
      </div>

      {/* Basic Identity & Portrait */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="text-lg font-display font-bold text-[#0A192F]">
          1. البيانات الشخصية والنبذة التعريفية
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-3">
            <div className="aspect-[3/4] max-h-[280px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
              {profile.photoUrl ? (
                <ResilientImage
                  src={profile.photoUrl}
                  alt={profile.fullName || 'صورة مدير العقد'}
                  fallbackTitle="مدير العقد"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-slate-500 px-4 text-center">
                  لا توجد صورة شخصية مرفوعة بعد
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0A192F] text-white rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {uploadingField === 'photoUrl' ? 'جاري الرفع...' : 'رفع صورة شخصية'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadFile('photoUrl', f);
                  }}
                />
              </label>
              {profile.photoUrl && (
                <button
                  type="button"
                  onClick={() => onChange({ ...profile, photoUrl: '' })}
                  className="px-3 py-2 text-xs text-red-700 bg-red-50 rounded-lg cursor-pointer"
                >
                  حذف الصورة
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0A192F] mb-1">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => onChange({ ...profile, fullName: e.target.value })}
                  placeholder="الاسم الكامل المعتمد للنشر"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0A192F] mb-1">
                  المسمى الوظيفي
                </label>
                <input
                  type="text"
                  value={profile.jobTitle}
                  onChange={(e) => onChange({ ...profile, jobTitle: e.target.value })}
                  placeholder="مدير العقد"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0A192F] mb-1">
                النبذة التعريفية والقيادية
              </label>
              <textarea
                rows={5}
                value={profile.bio}
                onChange={(e) => onChange({ ...profile, bio: e.target.value })}
                placeholder="نبذة مهنية موثقة عن الخبرة القيادية في قطاع المياه وإدارة العقود..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Intro Video */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-[#0284C7]" />
          <h3 className="text-lg font-display font-bold text-[#0A192F]">
            2. الفيديو التعريفي بمدير العقد
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#0A192F] mb-1">
              عنوان الفيديو التعريفي
            </label>
            <input
              type="text"
              value={profile.introVideoTitle}
              onChange={(e) => onChange({ ...profile, introVideoTitle: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0A192F] mb-1">
              رابط الفيديو (YouTube أو ملف MP4/WebM مرفوع)
            </label>
            <input
              type="text"
              value={profile.introVideoUrl}
              onChange={(e) => onChange({ ...profile, introVideoUrl: e.target.value })}
              placeholder="https://youtube.com/... أو /uploads/..."
              className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0A192F] text-white rounded-lg cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>
              {uploadingField === 'introVideoUrl' ? 'جاري رفع الفيديو...' : 'رفع فيديو (MP4/WebM)'}
            </span>
            <input
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadFile('introVideoUrl', f);
              }}
            />
          </label>
          {profile.introVideoUrl && (
            <button
              type="button"
              onClick={() => onChange({ ...profile, introVideoUrl: '' })}
              className="px-3 py-2 text-xs text-red-700 bg-red-50 rounded-lg cursor-pointer"
            >
              إزالة الفيديو
            </button>
          )}
        </div>
      </div>

      {/* Qualifications & Certifications */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="text-lg font-display font-bold text-[#0A192F]">
          3. المؤهلات العلمية والشهادات المهنية ({profile.qualifications.length})
        </h3>

        {profile.qualifications.length > 0 && (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl px-4">
            {profile.qualifications.map((q) => (
              <div key={q.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">
                    {q.kind === 'academic' ? 'مؤهل علمي' : 'شهادة مهنية'} · {q.issuer}
                    {q.year ? ` · ${q.year}` : ''}
                  </div>
                  <div className="text-sm font-bold text-[#0A192F]">{q.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...profile,
                      qualifications: profile.qualifications.filter((x) => x.id !== q.id),
                    })
                  }
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  aria-label="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F8FAFC] p-4 rounded-xl border border-slate-200">
          <select
            value={qualKind}
            onChange={(e) => setQualKind(e.target.value as 'academic' | 'professional')}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="academic">مؤهل علمي</option>
            <option value="professional">شهادة مهنية / اعتماد</option>
          </select>
          <input
            type="text"
            value={qualTitle}
            onChange={(e) => setQualTitle(e.target.value)}
            placeholder="اسم الدرجة أو الشهادة"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
          <input
            type="text"
            value={qualIssuer}
            onChange={(e) => setQualIssuer(e.target.value)}
            placeholder="الجامعة أو الجهة المانحة"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
          <input
            type="text"
            value={qualYear}
            onChange={(e) => setQualYear(e.target.value)}
            placeholder="السنة (مثال: 2022)"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
          <input
            type="text"
            value={qualNote}
            onChange={(e) => setQualNote(e.target.value)}
            placeholder="ملاحظة أو رقم اعتماد عام اختياري"
            className="sm:col-span-2 lg:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
          <button
            type="button"
            onClick={addQualification}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0284C7] text-white rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مؤهل / شهادة</span>
          </button>
        </div>
      </div>

      {/* Trainings & Experiences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trainings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-display font-bold text-[#0A192F]">
            4. الدورات التدريبية ({profile.trainings.length})
          </h3>
          {profile.trainings.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl px-4">
              {profile.trainings.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">
                      {t.provider} {t.year ? `· ${t.year}` : ''}
                    </div>
                    <div className="text-sm font-bold text-[#0A192F]">{t.title}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...profile,
                        trainings: profile.trainings.filter((x) => x.id !== t.id),
                      })
                    }
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2.5 bg-[#F8FAFC] p-4 rounded-xl border border-slate-200">
            <input
              type="text"
              value={trnTitle}
              onChange={(e) => setTrnTitle(e.target.value)}
              placeholder="عنوان الدورة التدريبية"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={trnProvider}
                onChange={(e) => setTrnProvider(e.target.value)}
                placeholder="الجهة التدريبية"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <input
                type="text"
                value={trnYear}
                onChange={(e) => setTrnYear(e.target.value)}
                placeholder="السنة"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <input
              type="text"
              value={trnDuration}
              onChange={(e) => setTrnDuration(e.target.value)}
              placeholder="المدة أو الاعتماد (اختياري)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
            <button
              type="button"
              onClick={addTraining}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0284C7] text-white rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة دورة</span>
            </button>
          </div>
        </div>

        {/* Experiences */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-display font-bold text-[#0A192F]">
            5. الخبرات العملية والإنجازات ({profile.experiences.length})
          </h3>
          {profile.experiences.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl px-4">
              {profile.experiences.map((exp) => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">
                      {exp.organization} {exp.period ? `· ${exp.period}` : ''}
                    </div>
                    <div className="text-sm font-bold text-[#0A192F]">{exp.roleTitle}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...profile,
                        experiences: profile.experiences.filter((x) => x.id !== exp.id),
                      })
                    }
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2.5 bg-[#F8FAFC] p-4 rounded-xl border border-slate-200">
            <input
              type="text"
              value={expRole}
              onChange={(e) => setExpRole(e.target.value)}
              placeholder="المنصب / الدور القيادي"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={expOrg}
                onChange={(e) => setExpOrg(e.target.value)}
                placeholder="الجهة / المشروع"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <input
                type="text"
                value={expPeriod}
                onChange={(e) => setExpPeriod(e.target.value)}
                placeholder="الفترة (مثال: 2021 - الآن)"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <textarea
              rows={2}
              value={expSummary}
              onChange={(e) => setExpSummary(e.target.value)}
              placeholder="ملخص المهام والإنجاز..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
            <textarea
              rows={2}
              value={expHighlights}
              onChange={(e) => setExpHighlights(e.target.value)}
              placeholder="أبرز الإنجازات (سطر لكل إنجاز)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
            <button
              type="button"
              onClick={addExperience}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0284C7] text-white rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة خبرة</span>
            </button>
          </div>
        </div>
      </div>

      {/* PDF CV & Certificates Attachments */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#0284C7]" />
          <h3 className="text-lg font-display font-bold text-[#0A192F]">
            6. السيرة الذاتية وملفات الشهادات المعتمدة للنشر (PDF)
          </h3>
        </div>

        {profile.attachments.length > 0 && (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl px-4">
            {profile.attachments.map((att) => (
              <div key={att.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">
                    {att.category === 'cv'
                      ? 'سيرة ذاتية'
                      : att.category === 'certificate'
                        ? 'شهادة مهنية'
                        : 'وثيقة اعتماد'}{' '}
                    · {att.fileName}
                  </div>
                  <div className="text-sm font-bold text-[#0A192F]">{att.title}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={att.approvedForPublic}
                      onChange={(e) =>
                        onChange({
                          ...profile,
                          attachments: profile.attachments.map((x) =>
                            x.id === att.id ? { ...x, approvedForPublic: e.target.checked } : x
                          ),
                        })
                      }
                      className="w-3.5 h-3.5 accent-[#0284C7]"
                    />
                    <span>معتمد للنشر العام</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={att.allowDownload}
                      onChange={(e) =>
                        onChange({
                          ...profile,
                          attachments: profile.attachments.map((x) =>
                            x.id === att.id ? { ...x, allowDownload: e.target.checked } : x
                          ),
                        })
                      }
                      className="w-3.5 h-3.5 accent-[#0284C7]"
                    />
                    <span>السماح بالتحميل</span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...profile,
                        attachments: profile.attachments.filter((x) => x.id !== att.id),
                      })
                    }
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#F8FAFC] p-4 rounded-xl border border-slate-200 items-center">
          <select
            value={attCategory}
            onChange={(e) => setAttCategory(e.target.value as 'cv' | 'certificate' | 'credential')}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="cv">السيرة الذاتية (CV)</option>
            <option value="certificate">شهادة مهنية</option>
            <option value="credential">وثيقة اعتماد</option>
          </select>

          <input
            type="text"
            value={attTitle}
            onChange={(e) => setAttTitle(e.target.value)}
            placeholder="عنوان الملف الظاهر للزوار"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={attAllowDownload}
              onChange={(e) => setAttAllowDownload(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#0284C7]"
            />
            <span>إتاحة زر التحميل</span>
          </label>

          <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0A192F] text-white rounded-lg cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>
              {uploadingField === 'attachment' ? 'جاري الرفع...' : 'رفع ملف PDF معتمد'}
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadFile('attachment', f);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
