import React, { useState } from 'react';
import {
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Monitor,
  Save,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { ExternalPortalSettings, PublicDisplayMode } from '../../types/cms';
import { adminFetch, readJsonSafe, uploadMediaFile } from '../../utils/mediaHelpers';
import { ResilientImage } from '../ResilientImage';

interface ExternalSettingsPanelProps {
  settings: ExternalPortalSettings;
  canPublishGlobal: boolean;
  onChange: (next: ExternalPortalSettings) => void;
  onWorkspaceReload: (payload: unknown) => void;
  onPublishAll: () => Promise<void>;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export const ExternalSettingsPanel: React.FC<ExternalSettingsPanelProps> = ({
  settings,
  canPublishGlobal,
  onChange,
  onWorkspaceReload,
  onPublishAll,
  onNotify,
}) => {
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/external-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const { data: json } = await readJsonSafe<{ error?: string }>(res);
      if (!res.ok) {
        onNotify('err', json?.error || 'تعذر حفظ إعدادات الواجهة الخارجية.');
        return;
      }
      onWorkspaceReload(json);
      onNotify('ok', 'تم حفظ إعدادات الواجهة الخارجية في المسودة (تظهر للعامة بعد الاعتماد والنشر).');
    } catch {
      onNotify('err', 'تعذر الاتصال بالخادم أثناء الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAsset = async (
    key: 'nwcLogoUrl' | 'alkhorayefLogoUrl' | 'projectIntroVideoUrl' | 'projectIntroVideoPosterUrl',
    file: File
  ) => {
    setUploadingKey(key);
    try {
      const url = await uploadMediaFile(file);
      onChange({ ...settings, [key]: url });
      onNotify('ok', 'تم رفع الملف بنجاح إلى المسودة. تذكّر حفظ المسودة ثم الاعتماد والنشر.');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'تعذر رفع الملف.');
    } finally {
      setUploadingKey(null);
    }
  };

  const toggleItems: {
    key: keyof Pick<
      ExternalPortalSettings,
      | 'showProjectNameOnly'
      | 'showLogos'
      | 'showProjectDetailsAndVideo'
      | 'showContractManagerAndVideo'
      | 'showExecutiveKpis'
      | 'enableShowcaseMode'
    >;
    title: string;
    desc: string;
  }[] = [
    {
      key: 'showProjectNameOnly',
      title: 'إظهار اسم المشروع فقط',
      desc: 'وضع تعريفي مختصر يكتفي بعرض الاسم الرسمي للمشروع والشعارات (إن فُعلت) ويحجب بقية الشاشات والتفاصيل.',
    },
    {
      key: 'showLogos',
      title: 'إظهار اسم المشروع والشعارات',
      desc: 'عرض شعار شركة المياه الوطنية (NWC) وشعار شركة الخريف في رأس الواجهة التعريفية وشاشات العرض.',
    },
    {
      key: 'showProjectDetailsAndVideo',
      title: 'إظهار بيانات المشروع والفيديو التعريفي',
      desc: 'عرض النبذة التعريفية، نطاق العمل، والفيديو التعريفي الرسمي للمشروع في صفحة /project والعرض الشامل.',
    },
    {
      key: 'showContractManagerAndVideo',
      title: 'إظهار بيانات مدير العقد والفيديو التعريفي',
      desc: 'تفعيل ظهور صفحة /contract-manager في الموقع ونتائج Google (يشترط أيضاً اعتماد ونشر ملف المدير).',
    },
    {
      key: 'showExecutiveKpis',
      title: 'إظهار المؤشرات التنفيذية فقط / لوحة المؤشرات',
      desc: 'إتاحة شاشات المؤشرات والأداء والإنجازات والمقارنات المجمعة (/executive) للزوار وشاشات العرض.',
    },
    {
      key: 'enableShowcaseMode',
      title: 'إظهار جميع البيانات في شاشة عرض شاملة',
      desc: 'تفعيل مسار /showcase ودورة العرض المتكاملة التلقائية التي تجمع المشروع والمدير والمؤشرات.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <div className="text-xs font-medium text-[#0284C7] mb-1 inline-flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" />
              <span>التحكم المرن في الواجهة الخارجية</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#0A192F]">
              إعدادات الواجهة الخارجية وأوضاع العرض
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              تحكم كامل في عناصر الموقع وشاشات العرض والأوضاع الأربعة دون أي تعديل برمجي. أي
              تعطيل يُطبّق على مستوى الخادم أيضاً بعد الاعتماد والنشر.
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
              <span>{saving ? 'جاري الحفظ...' : 'حفظ في المسودة'}</span>
            </button>

            {canPublishGlobal && (
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await handleSaveDraft();
                  await onPublishAll();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>اعتماد ونشر للعامة</span>
              </button>
            )}
          </div>
        </div>

        {/* 6 Independent Toggle Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {toggleItems.map((item) => {
            const checked = Boolean(settings[item.key]);
            return (
              <label
                key={item.key}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? 'bg-[#F0F9FF] border-[#0284C7]/40'
                    : 'bg-[#F8FAFC] border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      [item.key]: e.target.checked,
                    })
                  }
                  className="mt-1 w-4 h-4 accent-[#0284C7]"
                />
                <div>
                  <div className="text-sm font-display font-bold text-[#0A192F]">
                    {item.title}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Display Mode & Auto-Rotation Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
              الوضع الافتراضي للرابط الرئيسي (/)
            </label>
            <select
              value={settings.defaultLandingMode}
              onChange={(e) =>
                onChange({
                  ...settings,
                  defaultLandingMode: e.target.value as PublicDisplayMode,
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="showcase">العرض الشامل (/showcase)</option>
              <option value="project">عرض المشروع (/project)</option>
              <option value="contract-manager">عرض مدير العقد (/contract-manager)</option>
              <option value="executive">عرض المؤشرات التنفيذية (/executive)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
              مدة التنقل التلقائي بين الشاشات (بالثواني)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={settings.autoRotateSeconds}
              onChange={(e) =>
                onChange({
                  ...settings,
                  autoRotateSeconds: Math.min(120, Math.max(5, Number(e.target.value) || 20)),
                })
              }
              className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-[#F8FAFC] w-full cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowVisitorModeSwitch}
                onChange={(e) =>
                  onChange({ ...settings, allowVisitorModeSwitch: e.target.checked })
                }
                className="w-4 h-4 accent-[#0284C7]"
              />
              <span className="text-xs font-medium text-[#0A192F]">
                السماح للزائر بالتبديل بين الأوضاع المفعّلة
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Partner Logos Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <div className="text-xs font-medium text-[#0284C7] mb-1 inline-flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>الشعارات الرسمية للشركاء</span>
          </div>
          <h3 className="text-lg font-display font-bold text-[#0A192F]">
            شعار شركة المياه الوطنية (NWC) وشعار شركة الخريف
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NWC Logo */}
          <div className="border border-slate-200 rounded-xl p-4 bg-[#F8FAFC] space-y-3">
            <div className="text-sm font-bold text-[#0A192F]">شعار شركة المياه الوطنية (NWC)</div>
            {settings.nwcLogoUrl && (
              <div className="h-20 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center">
                <ResilientImage
                  src={settings.nwcLogoUrl}
                  alt="معاينة شعار NWC"
                  fallbackTitle="NWC"
                  className="max-h-16 object-contain"
                />
              </div>
            )}
            <input
              type="text"
              value={settings.nwcLogoUrl}
              onChange={(e) => onChange({ ...settings, nwcLogoUrl: e.target.value })}
              placeholder="رابط الشعار المرفوع (/uploads/...)"
              className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
            />
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0A192F] text-white rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingKey === 'nwcLogoUrl' ? 'جاري الرفع...' : 'رفع شعار (PNG/WebP/JPG)'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAsset('nwcLogoUrl', f);
                  }}
                />
              </label>
              {settings.nwcLogoUrl && (
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, nwcLogoUrl: '' })}
                  className="px-3 py-2 text-xs text-red-700 bg-red-50 rounded-lg cursor-pointer"
                >
                  إزالة
                </button>
              )}
            </div>
          </div>

          {/* Alkhorayef Logo */}
          <div className="border border-slate-200 rounded-xl p-4 bg-[#F8FAFC] space-y-3">
            <div className="text-sm font-bold text-[#0A192F]">شعار شركة الخريف</div>
            {settings.alkhorayefLogoUrl && (
              <div className="h-20 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center">
                <ResilientImage
                  src={settings.alkhorayefLogoUrl}
                  alt="معاينة شعار الخريف"
                  fallbackTitle="Alkhorayef"
                  className="max-h-16 object-contain"
                />
              </div>
            )}
            <input
              type="text"
              value={settings.alkhorayefLogoUrl}
              onChange={(e) => onChange({ ...settings, alkhorayefLogoUrl: e.target.value })}
              placeholder="رابط الشعار المرفوع (/uploads/...)"
              className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
            />
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0A192F] text-white rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {uploadingKey === 'alkhorayefLogoUrl' ? 'جاري الرفع...' : 'رفع شعار (PNG/WebP/JPG)'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAsset('alkhorayefLogoUrl', f);
                  }}
                />
              </label>
              {settings.alkhorayefLogoUrl && (
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, alkhorayefLogoUrl: '' })}
                  className="px-3 py-2 text-xs text-red-700 bg-red-50 rounded-lg cursor-pointer"
                >
                  إزالة
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700">
          <input
            type="checkbox"
            checked={settings.logosConsentConfirmed}
            onChange={(e) =>
              onChange({ ...settings, logosConsentConfirmed: e.target.checked })
            }
            className="w-4 h-4 accent-[#0284C7]"
          />
          <ShieldCheck className="w-4 h-4 text-[#0284C7] shrink-0" />
          <span>
            أقر بوجود التصريح المؤسسي اللازم لاستخدام الشعارات الرسمية المرفوعة ضمن الواجهة العامة للمشروع.
          </span>
        </label>
      </div>

      {/* Project Intro Video Settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="text-xs font-medium text-[#0284C7] inline-flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5" />
          <span>الفيديو التعريفي للمشروع (/project و /showcase)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#0A192F] mb-1">
              عنوان الفيديو التعريفي بالمشروع
            </label>
            <input
              type="text"
              value={settings.projectIntroVideoTitle}
              onChange={(e) =>
                onChange({ ...settings, projectIntroVideoTitle: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0A192F] mb-1">
              رابط الفيديو (MP4/WebM مرفوع أو رابط YouTube رسمي)
            </label>
            <input
              type="text"
              value={settings.projectIntroVideoUrl}
              onChange={(e) =>
                onChange({ ...settings, projectIntroVideoUrl: e.target.value })
              }
              placeholder="https://youtube.com/... أو /uploads/..."
              className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0A192F] text-white rounded-lg cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>
              {uploadingKey === 'projectIntroVideoUrl'
                ? 'جاري رفع الفيديو...'
                : 'رفع فيديو المشروع (MP4/WebM)'}
            </span>
            <input
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadAsset('projectIntroVideoUrl', f);
              }}
            />
          </label>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-[#0A192F] rounded-lg cursor-pointer">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>
              {uploadingKey === 'projectIntroVideoPosterUrl'
                ? 'جاري رفع الغلاف...'
                : 'رفع صورة غلاف الفيديو'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadAsset('projectIntroVideoPosterUrl', f);
              }}
            />
          </label>

          <span className="text-xs text-slate-500 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>تذكّر حفظ المسودة ثم الاعتماد والنشر لتحديث الواجهة العامة.</span>
          </span>
        </div>
      </div>
    </div>
  );
};
