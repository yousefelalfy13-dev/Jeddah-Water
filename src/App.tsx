import { useEffect, useState } from 'react';
import { AchievementsSection } from './components/AchievementsSection';
import { AdminPortal } from './components/admin/AdminPortal';
import { BootstrapPortal } from './components/admin/BootstrapPortal';
import { ContractManagerView } from './components/ContractManagerView';
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView';
import { ImpactClosingSection } from './components/ImpactClosingSection';
import { MediaGallerySection } from './components/MediaGallerySection';
import { OperationsSection } from './components/OperationsSection';
import { ProjectShowcaseView } from './components/ProjectShowcaseView';
import { PublicTopBar } from './components/PublicTopBar';
import { ScopeAndOrgSection } from './components/ScopeAndOrgSection';
import { SeoHeadManager } from './components/SeoHeadManager';
import { ShowcaseModeView } from './components/ShowcaseModeView';
import { DEFAULT_CMS_DATA } from './data/defaultCmsData';
import { CmsData, PageId, PublicDisplayMode } from './types/cms';
import { hydrateCmsData } from './utils/cmsHydration';

function isBootstrapRoutePath(pathname: string): boolean {
  return pathname === '/admin/bootstrap' || pathname === '/admin/bootstrap/';
}

function isAdminRoutePath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function resolveModeFromPath(
  pathname: string,
  defaultMode: PublicDisplayMode
): PublicDisplayMode {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/project') return 'project';
  if (clean === '/contract-manager') return 'contract-manager';
  if (clean === '/executive') return 'executive';
  if (clean === '/showcase') return 'showcase';
  return defaultMode;
}

