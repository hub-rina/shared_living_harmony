'use client';

import { RegisterInputSchema } from '@homebuddy/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Field, PasswordInput, TextInput } from '@/components/ui';
import { HoomaLockup } from '@/components/brand/hooma-lockup';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const joinCode = search.get('join');
  const { setSession } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = RegisterInputSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first?.message ?? 'Check the form and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.register(parsed.data);
      setSession(res);
      if (joinCode) {
        try {
          const house = await apiClient.households.join({ code: joinCode });
          router.push(`/h/${house.id}/today`);
          return;
        } catch {
          // fall through to welcome
        }
      }
      router.push('/welcome');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create your account.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <HoomaLockup tone="sage" size="md" />
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Create your account.</h1>
        <p className="mt-1 text-sm text-[var(--text-mute)]">Start sharing the load with your housemates.</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Name" required>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Field label="Email" required>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Field label="Password" hint="8 characters or more." required>
          {(id, describedBy) => (
            <PasswordInput
              id={id}
              aria-describedby={describedBy}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {error && (
          <p className="text-sm text-[color:var(--color-state-danger)]" role="alert">{error}</p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>

      <p className="text-sm text-[var(--text-mute)]">
        Already have an account?{' '}
        <Link href={joinCode ? `/login?join=${encodeURIComponent(joinCode)}` : '/login'} className="font-semibold text-[var(--accent)] hover:underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
