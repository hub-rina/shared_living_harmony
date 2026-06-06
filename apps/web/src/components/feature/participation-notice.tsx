'use client';

import { UsersThree } from '@phosphor-icons/react';
import Link from 'next/link';

interface ParticipationNoticeProps {
  householdId: string;
  invitedCount: number;
}

// Surfaces the participation gap described in §5.11: when members have been
// invited but have not yet activated (entered the join code), Smart Rotation
// can only distribute chores among the active members, so the active few would
// absorb everyone's load. The warning is persistent until the gap closes.
export function ParticipationNotice({ householdId, invitedCount }: ParticipationNoticeProps) {
  if (invitedCount < 1) return null;

  const peopleWord = invitedCount === 1 ? 'housemate hasn’t' : 'housemates haven’t';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-mood-unstable)] bg-[color:var(--color-mood-unstable-wash)] px-4 py-3 text-sm text-[color:var(--mood-unstable-fg)]"
    >
      <UsersThree size={20} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          {invitedCount} {peopleWord} joined yet
        </p>
        <p className="text-[color:var(--mood-unstable-fg)]/80">
          Chores only rotate between housemates who have joined. Until everyone is in, the
          active members carry the full load.{' '}
          <Link href={`/h/${householdId}/house`} className="font-semibold underline">
            Share the join code
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
