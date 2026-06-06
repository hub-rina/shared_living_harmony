'use client';

import type { CreateCaretakerTaskInput, TaskWeight } from '@homebuddy/shared';
import { Wrench } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button, Field, Select, TextInput } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { useInFlight } from '@/lib/use-in-flight';

interface CaretakerChoreFormProps {
  householdId: string;
  onCreated: () => Promise<void> | void;
}

export function CaretakerChoreForm({ householdId, onCreated }: CaretakerChoreFormProps) {
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState<TaskWeight>('heavy');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { pending: submitting, run } = useInFlight();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    await run(async () => {
      setError(null);
      try {
        const input: CreateCaretakerTaskInput = {
          title: title.trim(),
          weight,
          dueAt: new Date(dueDate).toISOString(),
        };
        await apiClient.tasks.createCaretakerChore(householdId, input);
        setTitle('');
        setDueDate('');
        void onCreated();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not add the common-area chore.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Add a common-area chore">
      <Field label="What does the caretaker look after?" required>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mop the shared hallway"
            required
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Weight">
          {(id) => (
            <Select id={id} value={weight} onChange={(e) => setWeight(e.target.value as TaskWeight)}>
              <option value="light">Light</option>
              <option value="heavy">Heavy</option>
            </Select>
          )}
        </Field>
        <Field label="Due date" required>
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

      <Button type="submit" disabled={submitting || !title.trim() || !dueDate}>
        <Wrench size={16} weight="bold" aria-hidden />
        {submitting ? 'Adding…' : 'Add common-area chore'}
      </Button>
      <p className="text-xs text-[var(--text-soft)]">
        Stays out of everyone&apos;s rotation — your caretaker owns it. Needs a consented caretaker landlord linked.
      </p>
    </form>
  );
}
