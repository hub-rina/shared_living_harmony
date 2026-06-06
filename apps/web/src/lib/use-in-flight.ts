'use client';

import { useCallback, useRef, useState } from 'react';

interface InFlight {
  pending: boolean;
  run: (work: () => Promise<unknown>) => Promise<void>;
}

/**
 * Component-level guard against double submits. A `disabled` button only reflects
 * its new state on the next React render, so a burst of rapid taps fires several
 * handlers before the button visibly disables. The ref lock blocks re-entry
 * synchronously; `pending` drives the disabled state and busy label.
 */
export function useInFlight(): InFlight {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async (work: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      await work();
    } finally {
      lock.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}
