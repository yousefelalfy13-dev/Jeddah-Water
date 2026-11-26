import React from 'react';
import { Layers } from 'lucide-react';
import { CmsData, OperationalPillar, PageId } from '../types/cms';
import { ResilientImage } from './ResilientImage';

interface OperationsSectionProps {
  data: CmsData;
  activeOperationTab: 'stations' | 'maintenance' | 'networks' | 'quality' | 'hse';
  onSelectOperationTab: (tab: 'stations' | 'maintenance' | 'networks' | 'quality' | 'hse') => void;
  activeCustomSectionId?: string | null;
  onJumpToChapter: (id: PageId) => void;
}

const OP_KEYS: ('stations' | 'maintenance' | 'networks' | 'quality' | 'hse')[] = [
  'stations',
  'maintenance',
  'networks',
  'quality',
  'hse',
];

export const OperationsSection: React.FC<OperationsSectionProps> = ({
  data,
  activeOperationTab,
  onSelectOperationTab,
}) => {
  const currentOp: OperationalPillar = data.operations[activeOperationTab];

  return (
    <section id="operations" className="bg-white border-b border-slate-200 py-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-8">
          <div className="text-xs font-medium text-[#0D9488] mb-2">
            05 – 09 · المحاور التشغيلية والهندسية التخصصية
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A]">
            منظومة التشغيل والصيانة والجودة والسلامة
          </h2>
        </div>

        {/* Interactive Chapter Switcher Tabs */}
        <div
          className="flex items-center gap-1.5 p-1.5 bg-[#F1F5F9] rounded-xl overflow-x-auto mb-10"
          role="tablist"
          aria-label="المحاور التشغيلية"
        >
          {OP_KEYS.map((key) => {
            const item = data.operations[key];
            const isActive = activeOperationTab === key;
            return (
              <button
                key={key}
                id={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectOperationTab(key)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#0B1F3A] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                <span className="font-mono-num text-[#0D9488] ml-1.5">
                  {item.chapterNumber}.
                </span>
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Operational Pillar View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Narrative & 4 Procedures */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div>
              <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
                <span className="font-mono-num font-semibold text-[#0D9488]">
                  الفصل {currentOp.chapterNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span>{currentOp.subtitle}</span>
              </div>

              <h3 className="text-2xl font-display font-bold text-[#0B1F3A] mb-3 text-balance">
                {currentOp.title}
              </h3>

              <p className="text-base text-slate-700 leading-relaxed mb-6">
                {currentOp.leadDescription}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentOp.procedures.map((proc) => (
                  <div
                    key={proc.id}
                    className="p-5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-xs font-mono-num font-bold text-[#0284C7] mb-2">
                        إجراء {proc.step}
                      </div>
                      <h4 className="text-base font-display font-bold text-[#0B1F3A] mb-1.5">
                        {proc.title}
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {proc.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-slate-600 leading-relaxed">
              {currentOp.standardsNote}
            </div>
          </div>

          {/* Documentary Visual Carrier */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 bg-[#0B1F3A] min-h-[300px] lg:min-h-full relative">
              <ResilientImage
                src={currentOp.imageUrl}
                alt={currentOp.title}
                fallbackTitle={currentOp.title}
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0B1F3A]/90 via-[#0B1F3A]/45 to-transparent" />
              <figcaption className="absolute bottom-4 right-5 left-5 text-xs sm:text-sm text-white leading-relaxed">
                {currentOp.imageCaption}
              </figcaption>
            </div>
          </div>
        </div>

        {/* Custom Added Sections */}
        {data.customSections.length > 0 && (
          <div className="mt-14 pt-12 border-t border-slate-200 space-y-8">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-[#0B1F3A]">
              <Layers className="w-4 h-4 text-[#0D9488]" />
              <span>أقسام مضافة ضمن المنصة</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.customSections.map((sec) => (
                <article
                  key={sec.id}
                  id={sec.id}
                  className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 space-y-4"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono-num font-semibold text-[#0284C7]">
                      الفصل {sec.chapterNumber}
                    </span>
                    <span>تاريخ الإضافة: {sec.createdAt}</span>
                  </div>
                  <h3 className="text-xl font-display font-bold text-[#0B1F3A]">
                    {sec.title}
                  </h3>
                  {sec.subtitle && (
                    <p className="text-sm font-medium text-[#0D9488]">
                      {sec.subtitle}
                    </p>
                  )}
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {sec.body}
                  </p>
                  {sec.highlights.length > 0 && (
                    <ul className="pt-3 border-t border-slate-200 space-y-2">
                      {sec.highlights.map((hl, i) => (
                        <li
                          key={i}
                          className="text-xs sm:text-sm text-slate-700 flex items-start gap-2"
                        >
                          <span className="font-mono-num text-[#0D9488] font-semibold">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
