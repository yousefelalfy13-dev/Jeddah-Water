import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Download,
  ExternalLink,
  FileText,
  Film,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { CmsData, ContractManagerAttachment } from '../types/cms';
import { extractYouTubeId, getYouTubeEmbedUrl } from '../utils/mediaHelpers';
import { ResilientImage } from './ResilientImage';

interface ContractManagerViewProps {
  data: CmsData;
  isFullscreen?: boolean;
  onVideoPlayStateChange?: (playing: boolean) => void;
  onVideoEnded?: () => void;
}

export const ContractManagerView: React.FC<ContractManagerViewProps> = ({
  data,
  isFullscreen = false,
  onVideoPlayStateChange,
  onVideoEnded,
}) => {
  const { contractManagerProfile: cm, externalPortalSettings: ext, hero } = data;
  const [previewAttachment, setPreviewAttachment] =
    useState<ContractManagerAttachment | null>(null);

  const isPublicReady =
    !ext.showProjectNameOnly &&
    ext.showContractManagerAndVideo &&
    cm.isPublished &&
    cm.consentConfirmed &&
    Boolean(cm.fullName.trim());

  if (!isPublicReady) {
    return (
      <section className="bg-[#F4F8FB] border-b border-slate-200 py-16">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#0A192F] text-[#38BDF8] flex items-center justify-center">
              <UserCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-display font-bold text-[#0A192F] mb-3">
              بيانات مدير العقد
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
              {ext.showProjectNameOnly || !ext.showContractManagerAndVideo
                ? 'تم إخفاء قسم بيانات مدير العقد حالياً وفق إعدادات الواجهة الخارجية المعتمدة.'
                : 'بانتظار إدخال بيانات مدير العقد وتأكيد إقرار النشر والاعتماد الصريح من لوحة الإدارة قبل إتاحتها للزوار ومحركات البحث.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const ytVideoId = extractYouTubeId(cm.introVideoUrl);
  const academicQuals = cm.qualifications.filter((q) => q.kind === 'academic');
  const professionalCerts = cm.qualifications.filter((q) => q.kind === 'professional');
  const publicAttachments = cm.attachments.filter((a) => a.approvedForPublic);

  return (
    <section
      id="contract-manager"
      className={`bg-[#F4F8FB] border-b border-slate-200 ${
        isFullscreen ? 'py-8' : 'py-12 lg:py-16'
      }`}
    >
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Official Leadership Header Card */}
        <article className="bg-[#0A192F] text-white rounded-xl overflow-hidden border border-[#1E3A5F]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-10 items-stretch">
            {/* Portrait Column */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="relative w-full aspect-[3/4] max-h-[420px] rounded-xl overflow-hidden bg-[#0F2942] border border-white/15">
                {cm.photoUrl ? (
                  <ResilientImage
                    src={cm.photoUrl}
                    alt={`${cm.fullName} — ${cm.jobTitle}`}
                    fallbackTitle={cm.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 p-6 text-center">
                    <UserCheck className="w-12 h-12 text-[#38BDF8] mb-3" />
                    <span className="text-sm font-medium text-white">{cm.fullName}</span>
                    <span className="text-xs text-slate-400 mt-1">{cm.jobTitle}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio & Metadata Column */}
            <div className="lg:col-span-8 flex flex-col justify-between">
              <div>
                <div className="text-xs sm:text-sm text-[#38BDF8] font-medium mb-3 flex flex-wrap items-center gap-2">
                  <span>بيانات مدير العقد المعتمدة</span>
                  <span aria-hidden="true">·</span>
                  <span>{hero.title}</span>
                </div>

                <h1 className="text-[clamp(1.85rem,3.2vw,2.75rem)] font-display font-bold text-white leading-tight text-balance mb-2">
                  {cm.fullName}
                </h1>

                <p className="text-base sm:text-lg text-[#7DD3FC] font-medium mb-6">
                  {cm.jobTitle || 'مدير العقد'}
                </p>

                {cm.bio && (
                  <div className="text-sm sm:text-base text-slate-200 leading-relaxed space-y-3 max-w-3xl">
                    {cm.bio.split('\n').map((line, i) =>
                      line.trim() ? <p key={i}>{line}</p> : null
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#38BDF8]" />
                  <span>
                    ملف قيادي معتمد للنشر الرسمي
                    {cm.approvedAt ? ` · تاريخ الاعتماد: ${cm.approvedAt.slice(0, 10)}` : ''}
                  </span>
                </span>
                <span>
                  المؤهلات والاعتمادات: {cm.qualifications.length} · الدورات: {cm.trainings.length} ·
                  الخبرات: {cm.experiences.length}
                </span>
              </div>
            </div>
          </div>
        </article>

        {/* Intro Video Section */}
        {cm.introVideoUrl && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <div className="text-xs font-medium text-[#0284C7] mb-1 inline-flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>الكلمة والتعريف المرئي</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-[#0A192F]">
                  {cm.introVideoTitle || 'الفيديو التعريفي بمدير العقد'}
                </h2>
              </div>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#0A192F] border border-slate-200">
              {ytVideoId ? (
                <iframe
                  src={getYouTubeEmbedUrl(ytVideoId)}
                  title={cm.introVideoTitle || `الفيديو التعريفي — ${cm.fullName}`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={cm.introVideoUrl}
                  poster={cm.introVideoPosterUrl || cm.photoUrl || undefined}
                  controls
                  playsInline
                  onPlay={() => onVideoPlayStateChange?.(true)}
                  onPause={() => onVideoPlayStateChange?.(false)}
                  onEnded={() => {
                    onVideoPlayStateChange?.(false);
                    onVideoEnded?.();
                  }}
                  className="w-full h-full object-contain bg-black"
                />
              )}
            </div>
          </div>
        )}

        {/* Academic Qualifications & Professional Certifications */}
        {(academicQuals.length > 0 || professionalCerts.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {academicQuals.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                <div className="flex items-center gap-2.5 mb-5">
                  <GraduationCap className="w-5 h-5 text-[#0284C7]" />
                  <h2 className="text-xl font-display font-bold text-[#0A192F]">
                    المؤهلات العلمية
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {academicQuals.map((q) => (
                    <div key={q.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="text-xs text-slate-500 mb-1">
                        {q.issuer}
                        {q.year ? ` · ${q.year}` : ''}
                      </div>
                      <h3 className="text-base font-display font-bold text-[#0A192F]">
                        {q.title}
                      </h3>
                      {q.credentialNote && (
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                          {q.credentialNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {professionalCerts.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                <div className="flex items-center gap-2.5 mb-5">
                  <Award className="w-5 h-5 text-[#0284C7]" />
                  <h2 className="text-xl font-display font-bold text-[#0A192F]">
                    الشهادات والاعتمادات المهنية
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {professionalCerts.map((q) => (
                    <div key={q.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="text-xs text-slate-500 mb-1">
                        {q.issuer}
                        {q.year ? ` · ${q.year}` : ''}
                      </div>
                      <h3 className="text-base font-display font-bold text-[#0A192F]">
                        {q.title}
                      </h3>
                      {q.credentialNote && (
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                          {q.credentialNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Practical Experiences & Training Courses */}
        {(cm.experiences.length > 0 || cm.trainings.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {cm.experiences.length > 0 && (
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                <div className="flex items-center gap-2.5 mb-5">
                  <Briefcase className="w-5 h-5 text-[#0284C7]" />
                  <h2 className="text-xl font-display font-bold text-[#0A192F]">
                    الخبرات العملية والإنجازات القيادية
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {cm.experiences.map((exp) => (
                    <div key={exp.id} className="py-5 first:pt-0 last:pb-0">
                      <div className="text-xs text-slate-500 mb-1">
                        {exp.organization}
                        {exp.period ? ` · ${exp.period}` : ''}
                      </div>
                      <h3 className="text-base sm:text-lg font-display font-bold text-[#0A192F] mb-2">
                        {exp.roleTitle}
                      </h3>
                      {exp.summary && (
                        <p className="text-sm text-slate-700 leading-relaxed mb-3">
                          {exp.summary}
                        </p>
                      )}
                      {exp.highlights.length > 0 && (
                        <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                          {exp.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cm.trainings.length > 0 && (
              <div
                className={`${
                  cm.experiences.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
                } bg-white border border-slate-200 rounded-xl p-6 sm:p-8`}
              >
                <div className="flex items-center gap-2.5 mb-5">
                  <BookOpen className="w-5 h-5 text-[#0284C7]" />
                  <h2 className="text-xl font-display font-bold text-[#0A192F]">
                    الدورات التدريبية المتخصصة
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {cm.trainings.map((t) => (
                    <div key={t.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="text-xs text-slate-500 mb-1">
                        {t.provider}
                        {t.year ? ` · ${t.year}` : ''}
                        {t.durationNote ? ` · ${t.durationNote}` : ''}
                      </div>
                      <h3 className="text-sm sm:text-base font-display font-bold text-[#0A192F]">
                        {t.title}
                      </h3>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Approved CV & Certificate Attachments */}
        {publicAttachments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <div className="mb-6">
              <div className="text-xs font-medium text-[#0284C7] mb-1">
                الوثائق والملفات المعتمدة للنشر
              </div>
              <h2 className="text-xl font-display font-bold text-[#0A192F]">
                السيرة الذاتية وملفات الشهادات الرسمية
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicAttachments.map((att) => {
                const catLabel =
                  att.category === 'cv'
                    ? 'سيرة ذاتية معتمدة'
                    : att.category === 'certificate'
                      ? 'شهادة مهنية'
                      : 'وثيقة اعتماد';

                return (
                  <div
                    key={att.id}
                    className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-[#F8FAFC]"
                  >
                    <div>
                      <div className="text-xs text-slate-500 mb-2">
                        {catLabel} · ملف معتمد
                      </div>
                      <div className="flex items-start gap-3 mb-4">
                        <FileText className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-display font-bold text-[#0A192F]">
                            {att.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 break-all">
                            {att.fileName}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(att)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0A192F] hover:bg-[#0F2942] text-white rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>استعراض الملف</span>
                      </button>

                      {att.allowDownload && (
                        <a
                          href={att.fileUrl}
                          download={att.fileName || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-[#0A192F] rounded-lg whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5 text-[#0284C7]" />
                          <span>تحميل</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Inline PDF / Document Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 bg-[#0A192F]/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={previewAttachment.title}
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-display font-bold text-[#0A192F]">
                  {previewAttachment.title}
                </h3>
                <p className="text-xs text-slate-500">{previewAttachment.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                {previewAttachment.allowDownload && (
                  <a
                    href={previewAttachment.fileUrl}
                    download={previewAttachment.fileName || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0284C7] text-white rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  aria-label="إغلاق المعاينة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe
                src={previewAttachment.fileUrl}
                title={previewAttachment.title}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
