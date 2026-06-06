'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { authStore } from '@/lib/auth-store';

export default function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = authStore.getAccessToken();
    if (!token) {
      router.replace(`/register?join=${encodeURIComponent(code)}`);
      return;
    }
    apiClient.households
      .join({ code })
      .then((house) => router.replace(`/h/${house.id}/today`))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/register?join=${encodeURIComponent(code)}`);
          return;
        }
        setStatus('error');
      });
  }, [code, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      {status === 'working' ? (
        <p role="status" aria-live="polite" className="text-sm text-[var(--text-mute)]">
          Joining the house…
        </p>
      ) : (
        <>
          <h1 role="alert" className="text-xl font-bold tracking-tight">
            That code didn’t match a house
          </h1>
          <p className="max-w-prose text-sm text-[var(--text-mute)]">
            Ask your housemate for the current code, then try again from the welcome screen.
          </p>
          <Button type="button" className="mt-2" onClick={() => router.replace('/welcome')}>
            Go to welcome
          </Button>
        </>
      )}
    </main>
  );
}
