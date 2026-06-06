'use client';

import { Card, SectionHeader, Skeleton } from '@/components/ui';
import { RitualsPanel } from '@/components/feature/rituals-panel';
import { RitualCreateForm } from '@/components/feature/ritual-create-form';
import { useAuth } from '@/lib/use-auth';
import { useHousehold } from '@/lib/household-context';

export default function RitualsPage() {
  const { user } = useAuth();
  const {
    householdId,
    household,
    householdRituals,
    loading,
    createRitual,
    joinRitual,
    completeRitual,
  } = useHousehold();

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Rituals</p>
        <h1 className="text-3xl font-bold tracking-tight">Build the home</h1>
        <p className="max-w-prose text-sm text-[var(--text-mute)]">
          Shared meals, events, check-ins, and challenges. Slow work that turns a household into a home.
        </p>
      </header>

      <p className="text-center text-sm text-[var(--text-mute)] lg:hidden">
        Tap the <span className="font-semibold text-[var(--foreground)]">+</span> button to propose a ritual.
      </p>

      <Card surface="wash" backdrop="taking-notes" backdropAnchor="right">
        <SectionHeader
          eyebrow="Propose"
          title={household?.name ?? 'Rituals'}
          description="When 60% of the house joins, the Energy Core blooms for everyone."
        />
        <div className="mb-6 hidden lg:block">
          <RitualCreateForm onCreate={createRitual} />
        </div>
        <RitualsPanel
          householdId={householdId}
          rituals={householdRituals}
          currentUserId={user?.id ?? ''}
          onJoin={joinRitual}
          onComplete={completeRitual}
        />
      </Card>
    </div>
  );
}
