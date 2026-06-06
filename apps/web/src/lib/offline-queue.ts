'use client';

import { apiClient } from './api';

// A tiny IndexedDB-backed queue for write actions taken while offline. Actions
// are replayed in order on reconnect. We only queue completions and mess flags —
// the two actions a user is most likely to take away from a good connection.

export type QueuedAction =
  | { type: 'complete'; householdId: string; taskId: string; photoDataUrl?: string }
  | { type: 'flag'; householdId: string; title?: string; photoDataUrl: string };

type QueuedRecord = QueuedAction & { id: number };

const DB_NAME = 'hooma-offline';
const STORE = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function enqueue(action: QueuedAction): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = tx(db, 'readwrite').add(action);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  notify();
}

export async function queuedCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = tx(db, 'readonly').count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allQueued(): Promise<QueuedRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = tx(db, 'readonly').getAll();
    request.onsuccess = () => resolve(request.result as QueuedRecord[]);
    request.onerror = () => reject(request.error);
  });
}

async function remove(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = tx(db, 'readwrite').delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function replay(record: QueuedRecord): Promise<void> {
  if (record.type === 'complete') {
    await apiClient.tasks.complete(
      record.householdId,
      record.taskId,
      record.photoDataUrl ? { photoDataUrl: record.photoDataUrl } : {},
    );
    return;
  }
  await apiClient.tasks.flagMess(record.householdId, {
    photoDataUrl: record.photoDataUrl,
    ...(record.title ? { title: record.title } : {}),
  });
}

let flushing = false;

// Replays queued actions oldest-first. Stops at the first failure so a still-down
// network or a transient error leaves the rest of the queue intact for next time.
export async function flushQueue(): Promise<number> {
  if (flushing || isOffline()) return 0;
  flushing = true;
  let synced = 0;
  try {
    const records = await allQueued();
    for (const record of records.sort((a, b) => a.id - b.id)) {
      try {
        await replay(record);
        await remove(record.id);
        synced += 1;
        notify();
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return synced;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
