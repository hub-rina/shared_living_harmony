'use client';

import { LoginInputSchema } from '@homebuddy/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Field, PasswordInput, TextInput } from '@/components/ui';
import { HoomaLockup } from '@/components/brand/hooma-lockup';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const joinCode = search.get('join');
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = LoginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Enter a valid email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.login(parsed.data);
      setSession(res);
      if (joinCode) {
        try {
          const house = await apiClient.households.join({ code: joinCode });
          router.push(`/h/${house.id}/today`);
          return;
        } catch {
          // fall through to me-based routing
        }
      }
      const me = await apiClient.me();
      const firstProperty = me.properties[0];
      const firstMembership = me.memberships[0];
      if (firstProperty && me.memberships.length === 0) {
        router.push(`/properties/${firstProperty.propertyId}`);
      } else if (firstMembership) {
        router.push(`/h/${firstMembership.householdId}`);
      } else {
        router.push('/welcome');
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Sign in failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <HoomaLockup tone="sage" size="md" />
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Welcome back.</h1>
        <p className="mt-1 text-sm text-[var(--text-mute)]">Sign in to your home.</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

        <Field label="Password" required>
          {(id, describedBy) => (
            <PasswordInput
              id={id}
              aria-describedby={describedBy}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {error && (
          <p className="text-sm text-[color:var(--color-state-danger)]" role="alert">{error}</p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-sm text-[var(--text-mute)]">
        No account?{' '}
        <Link href={joinCode ? `/register?join=${encodeURIComponent(joinCode)}` : '/register'} className="font-semibold text-[var(--accent)] hover:underline">
          Create one
        </Link>
        .
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
