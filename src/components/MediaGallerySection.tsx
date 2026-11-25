import React, { useState } from 'react';
import { Play, X } from 'lucide-react';
import { CmsData, MediaItem } from '../types/cms';
import {
  extractYouTubeId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
} from '../utils/mediaHelpers';
import { ResilientImage } from './ResilientImage';

interface MediaGallerySectionProps {
  data: CmsData;
}

const CATEGORIES: MediaItem['category'][] = [
  'محطات المياه',
  'إصلاح الانكسارات',
  'أعمال الشبكات',
  'المختبرات والجودة',
  'السلامة المهنية',
  'أخرى',
];

export const MediaGallerySection: React.FC<MediaGallerySectionProps> = ({
  data,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);

  const filteredMedia = data.media.filter((item) => {
    const matchesType =
      typeFilter === 'all'
        ? true
        : typeFilter === 'image'
          ? item.type === 'image'
          : item.type === 'youtube' || item.type === 'video';

    const matchesCategory =
      categoryFilter === 'الكل' ? true : item.category === categoryFilter;

    return matchesType && matchesCategory;
  });

  return (
    <section id="media" className="bg-white border-b border-slate-200 py-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mb-8">
          <div className="text-xs font-medium text-[#0D9488] mb-2">
            11 · معرض الصور والفيديوهات التوثيقي
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A] text-balance mb-2">
            التوثيق المرئي لأعمال المحطات والشبكات والميدان
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            أرشيف منظم للصور الميدانية ومقاطع الفيديو التوثيقية من مواقع العمل المصنفة حسب التخصص التشغيلي.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
          <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white text-[#0B1F3A] shadow-sm'
                  : 'text-slate-600 hover:text-[#0B1F3A]'
              }`}
            >
              جميع الوسائط ({data.media.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('image')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                typeFilter === 'image'
                  ? 'bg-white text-[#0B1F3A] shadow-sm'
                  : 'text-slate-600 hover:text-[#0B1F3A]'
              }`}
            >
              الصور ({data.media.filter((m) => m.type === 'image').length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('video')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                typeFilter === 'video'
                  ? 'bg-white text-[#0B1F3A] shadow-sm'
                  : 'text-slate-600 hover:text-[#0B1F3A]'
              }`}
            >
              الفيديوهات ويوتيوب (
              {data.media.filter((m) => m.type !== 'image').length})
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['الكل', ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Media Grid */}
        {filteredMedia.length === 0 ? (
          <div className="text-center py-16 bg-[#F8FAFC] border border-slate-200 rounded-xl">
            <p className="text-sm text-slate-600 mb-3">
              لا توجد صور أو فيديوهات مطابقة للتصفية الحالية.
            </p>
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all');
                setCategoryFilter('الكل');
              }}
              className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
            >
              عرض كافة الوسائط
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMedia.map((item) => {
              const ytId =
                item.type === 'youtube' ? extractYouTubeId(item.url) : null;
              const thumbSrc =
                item.type === 'image'
                  ? item.url
                  : item.type === 'youtube' && ytId
                    ? item.thumbnailUrl || getYouTubeThumbnailUrl(ytId)
                    : item.thumbnailUrl;

              return (
                <article
                  key={item.id}
                  className="group bg-[#F8FAFC] border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div
                      className="relative aspect-[4/3] bg-[#0B1F3A] overflow-hidden cursor-pointer"
                      onClick={() => setLightboxItem(item)}
                    >
                      {item.type === 'video' && !thumbSrc ? (
                        <video
                          src={item.url}
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ResilientImage
                          src={thumbSrc}
                          alt={item.title}
                          fallbackTitle={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      )}

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

                      {item.type !== 'image' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="w-12 h-12 rounded-full bg-white/95 text-[#0B1F3A] flex items-center justify-center shadow-lg transition-transform duration-150 group-hover:scale-105">
                            <Play className="w-5 h-5 fill-current" />
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between text-xs text-white/95">
                        <span>
                          {item.type === 'youtube'
                            ? 'فيديو YouTube'
                            : item.type === 'video'
                              ? 'فيديو ميداني'
                              : 'صورة موثقة'}
                        </span>
                        <span>{item.category}</span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
                        <span>{item.location}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.dateLabel}</span>
                      </div>
                      <h3
                        onClick={() => setLightboxItem(item)}
                        className="text-base font-display font-bold text-[#0B1F3A] hover:text-[#0284C7] cursor-pointer mb-1.5"
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setLightboxItem(item)}
                      className="font-medium text-[#0284C7] hover:text-[#0B1F3A] cursor-pointer"
                    >
                      {item.type === 'image' ? 'معاينة بالحجم الكامل' : 'تشغيل الفيديو'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxItem.title}
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">
                  {lightboxItem.category} · {lightboxItem.location} ·{' '}
                  {lightboxItem.dateLabel}
                </div>
                <h3 className="text-base sm:text-lg font-display font-bold text-[#0B1F3A]">
                  {lightboxItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                aria-label="إغلاق المعاينة"
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#0B1F3A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0B1F3A] aspect-video w-full flex items-center justify-center">
              {lightboxItem.type === 'youtube' ? (
                (() => {
                  const ytId = extractYouTubeId(lightboxItem.url);
                  if (!ytId) {
                    return (
                      <div className="text-white text-sm p-6">
                        تعذر تحميل فيديو YouTube.
                      </div>
                    );
                  }
                  return (
                    <iframe
                      src={getYouTubeEmbedUrl(ytId)}
                      title={lightboxItem.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                })()
              ) : lightboxItem.type === 'video' ? (
                <video
                  src={lightboxItem.url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full max-h-[70vh]"
                />
              ) : (
                <ResilientImage
                  src={lightboxItem.url}
                  alt={lightboxItem.title}
                  fallbackTitle={lightboxItem.title}
                  className="w-full h-full object-contain max-h-[70vh]"
                />
              )}
            </div>

            <div className="p-5 text-sm text-slate-700 leading-relaxed">
              {lightboxItem.description}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
