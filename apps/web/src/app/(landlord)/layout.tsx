'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/use-auth';
import { HoomaLockup } from '@/components/brand/hooma-lockup';
import { HoomaLoader } from '@/components/brand/hooma-loader';

export default function LandlordLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.properties.length === 0) { router.replace('/pick'); return; }
  }, [loading, user, router]);

  if (loading || !user || user.properties.length === 0) {
    return <HoomaLoader label="Opening the portal" />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-6 py-6">
      <header className="flex items-center justify-between border-b border-ink/10 pb-4 dark:border-cream-shade/15">
        <div className="flex items-center gap-2">
          <HoomaLockup tone="sage" size="sm" />
          <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-sage-900 dark:bg-sage-900/40 dark:text-sage-100">
            Property Manager
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-mute dark:text-cream-shade/70">{user.email}</span>
          <button
            onClick={() => signOut().then(() => router.replace('/login'))}
            className="rounded-md border border-ink/15 px-3 py-1.5 transition-colors hover:bg-cream-shade dark:border-cream-shade/20 dark:hover:bg-cocoa-shade"
          >
            Sign out
          </button>
        </div>
      </header>
      <section className="flex-1 py-8">{children}</section>
    </div>
  );
}
