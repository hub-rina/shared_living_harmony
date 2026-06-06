'use client';

import { ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CardCarousel, EmptyState, Skeleton } from '@/components/ui';
import { PeepChilling } from '@/components/illustration';
import { BloomSpark } from '@/components/feature/bloom-spark';
import { EnergyCoreStage } from '@/components/feature/energy-core-stage';
import { EveningHuddle } from '@/components/feature/evening-huddle';
import { GetStarted } from '@/components/feature/get-started';
import { HarmonyCard } from '@/components/feature/harmony-card';
import { HarmonySummary } from '@/components/feature/harmony-summary';
import { ParticipationNotice } from '@/components/feature/participation-notice';
import { TaskCard } from '@/components/feature/task-card';
import { useAuth } from '@/lib/use-auth';
import { useHousehold } from '@/lib/household-context';
import { useCan } from '@/lib/use-can';
import { TASK_BLOOM_EVENT, type TaskBloomOrigin } from '@/lib/task-bloom';

interface Spark {
  id: number;
  from: TaskBloomOrigin;
  to: TaskBloomOrigin;
}

const BLOOM_CELEBRATION_MS = 8000;

export default function TodayPage() {
  const { user } = useAuth();
  const {
    householdId,
    household,
    householdTasks,
    myTasks,
    loading,
    completeTask,
    removeTask,
    updateTask,
    snoozeTask,
    refresh,
    error,
  } = useHousehold();
  const can = useCan();
  const [bloomActive, setBloomActive] = useState(false);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const [pulseCount, setPulseCount] = useState(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const nextSparkId = useRef(0);

  useEffect(() => {
    function handleTaskBloom(event: Event) {
      const origin = (event as CustomEvent<TaskBloomOrigin>).detail;
      const orb = orbRef.current;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!orb || prefersReducedMotion) {
        setPulseCount((count) => count + 1);
        return;
      }
      const rect = orb.getBoundingClientRect();
      const to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const id = nextSparkId.current++;
      setSparks((current) => [...current, { id, from: origin, to }]);
    }
    window.addEventListener(TASK_BLOOM_EVENT, handleTaskBloom);
    return () => window.removeEventListener(TASK_BLOOM_EVENT, handleTaskBloom);
  }, []);

  function handleSparkDone(id: number) {
    setSparks((current) => current.filter((spark) => spark.id !== id));
    setPulseCount((count) => count + 1);
  }

  useEffect(() => {
    if (!household?.lastBloomedAt) return;
    const seenKey = `hb-bloom-seen:${household.id}`;
    const seen = typeof window !== 'undefined' ? localStorage.getItem(seenKey) : null;
    if (seen === household.lastBloomedAt) return;
    setBloomActive(true);
    if (typeof window !== 'undefined') localStorage.setItem(seenKey, household.lastBloomedAt);
    const t = setTimeout(() => setBloomActive(false), BLOOM_CELEBRATION_MS);
    return () => clearTimeout(t);
  }, [household?.lastBloomedAt, household?.id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-52" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const myActiveTasks = myTasks.filter((t) => t.status !== 'completed');
  const hasHeavyOverdue = householdTasks.some(
    (t) => t.weight === 'heavy' && t.status === 'overdue',
  );
  const overdueCount = householdTasks.filter((t) => t.status === 'overdue').length;
  const isNewHousehold = householdTasks.length === 0;
  const members =
    (household as (typeof household & { members?: { status?: string }[] }))?.members ?? [];
  const invitedCount = members.filter((m) => m.status === 'invited').length;

  const cardProps = {
    showComplete: true,
    showRemove: false,
    onComplete: completeTask,
    onRemove: removeTask,
    onUpdate: updateTask,
    onSnooze: snoozeTask,
  } as const;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Today</p>
        <h1 className="text-3xl font-bold tracking-tight">Hi {user?.name}.</h1>
        {household && (
          <p className="text-sm text-[var(--text-mute)]">The orb below is {household.name}&apos;s mood right now.</p>
        )}
      </header>

      {error && (
        <p className="text-sm text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      <ParticipationNotice householdId={householdId} invitedCount={invitedCount} />

      {household && (
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div ref={orbRef} className="flex flex-col gap-4">
            <EnergyCoreStage
              score={household.harmonyScore}
              hasHeavyOverdue={hasHeavyOverdue}
              bloomCount={bloomActive ? 1 : 0}
              pulseCount={pulseCount}
              overdueCount={overdueCount}
            />
            <HarmonySummary
              householdName={household.name}
              score={household.harmonyScore}
              overdueCount={overdueCount}
              hasHeavyOverdue={hasHeavyOverdue}
              bloomActive={bloomActive}
            />
          </div>
          <HarmonyCard score={household.harmonyScore} householdName={household.name} />
          {bloomActive && (
            <div
              role="status"
              aria-live="polite"
              className="lg:col-span-2 rounded-2xl border border-[color:var(--color-mood-harmonized)] bg-[color:var(--color-mood-harmonized-wash)] px-4 py-3 text-center text-sm font-medium text-[color:var(--mood-harmonized-fg)] transition-opacity"
            >
              The house bloomed. Everyone showed up. That rare, quiet good thing.
            </div>
          )}
        </section>
      )}

      {isNewHousehold && household ? (
        <GetStarted
          householdId={householdId}
          householdName={household.name}
          joinCode={household.joinCode}
          isAdmin={can.isAdmin}
          onRegenerated={() => { void refresh(); }}
        />
      ) : (
      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Your turn
          </h2>
          {myActiveTasks.length > 0 && (
            <Link
              href={`/h/${householdId}/tasks`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              See all chores
              <ArrowRight size={12} weight="bold" aria-hidden />
            </Link>
          )}
        </header>
        {myActiveTasks.length === 0 ? (
          <EmptyState
            art={<PeepChilling size={160} />}
            title="You are clear"
            description="Nothing assigned to you right now. Enjoy it."
          />
        ) : (
          <>
            <div className="lg:hidden">
              <CardCarousel label="Chores assigned to you">
                {myActiveTasks.map((task) => (
                  <div
                    key={task.id}
                    data-carousel-item
                    className="w-[86%] shrink-0 snap-start rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-5"
                  >
                    <TaskCard task={task} {...cardProps} />
                  </div>
                ))}
              </CardCarousel>
            </div>
            <div className="hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-5 sm:px-6 lg:block">
              {myActiveTasks.map((task) => (
                <TaskCard key={task.id} task={task} {...cardProps} />
              ))}
            </div>
          </>
        )}
      </section>
      )}

      {household && myActiveTasks.length > 0 && (
        <EveningHuddle
          householdName={household.name}
          harmonyScore={household.harmonyScore}
          tasks={householdTasks}
        />
      )}

      {sparks.map((spark) => (
        <BloomSpark key={spark.id} from={spark.from} to={spark.to} onDone={() => handleSparkDone(spark.id)} />
      ))}
    </div>
  );
}
