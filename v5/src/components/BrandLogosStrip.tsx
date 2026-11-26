import React from 'react';
import { Building2, Droplets } from 'lucide-react';
import { ExternalPortalSettings } from '../types/cms';
import { ResilientImage } from './ResilientImage';

interface BrandLogosStripProps {
  settings: ExternalPortalSettings;
  variant?: 'dark' | 'light';
  compact?: boolean;
}

export const BrandLogosStrip: React.FC<BrandLogosStripProps> = ({
  settings,
  variant = 'dark',
  compact = false,
}) => {
  if (!settings.showLogos) return null;

  const boxClass =
    variant === 'dark'
      ? 'bg-white/95 border border-white/20 text-[#0A192F]'
      : 'bg-white border border-slate-200 text-[#0A192F]';

  const labelSubClass = variant === 'dark' ? 'text-slate-600' : 'text-slate-500';

  return (
    <div
      className={`flex flex-wrap items-center justify-center sm:justify-start gap-4 ${
        compact ? 'py-1' : 'py-2'
      }`}
    >
      {/* شركة المياه الوطنية NWC */}
      <div
        className={`flex items-center gap-3 rounded-xl px-4 ${
          compact ? 'py-2' : 'py-3'
        } ${boxClass}`}
      >
        {settings.nwcLogoUrl ? (
          <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center overflow-hidden rounded-lg bg-white shrink-0">
            <ResilientImage
              src={settings.nwcLogoUrl}
              alt="شعار شركة المياه الوطنية NWC"
              fallbackTitle="NWC"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[#0A192F] text-[#38BDF8] flex flex-col items-center justify-center shrink-0">
            <Droplets className="w-5 h-5" />
            <span className="text-[10px] font-mono-num font-bold tracking-wider mt-0.5">NWC</span>
          </div>
        )}
        <div className="text-right">
          <div className="text-xs sm:text-sm font-display font-bold text-[#0A192F]">
            شركة المياه الوطنية
          </div>
          <div className={`text-[11px] ${labelSubClass}`}>
            {settings.nwcLogoUrl ? 'National Water Company · NWC' : 'شعار NWC (قابل للرفع من الإدارة)'}
          </div>
        </div>
      </div>

      {/* شركة الخريف لتقنية المياه والطاقة */}
      <div
        className={`flex items-center gap-3 rounded-xl px-4 ${
          compact ? 'py-2' : 'py-3'
        } ${boxClass}`}
      >
        {settings.alkhorayefLogoUrl ? (
          <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center overflow-hidden rounded-lg bg-white shrink-0">
            <ResilientImage
              src={settings.alkhorayefLogoUrl}
              alt="شعار شركة الخريف"
              fallbackTitle="Alkhorayef"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[#0284C7] text-white flex flex-col items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
            <span className="text-[9px] font-mono-num font-bold mt-0.5">AWPT</span>
          </div>
        )}
        <div className="text-right">
          <div className="text-xs sm:text-sm font-display font-bold text-[#0A192F]">
            شركة الخريف لتقنية المياه والطاقة
          </div>
          <div className={`text-[11px] ${labelSubClass}`}>
            {settings.alkhorayefLogoUrl
              ? 'Alkhorayef Water & Power Technologies'
              : 'شعار شركة الخريف (قابل للرفع من الإدارة)'}
          </div>
        </div>
      </div>
    </div>
  );
};
