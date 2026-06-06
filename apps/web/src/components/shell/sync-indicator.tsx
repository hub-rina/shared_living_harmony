'use client';

import { CloudArrowUp, CloudSlash } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { queuedCount, subscribe } from '@/lib/offline-queue';

export function SyncIndicator() {
  const [count, setCount] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const refresh = () => {
      queuedCount()
        .then(setCount)
        .catch(() => {});
    };
    const onOnline = () => {
      setOffline(false);
      refresh();
    };
    const onOffline = () => setOffline(true);

    setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    const unsubscribe = subscribe(refresh);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    refresh();

    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline && count === 0) return null;

  const plural = count === 1 ? '' : 's';
  const label = offline
    ? count > 0
      ? `Offline — ${count} action${plural} saved`
      : 'Offline'
    : `Syncing ${count} action${plural}…`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-1.5 text-xs font-medium text-[var(--text-mute)] shadow-sm backdrop-blur"
    >
      {offline ? (
        <CloudSlash size={14} weight="bold" aria-hidden />
      ) : (
        <CloudArrowUp size={14} weight="bold" aria-hidden className="text-[color:var(--color-mood-stable)]" />
      )}
      {label}
    </div>
  );
}
