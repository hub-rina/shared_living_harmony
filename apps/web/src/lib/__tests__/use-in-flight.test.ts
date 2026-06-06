import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInFlight } from '../use-in-flight';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useInFlight', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useInFlight());
    expect(result.current.pending).toBe(false);
  });

  it('locks out a second run while the first is in flight', async () => {
    const { result } = renderHook(() => useInFlight());
    const d = deferred<void>();
    const work = vi.fn(() => d.promise);

    act(() => {
      void result.current.run(work);
      void result.current.run(work);
      void result.current.run(work);
    });

    expect(work).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve();
    });
  });

  it('reports pending while work runs and clears it after', async () => {
    const { result } = renderHook(() => useInFlight());
    const d = deferred<void>();

    act(() => {
      void result.current.run(() => d.promise);
    });
    expect(result.current.pending).toBe(true);

    await act(async () => {
      d.resolve();
    });
    expect(result.current.pending).toBe(false);
  });

  it('allows another run after the previous one finishes', async () => {
    const { result } = renderHook(() => useInFlight());
    const work = vi.fn(async () => {});

    await act(async () => {
      await result.current.run(work);
    });
    await act(async () => {
      await result.current.run(work);
    });

    expect(work).toHaveBeenCalledTimes(2);
  });

  it('clears pending even when work throws', async () => {
    const { result } = renderHook(() => useInFlight());

    await act(async () => {
      await result.current
        .run(async () => {
          throw new Error('boom');
        })
        .catch(() => {});
    });

    expect(result.current.pending).toBe(false);
  });
});
