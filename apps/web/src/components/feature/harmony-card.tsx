import type { HarmonyMoodLabel } from '@homebuddy/shared';
import { harmonyMood } from '@homebuddy/shared';
import { memo } from 'react';

const BAR: Record<HarmonyMoodLabel, string> = {
  Tense:      'bg-[color:var(--color-mood-tense)]',
  Unstable:   'bg-[color:var(--color-mood-unstable)]',
  Calm:       'bg-[color:var(--color-mood-calm)]',
  Stable:     'bg-[color:var(--color-mood-stable)]',
  Harmonized: 'bg-[color:var(--color-mood-harmonized)]',
};

const TEXT: Record<HarmonyMoodLabel, string> = {
  Tense:      'text-[color:var(--mood-tense-fg)]',
  Unstable:   'text-[color:var(--mood-unstable-fg)]',
  Calm:       'text-[color:var(--mood-calm-fg)]',
  Stable:     'text-[color:var(--mood-stable-fg)]',
  Harmonized: 'text-[color:var(--mood-harmonized-fg)]',
};

interface HarmonyCardProps {
  score: number;
  householdName: string;
}

export const HarmonyCard = memo(function HarmonyCard({ score, householdName }: HarmonyCardProps) {
  const mood = harmonyMood(score);

  return (
    <section
      aria-label={`${householdName} harmony score`}
      className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-6"
    >
      <div className="flex items-baseline gap-3">
        <span className={`text-6xl font-bold tabular-nums leading-none ${TEXT[mood]}`}>
          {score}
        </span>
        <span className={`text-xl font-semibold ${TEXT[mood]}`}>{mood}</span>
        <span className="ml-auto text-xs text-[var(--text-soft)]">{householdName}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label={`Harmony ${score} of 100`}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${BAR[mood]}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
        <span>Tense 0</span>
        <span>Harmonized 100</span>
      </p>
    </section>
  );
});
