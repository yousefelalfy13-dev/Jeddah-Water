import React from 'react';
import { ArrowLeft, Film, Maximize2, ShieldCheck } from 'lucide-react';
import { CmsData, PublicDisplayMode } from '../types/cms';
import { extractYouTubeId, getYouTubeEmbedUrl } from '../utils/mediaHelpers';
import { BrandLogosStrip } from './BrandLogosStrip';
import { ResilientImage } from './ResilientImage';

interface ProjectShowcaseViewProps {
  data: CmsData;
  isFullscreen?: boolean;
  onNavigateMode?: (mode: PublicDisplayMode) => void;
  onStartFullscreen?: () => void;
  onVideoPlayStateChange?: (playing: boolean) => void;
  onVideoEnded?: () => void;
}

export const ProjectShowcaseView: React.FC<ProjectShowcaseViewProps> = ({
  data,
  isFullscreen = false,
  onNavigateMode,
  onStartFullscreen,
  onVideoPlayStateChange,
  onVideoEnded,
}) => {
  const { hero, overviewBrief, scope, externalPortalSettings: ext } = data;
  const projectVideoUrl = ext.projectIntroVideoUrl || hero.heroVideoUrl || '';
  const ytId = extractYouTubeId(projectVideoUrl);

  return (
    <section className="bg-[#0A192F] text-white border-b border-white/10">
      <div
        className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 ${
          isFullscreen ? 'py-8 lg:py-12' : 'py-12 lg:py-16'
        }`}
      >
        {/* Partner Logos (Alkhorayef + NWC) */}
        {ext.showLogos && (
          <div className="mb-8">
            <BrandLogosStrip settings={ext} variant="dark" />
          </div>
        )}

        {/* Minimal Name-Only Mode */}
        {ext.showProjectNameOnly ? (
          <div className="py-10 lg:py-16 text-center max-w-4xl mx-auto">
            <div className="text-xs sm:text-sm text-[#38BDF8] font-medium mb-3">
              {hero.locationLabel}
            </div>
            <h1 className="text-[clamp(2rem,4.5vw,3.5rem)] font-display font-bold text-white leading-tight text-balance mb-4">
              {hero.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              {hero.subtitle}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Project Editorial Summary */}
            <div className="lg:col-span-6 flex flex-col justify-between">
              <div>
                <div className="text-xs sm:text-sm text-[#38BDF8] font-medium mb-4 flex flex-wrap items-center gap-2">
                  <span>{hero.locationLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{hero.contractLabel}</span>
                </div>

                <h1 className="text-[clamp(2rem,3.6vw,3.1rem)] font-display font-bold leading-[1.2] text-white text-balance mb-5">
                  {hero.title}
                </h1>

                <p className="text-base sm:text-lg text-slate-100 leading-relaxed mb-4 max-w-2xl">
                  {hero.subtitle}
                </p>

                {ext.showProjectDetailsAndVideo && (
                  <>
                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mb-5">
                      {hero.description}
                    </p>
                    {overviewBrief.paragraphs.length > 0 && (
                      <div className="space-y-3 text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-5">
                        {overviewBrief.paragraphs.slice(0, 2).map((p, idx) => (
                          <p key={idx}>{p}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isFullscreen && (
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
                  {onStartFullscreen && (
                    <button
                      type="button"
                      onClick={onStartFullscreen}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#00A8E8] hover:bg-[#38BDF8] text-[#0A192F] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>تشغيل شاشة العرض</span>
                    </button>
                  )}

                  {ext.showExecutiveKpis && onNavigateMode && (
                    <button
                      type="button"
                      onClick={() => onNavigateMode('executive')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>عرض المؤشرات التنفيذية</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Project Intro Video / Hero Visual */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="relative flex-1 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] rounded-xl overflow-hidden border border-white/15 bg-[#0F2942]">
                {ext.showProjectDetailsAndVideo && ytId ? (
                  <iframe
                    src={getYouTubeEmbedUrl(ytId)}
                    title={ext.projectIntroVideoTitle || hero.title}
                    className="w-full h-full min-h-[320px] lg:h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : ext.showProjectDetailsAndVideo && projectVideoUrl ? (
                  <video
                    src={projectVideoUrl}
                    poster={ext.projectIntroVideoPosterUrl || hero.heroImageUrl}
                    controls
                    playsInline
                    onPlay={() => onVideoPlayStateChange?.(true)}
                    onPause={() => onVideoPlayStateChange?.(false)}
                    onEnded={() => {
                      onVideoPlayStateChange?.(false);
                      onVideoEnded?.();
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ResilientImage
                    src={ext.projectIntroVideoPosterUrl || hero.heroImageUrl}
                    alt={hero.title}
                    fallbackTitle={hero.title}
                    className="w-full h-full object-cover"
                  />
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0A192F]/90 via-[#0A192F]/45 to-transparent" />
                <div className="pointer-events-none absolute bottom-4 right-5 left-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>
                      {projectVideoUrl && ext.showProjectDetailsAndVideo
                        ? ext.projectIntroVideoTitle || 'الفيديو التعريفي بالمشروع'
                        : 'الفيديو التعريفي بالمشروع (قابل للإضافة من لوحة الإدارة)'}
                    </span>
                  </span>
                  <span>آخر اعتماد: {data.lastUpdated}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scope Highlights Strip (when project details enabled) */}
        {!ext.showProjectNameOnly &&
          ext.showProjectDetailsAndVideo &&
          scope.detailedTracks.length > 0 && (
            <div className="mt-10 pt-8 border-t border-white/10">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-base sm:text-lg font-display font-bold text-white">
                  نطاق أعمال المشروع الموحد
                </h2>
                <span className="text-xs text-slate-300 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>بيانات تعريفية معتمدة</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {scope.detailedTracks.map((track) => (
                  <div
                    key={track.id}
                    className="bg-[#0F2942] border border-white/10 rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-xs font-mono-num text-[#38BDF8] mb-2">
                        {track.number}
                      </div>
                      <h3 className="text-sm sm:text-base font-display font-bold text-white mb-2">
                        {track.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {track.scopeBoundary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </section>
  );
};
