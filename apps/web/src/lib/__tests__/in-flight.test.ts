import { describe, expect, it, vi } from 'vitest';
import { createInFlightGuard } from '../in-flight';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createInFlightGuard', () => {
  it('runs the work once for concurrent calls with the same key', async () => {
    const guard = createInFlightGuard();
    const work = vi.fn(() => deferred<string>().promise);

    guard('create-task', work);
    guard('create-task', work);
    guard('create-task', work);

    expect(work).toHaveBeenCalledTimes(1);
  });

  it('returns the same in-flight promise to every concurrent caller', async () => {
    const guard = createInFlightGuard();
    const d = deferred<string>();
    const work = vi.fn(() => d.promise);

    const first = guard('k', work);
    const second = guard('k', work);
    d.resolve('done');

    await expect(first).resolves.toBe('done');
    await expect(second).resolves.toBe('done');
  });

  it('allows a new run once the previous one resolves', async () => {
    const guard = createInFlightGuard();
    const work = vi.fn(async () => 'ok');

    await guard('k', work);
    await guard('k', work);

    expect(work).toHaveBeenCalledTimes(2);
  });

  it('clears the key after rejection so the action can be retried', async () => {
    const guard = createInFlightGuard();
    const failing = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(guard('k', failing)).rejects.toThrow('boom');
    await expect(guard('k', failing)).rejects.toThrow('boom');

    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('runs different keys independently', () => {
    const guard = createInFlightGuard();
    const a = vi.fn(() => deferred<void>().promise);
    const b = vi.fn(() => deferred<void>().promise);

    guard('a', a);
    guard('b', b);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
