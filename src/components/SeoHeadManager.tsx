import React, { useEffect } from 'react';
import { CmsData, PublicDisplayMode } from '../types/cms';

interface SeoHeadManagerProps {
  pathname: string;
  activeMode: PublicDisplayMode;
  data: CmsData;
}

function upsertMetaTag(
  selector: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

export const SeoHeadManager: React.FC<SeoHeadManagerProps> = ({
  pathname,
  activeMode,
  data,
}) => {
  useEffect(() => {
    const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
    const origin = window.location.origin;
    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const canonicalUrl = `${origin}${cleanPath}`;

    const projectName = data.hero.title || 'العقد الموحد لتشغيل وصيانة قطاع المياه بمدينة جدة';
    const cm = data.contractManagerProfile;
    const ext = data.externalPortalSettings;
    const managerVisible =
      !ext.showProjectNameOnly &&
      ext.showContractManagerAndVideo &&
      cm.isPublished &&
      cm.consentConfirmed &&
      Boolean(cm.fullName.trim());

    let pageTitle = projectName;
    let pageDescription =
      data.hero.subtitle ||
      'المنصة الرسمية وشاشة العرض التنفيذية لمشروع العقد الموحد لتشغيل وصيانة قطاع المياه بمدينة جدة.';

    if (isAdmin) {
      pageTitle = `لوحة الإدارة المحمية · ${projectName}`;
      pageDescription = 'بوابة الإدارة الداخلية المحمية لمشروع العقد الموحد لقطاع المياه بمدينة جدة.';
    } else if (activeMode === 'contract-manager') {
      pageTitle = managerVisible
        ? `${cm.fullName} — ${cm.jobTitle} | ${projectName}`
        : `بيانات مدير العقد | ${projectName}`;
      pageDescription = managerVisible && cm.bio
        ? cm.bio.slice(0, 155)
        : `الصفحة التعريفية الرسمية بمدير العقد ومؤهلاته وخبراته المعتمدة في ${projectName}.`;
    } else if (activeMode === 'executive') {
      pageTitle = `لوحة المؤشرات التنفيذية | ${projectName}`;
      pageDescription =
        'لوحة المؤشرات التنفيذية الرئيسية والأداء التشغيلي ومقارنات الأداء الشهرية والسنوية المعتمدة.';
    } else if (activeMode === 'showcase') {
      pageTitle = `العرض التنفيذي الشامل | ${projectName}`;
      pageDescription =
        'واجهة العرض التنفيذية المتكاملة للمشروع وشعارات الشركاء وبيانات مدير العقد والمؤشرات المعتمدة.';
    } else if (activeMode === 'project') {
      pageTitle = `تعريف المشروع | ${projectName}`;
      pageDescription = data.hero.description?.slice(0, 155) || pageDescription;
    }

    document.title = pageTitle;
    upsertMetaTag('meta[name="description"]', 'name', 'description', pageDescription);
    upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', pageTitle);
    upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', pageDescription);
    upsertMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    upsertMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle);
    upsertMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', pageDescription);
    upsertMetaTag(
      'meta[name="robots"]',
      'name',
      'robots',
      isAdmin ? 'noindex, nofollow, noarchive' : 'index, follow'
    );
    upsertCanonical(canonicalUrl);

    // Structured Data (Schema.org JSON-LD) for Public Pages Only
    const existingLd = document.head.querySelector('#jw-structured-data');
    if (isAdmin) {
      if (existingLd) existingLd.remove();
      return;
    }

    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: projectName,
      url: origin,
      description: pageDescription,
      inLanguage: 'ar',
    };

    const personSchema =
      activeMode === 'contract-manager' && managerVisible
        ? {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            url: `${origin}/contract-manager`,
            mainEntity: {
              '@type': 'Person',
              name: cm.fullName,
              jobTitle: cm.jobTitle || 'مدير العقد',
              description: cm.bio || undefined,
              image: cm.photoUrl ? (cm.photoUrl.startsWith('http') ? cm.photoUrl : `${origin}${cm.photoUrl}`) : undefined,
              worksFor: {
                '@type': 'Organization',
                name: projectName,
              },
              hasCredential: cm.qualifications.map((q) => ({
                '@type': 'EducationalOccupationalCredential',
                name: q.title,
                credentialCategory: q.kind === 'academic' ? 'degree' : 'certification',
                recognizedBy: {
                  '@type': 'Organization',
                  name: q.issuer,
                },
              })),
            },
          }
        : null;

    let scriptEl = existingLd as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'jw-structured-data';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(personSchema || orgSchema);
  }, [pathname, activeMode, data]);

  return null;
};
