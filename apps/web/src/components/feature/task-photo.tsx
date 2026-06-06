'use client';

import { useState } from 'react';

interface TaskPhotoProps {
  src: string;
  alt: string;
  className: string;
}

export function TaskPhoto({ src, alt, className }: TaskPhotoProps) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div
        role="img"
        aria-label={`${alt} (photo unavailable)`}
        className={`${className} flex items-center justify-center bg-[var(--surface-raised)] text-[10px] uppercase tracking-widest text-[var(--text-soft)]`}
      >
        Photo unavailable
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
