type Guard = <T>(key: string, work: () => Promise<T>) => Promise<T>;

/**
 * Synchronous de-duplication of async actions by key. While a call for a key is
 * in flight, any further call with the same key returns the same promise instead
 * of starting new work. The disabled-button guards in the UI only take effect on
 * the next React render, so a burst of rapid taps can fire several handlers before
 * the button visibly disables; this closes that window at the data layer.
 */
export function createInFlightGuard(): Guard {
  const pending = new Map<string, Promise<unknown>>();

  return function run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;

    const promise = work();
    pending.set(key, promise);
    return promise.finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
    }) as Promise<T>;
  };
}
