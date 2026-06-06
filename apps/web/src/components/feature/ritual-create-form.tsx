'use client';

import type { CreateRitualInput, RitualCadence, RitualType } from '@homebuddy/shared';
import { RITUAL_CADENCE_LABELS, RITUAL_TYPE_LABELS } from '@homebuddy/shared';
import { Sparkle } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button, Field, Select, TextInput } from '@/components/ui';
import { ApiError } from '@/lib/api';

interface RitualCreateFormProps {
  onCreate: (input: CreateRitualInput) => Promise<void>;
  onCreated?: () => void;
}

export function RitualCreateForm({ onCreate, onCreated }: RitualCreateFormProps) {
  const [title, setTitle] = useState('Sunday Dinner');
  const [type, setType] = useState<RitualType>('meal');
  const [cadence, setCadence] = useState<RitualCadence>('once');
  const [proposedAt, setProposedAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !proposedAt) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        type,
        title: title.trim(),
        proposedAt: new Date(proposedAt).toISOString(),
        cadence,
      });
      setTitle('Sunday Dinner');
      setProposedAt('');
      setCadence('once');
      onCreated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not propose the ritual.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Propose a new ritual">
      <Field label="What are we doing?" required>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunday Dinner"
            required
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={type}
              onChange={(e) => setType(e.target.value as RitualType)}
            >
              {(Object.keys(RITUAL_TYPE_LABELS) as RitualType[]).map((t) => (
                <option key={t} value={t}>{RITUAL_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="When" required>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="datetime-local"
              value={proposedAt}
              onChange={(e) => setProposedAt(e.target.value)}
              required
            />
          )}
        </Field>
      </div>

      <Field label="Repeats">
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={cadence}
            onChange={(e) => setCadence(e.target.value as RitualCadence)}
          >
            {(Object.keys(RITUAL_CADENCE_LABELS) as RitualCadence[]).map((c) => (
              <option key={c} value={c}>{RITUAL_CADENCE_LABELS[c]}</option>
            ))}
          </Select>
        )}
      </Field>

      {error && (
        <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      <Button type="submit" disabled={submitting || !title.trim() || !proposedAt}>
        <Sparkle size={16} weight="bold" aria-hidden />
        {submitting ? 'Proposing…' : 'Propose ritual'}
      </Button>
      <p className="text-xs text-[var(--text-soft)]">
        When 60% of the house joins, the Energy Core blooms for everyone.
      </p>
    </form>
  );
}
