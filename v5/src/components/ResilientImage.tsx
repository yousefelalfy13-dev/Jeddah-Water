import React, { useState } from 'react';
import { Droplets } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1F3A] via-[#12335B] to-[#0D5B66] text-white/90 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Droplets className="w-8 h-8 text-[#5EEAD4] mb-3 opacity-85" />
        <span className="text-sm font-medium text-white/90 max-w-xs leading-relaxed">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
