'use client';

import type {
  CreateRitualInput,
  Household,
  HouseholdScope,
  Ritual,
  Task,
  UpdateTaskInput,
} from '@homebuddy/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, ApiError } from './api';
import { createInFlightGuard } from './in-flight';
import { haptic } from './haptics';
import { enqueue, flushQueue, isOffline } from './offline-queue';
import { HoomaLoader } from '@/components/brand/hooma-loader';

const isNetworkFailure = (err: unknown): boolean => !(err instanceof ApiError);

interface HouseholdContextValue {
  householdId: string;
  household: Household | null;
  scope: HouseholdScope;
  householdTasks: Task[];
  householdRituals: Ritual[];
  myTasks: Task[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  completeTask: (taskId: string, photoDataUrl?: string) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  snoozeTask: (taskId: string) => Promise<void>;
  createRitual: (input: CreateRitualInput) => Promise<void>;
  joinRitual: (ritualId: string) => Promise<void>;
  completeRitual: (ritualId: string) => Promise<{ bloomTriggered: boolean }>;
  flagMess: (input: { title?: string; photoDataUrl: string }) => Promise<void>;
}

const Ctx = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  householdId,
  children,
}: {
  householdId: string;
  children: ReactNode;
}) {
  const [scope, setScope] = useState<HouseholdScope | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdTasks, setHouseholdTasks] = useState<Task[]>([]);
  const [householdRituals, setHouseholdRituals] = useState<Ritual[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guard = useRef(createInFlightGuard()).current;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [house, tasks, mine, rituals] = await Promise.all([
        apiClient.households.get(householdId),
        apiClient.tasks.listForHousehold(householdId),
        apiClient.tasks.mine(householdId),
        apiClient.rituals.listForHousehold(householdId),
      ]);
      setHousehold(house);
      setHouseholdTasks(tasks);
      setMyTasks(mine);
      setHouseholdRituals(rituals);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not refresh this home');
    } finally {
      setRefreshing(false);
    }
  }, [householdId]);

  const loadInitial = useCallback(async () => {
    setRefreshing(true);
    try {
      const [scopeRes, house, tasks, mine, rituals] = await Promise.all([
        apiClient.households.getScope(householdId),
        apiClient.households.get(householdId),
        apiClient.tasks.listForHousehold(householdId),
        apiClient.tasks.mine(householdId),
        apiClient.rituals.listForHousehold(householdId),
      ]);
      setScope(scopeRes.scope);
      setHousehold(house);
      setHouseholdTasks(tasks);
      setMyTasks(mine);
      setHouseholdRituals(rituals);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this home');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  const markCompletedLocally = useCallback((taskId: string) => {
    setHouseholdTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)),
    );
    setMyTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const completeTask = useCallback((taskId: string, photoDataUrl?: string) =>
    guard(`complete:${taskId}`, async () => {
      const action = { type: 'complete' as const, householdId, taskId, ...(photoDataUrl ? { photoDataUrl } : {}) };
      if (isOffline()) {
        await enqueue(action);
        haptic('success');
        markCompletedLocally(taskId);
        return;
      }
      try {
        await apiClient.tasks.complete(householdId, taskId, photoDataUrl ? { photoDataUrl } : {});
      } catch (err) {
        if (isNetworkFailure(err)) {
          await enqueue(action);
          haptic('success');
          markCompletedLocally(taskId);
          return;
        }
        throw err;
      }
      haptic('success');
      markCompletedLocally(taskId);
      void refresh();
    }), [householdId, refresh, markCompletedLocally, guard]);

  const removeTask = useCallback((taskId: string) =>
    guard(`remove:${taskId}`, async () => {
      await apiClient.tasks.remove(householdId, taskId);
      setHouseholdTasks((prev) => prev.filter((t) => t.id !== taskId));
      setMyTasks((prev) => prev.filter((t) => t.id !== taskId));
      void refresh();
    }), [householdId, refresh, guard]);

  const updateTask = useCallback((taskId: string, input: UpdateTaskInput) =>
    guard(`update:${taskId}`, async () => {
      const updated = await apiClient.tasks.update(householdId, taskId, input);
      setHouseholdTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setMyTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      void refresh();
    }), [householdId, refresh, guard]);

  const snoozeTask = useCallback((taskId: string) =>
    guard(`snooze:${taskId}`, async () => {
      const updated = await apiClient.tasks.snooze(householdId, taskId);
      setHouseholdTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      void refresh();
    }), [householdId, refresh, guard]);

  const createRitual = useCallback((input: CreateRitualInput) =>
    guard('create-ritual', async () => {
      const ritual = await apiClient.rituals.create(householdId, input);
      setHouseholdRituals((prev) => [...prev, ritual]);
      void refresh();
    }), [householdId, refresh, guard]);

  const joinRitual = useCallback((ritualId: string) =>
    guard(`join-ritual:${ritualId}`, async () => {
      const ritual = await apiClient.rituals.join(householdId, ritualId);
      setHouseholdRituals((prev) => prev.map((r) => (r.id === ritualId ? ritual : r)));
      void refresh();
    }), [householdId, refresh, guard]);

  const completeRitual = useCallback((ritualId: string) =>
    guard(`complete-ritual:${ritualId}`, async () => {
      const response = await apiClient.rituals.complete(householdId, ritualId);
      haptic(response.bloomTriggered ? 'bloom' : 'success');
      void refresh();
      return { bloomTriggered: response.bloomTriggered };
    }), [householdId, refresh, guard]);

  const flagMess = useCallback((input: { title?: string; photoDataUrl: string }) =>
    guard('flag-mess', async () => {
      const action = { type: 'flag' as const, householdId, photoDataUrl: input.photoDataUrl, ...(input.title ? { title: input.title } : {}) };
      if (isOffline()) {
        await enqueue(action);
        return;
      }
      try {
        await apiClient.tasks.flagMess(householdId, input);
      } catch (err) {
        if (isNetworkFailure(err)) {
          await enqueue(action);
          return;
        }
        throw err;
      }
      void refresh();
    }), [householdId, refresh, guard]);

  useEffect(() => {
    const syncNow = () => {
      void flushQueue().then((synced) => {
        if (synced > 0) void refresh();
      });
    };
    window.addEventListener('online', syncNow);
    syncNow();
    return () => window.removeEventListener('online', syncNow);
  }, [refresh]);

  const value: HouseholdContextValue | null = useMemo(
    () =>
      scope
        ? {
            householdId,
            household,
            scope,
            householdTasks,
            householdRituals,
            myTasks,
            loading,
            refreshing,
            error,
            refresh,
            completeTask,
            removeTask,
            updateTask,
            snoozeTask,
            createRitual,
            joinRitual,
            completeRitual,
            flagMess,
          }
        : null,
    [
      householdId, household, scope, householdTasks, householdRituals, myTasks,
      loading, refreshing, error, refresh, completeTask, removeTask, updateTask,
      snoozeTask, createRitual, joinRitual, completeRitual, flagMess,
    ],
  );

  if (loading && !scope) {
    return <HoomaLoader label="Opening your home" />;
  }
  if (!scope) {
    return (
      <div style={{ padding: '2rem' }}>
        Could not load this home. <a href="/pick">Pick another</a>.
      </div>
    );
  }
  return <Ctx.Provider value={value!}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>');
  return ctx;
}
