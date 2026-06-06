'use client';

import { useState } from 'react';
import { Button } from './button';

interface InlineConfirmProps {
  label: string;
  confirmLabel: string;
  cancelLabel?: string;
  question: string;
  onConfirm: () => Promise<void> | void;
  busy?: boolean;
  size?: 'sm' | 'md';
  variant?: 'danger' | 'warning';
}

export function InlineConfirm({
  label,
  confirmLabel,
  cancelLabel = 'Cancel',
  question,
  onConfirm,
  busy,
  size = 'sm',
  variant = 'danger',
}: InlineConfirmProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleConfirm() {
    setRunning(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setRunning(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={() => setOpen(true)}
        disabled={busy}
        className="text-[var(--text-mute)] hover:text-[var(--color-state-danger)]"
      >
        {label}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={question}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-xs"
    >
      <span className="text-[var(--text-mute)]">{question}</span>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleConfirm}
        disabled={running}
      >
        {running ? 'Working…' : confirmLabel}
      </Button>
      <Button
        type="button"
        size={size}
        variant="ghost"
        onClick={() => setOpen(false)}
        disabled={running}
      >
        {cancelLabel}
      </Button>
    </div>
  );
}
