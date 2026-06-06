/**
 * When a chore is completed, the card emits its on-screen position so a host
 * surface (the Today page) can fly a spark of energy into the Energy Core.
 * Surfaces without the Core simply ignore the event — completion still works.
 */

export const TASK_BLOOM_EVENT = 'hb:task-bloom';

export interface TaskBloomOrigin {
  x: number;
  y: number;
}

export function emitTaskBloom(origin: TaskBloomOrigin): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<TaskBloomOrigin>(TASK_BLOOM_EVENT, { detail: origin }));
}

export function elementCenter(el: Element): TaskBloomOrigin {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
