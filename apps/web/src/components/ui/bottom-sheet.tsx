'use client';

import { CaretLeft, X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onBack?: () => void;
  /**
   * 'sheet' (default) stays a bottom sheet and is hidden on desktop — the FAB
   * that drives it is mobile-only. 'adaptive' keeps the sheet on mobile but
   * centers it as a modal on desktop, so it works at every breakpoint.
   */
  variant?: 'sheet' | 'adaptive';
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, description, onBack, variant = 'sheet', children }: BottomSheetProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const adaptive = variant === 'adaptive';
  const containerCls = adaptive
    ? 'fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-6'
    : 'fixed inset-0 z-50 flex flex-col justify-end lg:hidden';
  const panelCls = adaptive
    ? 'relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)] pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-16px_48px_-12px_rgba(20,16,12,0.35)] outline-none motion-safe:animate-[hb-sheet-up_280ms_cubic-bezier(0.16,1,0.3,1)] lg:max-w-md lg:rounded-3xl lg:border lg:pb-4 lg:shadow-[0_24px_64px_-16px_rgba(20,16,12,0.4)] lg:motion-safe:animate-[hb-rise_220ms_both]'
    : 'relative flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)] pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-16px_48px_-12px_rgba(20,16,12,0.35)] outline-none motion-safe:animate-[hb-sheet-up_280ms_cubic-bezier(0.16,1,0.3,1)]';

  return createPortal(
    <div className={containerCls} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--scrim,rgba(20,16,12,0.45))] backdrop-blur-sm motion-safe:animate-[hb-fade-in_180ms_ease-out]"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={panelCls}
      >
        <div className={`mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-[var(--border-strong)] ${adaptive ? 'lg:hidden' : ''}`} aria-hidden />
        <header className="flex items-start gap-3 px-5 pb-3 pt-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="-ml-1 mt-0.5 shrink-0 rounded-full p-1.5 text-[var(--text-mute)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]"
            >
              <CaretLeft size={20} weight="bold" aria-hidden />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">{title}</h2>
            {description && (
              <p id={descId} className="mt-0.5 text-sm text-[var(--text-mute)]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 mt-0.5 shrink-0 rounded-full p-1.5 text-[var(--text-mute)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]"
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
