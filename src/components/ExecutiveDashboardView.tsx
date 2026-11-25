import React, { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  CheckCircle2,
  Maximize2,
  Pause,
  Play,
  TrendingUp,
} from 'lucide-react';
import { CmsData, ExecutiveScreenId } from '../types/cms';
import { extractYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '../utils/mediaHelpers';
import { ResilientImage } from './ResilientImage';

interface ExecutiveDashboardViewProps {
  data: CmsData;
  isFullscreen?: boolean;
  forcedScreen?: ExecutiveScreenId;
  controlledAutoRotate?: boolean;
  onStartFullscreen?: () => void;
}

const EXEC_SCREENS: { id: ExecutiveScreenId; label: string; shortTitle: string }[] = [
  { id: 'kpis', label: 'المؤشرات التنفيذية الرئيسية', shortTitle: '01 · المؤشرات الرئيسية' },
  { id: 'operations', label: 'الأداء التشغيلي المجمع', shortTitle: '02 · الأداء التشغيلي' },
  { id: 'achievements', label: 'إنجازات الأعمال المعتمدة', shortTitle: '03 · إنجازات الأعمال' },
  { id: 'comparison', label: 'مقارنة الأداء الشهري والسنوي', shortTitle: '04 · المقارنة الشهرية والسنوية' },
];

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  data,
  isFullscreen = false,
  forcedScreen,
  controlledAutoRotate = false,
  onStartFullscreen,
}) => {
  const ext = data.externalPortalSettings;
  const rotateSeconds = Math.max(5, ext.autoRotateSeconds || 20);

  const [activeScreen, setActiveScreen] = useState<ExecutiveScreenId>(forcedScreen || 'kpis');
  const [autoRotate, setAutoRotate] = useState<boolean>(controlledAutoRotate);
  const [countdown, setCountdown] = useState<number>(rotateSeconds);
  const [hoveredPoint, setHoveredPoint] = useState<{ chartId: string; pointId: string } | null>(null);

  useEffect(() => {
    if (forcedScreen) {
      setActiveScreen(forcedScreen);
    }
  }, [forcedScreen]);

  useEffect(() => {
    setCountdown(rotateSeconds);
  }, [rotateSeconds, activeScreen]);

  useEffect(() => {
    if (!autoRotate || forcedScreen) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setActiveScreen((cur) => {
            const idx = EXEC_SCREENS.findIndex((s) => s.id === cur);
            return EXEC_SCREENS[(idx + 1) % EXEC_SCREENS.length].id;
          });
          return rotateSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoRotate, forcedScreen, rotateSeconds]);

  if (ext.showProjectNameOnly || !ext.showExecutiveKpis) {
    return (
      <section className="bg-[#F4F8FB] border-b border-slate-200 py-16">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <BarChart3 className="w-10 h-10 text-[#0284C7] mx-auto mb-3" />
            <h1 className="text-2xl font-display font-bold text-[#0A192F] mb-2">
              لوحة المؤشرات التنفيذية
            </h1>
            <p className="text-sm text-slate-600">
              تم تعطيل عرض المؤشرات التنفيذية على الواجهة الخارجية من إعدادات لوحة الإدارة.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const currentScreen = forcedScreen || activeScreen;
  const approvedMedia = data.media.filter((m) => m.approvalStatus !== 'draft');
  const pillarsList = Object.values(data.operations);
  const hasAnySampleKpis =
    data.kpis.some((k) => k.isSampleData) || data.charts.some((c) => c.isSampleData);

  return (
    <section
      id="executive-dashboard"
      className={`bg-[#F4F8FB] text-[#0A192F] border-b border-slate-200 ${
        isFullscreen ? 'py-6 lg:py-8 min-h-[calc(100vh-4rem)]' : 'py-12 lg:py-16'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Executive Header Bar */}
        <div className="bg-[#0A192F] text-white rounded-xl p-5 sm:p-7 mb-6 border border-[#1E3A5F]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#38BDF8] font-medium mb-1">
                العرض التنفيذي الذكي · بيانات مجمعة مصرح بنشرها فقط
              </div>
              <h1 className="text-xl sm:text-3xl font-display font-bold text-white text-balance">
                {data.hero.title}
              </h1>
            </div>

            {!forcedScreen && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAutoRotate((prev) => !prev);
                    setCountdown(rotateSeconds);
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    autoRotate
                      ? 'bg-[#00A8E8] text-[#0A192F]'
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/20'
                  }`}
                >
                  {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>
                    {autoRotate
                      ? `إيقاف التنقل التلقائي (${countdown} ث)`
                      : `تنقل تلقائي كل ${rotateSeconds} ث`}
                  </span>
                </button>

                {onStartFullscreen && !isFullscreen && (
                  <button
                    type="button"
                    onClick={onStartFullscreen}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium bg-white text-[#0A192F] hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span>شاشة العرض</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4-Screen Selector */}
          {!forcedScreen && (
            <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
              {EXEC_SCREENS.map((scr) => {
                const isActive = currentScreen === scr.id;
                return (
                  <button
                    key={scr.id}
                    type="button"
                    onClick={() => {
                      setActiveScreen(scr.id);
                      setCountdown(rotateSeconds);
                    }}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#0284C7] text-white'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {scr.shortTitle}
                  </button>
                );
              })}
            </div>
          )}

          {/* Auto-Rotate Progress Strip */}
          {autoRotate && !forcedScreen && (
            <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#38BDF8] transition-all duration-1000 ease-linear"
                style={{
                  width: `${Math.max(0, Math.min(100, ((rotateSeconds - countdown) / rotateSeconds) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Clear Disclosure when Structural Sample Indicators are Present */}
        {hasAnySampleKpis && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-700 flex flex-wrap items-center justify-between gap-2">
            <span>
              ملاحظة الموثوقية: المؤشرات الموسومة بـ «نموذج عرض هيكلي» هي أرقام مبدئية مجمعة وليست
              بياناً تعاقدياً رسمياً إلا بعد تحديثها واعتمادها من لوحة الإدارة.
            </span>
            <span className="text-xs text-slate-500">آخر نشر: {data.lastUpdated}</span>
          </div>
        )}

        {/* SCREEN 1: Main Executive KPIs */}
        {currentScreen === 'kpis' && (
          <div className="space-y-8 transition-opacity duration-300">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#0284C7] mb-1">
                  الشاشة التنفيذية 01
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0A192F]">
                  لوحة المؤشرات التنفيذية الرئيسية
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                مؤشرات إجمالية معتمدة · معزولة عن التفاصيل التشغيلية الفردية
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {data.kpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span>{kpi.category}</span>
                      <span
                        className={
                          kpi.isSampleData ? 'text-amber-700 font-medium' : 'text-[#0284C7] font-medium'
                        }
                      >
                        {kpi.isSampleData ? 'نموذج عرض هيكلي' : 'بيان رسمي معتمد'}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-4xl font-display font-bold text-[#0A192F] font-mono-num tabular-nums">
                        {kpi.value}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{kpi.unit}</span>
                    </div>

                    <div className="text-sm sm:text-base font-medium text-[#0A192F] leading-snug">
                      {kpi.label}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    {kpi.periodNote}
                  </div>
                </div>
              ))}
            </div>

            {/* Strategic Continuity Pillars Summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <h3 className="text-lg font-display font-bold text-[#0A192F] mb-5">
                مرتكزات الأداء التنفيذي للعقد
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {data.impact.pillars.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-[#F4F8FB] border border-slate-200">
                    <div className="text-xs font-mono-num font-bold text-[#0284C7] mb-1.5">
                      {p.number}
                    </div>
                    <div className="text-sm font-display font-bold text-[#0A192F] mb-1">
                      {p.title}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2: Operational Performance */}
        {currentScreen === 'operations' && (
          <div className="space-y-8 transition-opacity duration-300">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#0284C7] mb-1">
                  الشاشة التنفيذية 02
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0A192F]">
                  شاشة الأداء التشغيلي المجمع
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                مستخلصات تشغيلية مجمعة · دون بلاغات فردية أو إحداثيات مواقع
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pillarsList.map((pillar) => (
                <div
                  key={pillar.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span className="font-mono-num text-[#0284C7] font-semibold">
                        محور {pillar.chapterNumber}
                      </span>
                      <span>{pillar.subtitle}</span>
                    </div>
                    <h3 className="text-lg font-display font-bold text-[#0A192F] mb-2">
                      {pillar.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">
                      {pillar.leadDescription}
                    </p>
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      {pillar.procedures.slice(0, 3).map((proc) => (
                        <div key={proc.id} className="text-xs text-slate-700 flex items-start gap-2">
                          <Activity className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-0.5" />
                          <span>{proc.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Aggregated Department KPIs Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <h3 className="text-lg font-display font-bold text-[#0A192F] mb-4">
                ملخص مؤشرات الإدارات التشغيلية المعتمدة
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-3 px-3 font-medium">الإدارة</th>
                      <th className="py-3 px-3 font-medium">المؤشر المجمع</th>
                      <th className="py-3 px-3 font-medium">القيمة</th>
                      <th className="py-3 px-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {data.departments.slice(0, 6).map((dept) => {
                      const mainKpi = dept.departmentKpis[0];
                      return (
                        <tr key={dept.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-medium text-[#0A192F]">
                            {dept.name}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {mainKpi?.label || dept.kpiFocus}
                          </td>
                          <td className="py-3 px-3 font-mono-num tabular-nums font-bold text-[#0A192F]">
                            {mainKpi ? `${mainKpi.value} ${mainKpi.unit}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <span className={mainKpi?.isSampleData ? 'text-amber-700' : 'text-[#0284C7]'}>
                              {mainKpi?.isSampleData ? 'نموذج عرض هيكلي' : 'بيان معتمد'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3: Business Achievements */}
        {currentScreen === 'achievements' && (
          <div className="space-y-8 transition-opacity duration-300">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#0284C7] mb-1">
                  الشاشة التنفيذية 03
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0A192F]">
                  شاشة إنجازات الأعمال المعتمدة
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                منجزات ومسارات العقد والتوثيق الميداني المعتمد للنشر
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {data.scope.objectives.map((obj) => (
                <div
                  key={obj.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#0284C7] font-mono-num font-bold mb-2">
                      <Award className="w-4 h-4" />
                      <span>هدف ومنجز {obj.number}</span>
                    </div>
                    <h3 className="text-lg font-display font-bold text-[#0A192F] mb-2">
                      {obj.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{obj.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>المخرج المعتمد: {obj.deliverable}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Approved Public Media Highlights */}
            {approvedMedia.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                <h3 className="text-lg font-display font-bold text-[#0A192F] mb-5">
                  نماذج التوثيق الميداني المعتمدة
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {approvedMedia.slice(0, 6).map((item) => {
                    const ytId = item.type === 'youtube' ? extractYouTubeId(item.url) : null;
                    return (
                      <div
                        key={item.id}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-[#F8FAFC] flex flex-col"
                      >
                        <div className="aspect-[16/10] bg-[#0A192F] overflow-hidden">
                          {item.type === 'youtube' && ytId ? (
                            <iframe
                              src={getYouTubeEmbedUrl(ytId)}
                              title={item.title}
                              className="w-full h-full border-0"
                              allowFullScreen
                            />
                          ) : item.type === 'video' ? (
                            <video
                              src={item.url}
                              controls
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ResilientImage
                              src={item.thumbnailUrl || item.url || (ytId ? getYouTubeThumbnailUrl(ytId) : '')}
                              alt={item.title}
                              fallbackTitle={item.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="p-4">
                          <div className="text-xs text-slate-500 mb-1">
                            {item.category} · {item.dateLabel}
                          </div>
                          <h4 className="text-sm font-display font-bold text-[#0A192F] mb-1">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 4: Monthly & Yearly Performance Comparison */}
        {currentScreen === 'comparison' && (
          <div className="space-y-8 transition-opacity duration-300">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#0284C7] mb-1">
                  الشاشة التنفيذية 04
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0A192F]">
                  شاشة مقارنة الأداء الشهري والسنوي
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                قراءة مقارنة للفوارق الشهرية والسنوية مقابل المستهدف
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {data.charts.map((chart) => {
                const maxVal = Math.max(
                  10,
                  ...chart.points.flatMap((p) => [p.primaryValue, p.secondaryValue])
                );
                const chartHeight = 230;
                const chartWidth = 560;
                const padLeft = 40;
                const padRight = 24;
                const padTop = 20;
                const padBottom = 34;
                const innerW = chartWidth - padLeft - padRight;
                const innerH = chartHeight - padTop - padBottom;

                const getX = (idx: number) =>
                  chart.points.length <= 1
                    ? padLeft + innerW / 2
                    : padLeft + (idx / (chart.points.length - 1)) * innerW;
                const getY = (val: number) => padTop + innerH - (val / maxVal) * innerH;

                const primaryPath = chart.points
                  .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.primaryValue)}`)
                  .join(' ');
                const secondaryPath = chart.points
                  .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.secondaryValue)}`)
                  .join(' ');

                const latest = chart.points[chart.points.length - 1];
                const first = chart.points[0];
                const deltaPct =
                  latest && first && first.primaryValue > 0
                    ? (((latest.primaryValue - first.primaryValue) / first.primaryValue) * 100).toFixed(1)
                    : null;

                return (
                  <div
                    key={chart.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                        <span className="inline-flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-[#0284C7]" />
                          <span className={chart.isSampleData ? 'text-amber-700' : 'text-[#0284C7]'}>
                            {chart.isSampleData ? 'نموذج عرض هيكلي' : 'بيان رسمي معتمد'}
                          </span>
                          <span>· {chart.unit}</span>
                        </span>
                        {deltaPct !== null && (
                          <span className="font-mono-num tabular-nums font-semibold text-[#0A192F]">
                            التغير عبر الفترة: {Number(deltaPct) >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-display font-bold text-[#0A192F] mb-1">
                        {chart.title}
                      </h3>
                      <p className="text-xs text-slate-500 mb-4">{chart.subtitle}</p>

                      <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm bg-[#0A192F] inline-block" />
                          <span>{chart.primaryLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm bg-[#00A8E8] inline-block" />
                          <span>{chart.secondaryLabel}</span>
                        </div>
                      </div>

                      <div className="w-full overflow-x-auto" dir="ltr">
                        <svg
                          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                          className="w-full h-auto min-w-[360px]"
                          role="img"
                          aria-label={chart.title}
                        >
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const y = padTop + innerH - ratio * innerH;
                            return (
                              <g key={ratio}>
                                <line
                                  x1={padLeft}
                                  y1={y}
                                  x2={chartWidth - padRight}
                                  y2={y}
                                  stroke="#E2E8F0"
                                  strokeWidth="1"
                                />
                                <text
                                  x={padLeft - 6}
                                  y={y + 4}
                                  textAnchor="end"
                                  fontSize="10"
                                  fill="#64748B"
                                >
                                  {Math.round(ratio * maxVal)}
                                </text>
                              </g>
                            );
                          })}

                          {chart.type === 'bar' ? (
                            chart.points.map((pt, i) => {
                              const groupWidth = innerW / Math.max(1, chart.points.length);
                              const barW = Math.min(20, groupWidth * 0.34);
                              const cx = padLeft + i * groupWidth + groupWidth / 2;
                              const h1 = (pt.primaryValue / maxVal) * innerH;
                              const h2 = (pt.secondaryValue / maxVal) * innerH;
                              return (
                                <g
                                  key={pt.id}
                                  onMouseEnter={() => setHoveredPoint({ chartId: chart.id, pointId: pt.id })}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                >
                                  <rect
                                    x={cx - barW - 2}
                                    y={padTop + innerH - h1}
                                    width={barW}
                                    height={h1}
                                    rx="3"
                                    fill="#0A192F"
                                  />
                                  <rect
                                    x={cx + 2}
                                    y={padTop + innerH - h2}
                                    width={barW}
                                    height={h2}
                                    rx="3"
                                    fill="#00A8E8"
                                  />
                                  <text
                                    x={cx}
                                    y={chartHeight - 10}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#475569"
                                  >
                                    {pt.label}
                                  </text>
                                </g>
                              );
                            })
                          ) : (
                            <>
                              <path d={secondaryPath} fill="none" stroke="#00A8E8" strokeWidth="2.5" />
                              <path d={primaryPath} fill="none" stroke="#0A192F" strokeWidth="3" />
                              {chart.points.map((pt, i) => {
                                const cx = getX(i);
                                const cy1 = getY(pt.primaryValue);
                                const cy2 = getY(pt.secondaryValue);
                                const isHover =
                                  hoveredPoint?.chartId === chart.id && hoveredPoint?.pointId === pt.id;
                                return (
                                  <g
                                    key={pt.id}
                                    onMouseEnter={() =>
                                      setHoveredPoint({ chartId: chart.id, pointId: pt.id })
                                    }
                                    onMouseLeave={() => setHoveredPoint(null)}
                                  >
                                    <circle cx={cx} cy={cy2} r={isHover ? 5.5 : 4} fill="#00A8E8" />
                                    <circle cx={cx} cy={cy1} r={isHover ? 6 : 4.5} fill="#0A192F" />
                                    <text
                                      x={cx}
                                      y={chartHeight - 10}
                                      textAnchor="middle"
                                      fontSize="10"
                                      fill="#475569"
                                    >
                                      {pt.label}
                                    </text>
                                  </g>
                                );
                              })}
                            </>
                          )}
                        </svg>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex flex-wrap justify-between gap-2">
                      {hoveredPoint?.chartId === chart.id ? (
                        (() => {
                          const pt = chart.points.find((p) => p.id === hoveredPoint.pointId);
                          return pt ? (
                            <span className="font-mono-num tabular-nums">
                              {pt.label}: {chart.primaryLabel} ({pt.primaryValue}) · {chart.secondaryLabel} (
                              {pt.secondaryValue})
                            </span>
                          ) : null;
                        })()
                      ) : (
                        <span>مرر المؤشر على أي نقطة أو عمود لعرض القيمة الدقيقة.</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
