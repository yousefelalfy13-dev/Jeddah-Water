import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type NavGroupId = 'overview' | 'scope-org' | 'operations' | 'achievements' | 'media-impact';

interface TopNavProps {
  activeGroup: NavGroupId;
  onNavigateGroup: (group: NavGroupId) => void;
}

const NAV_ITEMS: { id: NavGroupId; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'scope-org', label: 'النطاق والهيكل' },
  { id: 'operations', label: 'العمليات التخصصية' },
  { id: 'achievements', label: 'الإنجازات والمؤشرات' },
  { id: 'media-impact', label: 'المعرض والأثر' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeGroup,
  onNavigateGroup,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelect = (id: NavGroupId) => {
    onNavigateGroup(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            handleSelect('overview');
          }}
          className="text-base sm:text-lg font-display font-bold tracking-tight text-[#0B1F3A] whitespace-nowrap shrink-0"
        >
          العقد الموحد · مياه جدة
        </a>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => {
            const isActive = activeGroup === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'text-[#0B1F3A]'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-0 bottom-0 h-0.5 bg-[#0D9488] transition-transform duration-150 origin-center ${
                    isActive ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Public Action + Mobile Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#0B1F3A] hover:bg-[#14345E] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            طباعة الملف التعريفي
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-[#0B1F3A] hover:bg-slate-50 cursor-pointer"
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = activeGroup === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 text-[#0B1F3A]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#0B1F3A]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100 sm:hidden">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                window.print();
              }}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
            >
              طباعة الملف التعريفي
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
