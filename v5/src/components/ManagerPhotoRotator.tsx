import React, { useEffect, useRef, useState } from 'react';
import { ResilientImage } from './ResilientImage';

interface ManagerPhotoRotatorProps {
  photos: string[];
  fullName: string;
  jobTitle: string;
}

const ROTATE_MS = 4500;

/**
 * Gentle auto-rotating portrait card (v5): fades between the manager's photos
 * inside the existing fixed-aspect card, so there is no layout shift. Pauses
 * while hovered or focused; the dots allow manual switching (touch friendly).
 */
export const ManagerPhotoRotator: React.FC<ManagerPhotoRotatorProps> = ({
  photos,
  fullName,
  jobTitle,
}) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused || photos.length < 2) return;
    timerRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % photos.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paused, photos.length]);

  const alt = `${fullName} — ${jobTitle}`;

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {photos.map((photo, i) => (
        <div
          key={photo}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={i === index ? undefined : true}
        >
          <ResilientImage
            src={photo}
            alt={alt}
            fallbackTitle={fullName}
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {photos.length > 1 && (
        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2 z-10">
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`عرض الصورة ${i + 1} من ${photos.length}`}
              aria-current={i === index}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 cursor-pointer shadow ${
                i === index ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
