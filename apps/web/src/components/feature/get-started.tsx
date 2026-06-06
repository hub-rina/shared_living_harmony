'use client';

import Link from 'next/link';
import { CheckSquare, Camera } from '@phosphor-icons/react';
import { Card, SectionHeader } from '@/components/ui';
import { InviteRoommates } from './invite-roommates';

interface GetStartedProps {
  householdId: string;
  householdName: string;
  joinCode: string;
  isAdmin: boolean;
  onRegenerated: () => void;
}

export function GetStarted({
  householdId,
  householdName,
  joinCode,
  isAdmin,
  onRegenerated,
}: GetStartedProps) {
  return (
    <Card>
      <div className="flex flex-col gap-6">
        <SectionHeader
          eyebrow="Get started"
          title={`Welcome to ${householdName}`}
          description="The orb above is your home's Harmony. It brightens as everyone pitches in. Two quick steps to set things up."
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-[var(--accent)]">1.</span>
            <h3 className="text-sm font-semibold tracking-tight">Invite your roommates</h3>
          </div>
          <InviteRoommates
            householdId={householdId}
            joinCode={joinCode}
            isAdmin={isAdmin}
            onRegenerated={onRegenerated}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-[var(--accent)]">2.</span>
            <h3 className="text-sm font-semibold tracking-tight">Add the first chore</h3>
          </div>
          <p className="text-sm text-[var(--text-mute)]">
            Add a recurring chore and Smart Rotation shares it fairly. Or snap a photo of a mess and it becomes a task on its own.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/h/${householdId}/tasks`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-cream transition-colors hover:bg-[var(--accent-hover)]"
            >
              <CheckSquare size={16} weight="bold" aria-hidden />
              Add a chore
            </Link>
            <Link
              href={`/h/${householdId}/tasks`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-deep)]"
            >
              <Camera size={16} weight="bold" aria-hidden />
              Flag a mess
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
