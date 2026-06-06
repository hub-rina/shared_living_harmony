'use client';

import {
  CheckSquare,
  HouseLine,
  Receipt,
  Sparkle,
  UserCircle,
  Users,
  type Icon,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/use-auth';
import { HoomaLockup } from '@/components/brand/hooma-lockup';
import { HoomaLoader } from '@/components/brand/hooma-loader';
import { SyncIndicator } from './sync-indicator';

interface NavItem {
  segment: string;
  label: string;
  blurb: string;
  icon: Icon;
}

const NAV_SEGMENTS: readonly NavItem[] = [
  { segment: 'today',   label: 'Today',   blurb: 'What needs you',      icon: HouseLine },
  { segment: 'tasks',   label: 'Tasks',   blurb: 'Household chores',    icon: CheckSquare },
  { segment: 'rituals', label: 'Rituals', blurb: 'Build the home',      icon: Sparkle },
  { segment: 'money',   label: 'Money',   blurb: 'Share the costs',     icon: Receipt },
  { segment: 'house',   label: 'House',   blurb: 'Members and homes',   icon: Users },
  { segment: 'you',     label: 'You',     blurb: 'Profile and sign out', icon: UserCircle },
];

function extractHouseholdId(pathname: string): string | null {
  const match = /\/h\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

function NavLinks({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const pathname = usePathname() ?? '';
  const householdId = extractHouseholdId(pathname);
  const layoutCls =
    orientation === 'vertical'
      ? 'flex flex-col gap-1'
      : 'grid grid-cols-6 gap-1 px-2 py-2';

  return (
    <ul className={layoutCls}>
      {NAV_SEGMENTS.map((item) => {
        const href = householdId ? `/h/${householdId}/${item.segment}` : '/pick';
        const active = pathname.includes(`/${item.segment}`);
        const IconCmp = item.icon;
        if (orientation === 'vertical') {
          return (
            <li key={item.segment}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-[var(--accent-wash)] text-[var(--accent-hover)]'
                    : 'text-[var(--text-mute)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]'
                }`}
              >
                <IconCmp
                  size={22}
                  weight={active ? 'duotone' : 'regular'}
                  aria-hidden
                  className="shrink-0"
                />
                <span className="flex min-w-0 flex-col gap-0">
                  <span className="font-semibold tracking-tight">{item.label}</span>
                  <span className="text-xs text-[var(--text-soft)]">{item.blurb}</span>
                </span>
              </Link>
            </li>
          );
        }
        return (
          <li key={item.segment}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={`${item.label}. ${item.blurb}`}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-[var(--accent-wash)] text-[var(--accent-hover)]'
                  : 'text-[var(--text-mute)] hover:text-[var(--foreground)]'
              }`}
            >
              <IconCmp
                size={22}
                weight={active ? 'duotone' : 'regular'}
                aria-hidden
              />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main>
        <HoomaLoader />
      </main>
    );
  }

  return (
    <div className="min-h-dvh text-[var(--foreground)]">
      <SyncIndicator />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-[var(--accent)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-cream"
      >
        Skip to main content
      </a>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
        <header className="lg:col-span-2 lg:flex lg:items-center lg:justify-between lg:border-b lg:border-[var(--border)] lg:pb-4">
          <Link href="/" className="inline-flex items-center" aria-label="hooma home">
            <HoomaLockup tone="sage" size="md" />
          </Link>
        </header>

        <aside className="hidden lg:block">
          <nav aria-label="Primary" className="sticky top-10">
            <NavLinks orientation="vertical" />
          </nav>
        </aside>

        <main id="main" className="flex flex-col gap-6 pb-24 lg:pb-0">
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:hidden"
      >
        <NavLinks orientation="horizontal" />
      </nav>
    </div>
  );
}
