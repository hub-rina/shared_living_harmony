'use client';

import { Info, Scales } from '@phosphor-icons/react';
import { useState } from 'react';
import { BottomSheet } from '@/components/ui';
import { smartRotation } from '@/lib/copy';

interface SmartRotationInfoProps {
  /** 'icon' shows a bare info button; 'link' shows a labelled text trigger. */
  variant?: 'icon' | 'link';
  label?: string;
}

export function SmartRotationInfo({ variant = 'icon', label = 'How it works' }: SmartRotationInfoProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={smartRotation.title}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Info size={16} weight="bold" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-full text-xs font-semibold text-[var(--accent)] underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Info size={13} weight="bold" aria-hidden />
          {label}
        </button>
      )}

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        variant="adaptive"
        title={smartRotation.title}
        description={smartRotation.intro}
      >
        <div className="flex flex-col gap-4 pb-2">
          <ol className="flex flex-col gap-3">
            {smartRotation.points.map((point, index) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-wash)] text-xs font-bold text-[color:var(--accent)]">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-[var(--text-mute)]">{point}</span>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2 rounded-xl bg-[var(--surface-raised)] px-3 py-2.5 text-xs text-[var(--text-mute)]">
            <Scales size={16} weight="duotone" aria-hidden className="mt-0.5 shrink-0 text-[color:var(--accent)]" />
            <span>{smartRotation.outro}</span>
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
