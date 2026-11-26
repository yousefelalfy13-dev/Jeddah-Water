import React from 'react';
import { ArrowUp, Printer } from 'lucide-react';
import { CmsData } from '../types/cms';

interface ImpactClosingSectionProps {
  data: CmsData;
}

export const ImpactClosingSection: React.FC<ImpactClosingSectionProps> = ({
  data,
}) => {
  const { impact } = data;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Chapter 12: Closing Project Impact Section */}
      <section
        id="impact"
        className="bg-[#0B1F3A] text-white py-16 lg:py-20"
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pb-12 border-b border-white/15">
            <div className="lg:col-span-6 space-y-4">
              <div className="text-xs font-medium text-[#5EEAD4]">
                12 · الصفحة الختامية — أثر المشروع واستدامة القطاع
              </div>
              <h2 className="text-2xl sm:text-4xl font-display font-bold leading-tight text-balance">
                {impact.heading}
              </h2>
              <p className="text-base text-slate-200 leading-relaxed">
                {impact.subtitle}
              </p>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                {impact.statement}
              </p>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {impact.pillars.map((pillar) => (
                <div
                  key={pillar.id}
                  className="p-5 rounded-xl bg-[#102A4C] border border-white/10 space-y-2"
                >
                  <div className="text-xs font-mono-num font-semibold text-[#5EEAD4]">
                    أثر {pillar.number}
                  </div>
                  <h3 className="text-base font-display font-bold text-white">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <blockquote className="text-base sm:text-xl font-display text-slate-100 max-w-2xl leading-relaxed">
              {impact.closingQuote}
            </blockquote>

            <div className="flex flex-wrap items-center gap-3 no-print shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الملف التعريفي</span>
              </button>
              <button
                type="button"
                onClick={scrollToTop}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowUp className="w-4 h-4" />
                <span>العودة للأعلى</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Institutional Footer */}
      <footer className="bg-[#08172B] text-slate-400 border-t border-white/10 py-8 no-print">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-slate-300 font-medium">
            العقد الموحد لتشغيل وصيانة قطاع المياه بمدينة جدة · البوابة التعريفية والتوثيقية
          </div>
          <div className="flex items-center gap-4">
            <span>آخر تحديث للبيانات المنشورة: {data.lastUpdated}</span>
          </div>
        </div>
      </footer>
    </>
  );
};
