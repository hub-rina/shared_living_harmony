'use client';

import { Camera, Plus, Trash } from '@phosphor-icons/react';
import type { CreateExpenseInput } from '@homebuddy/shared';
import { useRef, useState } from 'react';
import { BottomSheet, Button, Field, TextInput, Tag } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { fileToResizedDataUrl } from '@/lib/photo';
import { useInFlight } from '@/lib/use-in-flight';

export type SplitMember = { userId: string; name: string; status: string };

type DraftItem = { label: string; amount: string };

function eurosToCents(value: string): number {
  const normalised = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(normalised)) return 0;
  return Math.round(normalised * 100);
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function NewBillSheet({
  householdId,
  members,
  currentUserId,
  open,
  onClose,
  onCreated,
}: {
  householdId: string;
  members: SplitMember[];
  currentUserId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<'capture' | 'edit'>('capture');
  const [scanning, setScanning] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [total, setTotal] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const { pending: saving, run } = useInFlight();

  function reset() {
    setPhase('capture');
    setTitle('');
    setNote('');
    setTotal('');
    setItems([]);
    setReceiptUrl(undefined);
    setError(null);
    setScanning(false);
  }

  function close() {
    reset();
    onClose();
  }

  function startEditing() {
    // Default the split to active members, always including the current user.
    const defaults = new Set(
      members.filter((m) => m.status === 'active').map((m) => m.userId),
    );
    defaults.add(currentUserId);
    setIncluded(defaults);
    setPhase('edit');
  }

  async function scanReceipt(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setScanning(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      const draft = await apiClient.expenses.scan(householdId, dataUrl);
      setReceiptUrl(draft.receiptUrl ?? undefined);
      if (draft.totalCents > 0) setTotal(centsToEuros(draft.totalCents));
      setItems(draft.items.map((item) => ({ label: item.label, amount: centsToEuros(item.amountCents) })));
      startEditing();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not read that photo. You can still enter it by hand.',
      );
      startEditing();
    } finally {
      setScanning(false);
    }
  }

  function toggleMember(userId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function save() {
    setError(null);
    const totalCents = eurosToCents(total);
    if (!title.trim()) return setError('Give the bill a name.');
    if (totalCents <= 0) return setError('Enter how much it cost.');
    const includedMemberIds = [...included];
    if (includedMemberIds.filter((id) => id !== currentUserId).length === 0) {
      return setError('Pick at least one other person to split with.');
    }

    await run(async () => {
      try {
        const input: CreateExpenseInput = {
          title: title.trim(),
          totalCents,
          includedMemberIds,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(receiptUrl ? { receiptUrl } : {}),
          items: items
            .filter((item) => item.label.trim() && eurosToCents(item.amount) > 0)
            .map((item) => ({ label: item.label.trim(), amountCents: eurosToCents(item.amount) })),
        };
        await apiClient.expenses.create(householdId, input);
        await onCreated();
        close();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save the bill.');
      }
    });
  }

  const sharerCount = [...included].length;
  const perPerson = sharerCount > 0 ? eurosToCents(total) / sharerCount : 0;

  return (
    <BottomSheet
      open={open}
      onClose={close}
      variant="adaptive"
      title={phase === 'capture' ? 'Add a shared bill' : 'Check the details'}
      description={
        phase === 'capture'
          ? 'Snap the receipt and we read it for you, or enter it by hand.'
          : 'Fix anything we got wrong, then choose who splits it.'
      }
      onBack={phase === 'edit' ? () => setPhase('capture') : undefined}
    >
      <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
        {error && (
          <p className="rounded-lg bg-[color:var(--color-mood-tense-wash)] px-3 py-2 text-sm text-[color:var(--mood-tense-fg)]" role="alert">
            {error}
          </p>
        )}

        {phase === 'capture' ? (
          <>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={scanReceipt}
            />
            <Button size="lg" fullWidth disabled={scanning} onClick={() => receiptInputRef.current?.click()}>
              <Camera size={20} weight="bold" aria-hidden />
              {scanning ? 'Reading the receipt…' : 'Scan a receipt'}
            </Button>
            <Button size="lg" variant="secondary" fullWidth disabled={scanning} onClick={startEditing}>
              Enter it manually
            </Button>
          </>
        ) : (
          <>
            <Field label="What was it?" required>
              {(id) => (
                <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Groceries" />
              )}
            </Field>

            <Field label="Total (€)" required>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="0.00"
                />
              )}
            </Field>

            <Field label="Note" hint="Optional.">
              {(id) => (
                <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Weekly shop" />
              )}
            </Field>

            {items.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[var(--text-mute)]">Line items (from the receipt — edit if wrong)</p>
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <TextInput
                      aria-label={`Item ${index + 1} name`}
                      value={item.label}
                      onChange={(e) => updateItem(index, { label: e.target.value })}
                      className="flex-1"
                    />
                    <TextInput
                      aria-label={`Item ${index + 1} price`}
                      inputMode="decimal"
                      value={item.amount}
                      onChange={(e) => updateItem(index, { amount: e.target.value })}
                      className="w-20"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remove item"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash size={16} weight="bold" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { label: '', amount: '' }])}
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-[var(--accent-hover)] hover:underline"
            >
              <Plus size={14} weight="bold" aria-hidden /> Add a line
            </button>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-[var(--text-mute)]">Split between</p>
              <ul className="flex flex-col gap-1.5">
                {members.map((member) => {
                  const checked = included.has(member.userId);
                  return (
                    <li key={member.userId}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(member.userId)}
                          className="size-4 accent-[var(--accent)]"
                        />
                        <span className="flex-1">
                          {member.name}
                          {member.userId === currentUserId && (
                            <span className="text-[var(--text-soft)]"> (you)</span>
                          )}
                        </span>
                        {member.status !== 'active' && (
                          <Tag tone={member.status === 'invited' ? 'reactive' : 'heavy'} size="sm">
                            {member.status === 'invited' ? 'Invited' : 'Away'}
                          </Tag>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {sharerCount > 1 && perPerson > 0 && (
                <p className="text-xs text-[var(--text-soft)]">
                  Splits to about €{(perPerson / 100).toFixed(2)} each across {sharerCount} people.
                </p>
              )}
            </div>

            <Button size="lg" fullWidth disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save bill'}
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