function routePathForMode(mode: PublicDisplayMode): string {
  switch (mode) {
    case 'project':
      return '/project';
    case 'contract-manager':
      return '/contract-manager';
    case 'executive':
      return '/executive';
    case 'showcase':
    default:
      return '/showcase';
  }
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [publicData, setPublicData] = useState<CmsData>(DEFAULT_CMS_DATA);
  const [loading, setLoading] = useState(true);
  const [isFullscreenDisplay, setIsFullscreenDisplay] = useState(false);
  const [activeDepartmentPageId, setActiveDepartmentPageId] = useState<string | null>(null);
  const [activeOperationTab, setActiveOperationTab] = useState<
    'stations' | 'maintenance' | 'networks' | 'quality' | 'hse'
  >('stations');

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenDisplay(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const loadPublicContent = async () => {
    try {
      const res = await fetch('/api/public/content');
      if (res.ok) {
        const json = hydrateCmsData(await res.json());
        setPublicData(json);
      }
    } catch {
      // Keep clean fallback on network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicContent();
  }, []);

  const ext = publicData.externalPortalSettings;
  const cm = publicData.contractManagerProfile;
  const managerPublished =
    !ext.showProjectNameOnly &&
    ext.showContractManagerAndVideo &&
    cm.isPublished &&
    cm.consentConfirmed &&
    Boolean(cm.fullName.trim());

  const activeMode = resolveModeFromPath(pathname, ext.defaultLandingMode || 'showcase');

  const navigateToMode = (mode: PublicDisplayMode) => {
    const targetPath = routePathForMode(mode);
    window.history.pushState({}, '', targetPath);
    setPathname(targetPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToPublic = () => {
    window.history.pushState({}, '', '/');
    setPathname('/');
    loadPublicContent();
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setPathname('/admin');
  };

  const enterFullscreenDisplay = () => {
    setIsFullscreenDisplay(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Fallback to CSS fixed fullscreen overlay when iframe blocks native Fullscreen API
      });
    }
  };

  const exitFullscreenDisplay = () => {
    setIsFullscreenDisplay(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {
        // Ignore exit errors
      });
    }
  };

  if (isBootstrapRoutePath(pathname)) {
    return (
      <>
        <SeoHeadManager pathname={pathname} activeMode={activeMode} data={publicData} />
        <BootstrapPortal
          onNavigateAdmin={navigateToAdmin}
          onNavigatePublic={navigateToPublic}
        />
      </>
    );
  }

  if (isAdminRoutePath(pathname)) {
    return (
      <>
        <SeoHeadManager pathname={pathname} activeMode={activeMode} data={publicData} />
        <AdminPortal
          onNavigatePublic={navigateToPublic}
          onPublishedUpdated={(published) => setPublicData(hydrateCmsData(published))}
        />
      </>
    );
  }

  const scrollToElement = (elementId: string) => {
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  const handleJumpToChapter = (pageId: PageId) => {
    if (
      pageId === 'stations' ||
      pageId === 'maintenance' ||
      pageId === 'networks' ||
      pageId === 'quality' ||
      pageId === 'hse'
    ) {
      setActiveOperationTab(pageId);
      scrollToElement('operations');
      return;
    }

    if (pageId === 'duties' && publicData.departments[0]) {
      setActiveDepartmentPageId(publicData.departments[0].id);
      scrollToElement('org');
      return;
    }

    scrollToElement(pageId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-6 text-white">
        <div className="text-center space-y-2">
          <div className="text-lg font-display font-bold">
            العقد الموحد لتشغيل وصيانة قطاع المياه بمدينة جدة
          </div>
          <p className="text-sm text-slate-300">جاري تحميل البوابة التنفيذية والتعريفية...</p>
        </div>
      </div>
    );
  }

  // Fullscreen Display Mode hides all site menus & chrome, showing enabled showcase only
  if (isFullscreenDisplay) {
    return (
      <>
        <SeoHeadManager pathname={pathname} activeMode={activeMode} data={publicData} />
        {activeMode === 'executive' && ext.showExecutiveKpis && !ext.showProjectNameOnly ? (
          <div className="fixed inset-0 z-50 bg-[#F4F8FB] overflow-y-auto">
            <div className="bg-[#0A192F] text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-white/10">
              <span className="text-sm font-display font-bold">
                شاشة العرض التنفيذية · {publicData.hero.title}
              </span>
              <button
                type="button"
                onClick={exitFullscreenDisplay}
                className="px-4 py-1.5 text-xs font-medium bg-white text-[#0A192F] rounded-lg cursor-pointer"
              >
                إيقاف العرض والعودة للموقع
              </button>
            </div>
            <ExecutiveDashboardView
              data={publicData}
              isFullscreen={true}
              controlledAutoRotate={true}
            />
          </div>
        ) : (
          <ShowcaseModeView
            data={publicData}
            isFullscreen={true}
            onEnterFullscreen={enterFullscreenDisplay}
            onExitFullscreen={exitFullscreenDisplay}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F8FB] text-[#0A192F]">
      <SeoHeadManager pathname={pathname} activeMode={activeMode} data={publicData} />

      <PublicTopBar
        activeMode={activeMode}
        settings={ext}
        managerPublished={managerPublished}
        onSelectMode={navigateToMode}
        onStartFullscreenDisplay={enterFullscreenDisplay}
      />

      <main className="flex-1">
        {/* Mode 1: /project */}
        {activeMode === 'project' && (
          <>
            <ProjectShowcaseView
              data={publicData}
              onNavigateMode={navigateToMode}
              onStartFullscreen={enterFullscreenDisplay}
            />
            {!ext.showProjectNameOnly && ext.showProjectDetailsAndVideo && (
              <>
                <ScopeAndOrgSection
                  data={publicData}
                  activeDepartmentPageId={activeDepartmentPageId}
                  onSelectDepartmentPage={setActiveDepartmentPageId}
                />
                <OperationsSection
                  data={publicData}
                  activeOperationTab={activeOperationTab}
                  onSelectOperationTab={setActiveOperationTab}
                  onJumpToChapter={handleJumpToChapter}
                />
              </>
            )}
          </>
        )}

        {/* Mode 2: /contract-manager */}
        {activeMode === 'contract-manager' && <ContractManagerView data={publicData} />}

        {/* Mode 3: /executive */}
        {activeMode === 'executive' && (
          <ExecutiveDashboardView
            data={publicData}
            onStartFullscreen={enterFullscreenDisplay}
          />
        )}

        {/* Mode 4: /showcase (and default /) */}
        {activeMode === 'showcase' && (
          <>
            {ext.enableShowcaseMode || ext.showProjectNameOnly ? (
              <ShowcaseModeView
                data={publicData}
                isFullscreen={false}
                onEnterFullscreen={enterFullscreenDisplay}
                onExitFullscreen={exitFullscreenDisplay}
              />
            ) : (
              <ProjectShowcaseView
                data={publicData}
                onNavigateMode={navigateToMode}
                onStartFullscreen={enterFullscreenDisplay}
              />
            )}

            {!ext.showProjectNameOnly && (
              <>
                {ext.showProjectDetailsAndVideo && (
                  <>
                    <ScopeAndOrgSection
                      data={publicData}
                      activeDepartmentPageId={activeDepartmentPageId}
                      onSelectDepartmentPage={setActiveDepartmentPageId}
                    />
                    <OperationsSection
                      data={publicData}
                      activeOperationTab={activeOperationTab}
                      onSelectOperationTab={setActiveOperationTab}
                      onJumpToChapter={handleJumpToChapter}
                    />
                  </>
                )}

                {ext.showExecutiveKpis && (
                  <>
                    <AchievementsSection data={publicData} />
                    <MediaGallerySection data={publicData} />
                  </>
                )}

                {ext.showProjectDetailsAndVideo && <ImpactClosingSection data={publicData} />}
              </>
            )}
          </>
        )}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="bg-[#0A192F] text-slate-300 border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8 no-print">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div>
            <span className="font-display font-bold text-white">{publicData.hero.title}</span>
            <span className="mx-2 text-slate-500">·</span>
            <span>واجهة عرض رسمية مجمعة ومصرح بنشرها</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/project"
              onClick={(e) => {
                e.preventDefault();
                navigateToMode('project');
              }}
              className="hover:text-white"
            >
              صفحة المشروع
            </a>
            <a
              href="/contract-manager"
              onClick={(e) => {
                e.preventDefault();
                navigateToMode('contract-manager');
              }}
              className="hover:text-white"
            >
              بيانات مدير العقد
            </a>
            <a
              href="/executive"
              onClick={(e) => {
                e.preventDefault();
                navigateToMode('executive');
              }}
              className="hover:text-white"
            >
              المؤشرات التنفيذية
            </a>
            <a
              href="/showcase"
              onClick={(e) => {
                e.preventDefault();
                navigateToMode('showcase');
              }}
              className="hover:text-white"
            >
              العرض الشامل
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigateToAdmin();
              }}
              className="text-[#38BDF8] hover:text-white"
            >
              بوابة الإدارة المحمية
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
