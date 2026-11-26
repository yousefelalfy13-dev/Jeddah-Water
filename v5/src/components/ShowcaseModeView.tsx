import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { CmsData, ExecutiveScreenId } from '../types/cms';
import { ContractManagerView } from './ContractManagerView';
import { ExecutiveDashboardView } from './ExecutiveDashboardView';
import { ProjectShowcaseView } from './ProjectShowcaseView';

interface ShowcaseModeViewProps {
  data: CmsData;
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
}

type ShowcaseStageId =
  | 'project-intro'
  | 'manager-profile'
  | 'exec-kpis'
  | 'exec-operations'
  | 'exec-achievements'
  | 'exec-comparison';

interface ShowcaseStage {
  id: ShowcaseStageId;
  label: string;
  isVideoSlide?: boolean;
  execScreen?: ExecutiveScreenId;
}

export const ShowcaseModeView: React.FC<ShowcaseModeViewProps> = ({
  data,
  isFullscreen,
  onEnterFullscreen,
  onExitFullscreen,
}) => {
  const ext = data.externalPortalSettings;
  const cm = data.contractManagerProfile;
  const rotateSeconds = Math.max(5, ext.autoRotateSeconds || 20);

  const stages = useMemo<ShowcaseStage[]>(() => {
    const list: ShowcaseStage[] = [
      {
        id: 'project-intro',
        label: 'تعريف المشروع والشركاء',
        isVideoSlide: Boolean(ext.projectIntroVideoUrl || data.hero.heroVideoUrl),
      },
    ];

    if (ext.showProjectNameOnly) {
      return list;
    }

    const managerVisible =
      ext.showContractManagerAndVideo &&
      cm.isPublished &&
      cm.consentConfirmed &&
      Boolean(cm.fullName.trim());

    if (managerVisible) {
      list.push({
        id: 'manager-profile',
        label: 'بيانات مدير العقد والفيديو التعريفي',
        isVideoSlide: Boolean(cm.introVideoUrl),
      });
    }

    if (ext.showExecutiveKpis) {
      list.push(
        { id: 'exec-kpis', label: 'المؤشرات التنفيذية الرئيسية', execScreen: 'kpis' },
        { id: 'exec-operations', label: 'الأداء التشغيلي المجمع', execScreen: 'operations' },
        { id: 'exec-achievements', label: 'إنجازات الأعمال', execScreen: 'achievements' },
        { id: 'exec-comparison', label: 'مقارنة الأداء الشهري والسنوي', execScreen: 'comparison' }
      );
    }

    return list;
  }, [ext, cm, data.hero.heroVideoUrl]);

  const [stageIdx, setStageIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [countdown, setCountdown] = useState(rotateSeconds);

  const safeIdx = stageIdx < stages.length ? stageIdx : 0;
  const currentStage = stages[safeIdx];

  useEffect(() => {
    setCountdown(rotateSeconds);
  }, [safeIdx, rotateSeconds]);

  useEffect(() => {
    if (!autoPlay || videoPlaying || stages.length <= 1) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStageIdx((idx) => (idx + 1) % stages.length);
          return rotateSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoPlay, videoPlaying, stages.length, rotateSeconds]);

  const goPrev = () => {
    setVideoPlaying(false);
    setStageIdx((idx) => (idx - 1 + stages.length) % stages.length);
  };

  const goNext = () => {
    setVideoPlaying(false);
    setStageIdx((idx) => (idx + 1) % stages.length);
  };

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#0A192F] overflow-y-auto flex flex-col'
          : 'bg-[#F4F8FB]'
      }`}
    >
      {/* Showcase Control Ribbon */}
      <div className="bg-[#0A192F] text-white border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3 shrink-0">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {stages.map((st, idx) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setVideoPlaying(false);
                  setStageIdx(idx);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  idx === safeIdx
                    ? 'bg-[#00A8E8] text-[#0A192F] font-bold'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
                }`}
              >
                {idx + 1}. {st.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  aria-label="الشاشة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAutoPlay((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>
                    {videoPlaying
                      ? 'متوقف مؤقتاً أثناء تشغيل الفيديو'
                      : autoPlay
                        ? `تبديل تلقائي (${countdown} ث)`
                        : 'استئناف العرض التلقائي'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  aria-label="الشاشة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            )}

            {isFullscreen ? (
              <button
                type="button"
                onClick={onExitFullscreen}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-white text-[#0A192F] hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>إيقاف العرض والعودة للموقع</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onEnterFullscreen}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#0A192F] rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>ملء الشاشة</span>
              </button>
            )}
          </div>
        </div>

        {/* Smooth Countdown Progress Line */}
        {autoPlay && !videoPlaying && stages.length > 1 && (
          <div className="max-w-[1400px] mx-auto mt-2.5 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#38BDF8] transition-all duration-1000 ease-linear"
              style={{
                width: `${Math.max(0, Math.min(100, ((rotateSeconds - countdown) / rotateSeconds) * 100))}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Active Stage Canvas */}
      <div className="flex-1">
        {currentStage?.id === 'project-intro' && (
          <ProjectShowcaseView
            data={data}
            isFullscreen={isFullscreen}
            onStartFullscreen={onEnterFullscreen}
            onVideoPlayStateChange={setVideoPlaying}
            onVideoEnded={() => {
              setVideoPlaying(false);
              if (autoPlay && stages.length > 1) {
                goNext();
              }
            }}
          />
        )}

        {currentStage?.id === 'manager-profile' && (
          <ContractManagerView
            data={data}
            isFullscreen={isFullscreen}
            onVideoPlayStateChange={setVideoPlaying}
            onVideoEnded={() => {
              setVideoPlaying(false);
              if (autoPlay && stages.length > 1) {
                goNext();
              }
            }}
          />
        )}

        {currentStage?.execScreen && (
          <ExecutiveDashboardView
            data={data}
            isFullscreen={isFullscreen}
            forcedScreen={currentStage.execScreen}
          />
        )}
      </div>
    </div>
  );
};
