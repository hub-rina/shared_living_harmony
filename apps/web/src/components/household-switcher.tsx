'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';

export function HouseholdSwitcher({ activeId }: { activeId: string }) {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;
  if (user.memberships.length <= 1) return null;

  return (
    <nav
      aria-label="Switch household"
      className="-mx-1 mb-4 flex gap-2 overflow-x-auto pb-1"
    >
      {user.memberships.map((m) => {
        const active = m.householdId === activeId;
        return (
          <button
            key={m.householdId}
            type="button"
            onClick={() => router.push(`/h/${m.householdId}`)}
            aria-pressed={active}
            className={`mx-1 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors min-h-11 ${
              active
                ? 'border-[var(--accent)] bg-[var(--accent)] text-cream'
                : 'border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--accent-wash)]'
            }`}
          >
            {m.householdName}
            {m.status === 'inactive' ? ' (away)' : ''}
          </button>
        );
      })}
    </nav>
  );
}
