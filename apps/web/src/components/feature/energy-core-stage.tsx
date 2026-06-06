'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui';
import type { MemberContribution } from '@/components/energy-core';

const EnergyCore = dynamic(
  () => import('@/components/energy-core').then((m) => m.EnergyCore),
  {
    ssr: false,
    loading: () => <Skeleton className="h-60 w-full max-w-xs rounded-full" />,
  },
);

interface EnergyCoreStageProps {
  score: number;
  hasHeavyOverdue: boolean;
  bloomCount: number;
  pulseCount?: number;
  overdueCount?: number;
  trend?: number;
  memberContributions?: MemberContribution[];
}

export function EnergyCoreStage({
  score,
  hasHeavyOverdue,
  bloomCount,
  pulseCount,
  overdueCount,
  trend,
  memberContributions,
}: EnergyCoreStageProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <EnergyCore
        score={score}
        hasHeavyOverdue={hasHeavyOverdue}
        bloomCount={bloomCount}
        pulseCount={pulseCount}
        overdueCount={overdueCount}
        trend={trend}
        memberContributions={memberContributions}
      />
    </div>
  );
}
