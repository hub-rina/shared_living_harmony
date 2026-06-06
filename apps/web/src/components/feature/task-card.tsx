'use client';

import type { Task, TaskWeight, UpdateTaskInput } from '@homebuddy/shared';
import { requiresPhotoEvidence, TASK_CADENCE_LABELS } from '@homebuddy/shared';
import {
  ArrowsClockwise,
  Camera,
  CheckCircle,
  Clock,
  Lightning,
  PencilSimple,
  Sparkle,
  WarningCircle,
  Wrench,
} from '@phosphor-icons/react';
import { memo, useRef, useState } from 'react';
import { Button, Field, InlineConfirm, Select, Tag, TextInput } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { dueLabel, taskStatusCopy } from '@/lib/copy';
import { elementCenter, emitTaskBloom } from '@/lib/task-bloom';
import { SmartRotationInfo } from './smart-rotation-info';
import { fileToResizedDataUrl } from '@/lib/photo';
import { TaskPhoto } from './task-photo';

const WEIGHT_LABELS: Record<TaskWeight, string> = {
  light: 'Light',
  heavy: 'Heavy',
};

function formatDue(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface TaskCardProps {
  task: Task;
  showComplete: boolean;
  showRemove?: boolean;
  onComplete: (id: string, photoDataUrl?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onSnooze?: (id: string) => Promise<void>;
  onUpdate?: (id: string, input: UpdateTaskInput) => Promise<void>;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function TaskCardImpl({
  task,
  showComplete,
  showRemove = true,
  onComplete,
  onRemove,
  onSnooze,
  onUpdate,
}: TaskCardProps) {
  const [completing, setCompleting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editWeight, setEditWeight] = useState<TaskWeight>(task.weight);
  const [editDueAt, setEditDueAt] = useState(toLocalInput(task.dueAt));
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  const needsPhoto = requiresPhotoEvidence(task.weight);
  const isDone = task.status === 'completed';
  const isCaretaker = task.caretakerOwned;

  async function handleQuickComplete() {
    setCompleting(true);
    setPhotoError(null);
    const origin = cardRef.current ? elementCenter(cardRef.current) : null;
    try {
      await onComplete(task.id);
      if (origin) emitTaskBloom(origin);
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Could not mark as done.');
    } finally {
      setCompleting(false);
    }
  }

  function openPhotoPicker() {
    setPhotoError(null);
    photoInputRef.current?.click();
  }

  async function handleSnooze() {
    if (!onSnooze) return;
    setSnoozing(true);
    setPhotoError(null);
    try {
      await onSnooze(task.id);
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Could not snooze.');
    } finally {
      setSnoozing(false);
    }
  }

  function openEditor() {
    setEditTitle(task.title);
    setEditWeight(task.weight);
    setEditDueAt(toLocalInput(task.dueAt));
    setEditError(null);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!onUpdate) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const patch: UpdateTaskInput = {};
      if (editTitle.trim() && editTitle.trim() !== task.title) patch.title = editTitle.trim();
      if (editWeight !== task.weight) patch.weight = editWeight;
      const newIso = new Date(editDueAt).toISOString();
      if (newIso !== task.dueAt) patch.dueAt = newIso;
      if (Object.keys(patch).length === 0) {
        setEditing(false);
        return;
      }
      await onUpdate(task.id, patch);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handlePhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCompleting(true);
    setPhotoError(null);
    const origin = cardRef.current ? elementCenter(cardRef.current) : null;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      await onComplete(task.id, dataUrl);
      if (origin) emitTaskBloom(origin);
    } catch (err) {
      setPhotoError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Could not attach the photo.',
      );
    } finally {
      setCompleting(false);
    }
  }

  return (
    <article ref={cardRef} className="flex flex-col gap-3 border-b border-[var(--border)] py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <p className={`text-base font-semibold leading-snug ${isDone ? 'text-[var(--text-soft)] line-through' : ''}`}>
            {task.title}
          </p>
          <p className="text-xs text-[var(--text-mute)]">
            <span className="text-[var(--foreground)]">{isCaretaker ? 'Your caretaker' : task.assignee.name}</span>
            <span className="px-1.5 text-[var(--text-soft)]">·</span>
            <span className={task.status === 'overdue' ? 'font-semibold text-[color:var(--color-state-overdue)]' : ''}>
              {dueLabel(formatDue(task.dueAt), task.status === 'overdue')}
            </span>
            {task.kind === 'reactive' && task.flaggedBy && (
              <>
                <span className="px-1.5 text-[var(--text-soft)]">·</span>
                <span>flagged by {task.flaggedBy.name}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isCaretaker && (
            <Tag tone="sage" size="sm">
              <Wrench size={11} weight="fill" aria-hidden className="mr-0.5" />
              Caretaker
            </Tag>
          )}
          {task.kind === 'reactive' && (
            <Tag tone="reactive" size="sm">
              <Lightning size={11} weight="fill" aria-hidden className="mr-0.5" />
              Reactive
            </Tag>
          )}
          <Tag tone={task.weight} size="sm">{WEIGHT_LABELS[task.weight]}</Tag>
          {task.cadence !== 'once' && (
            <Tag tone="sage" size="sm">
              <ArrowsClockwise size={11} weight="bold" aria-hidden className="mr-0.5" />
              {TASK_CADENCE_LABELS[task.cadence]}
            </Tag>
          )}
          {isDone && (
            <Tag tone="completed" size="sm">
              <CheckCircle size={11} weight="fill" aria-hidden className="mr-0.5" />
              {taskStatusCopy.done}
            </Tag>
          )}
          {task.status === 'overdue' && (
            <Tag tone="overdue" size="sm">
              <WarningCircle size={11} weight="fill" aria-hidden className="mr-0.5" />
              {taskStatusCopy.needsHand}
            </Tag>
          )}
        </div>
      </div>

      {!isDone && task.rotationReason && (
        <p className="flex items-start gap-2 text-xs italic text-[color:var(--mood-stable-fg)]">
          <Sparkle
            size={14}
            weight="fill"
            aria-hidden
            className="mt-[2px] shrink-0 text-[color:var(--color-mood-stable)]"
          />
          <span>
            <span className="not-italic mr-1 inline-flex items-center gap-1 align-middle text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--mood-stable-fg)]/80">
              Smart Rotation
              <SmartRotationInfo variant="icon" />
            </span>
            {task.rotationReason}
          </span>
        </p>
      )}

      {isDone && task.completedBy && (
        <p className="text-xs text-[var(--text-soft)]">Completed by {task.completedBy.name}.</p>
      )}

      {task.beforePhotoUrl && task.proofPhotoUrl ? (
        <div className="grid grid-cols-2 gap-2">
          <figure>
            <TaskPhoto src={task.beforePhotoUrl} alt={`Mess flagged for ${task.title}`} className="h-40 w-full rounded-md object-cover" />
            <figcaption className="mt-1 text-[10px] uppercase tracking-widest text-[var(--text-soft)]">Before</figcaption>
          </figure>
          <figure>
            <TaskPhoto src={task.proofPhotoUrl} alt={`Proof of completion for ${task.title}`} className="h-40 w-full rounded-md object-cover" />
            <figcaption className="mt-1 text-[10px] uppercase tracking-widest text-[var(--text-soft)]">After</figcaption>
          </figure>
        </div>
      ) : (
        <>
          {task.beforePhotoUrl && (
            <TaskPhoto src={task.beforePhotoUrl} alt={`Mess flagged for ${task.title}`} className="h-56 w-full rounded-md object-cover" />
          )}
          {task.proofPhotoUrl && (
            <TaskPhoto src={task.proofPhotoUrl} alt={`Proof of completion for ${task.title}`} className="h-56 w-full rounded-md object-cover" />
          )}
        </>
      )}

      {isCaretaker && !isDone && (
        <p className="text-xs italic text-[var(--text-soft)]">
          A common-area chore your caretaker looks after. It stays out of your rotation.
        </p>
      )}

      {needsPhoto && !isCaretaker && !isDone && (
        <p className="text-xs italic text-[var(--text-soft)]">
          Heavy chore. Snap a photo of the finished result to close it.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {showComplete && !isDone && (
            needsPhoto ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={openPhotoPicker}
                  disabled={completing}
                >
                  <Camera size={14} weight="bold" aria-hidden />
                  {completing ? 'Uploading photo…' : 'Add photo and finish'}
                </Button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChosen}
                  className="hidden"
                  aria-hidden
                />
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleQuickComplete}
                disabled={completing}
              >
                <CheckCircle size={14} weight="bold" aria-hidden />
                {completing ? 'Saving…' : 'Mark as done'}
              </Button>
            )
          )}
          {onSnooze && !isCaretaker && !isDone && task.status === 'overdue' && !task.snoozeUsed && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSnooze}
              disabled={snoozing}
            >
              <Clock size={14} weight="bold" aria-hidden />
              {snoozing ? 'Snoozing…' : 'Snooze 24h'}
            </Button>
          )}
          {onUpdate && !isCaretaker && !isDone && !editing && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={openEditor}
            >
              <PencilSimple size={14} weight="bold" aria-hidden />
              Edit
            </Button>
          )}
          {photoError && (
            <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{photoError}</p>
          )}
        </div>
        {showRemove && (
          <InlineConfirm
            label="Remove"
            confirmLabel="Yes, remove"
            question={`Remove "${task.title}"?`}
            onConfirm={() => onRemove(task.id)}
          />
        )}
      </div>

      {editing && onUpdate && (
        <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3">
          <Field label="Title">
            {(id) => (
              <TextInput
                id={id}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Weight">
              {(id) => (
                <Select
                  id={id}
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value as TaskWeight)}
                >
                  <option value="light">Light</option>
                  <option value="heavy">Heavy</option>
                </Select>
              )}
            </Field>
            <Field label="Due">
              {(id) => (
                <TextInput
                  id={id}
                  type="datetime-local"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                />
              )}
            </Field>
          </div>
          {editError && (
            <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{editError}</p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(false)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

export const TaskCard = memo(TaskCardImpl);
