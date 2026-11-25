import React, { useState } from 'react';
import { Maximize2, Menu, X } from 'lucide-react';
import { ExternalPortalSettings, PublicDisplayMode } from '../types/cms';

interface PublicTopBarProps {
  activeMode: PublicDisplayMode;
  settings: ExternalPortalSettings;
  managerPublished: boolean;
  onSelectMode: (mode: PublicDisplayMode) => void;
  onStartFullscreenDisplay: () => void;
}

export const PublicTopBar: React.FC<PublicTopBarProps> = ({
  activeMode,
  settings,
  managerPublished,
  onSelectMode,
  onStartFullscreenDisplay,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navModes: { id: PublicDisplayMode; label: string; visible: boolean }[] = [
    {
      id: 'showcase',
      label: 'العرض الشامل',
      visible: !settings.showProjectNameOnly && settings.enableShowcaseMode,
    },
    {
      id: 'project',
      label: 'المشروع',
      visible: true,
    },
    {
      id: 'contract-manager',
      label: 'مدير العقد',
      visible:
        !settings.showProjectNameOnly &&
        settings.showContractManagerAndVideo &&
        managerPublished,
    },
    {
      id: 'executive',
      label: 'المؤشرات التنفيذية',
      visible: !settings.showProjectNameOnly && settings.showExecutiveKpis,
    },
  ];

  const visibleLinks = settings.allowVisitorModeSwitch
    ? navModes.filter((m) => m.visible)
    : navModes.filter((m) => m.id === activeMode);

  const handleNav = (mode: PublicDisplayMode) => {
    onSelectMode(mode);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0A192F]/95 backdrop-blur-md border-b border-white/10 text-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav(settings.defaultLandingMode);
          }}
          className="text-base sm:text-lg font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          العقد الموحد · مياه جدة
        </a>

        {/* Zone 2: Concise Single-Line Mode Links */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="أوضاع العرض الرسمية">
          {visibleLinks.map((item) => {
            const isActive = activeMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
                  isActive ? 'text-[#38BDF8]' : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-0 bottom-0 h-0.5 bg-[#00A8E8] transition-transform duration-150 origin-center ${
                    isActive ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Display Action + Mobile Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onStartFullscreenDisplay}
            className="hidden sm:inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#0A192F] bg-[#38BDF8] hover:bg-[#7DD3FC] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>تشغيل شاشة العرض</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 text-white hover:bg-white/10 cursor-pointer"
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0F2942] px-4 py-4 space-y-2">
          {visibleLinks.map((item) => {
            const isActive = activeMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-right px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0284C7] text-white'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-white/10 sm:hidden">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onStartFullscreenDisplay();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#0A192F] bg-[#38BDF8] rounded-lg cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>تشغيل شاشة العرض</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
