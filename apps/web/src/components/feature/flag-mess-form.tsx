'use client';

import type { FlagMessInput, Task } from '@homebuddy/shared';
import { Camera, CheckCircle } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { Button, Field, TextInput } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { useInFlight } from '@/lib/use-in-flight';
import { flagPrompts } from '@/lib/copy';
import { fileToResizedDataUrl } from '@/lib/photo';
import { PhotoDoodleEditor } from './photo-doodle-editor';

interface FlagMessFormProps {
  householdId: string;
  onFlagged: (task: Task) => Promise<void> | void;
}

export function FlagMessForm({ householdId, onFlagged }: FlagMessFormProps) {
  const [title, setTitle] = useState('');
  const { pending: submitting, run } = useInFlight();
  const [error, setError] = useState<string | null>(null);
  const [lastFlagged, setLastFlagged] = useState<Task | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  function openCamera() {
    setError(null);
    photoInputRef.current?.click();
  }

  async function handlePhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setPendingPhoto(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the photo.');
    }
  }

  async function submitFlag(photoDataUrl: string) {
    await run(async () => {
      setError(null);
      try {
        const input: FlagMessInput = {
          photoDataUrl,
          ...(title.trim() ? { title: title.trim() } : {}),
        };
        const task = await apiClient.tasks.flagMess(householdId, input);
        setLastFlagged(task);
        setTitle('');
        setPendingPhoto(null);
        void onFlagged(task);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Could not flag the mess.',
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-4" role="region" aria-label="Flag a mess">
      <p className="max-w-prose text-sm text-[var(--text-mute)]">
        Snap a photo of anything that needs fixing. We turn it into a heavy chore and assign it fairly.
      </p>

      <Field label="What is the mess?" hint="Optional. We will fill in a name if you skip this.">
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dishes piling up"
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick prompts">
        {flagPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setTitle(prompt)}
            aria-pressed={title === prompt}
            className={`min-h-8 rounded-full border px-3 text-xs font-medium tracking-tight transition-colors ${
              title === prompt
                ? 'border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent-hover)]'
                : 'border-[var(--border)] text-[var(--text-mute)] hover:text-[var(--foreground)]'
            }`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {pendingPhoto ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--text-mute)]">Add a doodle or sticker, then send it off.</p>
          <PhotoDoodleEditor
            imageDataUrl={pendingPhoto}
            onCancel={() => setPendingPhoto(null)}
            onDone={submitFlag}
          />
          {submitting && <p className="text-xs text-[var(--text-mute)]">Flagging…</p>}
        </div>
      ) : (
        <Button type="button" variant="warning" onClick={openCamera} disabled={submitting}>
          <Camera size={16} weight="bold" aria-hidden />
          Snap the mess
        </Button>
      )}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoChosen}
        className="hidden"
        aria-hidden
      />

      {error && (
        <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      {lastFlagged && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-xs"
        >
          <CheckCircle
            size={18}
            weight="duotone"
            aria-hidden
            className="mt-0.5 shrink-0 text-[color:var(--color-mood-stable)]"
          />
          <div>
            <p className="font-semibold">Flagged: {lastFlagged.title}</p>
            <p className="text-[var(--text-mute)]">
              Assigned to <span className="font-semibold text-[var(--foreground)]">{lastFlagged.assignee.name}</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
