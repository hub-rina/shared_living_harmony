import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type Surface = 'flat' | 'raised' | 'wash';

type BackdropScene =
  | 'relaxing-at-home'
  | 'checklist'
  | 'home-run'
  | 'eating-together'
  | 'house-searching'
  | 'profile-pic'
  | 'empty'
  | 'warning'
  | 'to-do-list'
  | 'notes'
  | 'smart-home'
  | 'taking-notes'
  | 'organize-photos'
  | 'houses'
  | 'friendship'
  | 'together';

type BackdropAnchor = 'right' | 'right-bottom' | 'top-right';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: Surface;
  padded?: boolean;
  backdrop?: BackdropScene;
  backdropAnchor?: BackdropAnchor;
  backdropOpacity?: number;
}

const SURFACES: Record<Surface, string> = {
  flat: 'border border-[var(--border)] bg-[var(--surface)]',
  raised: 'bg-[var(--surface-raised)]',
  wash: 'bg-[var(--accent-wash)]',
};

const ANCHORS: Record<BackdropAnchor, string> = {
  'right':        'top-1/2 -right-16 -translate-y-1/2 w-64 sm:w-80',
  'right-bottom': '-bottom-10 -right-12 w-60 sm:w-72',
  'top-right':    '-top-6 -right-10 w-48 sm:w-56',
};

const MASKS: Record<BackdropAnchor, string> = {
  'right':        'linear-gradient(to right, transparent 0%, transparent 30%, black 80%)',
  'right-bottom': 'linear-gradient(to bottom right, transparent 25%, black 85%)',
  'top-right':    'linear-gradient(to top right, transparent 25%, black 85%)',
};

export function Card({
  surface = 'flat',
  padded = true,
  backdrop,
  backdropAnchor = 'right',
  backdropOpacity = 0.12,
  className = '',
  children,
  ...rest
}: CardProps) {
  const imgStyle = {
    opacity: backdropOpacity,
    filter: 'saturate(0.85)',
    maskImage: MASKS[backdropAnchor],
    WebkitMaskImage: MASKS[backdropAnchor],
    maskMode: 'alpha',
  } as CSSProperties;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${SURFACES[surface]} ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      {...rest}
    >
      {backdrop && (
        <img
          aria-hidden
          src={`/illustrations/${backdrop}.svg`}
          alt=""
          className={`pointer-events-none absolute select-none ${ANCHORS[backdropAnchor]}`}
          style={imgStyle}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0 flex flex-col gap-1">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="max-w-prose text-sm text-[var(--text-mute)]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
