import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { CmsData } from '../types/cms';

interface AchievementsSectionProps {
  data: CmsData;
}

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({
  data,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    chartId: string;
    pointId: string;
  } | null>(null);

  return (
    <section
      id="achievements"
      className="bg-[#F8FAFC] border-b border-slate-200 py-16"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-medium text-[#0D9488] mb-2">
            10 · الإنجازات ومؤشرات الأداء والرسوم البيانية
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A] text-balance mb-2">
            لوحة المؤشرات التشغيلية والإنجازات المعتمدة
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            استعراض رقمي وبياني للمؤشرات المنشورة ومتابعة معدلات الأداء عبر الإدارات والفترات التشغيلية.
          </p>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {data.kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span>
                    {kpi.category}
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span className={kpi.isSampleData ? 'text-[#0284C7]' : 'text-[#0D9488]'}>
                      {kpi.isSampleData ? 'بيانات تجريبية' : 'بيان معتمد'}
                    </span>
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-display font-bold text-[#0B1F3A] font-mono-num tabular-nums">
                    {kpi.value}
                  </span>
                  <span className="text-xs text-slate-500">{kpi.unit}</span>
                </div>

                <div className="text-sm font-medium text-[#0B1F3A] leading-snug">
                  {kpi.label}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                {kpi.periodNote}
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {data.charts.map((chart) => {
            const maxVal = Math.max(
              10,
              ...chart.points.flatMap((p) => [p.primaryValue, p.secondaryValue])
            );
            const chartHeight = 220;
            const chartWidth = 540;
            const padLeft = 36;
            const padRight = 20;
            const padTop = 20;
            const padBottom = 34;
            const innerW = chartWidth - padLeft - padRight;
            const innerH = chartHeight - padTop - padBottom;

            const getX = (idx: number) => {
              if (chart.points.length <= 1) return padLeft + innerW / 2;
              return padLeft + (idx / (chart.points.length - 1)) * innerW;
            };
            const getY = (val: number) =>
              padTop + innerH - (val / maxVal) * innerH;

            const primaryPath = chart.points
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.primaryValue)}`)
              .join(' ');
            const secondaryPath = chart.points
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.secondaryValue)}`)
              .join(' ');

            return (
              <div
                key={chart.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="mb-2">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-[#0D9488]" />
                      <span>
                        {chart.isSampleData ? 'نموذج بياني تجريبي' : 'رسم بياني معتمد'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{chart.unit}</span>
                    </div>
                    <h3 className="text-lg font-display font-bold text-[#0B1F3A]">
                      {chart.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-500 mb-5">{chart.subtitle}</p>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-[#0B1F3A] inline-block" />
                      <span>{chart.primaryLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-[#0D9488] inline-block" />
                      <span>{chart.secondaryLabel}</span>
                    </div>
                  </div>

                  {/* Interactive SVG Chart */}
                  <div className="w-full overflow-x-auto" dir="ltr">
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="w-full h-auto min-w-[360px]"
                      role="img"
                      aria-label={chart.title}
                    >
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y = padTop + innerH - ratio * innerH;
                        const labelVal = Math.round(ratio * maxVal);
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
                              className="fill-slate-400 text-[10px] font-mono-num"
                            >
                              {labelVal}
                            </text>
                          </g>
                        );
                      })}

                      {chart.type === 'trend' ? (
                        <>
                          {chart.points.length > 1 && (
                            <>
                              <path
                                d={secondaryPath}
                                fill="none"
                                stroke="#0D9488"
                                strokeWidth="2.2"
                                strokeDasharray="5 4"
                              />
                              <path
                                d={primaryPath}
                                fill="none"
                                stroke="#0B1F3A"
                                strokeWidth="2.8"
                              />
                            </>
                          )}
                          {chart.points.map((pt, idx) => {
                            const cx = getX(idx);
                            const cy1 = getY(pt.primaryValue);
                            const cy2 = getY(pt.secondaryValue);
                            const isHovered =
                              hoveredPoint?.chartId === chart.id &&
                              hoveredPoint?.pointId === pt.id;
                            return (
                              <g
                                key={pt.id}
                                onMouseEnter={() =>
                                  setHoveredPoint({ chartId: chart.id, pointId: pt.id })
                                }
                                onMouseLeave={() => setHoveredPoint(null)}
                                className="cursor-pointer"
                              >
                                <circle
                                  cx={cx}
                                  cy={cy2}
                                  r={isHovered ? 5 : 3.5}
                                  fill="#0D9488"
                                />
                                <circle
                                  cx={cx}
                                  cy={cy1}
                                  r={isHovered ? 6 : 4.5}
                                  fill="#0B1F3A"
                                  stroke="#FFFFFF"
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={cx}
                                  y={chartHeight - 10}
                                  textAnchor="middle"
                                  className="fill-slate-600 text-[10px]"
                                >
                                  {pt.label}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          {chart.points.map((pt, idx) => {
                            const groupWidth = innerW / chart.points.length;
                            const barWidth = Math.min(20, groupWidth * 0.28);
                            const center = padLeft + idx * groupWidth + groupWidth / 2;
                            const h1 = (pt.primaryValue / maxVal) * innerH;
                            const h2 = (pt.secondaryValue / maxVal) * innerH;
                            const isHovered =
                              hoveredPoint?.chartId === chart.id &&
                              hoveredPoint?.pointId === pt.id;
                            return (
                              <g
                                key={pt.id}
                                onMouseEnter={() =>
                                  setHoveredPoint({ chartId: chart.id, pointId: pt.id })
                                }
                                onMouseLeave={() => setHoveredPoint(null)}
                                className="cursor-pointer"
                              >
                                <rect
                                  x={center - barWidth - 2}
                                  y={padTop + innerH - h1}
                                  width={barWidth}
                                  height={Math.max(2, h1)}
                                  rx="3"
                                  fill={isHovered ? '#1E3A8A' : '#0B1F3A'}
                                />
                                <rect
                                  x={center + 2}
                                  y={padTop + innerH - h2}
                                  width={barWidth}
                                  height={Math.max(2, h2)}
                                  rx="3"
                                  fill={isHovered ? '#14B8A6' : '#0D9488'}
                                />
                                <text
                                  x={center}
                                  y={chartHeight - 10}
                                  textAnchor="middle"
                                  className="fill-slate-600 text-[10px]"
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

                  {/* Interactive Hover Summary Strip */}
                  <div className="mt-3 min-h-[24px] text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-3">
                    {hoveredPoint?.chartId === chart.id ? (
                      (() => {
                        const pt = chart.points.find(
                          (p) => p.id === hoveredPoint.pointId
                        );
                        if (!pt) return null;
                        return (
                          <div className="flex items-center gap-4 font-medium text-[#0B1F3A]">
                            <span>{pt.label}:</span>
                            <span className="font-mono-num">
                              {chart.primaryLabel}: {pt.primaryValue}
                            </span>
                            <span className="font-mono-num text-[#0D9488]">
                              {chart.secondaryLabel}: {pt.secondaryValue}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <span>مرّر المؤشر فوق نقاط الرسم البياني لعرض التفاصيل الرقمية</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
