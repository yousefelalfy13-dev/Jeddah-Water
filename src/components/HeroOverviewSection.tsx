import React from 'react';
import { ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { CmsData, PageId } from '../types/cms';
import { ResilientImage } from './ResilientImage';
import { extractYouTubeId, getYouTubeEmbedUrl } from '../utils/mediaHelpers';

interface HeroOverviewSectionProps {
  data: CmsData;
  onJumpToChapter: (pageId: PageId) => void;
}

const CHAPTER_DIRECTORY: { id: PageId; num: string; title: string; subtitle: string }[] = [
  { id: 'overview', num: '01', title: 'الرئيسية والتعريف بالمشروع', subtitle: 'الرؤية المؤسسية والملخص التنفيذي' },
  { id: 'scope', num: '02', title: 'نطاق العمل وأهداف المشروع', subtitle: 'القطاعات المخدومة والمستهدفات' },
  { id: 'org', num: '03', title: 'الهيكل التنظيمي والإدارات', subtitle: 'توزيع الإدارات والارتباط الإداري' },
  { id: 'duties', num: '04', title: 'مهام ومسؤوليات الأقسام', subtitle: 'الأدوار التشغيلية والتنسيق البيني' },
  { id: 'stations', num: '05', title: 'التشغيل وإدارة المحطات', subtitle: 'محطات الضخ والخزانات وغرف التحكم' },
  { id: 'maintenance', num: '06', title: 'الصيانة العلاجية والانكسارات', subtitle: 'بلاغات الطوارئ وفرق التدخل السريع' },
  { id: 'networks', num: '07', title: 'أعمال الشبكات والميدان', subtitle: 'صيانة المحابس وكشف التسربات' },
  { id: 'quality', num: '08', title: 'الجودة ومراقبة وتعقيم المياه', subtitle: 'الفحوصات المخبرية ومعايير السلامة' },
  { id: 'hse', num: '09', title: 'السلامة والصحة المهنية', subtitle: 'تصاريح العمل والرقابة الوقائية' },
  { id: 'achievements', num: '10', title: 'الإنجازات ومؤشرات الأداء', subtitle: 'الإحصائيات والرسوم البيانية التفاعلية' },
  { id: 'media', num: '11', title: 'معرض الصور والفيديوهات', subtitle: 'التوثيق الميداني ويوتيوب ورفع الصور' },
  { id: 'impact', num: '12', title: 'أثر المشروع الختامي', subtitle: 'الاستدامة المائية والأثر المؤسسي' },
];

export const HeroOverviewSection: React.FC<HeroOverviewSectionProps> = ({
  data,
  onJumpToChapter,
}) => {
  const { hero, overviewBrief, kpis, customSections } = data;
  const ytHeroId = hero.useVideoBackdrop ? extractYouTubeId(hero.heroVideoUrl) : null;

  return (
    <section id="overview" className="bg-white border-b border-slate-200">
      {/* Main Institutional Hero Split */}
      <div className="bg-[#0B1F3A] text-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Right Editorial Column (RTL start) */}
            <div className="lg:col-span-6 flex flex-col justify-between py-2">
              <div>
                <div className="text-xs sm:text-sm text-[#5EEAD4] font-medium tracking-wide mb-4 flex flex-wrap items-center gap-2">
                  <span>{hero.locationLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{hero.contractLabel}</span>
                </div>

                <h1 className="text-[clamp(2rem,3.6vw,3.15rem)] font-display font-bold leading-[1.2] text-white text-balance mb-5">
                  {hero.title}
                </h1>

                <p className="text-base sm:text-lg text-slate-200 leading-relaxed mb-4 max-w-2xl">
                  {hero.subtitle}
                </p>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  {hero.description}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-white/15 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onJumpToChapter('scope')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>استعراض نطاق المشروع</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onJumpToChapter('media')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>معرض الأعمال الميدانية</span>
                </button>
              </div>
            </div>

            {/* Left Visual Carrier Column */}
            <div className="lg:col-span-6 flex">
              <div className="relative w-full min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] rounded-xl overflow-hidden border border-white/15 bg-[#08172B]">
                {hero.useVideoBackdrop && ytHeroId ? (
                  <iframe
                    src={getYouTubeEmbedUrl(ytHeroId)}
                    title={hero.title}
                    className="w-full h-full min-h-[320px] lg:h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : hero.useVideoBackdrop && hero.heroVideoUrl ? (
                  <video
                    src={hero.heroVideoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ResilientImage
                    src={hero.heroImageUrl}
                    alt="محطة ضخ ومعالجة مياه في مدينة جدة"
                    fallbackTitle={hero.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0B1F3A]/85 via-[#0B1F3A]/35 to-transparent" />
                <div className="pointer-events-none absolute bottom-4 right-5 left-5 flex items-center justify-between text-xs text-slate-200">
                  <span>بنية تحتية مائية · التشغيل والتحكم المركزي</span>
                  <span>آخر تحديث: {data.lastUpdated}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column KPI Strip Below Hero Split */}
          <div className="mt-10 pt-8 border-t border-white/15">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <span className="text-xs font-medium text-slate-300">
                مؤشرات المشروع الأساسية (بيانات منشورة للعرض العام)
              </span>
              <button
                type="button"
                onClick={() => onJumpToChapter('achievements')}
                className="text-xs font-medium text-[#5EEAD4] hover:text-white transition-colors cursor-pointer"
              >
                عرض لوحة المؤشرات والرسوم البيانية
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.slice(0, 4).map((kpi) => (
                <div
                  key={kpi.id}
                  className="rounded-xl bg-[#102A4C] border border-white/10 p-5 flex flex-col justify-between"
                >
                  <div className="text-xs text-slate-300 mb-3 flex items-center justify-between gap-2">
                    <span>{kpi.category}</span>
                    {kpi.isSampleData && <span className="text-[#5EEAD4]">نموذج تجريبي</span>}
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-display font-bold text-white tabular-nums font-mono-num">
                      {kpi.value}
                    </span>
                    <span className="text-xs text-slate-300">{kpi.unit}</span>
                  </div>
                  <div className="text-sm text-slate-200 leading-snug">{kpi.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Executive Brief & 12-Chapter Directory */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pb-12 border-b border-slate-200">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-medium text-[#0D9488] tracking-wide">
              01 · التعريف المؤسسي والمنهجية التوثيقية
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A] text-balance">
              {overviewBrief.heading}
            </h2>
            {overviewBrief.paragraphs.map((p, idx) => (
              <p key={idx} className="text-base text-slate-700 leading-[1.8] max-w-prose">
                {p}
              </p>
            ))}
          </div>

          <div className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#0B1F3A] font-display font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-[#0D9488] shrink-0" />
              <span>ميثاق الدقة والمصداقية</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {overviewBrief.governanceNote}
            </p>
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">المحتوى المنشور للعرض العام فقط</span>
              <button
                type="button"
                onClick={() => onJumpToChapter('achievements')}
                className="text-xs font-semibold text-[#0284C7] hover:text-[#0B1F3A] transition-colors cursor-pointer"
              >
                استعراض مؤشرات الأداء
              </button>
            </div>
          </div>
        </div>

        {/* 12-Chapter Interactive Index */}
        <div className="pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">
                دليل فصول المنصة التوثيقية
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A]">
                الأقسام والمحاور الرئيسية للمشروع
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <BookOpen className="w-4 h-4 text-[#0D9488]" />
              <span>
                {12 + customSections.length} فصلاً توثيقياً قابلاً للتصفح والتعديل
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CHAPTER_DIRECTORY.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => onJumpToChapter(ch.id)}
                className="group text-right p-5 rounded-xl bg-white border border-slate-200 hover:border-[#0D9488] hover:bg-[#F8FAFC] transition-colors duration-150 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-mono-num font-semibold text-[#0D9488] mb-2">
                    {ch.num}
                  </div>
                  <div className="text-base font-display font-bold text-[#0B1F3A] group-hover:text-[#0284C7] transition-colors mb-1.5">
                    {ch.title}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ch.subtitle}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-[#0B1F3A]">
                  <span>الانتقال إلى الفصل</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}

            {customSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => onJumpToChapter(sec.id)}
                className="group text-right p-5 rounded-xl bg-white border border-slate-200 hover:border-[#0D9488] hover:bg-[#F8FAFC] transition-colors duration-150 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-mono-num font-semibold text-[#0284C7] mb-2">
                    {sec.chapterNumber} · قسم مضاف
                  </div>
                  <div className="text-base font-display font-bold text-[#0B1F3A] group-hover:text-[#0284C7] transition-colors mb-1.5">
                    {sec.title}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{sec.subtitle}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-[#0B1F3A]">
                  <span>الانتقال إلى الفصل</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
