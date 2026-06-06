'use client';

import type { CreateTaskInput, TaskCadence, TaskWeight } from '@homebuddy/shared';
import { TASK_CADENCE_LABELS } from '@homebuddy/shared';
import { Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button, Field, Select, TextInput } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { useInFlight } from '@/lib/use-in-flight';
import { SmartRotationInfo } from './smart-rotation-info';

const WEIGHTS: { value: TaskWeight; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Quick task. No photo needed.' },
  { value: 'heavy', label: 'Heavy', hint: 'Photo required to close.' },
];

const CADENCES: TaskCadence[] = ['once', 'weekly', 'monthly'];

interface AddChoreFormProps {
  householdId: string;
  onCreated: () => Promise<void> | void;
}

export function AddChoreForm({ householdId, onCreated }: AddChoreFormProps) {
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState<TaskWeight>('light');
  const [cadence, setCadence] = useState<TaskCadence>('once');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { pending: submitting, run } = useInFlight();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    await run(async () => {
      setError(null);
      try {
        const input: CreateTaskInput = {
          title: title.trim(),
          weight,
          cadence,
          dueAt: new Date(dueDate).toISOString(),
        };
        await apiClient.tasks.create(householdId, input);
        setTitle('');
        setDueDate('');
        setCadence('once');
        void onCreated();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not create the chore.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Add a routine chore">
      <Field label="What needs to be done?" required>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Take out the bins"
            required
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-[var(--text-mute)]">Weight</legend>
        <div className="flex flex-wrap gap-2">
          {WEIGHTS.map((w) => {
            const selected = weight === w.value;
            return (
              <label
                key={w.value}
                className={`flex min-h-11 flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  selected
                    ? 'border-[var(--accent)] bg-[var(--accent-wash)]'
                    : 'border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
                }`}
              >
                <input
                  type="radio"
                  name="chore-weight"
                  value={w.value}
                  checked={selected}
                  onChange={() => setWeight(w.value)}
                  className="sr-only"
                />
                <span className="font-semibold text-[var(--foreground)]">{w.label}</span>
                <span className="text-[var(--text-soft)]">{w.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repeats" hint="Recurring chores come back on their own.">
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={cadence}
              onChange={(e) => setCadence(e.target.value as TaskCadence)}
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {TASK_CADENCE_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={cadence === 'once' ? 'Due date' : 'First due date'} required>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          )}
        </Field>
      </div>

      {error && (
        <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      <Button
        type="submit"
        disabled={submitting || !title.trim() || !dueDate}
      >
        <Plus size={16} weight="bold" aria-hidden />
        {submitting ? 'Adding…' : 'Add chore'}
      </Button>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs text-[var(--text-soft)]">
          Smart Rotation picks the fairest person. A recurring chore goes to someone new each time.
        </p>
        <SmartRotationInfo variant="link" />
      </div>
    </form>
  );
}
