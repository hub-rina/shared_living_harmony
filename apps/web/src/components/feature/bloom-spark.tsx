'use client';

import { useEffect, useRef } from 'react';
import type { TaskBloomOrigin } from '@/lib/task-bloom';

interface BloomSparkProps {
  from: TaskBloomOrigin;
  to: TaskBloomOrigin;
  onDone: () => void;
}

const TRAVEL_MS = 720;

export function BloomSpark({ from, to, onDone }: BloomSparkProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      onDone();
      return;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const arc = -Math.max(40, Math.abs(dy) * 0.4);
    const animation = el.animate(
      [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 0.95 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + arc}px) scale(1.35)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: TRAVEL_MS, easing: 'cubic-bezier(0.34, 0.2, 0.2, 1)', fill: 'forwards' },
    );
    animation.onfinish = onDone;
    animation.oncancel = onDone;
    return () => animation.cancel();
  }, [from, to, onDone]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed z-50 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: from.x,
        top: from.y,
        background:
          'radial-gradient(circle, var(--color-mood-harmonized, #8fb98f) 0%, rgba(143,185,143,0.6) 45%, transparent 75%)',
        boxShadow: '0 0 14px 6px rgba(143,185,143,0.55)',
      }}
    />
  );
}
