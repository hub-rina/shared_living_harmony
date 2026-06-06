'use client';

import { useEffect } from 'react';

// Registers the service worker in production only. A `?nosw` query param is an
// escape hatch: it unregisters every worker and clears caches, so a bad deploy
// can never permanently brick the always-live URL.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (window.location.search.includes('nosw')) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister()));
      if (window.caches) caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      return;
    }

    if (process.env.NODE_ENV !== 'production') return;

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A registration failure must never break the app — fail silent.
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
