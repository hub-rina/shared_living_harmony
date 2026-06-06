'use client';

import { useState } from 'react';
import { Card, EmptyState, SectionHeader, Skeleton } from '@/components/ui';
import { BroomAtRest, PaperPlane } from '@/components/illustration';
import { AddChoreForm } from '@/components/feature/add-chore-form';
import { CaretakerChoreForm } from '@/components/feature/caretaker-chore-form';
import { FlagMessForm } from '@/components/feature/flag-mess-form';
import { TaskCard } from '@/components/feature/task-card';
import { useAuth } from '@/lib/use-auth';
import { useHousehold } from '@/lib/household-context';
import { useCan } from '@/lib/use-can';
import { choresVsRituals } from '@/lib/copy';

type Filter = 'open' | 'done';

export default function TasksPage() {
  const { user } = useAuth();
  const {
    householdId,
    household,
    householdTasks,
    loading,
    refresh,
    completeTask,
    removeTask,
    updateTask,
    snoozeTask,
  } = useHousehold();

  const can = useCan();
  const [filter, setFilter] = useState<Filter>('open');

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const open = householdTasks.filter((t) => t.status !== 'completed');
  const done = householdTasks.filter((t) => t.status === 'completed');
  const visible = filter === 'open' ? open : done;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Chores</p>
        <h1 className="text-3xl font-bold tracking-tight">{household?.name ?? 'Chores'}</h1>
        <p className="max-w-prose text-sm text-[var(--text-mute)]">{choresVsRituals}</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Household chores
          </h2>
          <div role="tablist" aria-label="Filter chores" className="inline-flex gap-1 rounded-full bg-[var(--surface-raised)] p-1">
            {(['open', 'done'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-full px-3 text-xs font-semibold tracking-tight transition-colors ${
                  filter === f
                    ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--text-mute)] hover:text-[var(--foreground)]'
                }`}
              >
                {f === 'open' ? `Open (${open.length})` : `Done (${done.length})`}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            art={filter === 'open' ? <BroomAtRest size={140} /> : <PaperPlane size={140} />}
            title={filter === 'open' ? 'All clear' : 'Nothing completed yet'}
            description={
              filter === 'open'
                ? 'No open chores right now. Add one to get the house moving.'
                : 'Completed chores will appear here once your house finishes some.'
            }
          />
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 sm:px-6">
            {visible.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showComplete={task.assigneeId === user?.id}
                showRemove={can.canDeleteTask(task)}
                onComplete={completeTask}
                onRemove={removeTask}
                onUpdate={updateTask}
                onSnooze={snoozeTask}
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-sm text-[var(--text-mute)] lg:hidden">
        Tap the <span className="font-semibold text-[var(--foreground)]">+</span> button to add a chore or flag a mess.
      </p>

      <div className="hidden flex-col gap-8 lg:flex">
        <Card surface="wash" backdrop="warning" backdropAnchor="right">
          <SectionHeader
            eyebrow="Flag"
            title="Something needs fixing?"
            description="Snap a photo. We auto-assign a heavy chore to the fairest person."
          />
          <FlagMessForm householdId={householdId} onFlagged={async () => { await refresh(); }} />
        </Card>

        <Card backdrop="to-do-list" backdropAnchor="right-bottom" backdropOpacity={0.16}>
          <SectionHeader
            eyebrow="Add"
            title="Add a routine chore"
            description="Recurring work. Smart Rotation assigns it to whoever is fairest this week."
          />
          <AddChoreForm householdId={householdId} onCreated={refresh} />
        </Card>

        {can.isAdmin && (
          <Card backdrop="to-do-list" backdropAnchor="right-bottom" backdropOpacity={0.16}>
            <SectionHeader
              eyebrow="Caretaker"
              title="Common-area chore"
              description="A shared-space chore your caretaker owns. It never enters the rotation."
            />
            <CaretakerChoreForm householdId={householdId} onCreated={refresh} />
          </Card>
        )}
      </div>
    </div>
  );
}
