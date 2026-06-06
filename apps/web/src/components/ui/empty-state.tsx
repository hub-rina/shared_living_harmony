import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  art?: ReactNode;
}

export function EmptyState({ title, description, action, art }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)]/60 px-5 py-8 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
      {art && (
        <div className="flex w-40 shrink-0 items-center justify-center sm:w-52">
          {art}
        </div>
      )}
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <p className="text-base font-semibold tracking-tight">{title}</p>
        {description && (
          <p className="max-w-prose text-sm text-[var(--text-mute)]">{description}</p>
        )}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-[var(--surface-raised)] ${className}`}
    />
  );
}
