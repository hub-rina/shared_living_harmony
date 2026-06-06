import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  households: {
    getScope: vi.fn(),
    get: vi.fn(),
  },
  tasks: {
    listForHousehold: vi.fn(),
    mine: vi.fn(),
    create: vi.fn(),
    complete: vi.fn(),
  },
  rituals: {
    listForHousehold: vi.fn(),
  },
}));

vi.mock('../api', () => ({
  apiClient: apiMock,
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../haptics', () => ({ haptic: vi.fn() }));
vi.mock('../offline-queue', () => ({
  isOffline: () => false,
  enqueue: vi.fn(),
  flushQueue: vi.fn(async () => 0),
}));

import { HouseholdProvider, useHousehold } from '../household-context';

const scope = {
  householdId: 'h1',
  userId: 'u1',
  systemRole: 'user' as const,
  membership: { id: 'm1', role: 'admin' as const, status: 'active' as const },
};

function makeTask(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    title: `Task ${id}`,
    weight: 'light',
    status: 'open',
    kind: 'routine',
    dueAt: '2026-06-01T00:00:00.000Z',
    assigneeId: 'u1',
    assignee: { id: 'u1', name: 'Alice' },
    caretakerOwned: false,
    snoozeUsed: false,
    ...over,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <HouseholdProvider householdId="h1">{children}</HouseholdProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.households.getScope.mockResolvedValue({ scope });
  apiMock.households.get.mockResolvedValue({ id: 'h1', name: 'Demo House' });
  apiMock.tasks.listForHousehold.mockResolvedValue([makeTask('t1')]);
  apiMock.tasks.mine.mockResolvedValue([makeTask('t1')]);
  apiMock.rituals.listForHousehold.mockResolvedValue([]);
  apiMock.tasks.complete.mockResolvedValue(makeTask('t1', { status: 'completed' }));
  apiMock.tasks.create.mockImplementation(async (_h: string, input: Record<string, unknown>) =>
    makeTask('new', input),
  );
});

async function mountContext() {
  const { result } = renderHook(() => useHousehold(), { wrapper });
  await waitFor(() => expect(result.current).toBeTruthy());
  return result;
}

describe('HouseholdProvider mutations', () => {
  it('fires a single complete request for concurrent calls of the same task', async () => {
    const result = await mountContext();

    await act(async () => {
      await Promise.all([
        result.current.completeTask('t1'),
        result.current.completeTask('t1'),
        result.current.completeTask('t1'),
      ]);
    });

    expect(apiMock.tasks.complete).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch scope on refresh after a mutation', async () => {
    const result = await mountContext();
    apiMock.households.getScope.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(apiMock.households.getScope).not.toHaveBeenCalled();
  });
});
