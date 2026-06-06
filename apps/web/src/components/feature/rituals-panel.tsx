'use client';

import type { Ritual } from '@homebuddy/shared';
import { RITUAL_CADENCE_LABELS, RITUAL_TYPE_LABELS } from '@homebuddy/shared';
import { Sparkle } from '@phosphor-icons/react';
import { memo, useState } from 'react';
import { Button, EmptyState, Tag } from '@/components/ui';
import { TableForTwo } from '@/components/illustration';
import { ApiError } from '@/lib/api';

function formatWhen(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface RitualsPanelProps {
  householdId?: string;
  rituals: Ritual[];
  currentUserId: string;
  onJoin: (ritualId: string) => Promise<void>;
  onComplete: (ritualId: string) => Promise<{ bloomTriggered: boolean }>;
}

function RitualsPanelImpl({
  rituals,
  currentUserId,
  onJoin,
  onComplete,
}: RitualsPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const proposed = rituals.filter((r) => r.status === 'proposed');

  async function withBusy(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ritual action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      {proposed.length === 0 ? (
        <EmptyState
          art={<TableForTwo size={140} />}
          title="No rituals yet"
          description="Propose a shared meal, an event, a mood check-in, or a challenge. Joined by enough housemates, it triggers a Bloom."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {proposed.map((ritual) => {
            const joined = ritual.participants.some((p) => p.id === currentUserId);
            const isProposer = ritual.proposerId === currentUserId;
            const busy = busyId === ritual.id;
            return (
              <li key={ritual.id} className="flex flex-col gap-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-semibold leading-snug">{ritual.title}</p>
                  <Tag tone="sage" size="sm">
                    <Sparkle size={11} weight="fill" aria-hidden className="mr-0.5" />
                    {RITUAL_TYPE_LABELS[ritual.type]}
                  </Tag>
                </div>
                <p className="text-xs text-[var(--text-mute)]">
                  {formatWhen(ritual.proposedAt)}
                  {ritual.cadence !== 'once' && (
                    <>
                      <span className="px-1.5 text-[var(--text-soft)]">·</span>
                      <span className="font-semibold text-[color:var(--accent)]">
                        {RITUAL_CADENCE_LABELS[ritual.cadence]}
                      </span>
                    </>
                  )}
                  <span className="px-1.5 text-[var(--text-soft)]">·</span>
                  {ritual.participants.length} joined
                  {ritual.participants.length > 0 && (
                    <span className="text-[var(--text-soft)]">
                      : {ritual.participants.map((p) => p.name).join(', ')}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={joined ? 'secondary' : 'primary'}
                    disabled={busy}
                    onClick={() => withBusy(ritual.id, () => onJoin(ritual.id))}
                  >
                    {joined ? 'Leave' : 'Join'}
                  </Button>
                  {isProposer && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => withBusy(ritual.id, () => onComplete(ritual.id))}
                    >
                      {busy ? 'Closing…' : 'Mark complete'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const RitualsPanel = memo(RitualsPanelImpl);
