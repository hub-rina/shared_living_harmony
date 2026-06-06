'use client';

import Link from 'next/link';
import { ArrowRight, HouseLine, Buildings, Plus } from '@phosphor-icons/react';
import { EmptyState, Skeleton, Tag } from '@/components/ui';
import { LittleHouse } from '@/components/illustration';
import { HoomaLogo } from '@/components/brand/hooma-logo';
import { useAuth } from '@/lib/use-auth';

export default function PickPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (!user) return null;

  const hasHomes = user.memberships.length > 0;
  const hasProperties = user.properties.length > 0;
  const hasNothing = !hasHomes && !hasProperties;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <HoomaLogo className="text-3xl" tone="sage" />
        <h1 className="text-3xl font-bold tracking-tight">Where to?</h1>
        <p className="text-sm text-[var(--text-mute)]">Pick a home to open, or start a new one.</p>
      </header>

      {hasNothing && (
        <EmptyState
          art={<LittleHouse size={160} />}
          title="No home yet"
          description="Create your first home or join one a roommate already made."
        />
      )}

      {hasHomes && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
            Where you live
          </h2>
          <ul className="flex flex-col gap-2">
            {user.memberships.map((m) => (
              <li key={m.householdId}>
                <Link
                  href={`/h/${m.householdId}`}
                  className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--surface-raised)]"
                >
                  <HouseLine size={22} weight="duotone" aria-hidden className="shrink-0 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold tracking-tight">{m.householdName}</span>
                    <span className="text-xs text-[var(--text-soft)]">
                      {m.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </span>
                  {m.status === 'inactive' && (
                    <Tag tone="sage" size="sm">Away</Tag>
                  )}
                  <ArrowRight
                    size={16}
                    weight="bold"
                    aria-hidden
                    className="shrink-0 text-[var(--text-soft)] transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasProperties && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
            Properties you manage
          </h2>
          <ul className="flex flex-col gap-2">
            {user.properties.map((p) => (
              <li key={p.propertyId}>
                <Link
                  href={`/properties/${p.propertyId}`}
                  className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--surface-raised)]"
                >
                  <Buildings size={22} weight="duotone" aria-hidden className="shrink-0 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1 truncate font-semibold tracking-tight">{p.householdName}</span>
                  <ArrowRight
                    size={16}
                    weight="bold"
                    aria-hidden
                    className="shrink-0 text-[var(--text-soft)] transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/welcome"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-cream transition-colors hover:bg-[var(--accent-hover)]"
      >
        <Plus size={16} weight="bold" aria-hidden />
        Create or join a home
      </Link>
    </main>
  );
}
