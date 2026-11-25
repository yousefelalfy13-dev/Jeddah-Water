import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckSquare,
  FileText,
  Gauge,
  Play,
  Users,
  X,
} from 'lucide-react';
import { Department, DepartmentMedia } from '../types/cms';
import {
  extractYouTubeId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
} from '../utils/mediaHelpers';
import { ResilientImage } from './ResilientImage';

interface DepartmentDetailViewProps {
  department: Department;
  allDepartments: Department[];
  onBackToOrg: () => void;
  onSelectDepartment: (id: string) => void;
}

export const DepartmentDetailView: React.FC<DepartmentDetailViewProps> = ({
  department,
  allDepartments,
  onBackToOrg,
  onSelectDepartment,
}) => {
  const [lightboxMedia, setLightboxMedia] = useState<DepartmentMedia | null>(null);

  return (
    <div
      id="department-detail-page"
      className="bg-[#F8FAFC] border border-slate-200 rounded-2xl overflow-hidden"
    >
      {/* Top Breadcrumb Bar */}
      <div className="bg-[#0B1F3A] text-white px-6 py-5 border-b border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBackToOrg}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى الهيكل التنظيمي</span>
            </button>
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <span>الهيكل التنظيمي</span>
              <span aria-hidden="true">/</span>
              <span className="text-[#5EEAD4] font-medium">{department.name}</span>
            </div>
          </div>
        </div>

        {/* Quick Department Switcher */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1">
          {allDepartments.map((d) => {
            const active = d.id === department.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDepartment(d.id)}
                className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-[#0B1F3A] font-semibold'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="font-mono-num ml-1.5 opacity-75">{d.code}</span>
                <span>{d.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Detail Page Content */}
      <div className="p-6 sm:p-8 lg:p-10 space-y-10">
        {/* 1. تعريف القسم */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-3">
              <div className="text-xs font-medium text-[#0D9488] flex items-center gap-2">
                <span className="font-mono-num">{department.code}</span>
                <span aria-hidden="true">·</span>
                <span>01. تعريف القسم</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A] text-balance">
                {department.name}
              </h3>
              <p className="text-base text-slate-700 leading-relaxed">
                {department.summary}
              </p>
            </div>

            <dl className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-[#0284C7] mt-1 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-500">القطاع التنظيمي</dt>
                  <dd className="font-semibold text-[#0B1F3A]">
                    {department.parentDivision}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-slate-200">
                <Users className="w-4 h-4 text-[#0D9488] mt-1 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-500">المسؤول عن الإدارة / القسم</dt>
                  <dd className="font-semibold text-[#0B1F3A]">
                    {department.headPlaceholder}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-slate-200">
                <CheckSquare className="w-4 h-4 text-[#0284C7] mt-1 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-500">نقاط التكامل مع الإدارات الأخرى</dt>
                  <dd className="text-slate-700 leading-relaxed">
                    {department.interfaces}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </section>

        {/* 2. المسؤوليات والمهام الرئيسية & 3. طبيعة الأعمال اليومية */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="text-xs font-medium text-[#0D9488]">
                  02. المسؤوليات والمهام الرئيسية
                </div>
                <h4 className="text-lg font-display font-bold text-[#0B1F3A] mt-0.5">
                  النطاق الوظيفي والصلاحيات
                </h4>
              </div>
              <span className="text-xs font-mono-num text-slate-500">
                {department.responsibilities.length} مهام
              </span>
            </div>

            <ol className="space-y-3">
              {department.responsibilities.map((task, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-100"
                >
                  <span className="font-mono-num text-xs font-bold text-[#0284C7] pt-0.5 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm text-slate-700 leading-relaxed">
                    {task}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="text-xs font-medium text-[#0D9488]">
                  03. طبيعة الأعمال اليومية
                </div>
                <h4 className="text-lg font-display font-bold text-[#0B1F3A] mt-0.5">
                  الدورة التشغيلية والإجراءات اليومية
                </h4>
              </div>
              <CalendarClock className="w-5 h-5 text-[#0284C7]" />
            </div>

            <ul className="space-y-3">
              {department.dailyOperations.map((op, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-100"
                >
                  <span className="font-mono-num text-xs font-bold text-[#0D9488] pt-0.5 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm text-slate-700 leading-relaxed">
                    {op}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 4. الفرق الميدانية والتشغيلية */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="text-xs font-medium text-[#0D9488]">
                04. الفرق الميدانية والتشغيلية
              </div>
              <h4 className="text-lg font-display font-bold text-[#0B1F3A] mt-0.5">
                هيكلة الفرق والجاهزية الميدانية
              </h4>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {department.fieldTeams.map((team) => (
              <div
                key={team.id}
                className="p-5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col justify-between space-y-3"
              >
                <div>
                  <h5 className="text-base font-display font-bold text-[#0B1F3A] mb-1.5">
                    {team.teamName}
                  </h5>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {team.roleDescription}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200 text-xs text-[#0284C7] font-medium">
                  نظام الجاهزية والمناوبة: {team.shiftOrReadinessNote}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. مؤشرات الأداء الخاصة بالقسم */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="text-xs font-medium text-[#0D9488]">
                05. مؤشرات الأداء الخاصة بالقسم
              </div>
              <h4 className="text-lg font-display font-bold text-[#0B1F3A] mt-0.5">
                معايير القياس والمتابعة الدورية
              </h4>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Gauge className="w-4 h-4 text-[#0D9488]" />
              <span>مؤشر التركيز: {department.kpiFocus}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {department.departmentKpis.map((kpi) => (
              <div
                key={kpi.id}
                className="p-5 rounded-xl bg-[#0B1F3A] text-white flex flex-col justify-between space-y-3"
              >
                <div className="text-xs text-[#5EEAD4]">
                  {kpi.isSampleData ? 'نموذج تجريبي' : 'بيان معتمد'}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display font-bold font-mono-num tabular-nums">
                    {kpi.value}
                  </span>
                  <span className="text-xs text-slate-300">{kpi.unit}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">
                    {kpi.label}
                  </div>
                  <div className="text-xs text-slate-300">{kpi.targetNote}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. صور وفيديوهات توثق الأعمال */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="text-xs font-medium text-[#0D9488]">
                06. صور وفيديوهات توثق الأعمال
              </div>
              <h4 className="text-lg font-display font-bold text-[#0B1F3A] mt-0.5">
                الأرشيف المرئي الميداني للقسم
              </h4>
            </div>
          </div>

          {department.mediaItems.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#F8FAFC] border border-slate-200 text-sm text-slate-500">
              لا توجد صور أو فيديوهات منشورة لهذا القسم حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {department.mediaItems.map((item) => {
                const ytId = item.type === 'youtube' ? extractYouTubeId(item.url) : null;
                const thumb =
                  item.type === 'image'
                    ? item.url
                    : ytId
                      ? getYouTubeThumbnailUrl(ytId)
                      : undefined;
                return (
                  <div
                    key={item.id}
                    onClick={() => setLightboxMedia(item)}
                    className="group rounded-xl overflow-hidden border border-slate-200 bg-[#F8FAFC] cursor-pointer"
                  >
                    <div className="relative aspect-[4/3] bg-[#0B1F3A] overflow-hidden">
                      {item.type === 'video' ? (
                        <video
                          src={item.url}
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ResilientImage
                          src={thumb}
                          alt={item.title}
                          fallbackTitle={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      )}
                      {item.type !== 'image' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <span className="w-11 h-11 rounded-full bg-white text-[#0B1F3A] flex items-center justify-center shadow">
                            <Play className="w-4 h-4 fill-current" />
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-display font-bold text-[#0B1F3A] mb-1">
                        {item.title}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.caption}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {department.reports && department.reports.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-display font-bold text-[#0B1F3A] pb-3 border-b border-slate-100">
              <FileText className="w-5 h-5 text-[#0D9488]" />
              <span>التقارير التشغيلية المعتمدة للقسم</span>
            </div>
            <div className="space-y-3">
              {department.reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="text-sm font-display font-bold text-[#0B1F3A]">
                      {rep.title}
                    </h5>
                    <span className="text-xs text-[#0D9488] font-medium">
                      {rep.periodLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rep.summary}</p>
                  <div className="text-[11px] text-slate-500">
                    إعداد: {rep.authorName}
                    {rep.approvedBy ? ` · اعتماد: ${rep.approvedBy}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Lightbox for Department Media */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h4 className="text-base font-display font-bold text-[#0B1F3A]">
                {lightboxMedia.title}
              </h4>
              <button
                type="button"
                onClick={() => setLightboxMedia(null)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-[#0B1F3A] aspect-video w-full flex items-center justify-center">
              {lightboxMedia.type === 'youtube' ? (
                (() => {
                  const ytId = extractYouTubeId(lightboxMedia.url);
                  return ytId ? (
                    <iframe
                      src={getYouTubeEmbedUrl(ytId)}
                      title={lightboxMedia.title}
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  ) : null;
                })()
              ) : lightboxMedia.type === 'video' ? (
                <video src={lightboxMedia.url} controls autoPlay className="w-full h-full" />
              ) : (
                <ResilientImage
                  src={lightboxMedia.url}
                  alt={lightboxMedia.title}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <div className="p-4 text-sm text-slate-700">{lightboxMedia.caption}</div>
          </div>
        </div>
      )}
    </div>
  );
};
