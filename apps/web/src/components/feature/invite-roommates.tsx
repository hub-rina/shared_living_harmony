'use client';

import { Copy } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { formatJoinCode } from '@homebuddy/shared';
import { Button, InlineConfirm } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';

interface InviteRoommatesProps {
  householdId: string;
  joinCode: string;
  isAdmin: boolean;
  onRegenerated: () => void;
}

export function InviteRoommates({ householdId, joinCode, isAdmin, onRegenerated }: InviteRoommatesProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/join/${joinCode}` : `/join/${joinCode}`;

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  async function copyLink() {
    setError(null);
    try {
      await navigator.clipboard.writeText(link);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      setCopied(true);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Long-press the code to copy it.');
    }
  }

  async function regenerate() {
    setError(null);
    try {
      await apiClient.households.regenerateCode(householdId);
      onRegenerated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not make a new code.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--text-mute)]">Share this with your housemates.</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2 text-lg font-bold tracking-[0.12em]">
          {formatJoinCode(joinCode)}
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={copyLink}>
          <Copy size={14} weight="bold" aria-hidden />
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        {isAdmin && (
          <InlineConfirm
            label="New code"
            confirmLabel="Make a new code"
            question="Make a new code? The old link will stop working."
            onConfirm={regenerate}
          />
        )}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
      {error && <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{error}</p>}
    </div>
  );
}
