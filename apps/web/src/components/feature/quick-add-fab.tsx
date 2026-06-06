'use client';

import {
  Broom,
  CaretRight,
  Flag,
  Plus,
  Sparkle,
  Wrench,
  type Icon,
} from '@phosphor-icons/react';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/ui';
import { useHousehold } from '@/lib/household-context';
import { useCan } from '@/lib/use-can';
import { AddChoreForm } from './add-chore-form';
import { CaretakerChoreForm } from './caretaker-chore-form';
import { FlagMessForm } from './flag-mess-form';
import { RitualCreateForm } from './ritual-create-form';

interface QuickAddAction {
  id: string;
  label: string;
  blurb: string;
  icon: Icon;
  tone: string;
  render: (close: () => void) => ReactNode;
}

const CREATE_SEGMENTS = ['today', 'tasks', 'rituals'] as const;

function activeSegment(pathname: string): (typeof CREATE_SEGMENTS)[number] | null {
  return CREATE_SEGMENTS.find((segment) => pathname.includes(`/${segment}`)) ?? null;
}

export function QuickAddFab() {
  const pathname = usePathname() ?? '';
  const { householdId, refresh, createRitual } = useHousehold();
  const { isAdmin, isActive } = useCan();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const segment = activeSegment(pathname);

  const actions = useMemo<QuickAddAction[]>(() => {
    if (!segment || !isActive) return [];

    const close = () => {
      setOpen(false);
      setActiveId(null);
    };
    const afterCreate = () => {
      void refresh();
      close();
    };

    const addChore: QuickAddAction = {
      id: 'chore',
      label: 'Routine chore',
      blurb: 'Recurring work, assigned by Smart Rotation.',
      icon: Broom,
      tone: 'text-[color:var(--accent)] bg-[var(--accent-wash)]',
      render: () => <AddChoreForm householdId={householdId} onCreated={afterCreate} />,
    };

    const flagMess: QuickAddAction = {
      id: 'flag',
      label: 'Flag a mess',
      blurb: 'Snap a photo. We assign a heavy chore fairly.',
      icon: Flag,
      tone: 'text-[color:var(--color-mood-unstable)] bg-[color:var(--color-mood-unstable-wash,var(--surface-raised))]',
      render: () => <FlagMessForm householdId={householdId} onFlagged={() => { void refresh(); }} />,
    };

    const caretakerChore: QuickAddAction = {
      id: 'caretaker',
      label: 'Common-area chore',
      blurb: 'A caretaker-owned chore, out of rotation.',
      icon: Wrench,
      tone: 'text-[color:var(--text-mute)] bg-[var(--surface-raised)]',
      render: () => <CaretakerChoreForm householdId={householdId} onCreated={afterCreate} />,
    };

    const proposeRitual: QuickAddAction = {
      id: 'ritual',
      label: 'Propose a ritual',
      blurb: 'A shared meal, event, check-in, or challenge.',
      icon: Sparkle,
      tone: 'text-[color:var(--color-mood-harmonized)] bg-[color:var(--color-mood-harmonized-wash)]',
      render: () => <RitualCreateForm onCreate={createRitual} onCreated={close} />,
    };

    if (segment === 'rituals') return [proposeRitual];
    if (segment === 'today') return [addChore, flagMess];
    return isAdmin ? [addChore, flagMess, caretakerChore] : [addChore, flagMess];
  }, [segment, isActive, isAdmin, householdId, refresh, createRitual]);

  if (actions.length === 0) return null;

  const single = actions.length === 1;
  const selected: QuickAddAction | null = activeId
    ? actions.find((a) => a.id === activeId) ?? null
    : null;

  function handleOpen() {
    setActiveId(single ? actions[0]?.id ?? null : null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setActiveId(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Add to your home"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-cream shadow-[0_10px_30px_-6px_rgba(77,110,81,0.55)] transition-[transform,background-color] duration-200 [transition-timing-function:var(--ease-spring)] hover:bg-[var(--accent-hover)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--focus-ring)] lg:hidden"
      >
        <Plus size={26} weight="bold" aria-hidden />
      </button>

      <BottomSheet
        open={open}
        onClose={handleClose}
        onBack={selected && !single ? () => setActiveId(null) : undefined}
        title={selected ? selected.label : 'Add to your home'}
        description={selected ? selected.blurb : 'What would you like to add?'}
      >
        {selected ? (
          selected.render(handleClose)
        ) : (
          <ul className="flex flex-col gap-2 pb-2">
            {actions.map((action, index) => {
              const IconCmp = action.icon;
              return (
                <li
                  key={action.id}
                  className="motion-safe:animate-[hb-rise_260ms_both]"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(action.id)}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]"
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.tone}`}>
                      <IconCmp size={22} weight="duotone" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold tracking-tight">{action.label}</span>
                      <span className="text-xs text-[var(--text-mute)]">{action.blurb}</span>
                    </span>
                    <CaretRight size={18} weight="bold" aria-hidden className="shrink-0 text-[var(--text-soft)]" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
