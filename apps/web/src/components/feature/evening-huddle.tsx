'use client';

import type { Task } from '@homebuddy/shared';
import { harmonyMood } from '@homebuddy/shared';
import { MoonStars } from '@phosphor-icons/react';

interface EveningHuddleProps {
  householdName: string;
  harmonyScore: number;
  tasks: Task[];
}

function isDueToday(iso: string): boolean {
  const due = new Date(iso);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function EveningHuddle({ householdName, harmonyScore, tasks }: EveningHuddleProps) {
  const open = tasks.filter((t) => t.status !== 'completed');
  const dueTodayCount = open.filter((t) => isDueToday(t.dueAt)).length;
  const mood = harmonyMood(harmonyScore).toLowerCase();

  const openLine =
    open.length === 0
      ? 'everything across the house is handled.'
      : `${open.length} chore${open.length === 1 ? '' : 's'} open across the house${
          dueTodayCount > 0 ? `, ${dueTodayCount} due today` : ''
        }.`;

  return (
    <section
      aria-label="Evening huddle"
      className="flex items-center gap-2.5 px-1 text-sm text-[var(--text-mute)]"
    >
      <MoonStars
        size={16}
        weight="duotone"
        aria-hidden
        className="shrink-0 text-[color:var(--color-mood-stable)]"
      />
      <p>
        <span className="font-medium text-[var(--foreground)]">{householdName}</span> feels {mood} tonight, {openLine}
      </p>
    </section>
  );
}
