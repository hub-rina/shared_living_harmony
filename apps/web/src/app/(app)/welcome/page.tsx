'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, TextInput } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';

export default function WelcomePage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createHouse(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('create');
    setError(null);
    try {
      const house = await apiClient.households.create({ name: name.trim() });
      await refresh();
      router.push(`/h/${house.id}/today`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the house.');
    } finally {
      setBusy(null);
    }
  }

  async function joinHouse(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy('join');
    setError(null);
    try {
      const house = await apiClient.households.join({ code: code.trim() });
      await refresh();
      router.push(`/h/${house.id}/today`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join that house.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Welcome</p>
        <h1 className="text-3xl font-bold tracking-tight">Let's set up your home.</h1>
        <p className="text-sm text-[var(--text-mute)]">Start a house, or join one your roommates already made.</p>
      </header>

      {error && (
        <p className="text-sm text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <form onSubmit={createHouse} className="flex flex-col gap-4" aria-label="Create a house">
            <h2 className="text-lg font-semibold tracking-tight">Create a house</h2>
            <Field label="House name" required>
              {(id, describedBy) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kot 12"
                  required
                />
              )}
            </Field>
            <Button type="submit" disabled={busy !== null || !name.trim()}>
              {busy === 'create' ? 'Creating…' : 'Create house'}
            </Button>
            <p className="text-xs text-[var(--text-soft)]">You become the admin and get a code to share.</p>
          </form>
        </Card>

        <Card surface="wash">
          <form onSubmit={joinHouse} className="flex flex-col gap-4" aria-label="Join a house">
            <h2 className="text-lg font-semibold tracking-tight">Join a house</h2>
            <Field label="Join code" hint="Your housemate can share it." required>
              {(id, describedBy) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="SAGE-7K3"
                  autoCapitalize="characters"
                  required
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" disabled={busy !== null || !code.trim()}>
              {busy === 'join' ? 'Joining…' : 'Join house'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
