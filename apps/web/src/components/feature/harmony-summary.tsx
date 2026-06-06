import { harmonyMood } from '@homebuddy/shared';
import { memo } from 'react';
import { harmonyCause, harmonyHeading } from '@/lib/copy';

interface HarmonySummaryProps {
  householdName: string;
  score: number;
  overdueCount: number;
  hasHeavyOverdue: boolean;
  bloomActive: boolean;
}

export const HarmonySummary = memo(function HarmonySummary({
  householdName,
  score,
  overdueCount,
  hasHeavyOverdue,
  bloomActive,
}: HarmonySummaryProps) {
  const mood = harmonyMood(score);

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
        {harmonyHeading(householdName)}
      </p>
      <p className="max-w-[42ch] text-sm text-[var(--text-mute)]" aria-live="polite">
        {harmonyCause({ mood, overdueCount, hasHeavyOverdue, bloomActive })}
      </p>
    </div>
  );
});
